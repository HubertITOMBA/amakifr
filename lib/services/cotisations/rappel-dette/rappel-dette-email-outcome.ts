import type { AuthContext } from "@/lib/auth-context";
import { db } from "@/lib/db";
import { acquireAdherentRowLock } from "@/lib/services/cotisations/rappel-dette/adherent-lock";

/**
 * Code technique borné (colonne `technicalResultCode`, max 64).
 * Pas de PII, pas de corps d’erreur fournisseur.
 */
export const RAPPEL_DETTE_TECHNICAL_CODE_PATTERN = /^[A-Z][A-Z0-9_]{0,63}$/;

/**
 * Sémantique de `emailAcceptedAt` :
 * instant où l’**acceptation fournisseur** a été observée et persistée —
 * **pas** l’heure de réservation, **pas** une preuve de livraison en boîte.
 */
export const RAPPEL_DETTE_EMAIL_ACCEPTED_AT_SEMANTICS =
  "provider_acceptance_observed" as const;

/**
 * Convention d’appel **interne** pour le futur adaptateur serveur.
 *
 * Ce n’est **pas** une authentification, **pas** une session, **pas** une
 * preuve d’acceptation fournisseur. C’est un signal de forme pour refuser
 * un câblage accidentel depuis une Server Action / handler HTTP qui
 * hydraterait `caller` / `outcome` depuis le client.
 *
 * Frontière réelle :
 * - ce module n’est **pas** réexporté par le barrel `rappel-dette/index.ts` ;
 * - le dépôt n’utilise pas le paquet `server-only` (aucune dépendance ajoutée) ;
 * - la convention serveur habituelle reste `"use server"` sur les actions ;
 * - **aucune** route HTTP / paramètre client ne doit appeler directement
 *   ce service avec un `outcome` fabriqué.
 */
export type PersistRappelDetteEmailOutcomeCaller = {
  kind: "server_adapter";
  /** Optionnel : corrélation logs (job) — pas de règle métier ni d’auth. */
  correlationId?: string;
};

/**
 * Résultat email discriminé fourni par le futur adaptateur serveur.
 * Ne pas dériver du booléen `sendEmail` actuel (non fiable).
 */
export type RappelDetteEmailOutcome =
  | { kind: "Accepted" }
  | { kind: "DefinitelyNotAccepted"; technicalCode: string }
  | { kind: "Unknown"; technicalCode: string };

export type RappelDetteNotifStatusResult =
  | "NotStarted"
  | "Created"
  | "Failed";

export type PersistRappelDetteEmailOutcomeInput = {
  caller: PersistRappelDetteEmailOutcomeCaller | null | undefined;
  envoiId: string;
  adherentId: string;
  outcome: RappelDetteEmailOutcome;
  /** Horloge après acquisition du verrou. */
  getNow?: () => Date;
  /**
   * Acteur optionnel (audit futur) — **non** utilisé comme garde d’accès.
   * La convention est `caller.kind === "server_adapter"` (voir JSDoc type).
   */
  actor?: Pick<AuthContext, "userId" | "role"> | null;
};

export type PersistRappelDetteEmailOutcomeSuccess = {
  ok: true;
  outcome: "persisted" | "idempotent";
  envoiId: string;
  adherentId: string;
  reservationStatus: "Completed" | "Failed" | "Unknown";
  emailStatus: "Accepted" | "DefinitelyNotAccepted" | "Unknown";
  emailAcceptedAt: Date | null;
  closedAt: Date | null;
  unknownAt: Date | null;
  notifStatus: RappelDetteNotifStatusResult;
};

export type PersistRappelDetteEmailOutcomeFailure = {
  ok: false;
  code:
    | "FORBIDDEN"
    | "VALIDATION_ERROR"
    | "NOT_FOUND"
    | "CONFLICT"
    | "INVALID_STATE"
    | "REQUIRES_OPS_RECONCILIATION"
    | "INTERNAL_ERROR";
  message: string;
};

export type PersistRappelDetteEmailOutcomeResult =
  | PersistRappelDetteEmailOutcomeSuccess
  | PersistRappelDetteEmailOutcomeFailure;

type PersistSuccessLog = {
  kind: "Accepted" | "DefinitelyNotAccepted" | "Unknown";
  technicalCode?: string;
};

function fail(
  code: PersistRappelDetteEmailOutcomeFailure["code"],
  message: string
): PersistRappelDetteEmailOutcomeFailure {
  return { ok: false, code, message };
}

/**
 * Valide un code technique borné.
 *
 * @param code - Code candidat
 */
export function isValidRappelDetteTechnicalCode(code: string): boolean {
  return RAPPEL_DETTE_TECHNICAL_CODE_PATTERN.test(code.trim());
}

function assertServerCaller(
  caller: PersistRappelDetteEmailOutcomeCaller | null | undefined
): PersistRappelDetteEmailOutcomeFailure | null {
  if (!caller || caller.kind !== "server_adapter") {
    return fail(
      "FORBIDDEN",
      "Persistance réservée à l’adaptateur serveur"
    );
  }
  return null;
}

function validateOutcome(
  outcome: RappelDetteEmailOutcome
): PersistRappelDetteEmailOutcomeFailure | null {
  if (!outcome || typeof outcome !== "object" || !("kind" in outcome)) {
    return fail("VALIDATION_ERROR", "Résultat email invalide");
  }
  if (outcome.kind === "Accepted") return null;
  if (
    outcome.kind === "DefinitelyNotAccepted" ||
    outcome.kind === "Unknown"
  ) {
    const code = String(outcome.technicalCode ?? "").trim();
    if (!isValidRappelDetteTechnicalCode(code)) {
      return fail("VALIDATION_ERROR", "Code technique invalide");
    }
    return null;
  }
  return fail("VALIDATION_ERROR", "Résultat email inconnu");
}

function sameOutcome(
  envoi: {
    reservationStatus: string;
    emailStatus: string;
  },
  outcome: RappelDetteEmailOutcome
): boolean {
  if (outcome.kind === "Accepted") {
    return (
      envoi.reservationStatus === "Completed" &&
      envoi.emailStatus === "Accepted"
    );
  }
  if (outcome.kind === "DefinitelyNotAccepted") {
    return (
      envoi.reservationStatus === "Failed" &&
      envoi.emailStatus === "DefinitelyNotAccepted"
    );
  }
  return (
    envoi.reservationStatus === "Unknown" && envoi.emailStatus === "Unknown"
  );
}

function asNotifStatus(value: string): RappelDetteNotifStatusResult {
  if (value === "Created" || value === "Failed" || value === "NotStarted") {
    return value;
  }
  // Invariant schéma : ne pas inventer d’autre statut.
  return "NotStarted";
}

/**
 * Persiste un résultat email typé sous verrou adhérent (TX courte).
 * Aucun appel fournisseur, aucune notification, aucun push.
 *
 * @param input - Appelant adaptateur, cible, résultat discriminé
 */
export async function persistRappelDetteEmailOutcome(
  input: PersistRappelDetteEmailOutcomeInput
): Promise<PersistRappelDetteEmailOutcomeResult> {
  const denied = assertServerCaller(input.caller);
  if (denied) return denied;

  const outcomeError = validateOutcome(input.outcome);
  if (outcomeError) return outcomeError;

  const envoiId = String(input.envoiId ?? "").trim();
  const adherentId = String(input.adherentId ?? "").trim();
  if (!envoiId || !adherentId) {
    return fail("VALIDATION_ERROR", "Identifiants requis");
  }

  const outcome = input.outcome;
  /**
   * Rempli seulement si la TX a produit un succès `persisted` ; journalisé après commit.
   * Objet mutable : les affectations dans le callback TX ne sont pas suivies par le narrowing
   * d’un `let` local (sinon `pendingPersistLog` serait réduit à `never` après le garde).
   */
  const pendingPersistLog: { current: PersistSuccessLog | null } = {
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

      // ——— États déjà terminaux / bloquants ———
      if (envoi.reservationStatus === "Reserved") {
        return fail("INVALID_STATE", "Résultat email refusé depuis Reserved");
      }
      if (envoi.reservationStatus === "Abandoned") {
        return fail("INVALID_STATE", "Résultat email refusé depuis Abandoned");
      }

      if (envoi.reservationStatus === "Unknown") {
        if (outcome.kind === "Unknown" && sameOutcome(envoi, outcome)) {
          return {
            ok: true as const,
            outcome: "idempotent" as const,
            envoiId: envoi.id,
            adherentId: envoi.adherentId,
            reservationStatus: "Unknown" as const,
            emailStatus: "Unknown" as const,
            emailAcceptedAt: envoi.emailAcceptedAt,
            closedAt: envoi.closedAt,
            unknownAt: envoi.unknownAt,
            notifStatus: asNotifStatus(envoi.notifStatus),
          };
        }
        // Accepted / Failed / autre après Unknown : pas de libération ici.
        return fail(
          "REQUIRES_OPS_RECONCILIATION",
          "Unknown bloquant — réconciliation ops tracée requise"
        );
      }

      if (envoi.reservationStatus === "Completed") {
        if (outcome.kind === "Accepted" && sameOutcome(envoi, outcome)) {
          return {
            ok: true as const,
            outcome: "idempotent" as const,
            envoiId: envoi.id,
            adherentId: envoi.adherentId,
            reservationStatus: "Completed" as const,
            emailStatus: "Accepted" as const,
            emailAcceptedAt: envoi.emailAcceptedAt,
            closedAt: envoi.closedAt,
            unknownAt: envoi.unknownAt,
            notifStatus: asNotifStatus(envoi.notifStatus),
          };
        }
        // Ne jamais rétrograder Accepted ni effacer la preuve.
        return fail(
          "CONFLICT",
          "Résultat contradictoire — aucune écriture"
        );
      }

      if (envoi.reservationStatus === "Failed") {
        if (
          outcome.kind === "DefinitelyNotAccepted" &&
          sameOutcome(envoi, outcome)
        ) {
          return {
            ok: true as const,
            outcome: "idempotent" as const,
            envoiId: envoi.id,
            adherentId: envoi.adherentId,
            reservationStatus: "Failed" as const,
            emailStatus: "DefinitelyNotAccepted" as const,
            emailAcceptedAt: null,
            closedAt: envoi.closedAt,
            unknownAt: envoi.unknownAt,
            notifStatus: asNotifStatus(envoi.notifStatus),
          };
        }
        return fail(
          "CONFLICT",
          "Résultat contradictoire — aucune écriture"
        );
      }

      if (envoi.reservationStatus !== "Calling") {
        return fail("INVALID_STATE", "État de tentative non supporté");
      }

      // ——— Transitions depuis Calling ———
      if (outcome.kind === "Accepted") {
        const updated = await tx.rappelDetteEnvoi.updateMany({
          where: {
            id: envoiId,
            adherentId,
            reservationStatus: "Calling",
          },
          data: {
            reservationStatus: "Completed",
            emailStatus: "Accepted",
            emailAcceptedAt: now,
            // notifStatus reste NotStarted ; closedAt reste null (reprise notif).
            notifStatus: "NotStarted",
            closedAt: null,
          },
        });
        if (updated.count !== 1) {
          return fail("CONFLICT", "Transition Calling→Accepted refusée");
        }
        pendingPersistLog.current = { kind: "Accepted" };
        return {
          ok: true as const,
          outcome: "persisted" as const,
          envoiId,
          adherentId,
          reservationStatus: "Completed" as const,
          emailStatus: "Accepted" as const,
          emailAcceptedAt: now,
          closedAt: null,
          unknownAt: null,
          notifStatus: "NotStarted" as const,
        };
      }

      if (outcome.kind === "DefinitelyNotAccepted") {
        const technicalCode = outcome.technicalCode.trim();
        const updated = await tx.rappelDetteEnvoi.updateMany({
          where: {
            id: envoiId,
            adherentId,
            reservationStatus: "Calling",
          },
          data: {
            reservationStatus: "Failed",
            emailStatus: "DefinitelyNotAccepted",
            closedAt: now,
            emailAcceptedAt: null,
            notifStatus: "NotStarted",
            technicalResultCode: technicalCode,
          },
        });
        if (updated.count !== 1) {
          return fail("CONFLICT", "Transition Calling→Failed refusée");
        }
        pendingPersistLog.current = {
          kind: "DefinitelyNotAccepted",
          technicalCode,
        };
        return {
          ok: true as const,
          outcome: "persisted" as const,
          envoiId,
          adherentId,
          reservationStatus: "Failed" as const,
          emailStatus: "DefinitelyNotAccepted" as const,
          emailAcceptedAt: null,
          closedAt: now,
          unknownAt: null,
          notifStatus: "NotStarted" as const,
        };
      }

      // Unknown
      const technicalCode = outcome.technicalCode.trim();
      const updated = await tx.rappelDetteEnvoi.updateMany({
        where: {
          id: envoiId,
          adherentId,
          reservationStatus: "Calling",
        },
        data: {
          reservationStatus: "Unknown",
          emailStatus: "Unknown",
          unknownAt: now,
          closedAt: null,
          emailAcceptedAt: null,
          notifStatus: "NotStarted",
          technicalResultCode: technicalCode,
          reconciledAt: null,
          reconciledByUserId: null,
          reconciliationDecisionCode: null,
        },
      });
      if (updated.count !== 1) {
        return fail("CONFLICT", "Transition Calling→Unknown refusée");
      }
      pendingPersistLog.current = { kind: "Unknown", technicalCode };
      return {
        ok: true as const,
        outcome: "persisted" as const,
        envoiId,
        adherentId,
        reservationStatus: "Unknown" as const,
        emailStatus: "Unknown" as const,
        emailAcceptedAt: null,
        closedAt: null,
        unknownAt: now,
        notifStatus: "NotStarted" as const,
      };
    });

    // Journalisation **après** résolution réussie de `$transaction` (commit OK).
    // Si le commit échoue après le callback, on tombe dans le catch — pas de succès durable.
    const persistLog = pendingPersistLog.current;
    if (result.ok && result.outcome === "persisted" && persistLog) {
      console.error("[persistRappelDetteEmailOutcome]", {
        category: "email_outcome_persisted",
        kind: persistLog.kind,
        ...(persistLog.technicalCode
          ? { technicalCode: persistLog.technicalCode }
          : {}),
        envoiIdLength: envoiId.length,
      });
    }

    return result;
  } catch (error) {
    console.error("[persistRappelDetteEmailOutcome]", {
      category: "transaction_error",
      envoiIdLength: envoiId.length,
      name: error instanceof Error ? error.name : "unknown",
    });
    return fail("INTERNAL_ERROR", "Échec de la persistance du résultat email");
  }
}
