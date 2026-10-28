import type { Prisma } from "@prisma/client";
import type { AuthContext } from "@/lib/auth-context";
import { db } from "@/lib/db";
import { acquireAdherentRowLock } from "@/lib/services/cotisations/rappel-dette/adherent-lock";
import { computeDetteRappelable } from "@/lib/services/cotisations/rappel-dette/compute-dette-rappelable";
import {
  computeRappelDetteFingerprint,
  normalizeRecipientEmail,
  resolveTemplateDetailLinkContract,
  type RappelDetteFingerprintLine,
  RAPPEL_DETTE_TEMPLATE_DETAIL_LINK_CONTRACT,
} from "@/lib/services/cotisations/rappel-dette/payload-fingerprint";
import { canAccessPreviewRappelsDette } from "@/lib/services/cotisations/rappel-dette/preview-access";

/**
 * TTL local **proposé** pour une réservation `Reserved` (15 minutes).
 * Injectable en tests via `reservedTtlMs`. **Pas** une décision produit figée.
 */
export const RAPPEL_DETTE_RESERVED_TTL_MS = 15 * 60 * 1000;

export const RAPPEL_DETTE_RESERVATION_ACCESS_DENIED_MESSAGE =
  "Réservation de rappel réservée aux administrateurs et au président." as const;

/**
 * Sort d’une réservation `Reserved` après un refus pré-Calling
 * (inéligibilité, drift, gel, erreur technique) :
 * - **reste `Reserved`** jusqu’à TTL (`Abandoned` explicite) ou nouvelle confirmation
 *   avec **nouvelle** clé + empreinte ;
 * - **aucun** remplacement silencieux du snapshot ;
 * - **aucune** libération implicite sur simple refus.
 *
 * Le verrou adhérent de cette TX **ne bloque pas** automatiquement tous les
 * producteurs de paiements hors de cette transaction : pas d’isolation totale
 * annoncée contre les autres modules.
 */
export const RAPPEL_DETTE_RESERVED_ON_PRECALLING_REFUSAL =
  "remains_reserved_until_ttl_or_reconfirm" as const;

export type ReserveRappelDetteActor = Pick<AuthContext, "userId" | "role">;

export type ReserveRappelDetteInput = {
  actor: ReserveRappelDetteActor | null | undefined;
  adherentId: string;
  /** UUID fourni une fois par geste de confirmation UI. */
  clientConfirmationId: string;
  /** Empreinte présentée à la confirmation — recalculée serveur, jamais montants client. */
  expectedFingerprint: string;
  /**
   * Version template **catalogue serveur** (interne).
   * Pas librement pilotable par un futur formulaire hors catalogue
   * {@link resolveTemplateDetailLinkContract}.
   */
  templateVersion: string;
  /** TTL Reserved (ms). Défaut : {@link RAPPEL_DETTE_RESERVED_TTL_MS}. */
  reservedTtlMs?: number;
  /**
   * Horloge appelée **après** acquisition du verrou
   * (tests : avancer l’horloge pendant l’attente simulée).
   */
  getNow?: () => Date;
  /** Gels serveur internes — jamais depuis HTTP client. */
  frozenAdherent?: boolean;
  frozenLineKeys?: ReadonlySet<string>;
};

export type ReserveRappelDetteSuccess = {
  ok: true;
  outcome: "created" | "idempotent";
  envoiId: string;
  adherentId: string;
  reservationStatus:
    | "Reserved"
    | "Calling"
    | "Completed"
    | "Failed"
    | "Abandoned"
    | "Unknown";
  lockExpiresAt: Date;
  payloadFingerprint: string;
  templateVersion: string;
  /** Contrat dérivé du catalogue pour `templateVersion` (reconstructible). */
  templateDetailLinkContract: string;
  /** Toujours false : ce module n’effectue aucun appel fournisseur. */
  providerCallAuthorized: false;
};

export type ReserveRappelDetteFailure = {
  ok: false;
  code:
    | "UNAUTHENTICATED"
    | "FORBIDDEN"
    | "VALIDATION_ERROR"
    | "NOT_FOUND"
    | "CONFLICT"
    | "REQUIRES_RECONFIRM"
    | "NOT_ELIGIBLE"
    | "BLOCKED_ATTEMPT"
    | "UNRESOLVED_UNCERTAINTY"
    | "COMPUTE_ERROR"
    | "INTERNAL_ERROR";
  message: string;
};

export type ReserveRappelDetteResult =
  | ReserveRappelDetteSuccess
  | ReserveRappelDetteFailure;

export type AuthorizeCallingInput = {
  actor: ReserveRappelDetteActor | null | undefined;
  envoiId: string;
  adherentId: string;
  getNow?: () => Date;
  /** Gels serveur au moment du passage Calling (recalcul sous verrou). */
  frozenAdherent?: boolean;
  frozenLineKeys?: ReadonlySet<string>;
};

export type AuthorizeCallingSuccess = {
  ok: true;
  outcome: "authorized" | "already_started";
  envoiId: string;
  adherentId: string;
  reservationStatus: "Calling";
  /**
   * true uniquement lors du premier passage Reserved → Calling **après**
   * contrôles pré-Calling réussis.
   * false si déjà Calling, ou jamais sur un refus.
   * Ce module n’effectue **aucun** appel fournisseur.
   */
  providerCallAuthorized: boolean;
  callingAt: Date;
};

export type AuthorizeCallingFailure = {
  ok: false;
  code:
    | "UNAUTHENTICATED"
    | "FORBIDDEN"
    | "VALIDATION_ERROR"
    | "NOT_FOUND"
    | "CONFLICT"
    | "EXPIRED"
    | "REQUIRES_RECONFIRM"
    | "NOT_ELIGIBLE"
    | "COMPUTE_ERROR"
    | "INTERNAL_ERROR";
  message: string;
  /**
   * Présent sur refus métier pré-Calling : la ligne reste `Reserved`
   * (pas de libération implicite). Voir {@link RAPPEL_DETTE_RESERVED_ON_PRECALLING_REFUSAL}.
   */
  reservedFate?: typeof RAPPEL_DETTE_RESERVED_ON_PRECALLING_REFUSAL;
};

export type AuthorizeCallingResult =
  | AuthorizeCallingSuccess
  | AuthorizeCallingFailure;

function failReserve(
  code: ReserveRappelDetteFailure["code"],
  message: string
): ReserveRappelDetteFailure {
  return { ok: false, code, message };
}

function failCalling(
  code: AuthorizeCallingFailure["code"],
  message: string,
  reservedFate?: AuthorizeCallingFailure["reservedFate"]
): AuthorizeCallingFailure {
  return reservedFate
    ? { ok: false, code, message, reservedFate }
    : { ok: false, code, message };
}

/**
 * Garde acteur ADMIN|PRESID avant toute lecture métier / transaction.
 *
 * @param actor - Contexte acteur
 */
function assertReservationActor(
  actor: ReserveRappelDetteActor | null | undefined
): ReserveRappelDetteFailure | null {
  if (!actor?.userId || String(actor.userId).trim() === "") {
    return failReserve("UNAUTHENTICATED", "Non authentifié");
  }
  if (!canAccessPreviewRappelsDette(actor.role)) {
    return failReserve(
      "FORBIDDEN",
      RAPPEL_DETTE_RESERVATION_ACCESS_DENIED_MESSAGE
    );
  }
  return null;
}

function validateConfirmationId(id: string): boolean {
  const t = id.trim();
  return t.length >= 8 && t.length <= 64;
}

type RecipientSnapshot = {
  recipientUserId: string;
  recipientEmail: string;
};

/**
 * Relit le destinataire sous le même `tx` (après verrou).
 *
 * @param tx - Client transactionnel
 * @param adherentId - Cible
 */
function isReserveFailure(
  value: RecipientSnapshot | ReserveRappelDetteFailure
): value is ReserveRappelDetteFailure {
  return "ok" in value && value.ok === false;
}

async function loadRecipientUnderTx(
  tx: Prisma.TransactionClient,
  adherentId: string
): Promise<RecipientSnapshot | ReserveRappelDetteFailure> {
  const adherent = await tx.adherent.findUnique({
    where: { id: adherentId },
    select: {
      id: true,
      userId: true,
      User: { select: { id: true, email: true, status: true } },
    },
  });
  if (!adherent?.User?.id) {
    return failReserve("NOT_FOUND", "Adhérent introuvable");
  }
  const rawEmail = adherent.User.email;
  if (!rawEmail || String(rawEmail).trim() === "") {
    return failReserve(
      "VALIDATION_ERROR",
      "Adresse email destinataire indisponible"
    );
  }
  return {
    recipientUserId: adherent.User.id,
    recipientEmail: normalizeRecipientEmail(rawEmail),
  };
}

/**
 * Réserve une tentative d’envoi (`Reserved`) sous verrou adhérent.
 * `templateVersion` / contrat = paramètres **serveur internes** (catalogue).
 * Aucun email / notification / push.
 *
 * @param input - Acteur, cible, clé de confirmation, empreinte attendue
 */
export async function reserveRappelDetteEnvoi(
  input: ReserveRappelDetteInput
): Promise<ReserveRappelDetteResult> {
  const denied = assertReservationActor(input.actor);
  if (denied) return denied;

  const actor = input.actor!;
  const adherentId = String(input.adherentId ?? "").trim();
  const clientConfirmationId = String(input.clientConfirmationId ?? "").trim();
  const expectedFingerprint = String(input.expectedFingerprint ?? "").trim();
  const templateVersion = String(input.templateVersion ?? "").trim();

  if (!adherentId) {
    return failReserve("VALIDATION_ERROR", "Adhérent requis");
  }
  if (!validateConfirmationId(clientConfirmationId)) {
    return failReserve("VALIDATION_ERROR", "Clé de confirmation invalide");
  }
  if (!expectedFingerprint || expectedFingerprint.length > 128) {
    return failReserve("VALIDATION_ERROR", "Empreinte invalide");
  }
  if (!templateVersion || templateVersion.length > 64) {
    return failReserve("VALIDATION_ERROR", "Version de template invalide");
  }

  const templateDetailLinkContract =
    resolveTemplateDetailLinkContract(templateVersion);
  if (!templateDetailLinkContract) {
    return failReserve(
      "VALIDATION_ERROR",
      "Version de template hors catalogue serveur"
    );
  }

  const reservedTtlMs = input.reservedTtlMs ?? RAPPEL_DETTE_RESERVED_TTL_MS;
  if (!Number.isFinite(reservedTtlMs) || reservedTtlMs <= 0) {
    return failReserve("VALIDATION_ERROR", "TTL de réservation invalide");
  }

  try {
    return await db.$transaction(async (tx) => {
      const locked = await acquireAdherentRowLock(tx, adherentId);
      if (!locked) {
        return failReserve("NOT_FOUND", "Adhérent introuvable");
      }

      // Horloge de référence après verrou (peut différer si attente du verrou).
      const now = input.getNow?.() ?? new Date();

      const existingByKey = await tx.rappelDetteEnvoi.findUnique({
        where: { clientConfirmationId },
      });
      if (existingByKey) {
        const sameTarget = existingByKey.adherentId === adherentId;
        const sameFp =
          existingByKey.payloadFingerprint === expectedFingerprint;
        const sameTemplate =
          existingByKey.templateVersion === templateVersion;
        // Contrat dérivé du catalogue : incohérence version ⇒ conflit générique.
        const existingContract = resolveTemplateDetailLinkContract(
          existingByKey.templateVersion
        );
        const sameContract =
          existingContract === templateDetailLinkContract &&
          existingContract != null;
        if (sameTarget && sameFp && sameTemplate && sameContract) {
          return {
            ok: true as const,
            outcome: "idempotent" as const,
            envoiId: existingByKey.id,
            adherentId: existingByKey.adherentId,
            reservationStatus: existingByKey.reservationStatus,
            lockExpiresAt: existingByKey.lockExpiresAt,
            payloadFingerprint: existingByKey.payloadFingerprint,
            templateVersion: existingByKey.templateVersion,
            templateDetailLinkContract,
            providerCallAuthorized: false as const,
          };
        }
        return failReserve(
          "CONFLICT",
          "Conflit de confirmation — nouvelle tentative refusée"
        );
      }

      const blocking = await tx.rappelDetteEnvoi.findFirst({
        where: {
          adherentId,
          reservationStatus: { in: ["Reserved", "Calling", "Unknown"] },
        },
        orderBy: { reservedAt: "desc" },
      });

      if (blocking) {
        if (blocking.reservationStatus === "Unknown") {
          return failReserve(
            "UNRESOLVED_UNCERTAINTY",
            "Tentative incertaine en cours — réservation refusée"
          );
        }
        if (blocking.reservationStatus === "Calling") {
          return failReserve(
            "BLOCKED_ATTEMPT",
            "Tentative déjà en cours — réservation refusée"
          );
        }
        if (blocking.lockExpiresAt.getTime() > now.getTime()) {
          return failReserve(
            "BLOCKED_ATTEMPT",
            "Réservation active — réservation refusée"
          );
        }
        await tx.rappelDetteEnvoi.update({
          where: { id: blocking.id },
          data: {
            reservationStatus: "Abandoned",
            closedAt: now,
          },
        });
      }

      const recipientOrFail = await loadRecipientUnderTx(tx, adherentId);
      if (isReserveFailure(recipientOrFail)) {
        return recipientOrFail;
      }
      const { recipientUserId, recipientEmail } = recipientOrFail;

      const compute = await computeDetteRappelable(adherentId, {
        prisma: tx,
        now,
        frozenAdherent: input.frozenAdherent,
        frozenLineKeys: input.frozenLineKeys,
      });

      if (compute.globalReasons.includes("PRISMA_ERROR")) {
        return failReserve(
          "COMPUTE_ERROR",
          "Échec du recalcul d’éligibilité"
        );
      }
      if (!compute.eligible) {
        return failReserve(
          "NOT_ELIGIBLE",
          "Adhérent non éligible au rappel"
        );
      }

      const { payload, fingerprint } = computeRappelDetteFingerprint({
        adherentId,
        recipientUserId,
        recipientEmail,
        templateVersion,
        templateDetailLinkContract,
        montantBrut: compute.montantBrut,
        avoirDisponible: compute.avoirDisponible,
        detteNette: compute.detteNette,
        retainedLines: compute.retainedLines,
      });

      if (fingerprint !== expectedFingerprint) {
        return failReserve(
          "REQUIRES_RECONFIRM",
          "Les données ont changé — nouvelle confirmation requise"
        );
      }

      const lockExpiresAt = new Date(now.getTime() + reservedTtlMs);
      const retainedLinesJson: RappelDetteFingerprintLine[] =
        payload.retainedLines;

      const created = await tx.rappelDetteEnvoi.create({
        data: {
          adherentId,
          createdByUserId: actor.userId,
          recipientUserId,
          recipientEmail,
          clientConfirmationId,
          payloadFingerprint: fingerprint,
          templateVersion,
          montantBrut: compute.montantBrut,
          avoirDisponible: compute.avoirDisponible,
          detteNette: compute.detteNette,
          retainedLinesJson,
          reservationStatus: "Reserved",
          emailStatus: "NotStarted",
          notifStatus: "NotStarted",
          reservedAt: now,
          lockExpiresAt,
        },
      });

      return {
        ok: true as const,
        outcome: "created" as const,
        envoiId: created.id,
        adherentId: created.adherentId,
        reservationStatus: "Reserved" as const,
        lockExpiresAt: created.lockExpiresAt,
        payloadFingerprint: created.payloadFingerprint,
        templateVersion: created.templateVersion,
        templateDetailLinkContract,
        providerCallAuthorized: false as const,
      };
    });
  } catch (error) {
    console.error("[reserveRappelDetteEnvoi]", {
      category: "transaction_error",
      adherentIdLength: adherentId.length,
      name: error instanceof Error ? error.name : "unknown",
    });
    return failReserve("INTERNAL_ERROR", "Échec de la réservation");
  }
}

/**
 * Autorise atomiquement Reserved → Calling sous verrou adhérent.
 * Avant transition : destinataire + recalcul + gels + empreinte du snapshot
 * confirmé ; refus sans `providerCallAuthorized` et sans libérer `Reserved`.
 * Aucun appel fournisseur.
 *
 * @param input - Acteur, envoi, cible, gels serveur
 */
export async function authorizeRappelDetteCalling(
  input: AuthorizeCallingInput
): Promise<AuthorizeCallingResult> {
  const denied = assertReservationActor(input.actor);
  if (denied) {
    return failCalling(
      denied.code === "FORBIDDEN" ? "FORBIDDEN" : "UNAUTHENTICATED",
      denied.message
    );
  }

  const envoiId = String(input.envoiId ?? "").trim();
  const adherentId = String(input.adherentId ?? "").trim();
  if (!envoiId || !adherentId) {
    return failCalling("VALIDATION_ERROR", "Identifiants requis");
  }

  try {
    return await db.$transaction(async (tx) => {
      const locked = await acquireAdherentRowLock(tx, adherentId);
      if (!locked) {
        return failCalling("NOT_FOUND", "Adhérent introuvable");
      }

      const now = input.getNow?.() ?? new Date();

      const envoi = await tx.rappelDetteEnvoi.findUnique({
        where: { id: envoiId },
      });
      if (!envoi || envoi.adherentId !== adherentId) {
        return failCalling("NOT_FOUND", "Tentative introuvable");
      }

      if (envoi.reservationStatus === "Calling") {
        return {
          ok: true as const,
          outcome: "already_started" as const,
          envoiId: envoi.id,
          adherentId: envoi.adherentId,
          reservationStatus: "Calling" as const,
          providerCallAuthorized: false,
          callingAt: envoi.callingAt ?? now,
        };
      }

      if (envoi.reservationStatus !== "Reserved") {
        return failCalling("CONFLICT", "Tentative non démarrable");
      }

      if (envoi.lockExpiresAt.getTime() <= now.getTime()) {
        return failCalling("EXPIRED", "Réservation expirée");
      }

      // ——— Contrôles juste avant Calling (même tx, horloge post-verrou) ———
      const recipientOrFail = await loadRecipientUnderTx(tx, adherentId);
      if (isReserveFailure(recipientOrFail)) {
        return failCalling(
          recipientOrFail.code === "NOT_FOUND"
            ? "NOT_FOUND"
            : "VALIDATION_ERROR",
          recipientOrFail.message,
          RAPPEL_DETTE_RESERVED_ON_PRECALLING_REFUSAL
        );
      }
      const { recipientUserId, recipientEmail } = recipientOrFail;

      const compute = await computeDetteRappelable(adherentId, {
        prisma: tx,
        now,
        frozenAdherent: input.frozenAdherent,
        frozenLineKeys: input.frozenLineKeys,
      });

      if (compute.globalReasons.includes("PRISMA_ERROR")) {
        return failCalling(
          "COMPUTE_ERROR",
          "Échec du recalcul pré-Calling",
          RAPPEL_DETTE_RESERVED_ON_PRECALLING_REFUSAL
        );
      }
      if (!compute.eligible) {
        return failCalling(
          "NOT_ELIGIBLE",
          "Adhérent non éligible au rappel",
          RAPPEL_DETTE_RESERVED_ON_PRECALLING_REFUSAL
        );
      }

      // Contrat dérivé de templateVersion persistée (catalogue immuable).
      const confirmedContract = resolveTemplateDetailLinkContract(
        envoi.templateVersion
      );
      if (!confirmedContract) {
        return failCalling(
          "COMPUTE_ERROR",
          "Version template hors catalogue à la relecture",
          RAPPEL_DETTE_RESERVED_ON_PRECALLING_REFUSAL
        );
      }

      // Empreinte reconstruite : template/contrat dérivés du snapshot +
      // destinataire/montants/lignes **recalculés** — pas de remplacement silencieux.
      const { fingerprint } = computeRappelDetteFingerprint({
        adherentId,
        recipientUserId,
        recipientEmail,
        templateVersion: envoi.templateVersion,
        templateDetailLinkContract: confirmedContract,
        montantBrut: compute.montantBrut,
        avoirDisponible: compute.avoirDisponible,
        detteNette: compute.detteNette,
        retainedLines: compute.retainedLines,
      });

      if (fingerprint !== envoi.payloadFingerprint) {
        return failCalling(
          "REQUIRES_RECONFIRM",
          "Les données ont changé — nouvelle confirmation requise",
          RAPPEL_DETTE_RESERVED_ON_PRECALLING_REFUSAL
        );
      }

      const updated = await tx.rappelDetteEnvoi.updateMany({
        where: {
          id: envoiId,
          adherentId,
          reservationStatus: "Reserved",
          lockExpiresAt: { gt: now },
          payloadFingerprint: envoi.payloadFingerprint,
        },
        data: {
          reservationStatus: "Calling",
          emailStatus: "Calling",
          callingAt: now,
        },
      });

      if (updated.count !== 1) {
        const again = await tx.rappelDetteEnvoi.findUnique({
          where: { id: envoiId },
        });
        if (again?.reservationStatus === "Calling") {
          return {
            ok: true as const,
            outcome: "already_started" as const,
            envoiId: again.id,
            adherentId: again.adherentId,
            reservationStatus: "Calling" as const,
            providerCallAuthorized: false,
            callingAt: again.callingAt ?? now,
          };
        }
        return failCalling("CONFLICT", "Tentative non démarrable");
      }

      return {
        ok: true as const,
        outcome: "authorized" as const,
        envoiId,
        adherentId,
        reservationStatus: "Calling" as const,
        providerCallAuthorized: true,
        callingAt: now,
      };
    });
  } catch (error) {
    console.error("[authorizeRappelDetteCalling]", {
      category: "transaction_error",
      envoiIdLength: envoiId.length,
      name: error instanceof Error ? error.name : "unknown",
    });
    return failCalling("INTERNAL_ERROR", "Échec de l’autorisation Calling");
  }
}

/** Réexport contrat lien détail pour les callers serveur. */
export { RAPPEL_DETTE_TEMPLATE_DETAIL_LINK_CONTRACT };

export type { RappelDetteFingerprintLine };
