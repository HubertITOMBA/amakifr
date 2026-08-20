import { db } from "@/lib/db";
import { z } from "zod";
import type { AuthContext } from "@/lib/auth-context";
import { ServiceError } from "@/lib/service-error";
import type { MyReunionYearDto } from "@/lib/services/reunions/types";
import { buildYearMonths } from "@/lib/services/reunions/year-calendar-helpers";

const YearSchema = z.object({
  annee: z.number().int().min(2020).max(2100),
});

/**
 * Calendrier annuel des 12 mois pour proposition d'hôte self-service.
 *
 * @throws {ServiceError} UNAUTHENTICATED | NOT_FOUND | VALIDATION_ERROR | INTERNAL_ERROR
 */
export async function getMyReunionYear(
  actor: AuthContext,
  annee: number
): Promise<MyReunionYearDto> {
  if (!actor?.userId || String(actor.userId).trim() === "") {
    throw new ServiceError("UNAUTHENTICATED", "Non autorisé");
  }

  const parsed = YearSchema.safeParse({ annee });
  if (!parsed.success) {
    throw new ServiceError("VALIDATION_ERROR", "Année invalide");
  }

  try {
    const adherent = await db.adherent.findUnique({
      where: { userId: actor.userId },
      select: { id: true },
    });

    if (!adherent) {
      throw new ServiceError("NOT_FOUND", "Adhérent non trouvé");
    }

    const reunions = await db.reunionMensuelle.findMany({
      where: { annee: parsed.data.annee },
      select: {
        id: true,
        mois: true,
        statut: true,
        dateReunion: true,
        adherentHoteId: true,
        AdherentHote: {
          select: { id: true, firstname: true, lastname: true },
        },
      },
      orderBy: { mois: "asc" },
    });

    const months = buildYearMonths({
      annee: parsed.data.annee,
      currentAdherentId: adherent.id,
      reunions: reunions.map((r) => ({
        id: r.id,
        mois: r.mois,
        statut: r.statut,
        dateReunion: r.dateReunion,
        hostId: r.AdherentHote?.id ?? r.adherentHoteId,
        hostFirstname: r.AdherentHote?.firstname ?? null,
        hostLastname: r.AdherentHote?.lastname ?? null,
      })),
    });

    return {
      annee: parsed.data.annee,
      alreadyHostThisYear: months.some((m) => m.isCurrentUserHost),
      months,
    };
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    console.error("[getMyReunionYear] Erreur:", error);
    throw new ServiceError(
      "INTERNAL_ERROR",
      "Erreur lors de la récupération du calendrier annuel"
    );
  }
}
