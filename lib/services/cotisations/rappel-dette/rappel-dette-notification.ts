import { TypeNotification } from "@prisma/client";
import { db } from "@/lib/db";
import { acquireAdherentRowLock } from "@/lib/services/cotisations/rappel-dette/adherent-lock";
import { RAPPEL_DETTE_TEMPLATE_DETAIL_LINK_CONTRACT } from "@/lib/services/cotisations/rappel-dette/payload-fingerprint";

/**
 * Convention d’appel **interne** (même sémantique que l’email-outcome) :
 * signal de forme pour l’adaptateur serveur — **pas** une authentification.
 * Ce module n’est **pas** réexporté par le barrel `rappel-dette/index.ts`.
 * Aucune action HTTP / paramètre client ne doit l’appeler avec un payload fabriqué.
 */
export type EnsureRappelDetteNotificationCaller = {
  kind: "server_adapter";
  correlationId?: string;
};

/**
 * Contenu neutre — aucun montant, email, ni détail financier sensible.
 */
export const RAPPEL_DETTE_NOTIFICATION_TITRE = "Rappel de cotisation";

export const RAPPEL_DETTE_NOTIFICATION_MESSAGE =
  "Un rappel concernant votre situation de cotisation vous a été adressé. Consultez votre espace adhérent pour en savoir plus.";

/**
 * Contrat de lien authentifié futur (catalogue template).
 * **Pas** une route HTTP réelle — branchement UI bloqué tant que
 * `RAPPEL_DETTE_NOTIFICATION_LIEN_ROUTE_READY` est false.
 */
export const RAPPEL_DETTE_NOTIFICATION_LIEN_CONTRACT =
  RAPPEL_DETTE_TEMPLATE_DETAIL_LINK_CONTRACT;

/**
 * Blocage explicite : aucune route membre/admin n’est arrêtée pour le détail rappel.
 * Tant que false, le champ `Notification.lien` reste `null` (pas d’invention de path).
 */
export const RAPPEL_DETTE_NOTIFICATION_LIEN_ROUTE_READY = false as const;

export type EnsureRappelDetteNotificationInput = {
  caller: EnsureRappelDetteNotificationCaller | null | undefined;
  envoiId: string;
  adherentId: string;
  /** Horloge après acquisition du verrou. */
  getNow?: () => Date;
};

export type EnsureRappelDetteNotificationSuccess = {
  ok: true;
  outcome: "created" | "idempotent";
  envoiId: string;
  adherentId: string;
  notifStatus: "Created";
  notificationId: string | null;
  notificationCreatedAt: Date;
  closedAt: Date;
  emailAcceptedAt: Date;
  /** true si traces ops présentes (conservées, non modifiées). */
  opsTracesPreserved: boolean;
};

export type EnsureRappelDetteNotificationFailure = {
  ok: false;
  code:
    | "FORBIDDEN"
    | "VALIDATION_ERROR"
    | "NOT_FOUND"
    | "INVALID_STATE"
    | "CONFLICT"
    | "NOTIF_MARKED_FAILED"
    | "NOTIF_FAILED_MARK_UNCERTAIN"
    | "INTERNAL_ERROR";
  message: string;
};

export type EnsureRappelDetteNotificationResult =
  | EnsureRappelDetteNotificationSuccess
  | EnsureRappelDetteNotificationFailure;

function fail(
  code: EnsureRappelDetteNotificationFailure["code"],
  message: string
): EnsureRappelDetteNotificationFailure {
  return { ok: false, code, message };
}

function assertServerCaller(
  caller: EnsureRappelDetteNotificationCaller | null | undefined
): EnsureRappelDetteNotificationFailure | null {
  if (!caller || caller.kind !== "server_adapter") {
    return fail(
      "FORBIDDEN",
      "Persistance notification réservée à l’adaptateur serveur"
    );
  }
  return null;
}

function resolveNotificationLien(): string | null {
  if (!RAPPEL_DETTE_NOTIFICATION_LIEN_ROUTE_READY) {
    return null;
  }
  // Branchement futur uniquement quand la route authentifiée sera figée.
  return null;
}

type CreateTxSuccess = EnsureRappelDetteNotificationSuccess;

/**
 * Marque `notifStatus=Failed` sous verrou, sans écraser un `Created` concurrent.
 * Transaction **séparée** de la création.
 *
 * @returns true si Failed persisté ; false si aucune ligne (ex. Created concurrent) ;
 *   throw si erreur technique
 */
async function markNotifFailedUnderLock(params: {
  envoiId: string;
  adherentId: string;
  getNow?: () => Date;
}): Promise<"marked" | "skipped_concurrent_created" | "not_applicable"> {
  return db.$transaction(async (tx) => {
    const locked = await acquireAdherentRowLock(tx, params.adherentId);
    if (!locked) {
      throw new Error("adherent_missing_on_fail_mark");
    }
    const now = params.getNow?.() ?? new Date();
    const envoi = await tx.rappelDetteEnvoi.findUnique({
      where: { id: params.envoiId },
    });
    if (!envoi || envoi.adherentId !== params.adherentId) {
      throw new Error("envoi_missing_on_fail_mark");
    }
    if (
      envoi.reservationStatus !== "Completed" ||
      envoi.emailStatus !== "Accepted" ||
      !envoi.emailAcceptedAt
    ) {
      return "not_applicable";
    }
    if (envoi.notifStatus === "Created" && envoi.notificationCreatedAt) {
      return "skipped_concurrent_created";
    }

    const updated = await tx.rappelDetteEnvoi.updateMany({
      where: {
        id: params.envoiId,
        adherentId: params.adherentId,
        reservationStatus: "Completed",
        emailStatus: "Accepted",
        notificationCreatedAt: null,
        notifStatus: { in: ["NotStarted", "Failed"] },
      },
      data: {
        notifStatus: "Failed",
        closedAt: now,
        notificationId: null,
        // preuve email / unknownAt / reconciled* inchangés
      },
    });

    if (updated.count === 1) {
      return "marked";
    }

    // Relecture : Created concurrent ?
    const again = await tx.rappelDetteEnvoi.findUnique({
      where: { id: params.envoiId },
    });
    if (
      again &&
      again.notifStatus === "Created" &&
      again.notificationCreatedAt
    ) {
      return "skipped_concurrent_created";
    }
    return "not_applicable";
  });
}

/**
 * Crée ou reprend la notification interne après email Accepted (sans push).
 * Chemin : `tx.notification.create` exclusif — **jamais** `createNotification`
 * (qui déclenche `pushAfterInternalNotification`).
 *
 * @param input - Appelant adaptateur, cible envoi/adhérent
 */
export async function ensureRappelDetteInternalNotification(
  input: EnsureRappelDetteNotificationInput
): Promise<EnsureRappelDetteNotificationResult> {
  const denied = assertServerCaller(input.caller);
  if (denied) return denied;

  const envoiId = String(input.envoiId ?? "").trim();
  const adherentId = String(input.adherentId ?? "").trim();
  if (!envoiId || !adherentId) {
    return fail("VALIDATION_ERROR", "Identifiants requis");
  }

  const pendingLog: { current: "created" | "idempotent" | null } = {
    current: null,
  };

  try {
    const result = await db.$transaction(async (tx) => {
      const locked = await acquireAdherentRowLock(tx, adherentId);
      if (!locked) {
        return fail("NOT_FOUND", "Adhérent introuvable");
      }

      const now = input.getNow?.() ?? new Date();

      const envoi = await tx.rappelDetteEnvoi.findUnique({
        where: { id: envoiId },
      });
      if (!envoi || envoi.adherentId !== adherentId) {
        return fail("NOT_FOUND", "Tentative introuvable");
      }

      if (envoi.reservationStatus === "Reserved") {
        return fail("INVALID_STATE", "Notification refusée depuis Reserved");
      }
      if (envoi.reservationStatus === "Calling") {
        return fail("INVALID_STATE", "Notification refusée depuis Calling");
      }
      if (envoi.reservationStatus === "Unknown") {
        return fail("INVALID_STATE", "Notification refusée depuis Unknown");
      }
      if (envoi.reservationStatus === "Failed") {
        return fail("INVALID_STATE", "Notification refusée depuis Failed");
      }
      if (envoi.reservationStatus === "Abandoned") {
        return fail("INVALID_STATE", "Notification refusée depuis Abandoned");
      }
      if (envoi.reservationStatus !== "Completed") {
        return fail("INVALID_STATE", "État de tentative non supporté");
      }

      if (
        envoi.emailStatus !== "Accepted" ||
        envoi.emailAcceptedAt == null
      ) {
        return fail(
          "INVALID_STATE",
          "Preuve email Accepted requise avant notification"
        );
      }

      // ——— Idempotence : preuve Created durable (même si lien notificationId purgé) ———
      if (
        envoi.notifStatus === "Created" &&
        envoi.notificationCreatedAt != null
      ) {
        pendingLog.current = "idempotent";
        return {
          ok: true as const,
          outcome: "idempotent" as const,
          envoiId: envoi.id,
          adherentId: envoi.adherentId,
          notifStatus: "Created" as const,
          notificationId: envoi.notificationId,
          notificationCreatedAt: envoi.notificationCreatedAt,
          closedAt: envoi.closedAt ?? envoi.notificationCreatedAt,
          emailAcceptedAt: envoi.emailAcceptedAt,
          opsTracesPreserved: Boolean(
            envoi.unknownAt ||
              envoi.reconciledAt ||
              envoi.reconciledByUserId ||
              envoi.reconciliationDecisionCode
          ),
        } satisfies CreateTxSuccess;
      }

      // ——— Création / reprise Failed sans preuve ———
      if (
        envoi.notifStatus !== "NotStarted" &&
        envoi.notifStatus !== "Failed"
      ) {
        return fail("INVALID_STATE", "État notification non supporté");
      }
      if (envoi.notificationCreatedAt != null) {
        // Invariant CHECK : NotStarted/Failed n’ont pas de preuve — conflit explicite.
        return fail(
          "CONFLICT",
          "Preuve notification incohérente — aucune écriture"
        );
      }

      const preservedEmailAcceptedAt = envoi.emailAcceptedAt;
      const preservedUnknownAt = envoi.unknownAt;
      const preservedReconciledAt = envoi.reconciledAt;
      const preservedReconciledBy = envoi.reconciledByUserId;
      const preservedReconCode = envoi.reconciliationDecisionCode;

      const notif = await tx.notification.create({
        data: {
          userId: envoi.recipientUserId,
          type: TypeNotification.Cotisation,
          titre: RAPPEL_DETTE_NOTIFICATION_TITRE,
          message: RAPPEL_DETTE_NOTIFICATION_MESSAGE,
          lien: resolveNotificationLien(),
          lue: false,
        },
      });

      const updated = await tx.rappelDetteEnvoi.updateMany({
        where: {
          id: envoiId,
          adherentId,
          reservationStatus: "Completed",
          emailStatus: "Accepted",
          notificationCreatedAt: null,
          notifStatus: { in: ["NotStarted", "Failed"] },
        },
        data: {
          notificationId: notif.id,
          notificationCreatedAt: now,
          notifStatus: "Created",
          closedAt: now,
          // emailAcceptedAt / unknownAt / reconciled* non touchés
        },
      });

      if (updated.count !== 1) {
        // Annule création + lien (rollback TX).
        throw new Error("rappel_dette_notif_link_cas_failed");
      }

      pendingLog.current = "created";
      return {
        ok: true as const,
        outcome: "created" as const,
        envoiId,
        adherentId,
        notifStatus: "Created" as const,
        notificationId: notif.id,
        notificationCreatedAt: now,
        closedAt: now,
        emailAcceptedAt: preservedEmailAcceptedAt,
        opsTracesPreserved: Boolean(
          preservedUnknownAt ||
            preservedReconciledAt ||
            preservedReconciledBy ||
            preservedReconCode
        ),
      } satisfies CreateTxSuccess;
    });

    if (result.ok && pendingLog.current) {
      console.error("[ensureRappelDetteInternalNotification]", {
        category: "notif_outcome",
        kind: pendingLog.current,
        envoiIdLength: envoiId.length,
        lienContract: RAPPEL_DETTE_NOTIFICATION_LIEN_CONTRACT,
        lienRouteReady: RAPPEL_DETTE_NOTIFICATION_LIEN_ROUTE_READY,
      });
    }

    return result;
  } catch (error) {
    console.error("[ensureRappelDetteInternalNotification]", {
      category: "transaction_error",
      envoiIdLength: envoiId.length,
      name: error instanceof Error ? error.name : "unknown",
    });

    // TX création annulée — tenter marquage Failed séparé, sans écraser Created.
    try {
      const mark = await markNotifFailedUnderLock({
        envoiId,
        adherentId,
        getNow: input.getNow,
      });
      if (mark === "marked") {
        console.error("[ensureRappelDetteInternalNotification]", {
          category: "notif_marked_failed",
          envoiIdLength: envoiId.length,
        });
        return fail(
          "NOTIF_MARKED_FAILED",
          "Création notification échouée — notifStatus=Failed enregistré (reprise manuelle, sans renvoi email)"
        );
      }
      if (mark === "skipped_concurrent_created") {
        return fail(
          "CONFLICT",
          "Création concurrente déjà Created — aucune rétrogradation"
        );
      }
      return fail(
        "NOTIF_FAILED_MARK_UNCERTAIN",
        "Échec création ; marquage Failed non applicable — état technique à vérifier (pas de renvoi email)"
      );
    } catch (markError) {
      console.error("[ensureRappelDetteInternalNotification]", {
        category: "notif_fail_mark_error",
        envoiIdLength: envoiId.length,
        name: markError instanceof Error ? markError.name : "unknown",
      });
      return fail(
        "NOTIF_FAILED_MARK_UNCERTAIN",
        "Échec création et marquage Failed non confirmé — incertitude technique (pas de renvoi email)"
      );
    }
  }
}
