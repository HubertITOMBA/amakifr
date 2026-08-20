import { db } from "@/lib/db";
import type { AuthContext } from "@/lib/auth-context";
import { ServiceError } from "@/lib/service-error";
import { canWithdrawAsReunionHost } from "@/lib/services/reunions/year-calendar-helpers";
import { hostWithdrawalLocationPatch } from "@/lib/services/reunions/reunion-helpers";
import type { WithdrawMyReunionHostProposalResult } from "@/lib/services/reunions/types";

/**
 * Désistement self-service de l'hôte authentifié.
 *
 * Reproduit `desisterReunionMensuelle` (Web) :
 * - seul l'hôte courant (actor.userId → Adherent) peut se désister ;
 * - pas de date, ou date ≥ aujourd'hui + 28 jours ;
 * - aucun filtre de statut métier explicite (comme le Web) ;
 * - libère adherentHoteId, remet EnAttente, efface dateReunion ;
 * - Domicile : nullifie `adresse` (PII hôte) ; Restaurant/Autre : lieu conservé ;
 * - pas de notification email (log Web uniquement côté Server Action).
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

    const reunion = await db.reunionMensuelle.findUnique({
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

    const updated = await db.reunionMensuelle.update({
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

    return {
      id: updated.id,
      annee: updated.annee,
      mois: updated.mois,
      statut: updated.statut,
    };
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    console.error("[withdrawMyReunionHostProposal] Erreur:", error);
    throw new ServiceError(
      "INTERNAL_ERROR",
      "Erreur lors du désistement"
    );
  }
}
