import { db } from "@/lib/db";
import { z } from "zod";
import type { AuthContext } from "@/lib/auth-context";
import { ServiceError } from "@/lib/service-error";
import {
  canUpdateParticipation,
  isReunionPast,
} from "@/lib/services/reunions/reunion-helpers";
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
 * Aligné sur `confirmerParticipationReunion` (Web) :
 * - statut réunion DateConfirmee uniquement ;
 * - valeurs Present | Absent | Excuse ;
 * - identité via actor.userId → Adherent (anti-IDOR).
 *
 * Refus supplémentaire côté API mobile : réunion passée (contrôle serveur).
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

    const reunion = await db.reunionMensuelle.findUnique({
      where: { id: reunionId },
      select: {
        id: true,
        statut: true,
        dateReunion: true,
      },
    });

    if (!reunion) {
      throw new ServiceError("NOT_FOUND", "Réunion non trouvée");
    }

    if (reunion.statut !== "DateConfirmee") {
      throw new ServiceError(
        "FORBIDDEN",
        "La date de la réunion n'est pas encore confirmée. Vous pourrez confirmer votre présence une fois la date validée."
      );
    }

    if (!reunion.dateReunion || isReunionPast(reunion.dateReunion)) {
      throw new ServiceError(
        "FORBIDDEN",
        "Cette réunion est passée. Vous ne pouvez plus modifier votre participation."
      );
    }

    if (
      !canUpdateParticipation({
        statut: reunion.statut,
        dateReunion: reunion.dateReunion,
      })
    ) {
      throw new ServiceError(
        "FORBIDDEN",
        "Modification de participation non autorisée pour cette réunion."
      );
    }

    const participation = await db.participationReunion.upsert({
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

    return { statut: participation.statut };
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    console.error("[updateMyReunionParticipation] Erreur:", error);
    throw new ServiceError(
      "INTERNAL_ERROR",
      "Erreur lors de la mise à jour de la participation"
    );
  }
}
