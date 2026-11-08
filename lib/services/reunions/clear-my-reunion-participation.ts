import { db } from "@/lib/db";
import type { AuthContext } from "@/lib/auth-context";
import { ServiceError } from "@/lib/service-error";
import {
  ReunionParticipationNotWritableError,
  withReunionParticipationLocks,
  type ReunionLockTx,
} from "@/lib/services/reunions/reunion-row-lock";
import type { ClearMyReunionParticipationResult } from "@/lib/services/reunions/types";

/**
 * Retire la participation de l'adhérent authentifié (retour à « Non répondu »).
 *
 * Protocole : TX → verrou réunion → relecture → assert → verrou participation →
 * `deleteMany` via `tx`. Aucun appel externe sous verrou.
 *
 * Canonique : absence de ligne = Non répondu. Idempotent si aucune ligne.
 *
 * @throws {ServiceError} UNAUTHENTICATED | NOT_FOUND | FORBIDDEN | VALIDATION_ERROR | INTERNAL_ERROR
 */
export async function clearMyReunionParticipation(
  actor: AuthContext,
  reunionId: string
): Promise<ClearMyReunionParticipationResult> {
  if (!actor?.userId || String(actor.userId).trim() === "") {
    throw new ServiceError("UNAUTHENTICATED", "Non autorisé");
  }

  if (!reunionId || String(reunionId).trim() === "") {
    throw new ServiceError("VALIDATION_ERROR", "ID réunion requis");
  }

  try {
    const adherent = await db.adherent.findUnique({
      where: { userId: actor.userId },
      select: { id: true },
    });

    if (!adherent) {
      throw new ServiceError("NOT_FOUND", "Adhérent non trouvé");
    }

    const deleted = await db.$transaction(async (tx) => {
      return withReunionParticipationLocks(
        tx as unknown as ReunionLockTx,
        reunionId,
        [adherent.id],
        async () => {
          return tx.participationReunion.deleteMany({
            where: {
              reunionId,
              adherentId: adherent.id,
            },
          });
        }
      );
    });

    return {
      participationStatus: null,
      cleared: true,
      alreadyClear: deleted.count === 0,
    };
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    if (error instanceof ReunionParticipationNotWritableError) {
      if (error.message === "Réunion non trouvée") {
        throw new ServiceError("NOT_FOUND", "Réunion non trouvée");
      }
      throw new ServiceError("FORBIDDEN", error.message);
    }
    console.error("[clearMyReunionParticipation] Erreur:", error);
    throw new ServiceError(
      "INTERNAL_ERROR",
      "Erreur lors du retrait de la participation"
    );
  }
}
