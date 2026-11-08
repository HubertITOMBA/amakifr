import { db } from "@/lib/db";
import { z } from "zod";
import type { AuthContext } from "@/lib/auth-context";
import { ServiceError } from "@/lib/service-error";
import {
  ReunionParticipationNotWritableError,
  withReunionParticipationLocks,
  type ReunionLockTx,
} from "@/lib/services/reunions/reunion-row-lock";
import type {
  UpdateMyReunionParticipationInput,
  UpdateMyReunionParticipationResult,
} from "@/lib/services/reunions/types";

const ParticipationSchema = z.object({
  statut: z.enum(["Present", "Absent", "Excuse"], {
    errorMap: () => ({ message: "Statut de participation invalide" }),
  }),
});

/**
 * Met à jour la participation de l'adhérent authentifié à une réunion.
 *
 * Protocole : TX → verrou réunion → relecture statut/date → assert →
 * verrou participation (adherentId) → upsert via `tx`.
 * Aucun appel externe sous verrou.
 *
 * @throws {ServiceError} UNAUTHENTICATED | NOT_FOUND | FORBIDDEN | VALIDATION_ERROR | INTERNAL_ERROR
 */
export async function updateMyReunionParticipation(
  actor: AuthContext,
  reunionId: string,
  input: UpdateMyReunionParticipationInput
): Promise<UpdateMyReunionParticipationResult> {
  if (!actor?.userId || String(actor.userId).trim() === "") {
    throw new ServiceError("UNAUTHENTICATED", "Non autorisé");
  }

  const parsed = ParticipationSchema.safeParse(input);
  if (!parsed.success) {
    throw new ServiceError(
      "VALIDATION_ERROR",
      parsed.error.errors[0].message
    );
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

    const participation = await db.$transaction(async (tx) => {
      return withReunionParticipationLocks(
        tx as unknown as ReunionLockTx,
        reunionId,
        [adherent.id],
        async () => {
          const row = await tx.participationReunion.upsert({
            where: {
              reunionId_adherentId: {
                reunionId,
                adherentId: adherent.id,
              },
            },
            create: {
              reunionId,
              adherentId: adherent.id,
              statut: parsed.data.statut,
            },
            update: {
              statut: parsed.data.statut,
            },
            select: { statut: true },
          });
          return row;
        }
      );
    });

    return { statut: participation.statut };
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    if (error instanceof ReunionParticipationNotWritableError) {
      if (error.message === "Réunion non trouvée") {
        throw new ServiceError("NOT_FOUND", "Réunion non trouvée");
      }
      throw new ServiceError("FORBIDDEN", error.message);
    }
    console.error("[updateMyReunionParticipation] Erreur:", error);
    throw new ServiceError(
      "INTERNAL_ERROR",
      "Erreur lors de la mise à jour de la participation"
    );
  }
}
