import { db } from "@/lib/db";
import type { AuthContext } from "@/lib/auth-context";
import { ServiceError } from "@/lib/service-error";
import { canWithdrawAsReunionHost } from "@/lib/services/reunions/year-calendar-helpers";
import { hostWithdrawalLocationPatch } from "@/lib/services/reunions/reunion-helpers";
import {
  withReunionRowLock,
  type ReunionLockTx,
} from "@/lib/services/reunions/reunion-row-lock";
import type { WithdrawMyReunionHostProposalResult } from "@/lib/services/reunions/types";

/**
 * Désistement self-service de l'hôte authentifié.
 *
 * Protocole writers : TX → verrou réunion → relecture → update via `tx`
 * (EnAttente, date null). Aligné `desisterReunionMensuelle`.
 *
 * @throws {ServiceError} UNAUTHENTICATED | NOT_FOUND | FORBIDDEN | INTERNAL_ERROR
 */
export async function withdrawMyReunionHostProposal(
  actor: AuthContext,
  reunionId: string
): Promise<WithdrawMyReunionHostProposalResult> {
  if (!actor?.userId || String(actor.userId).trim() === "") {
    throw new ServiceError("UNAUTHENTICATED", "Non autorisé");
  }

  const id = String(reunionId ?? "").trim();
  if (!id) {
    throw new ServiceError("VALIDATION_ERROR", "Identifiant de réunion requis");
  }

  try {
    const adherent = await db.adherent.findUnique({
      where: { userId: actor.userId },
      select: { id: true },
    });

    if (!adherent) {
      throw new ServiceError("NOT_FOUND", "Adhérent non trouvé");
    }

    const updated = await db.$transaction(async (tx) => {
      return withReunionRowLock(
        tx as unknown as ReunionLockTx,
        id,
        async () => {
          const reunion = await tx.reunionMensuelle.findUnique({
            where: { id },
            select: {
              id: true,
              annee: true,
              mois: true,
              statut: true,
              dateReunion: true,
              adherentHoteId: true,
              typeLieu: true,
            },
          });

          if (!reunion) {
            throw new ServiceError("NOT_FOUND", "Réunion non trouvée");
          }

          if (!reunion.adherentHoteId) {
            throw new ServiceError(
              "FORBIDDEN",
              "Cette réunion n'a pas d'hôte assigné."
            );
          }

          if (reunion.adherentHoteId !== adherent.id) {
            throw new ServiceError(
              "FORBIDDEN",
              "Seul l'hôte de la réunion peut se désister."
            );
          }

          if (
            !canWithdrawAsReunionHost({
              isCurrentUserHost: true,
              dateReunion: reunion.dateReunion,
            })
          ) {
            throw new ServiceError(
              "FORBIDDEN",
              "Vous ne pouvez vous désister que si la réunion a lieu dans 28 jours ou plus. La date actuelle est à moins de 28 jours."
            );
          }

          return tx.reunionMensuelle.update({
            where: { id: reunion.id },
            data: {
              adherentHoteId: null,
              statut: "EnAttente",
              dateReunion: null,
              updatedBy: actor.userId,
              ...hostWithdrawalLocationPatch(reunion.typeLieu),
            },
            select: {
              id: true,
              annee: true,
              mois: true,
              statut: true,
            },
          });
        }
      );
    });

    return {
      id: updated.id,
      annee: updated.annee,
      mois: updated.mois,
      statut: updated.statut,
    };
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    if (error instanceof Error && error.name === "ReunionNotFoundError") {
      throw new ServiceError("NOT_FOUND", "Réunion non trouvée");
    }
    console.error("[withdrawMyReunionHostProposal] Erreur:", error);
    throw new ServiceError(
      "INTERNAL_ERROR",
      "Erreur lors du désistement"
    );
  }
}
