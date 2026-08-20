import { db } from "@/lib/db";
import { z } from "zod";
import type { AuthContext } from "@/lib/auth-context";
import { ServiceError } from "@/lib/service-error";
import { isCalendarMonthPast } from "@/lib/services/reunions/year-calendar-helpers";
import type {
  ProposeMyselfAsReunionHostInput,
  ProposeMyselfAsReunionHostResult,
} from "@/lib/services/reunions/types";

const ProposeSchema = z.object({
  annee: z.number().int().min(2020).max(2100),
  mois: z.number().int().min(1).max(12),
});

/**
 * Propose l'adhérent authentifié comme hôte d'un mois (self-service).
 *
 * Reproduit createReunionMensuelle (parcours membre, sans adherentHoteId client) :
 * - crée une ReunionMensuelle si le mois est libre ;
 * - ou reclaim une EnAttente sans hôte (après désistement) ;
 * - statut EnAttente ;
 * - limite 1 hôte / adhérent / année ;
 * - contrainte unique annee+mois (concurrence → CONFLICT).
 *
 * @throws {ServiceError} UNAUTHENTICATED | NOT_FOUND | FORBIDDEN | VALIDATION_ERROR | CONFLICT | INTERNAL_ERROR
 */
export async function proposeMyselfAsReunionHost(
  actor: AuthContext,
  input: ProposeMyselfAsReunionHostInput
): Promise<ProposeMyselfAsReunionHostResult> {
  if (!actor?.userId || String(actor.userId).trim() === "") {
    throw new ServiceError("UNAUTHENTICATED", "Non autorisé");
  }

  const parsed = ProposeSchema.safeParse(input);
  if (!parsed.success) {
    throw new ServiceError(
      "VALIDATION_ERROR",
      parsed.error.errors[0]?.message ?? "Année ou mois invalide"
    );
  }

  const { annee, mois } = parsed.data;

  if (isCalendarMonthPast(annee, mois)) {
    throw new ServiceError(
      "FORBIDDEN",
      "Vous ne pouvez pas vous proposer pour un mois déjà passé."
    );
  }

  try {
    const adherent = await db.adherent.findUnique({
      where: { userId: actor.userId },
      select: {
        id: true,
        firstname: true,
        lastname: true,
        User: { select: { role: true, status: true } },
      },
    });

    if (!adherent) {
      throw new ServiceError("NOT_FOUND", "Adhérent non trouvé");
    }

    if (adherent.User.role !== "MEMBRE" || adherent.User.status !== "Actif") {
      throw new ServiceError(
        "FORBIDDEN",
        "Seuls les membres actifs peuvent se proposer comme hôte."
      );
    }

    const existing = await db.reunionMensuelle.findUnique({
      where: { annee_mois: { annee, mois } },
      select: { id: true, adherentHoteId: true, statut: true },
    });

    if (existing?.adherentHoteId) {
      throw new ServiceError(
        "CONFLICT",
        `Une réunion existe déjà pour ${mois}/${annee}`
      );
    }

    // EnAttente sans hôte (après désistement) : reclaim self-service via update.
    // Autres cas sans hôte : admin uniquement (comme le message Web create).
    if (existing && existing.statut !== "EnAttente") {
      throw new ServiceError(
        "CONFLICT",
        "Une réunion existe déjà pour ce mois sans hôte. Un administrateur doit désigner l'hôte."
      );
    }

    const autreReunionMemeAnnee = await db.reunionMensuelle.findFirst({
      where: { adherentHoteId: adherent.id, annee },
      select: { id: true, mois: true },
    });

    if (autreReunionMemeAnnee) {
      throw new ServiceError(
        "FORBIDDEN",
        "Vous avez déjà accueilli ou réservé une réunion pour cette année."
      );
    }

    const hostName = `${adherent.firstname} ${adherent.lastname}`.trim();

    if (existing && !existing.adherentHoteId && existing.statut === "EnAttente") {
      const reunion = await db.reunionMensuelle.update({
        where: { id: existing.id },
        data: {
          adherentHoteId: adherent.id,
          statut: "EnAttente",
          updatedBy: actor.userId,
        },
        select: {
          id: true,
          annee: true,
          mois: true,
          statut: true,
        },
      });

      return {
        id: reunion.id,
        annee: reunion.annee,
        mois: reunion.mois,
        statut: reunion.statut,
        hostName,
      };
    }

    try {
      const reunion = await db.reunionMensuelle.create({
        data: {
          annee,
          mois,
          adherentHoteId: adherent.id,
          statut: "EnAttente",
          createdBy: actor.userId,
        },
        select: {
          id: true,
          annee: true,
          mois: true,
          statut: true,
          AdherentHote: {
            select: { firstname: true, lastname: true },
          },
        },
      });

      const createdHostName = [
        reunion.AdherentHote?.firstname,
        reunion.AdherentHote?.lastname,
      ]
        .filter(Boolean)
        .join(" ")
        .trim();

      return {
        id: reunion.id,
        annee: reunion.annee,
        mois: reunion.mois,
        statut: reunion.statut,
        hostName: createdHostName,
      };
    } catch (createError: unknown) {
      const code =
        createError &&
        typeof createError === "object" &&
        "code" in createError
          ? String((createError as { code: unknown }).code)
          : "";
      if (code === "P2002") {
        throw new ServiceError(
          "CONFLICT",
          `Une réunion existe déjà pour ${mois}/${annee}`
        );
      }
      throw createError;
    }
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    console.error("[proposeMyselfAsReunionHost] Erreur:", error);
    throw new ServiceError(
      "INTERNAL_ERROR",
      "Erreur lors de la proposition d'hôte"
    );
  }
}
