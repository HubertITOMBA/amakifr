import { db } from "@/lib/db";
import type { AuthContext } from "@/lib/auth-context";
import { ServiceError } from "@/lib/service-error";
import type { MyReunionDto } from "@/lib/services/reunions/types";
import {
  buildLieuLabel,
  canUpdateParticipation,
  resolveLieuAdresseForDto,
  selectHostTelephones,
  shouldExposeOperationalCoords,
} from "@/lib/services/reunions/reunion-helpers";

export { buildLieuLabel } from "@/lib/services/reunions/reunion-helpers";

const MOIS_LABELS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
] as const;

function buildTitre(mois: number, annee: number): string {
  const label = MOIS_LABELS[mois - 1] ?? String(mois);
  return `Réunion de ${label} ${annee}`;
}

/**
 * Retourne les réunions mensuelles visibles pour l'adhérent authentifié.
 *
 * Règle métier (reproduit le Web `/reunions-mensuelles`) :
 * calendrier collectif — tout adhérent authentifié voit les réunions mensuelles.
 *
 * Minimisation historique : adresse et téléphones hôte masqués pour réunions passées.
 *
 * @throws {ServiceError} UNAUTHENTICATED | NOT_FOUND | INTERNAL_ERROR
 */
export async function getMyReunions(
  actor: AuthContext
): Promise<MyReunionDto[]> {
  if (!actor?.userId || String(actor.userId).trim() === "") {
    throw new ServiceError("UNAUTHENTICATED", "Non autorisé");
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
      include: {
        AdherentHote: {
          select: {
            id: true,
            firstname: true,
            lastname: true,
            Adresse: {
              take: 1,
              orderBy: { createdAt: "asc" },
              select: {
                label: true,
                streetnum: true,
                street1: true,
                street2: true,
                codepost: true,
                city: true,
                country: true,
              },
            },
            Telephones: {
              select: {
                numero: true,
                type: true,
                estPrincipal: true,
              },
            },
          },
        },
        Participations: {
          where: { adherentId: adherent.id },
          select: { statut: true },
          take: 1,
        },
      },
      orderBy: [
        { dateReunion: "asc" },
        { annee: "asc" },
        { mois: "asc" },
      ],
    });

    const now = new Date();

    return reunions.map((r) => {
      const host = r.AdherentHote;
      const own = r.Participations[0] ?? null;
      const dateConfirmed = r.statut === "DateConfirmee";
      const hostAdresse = host?.Adresse[0] ?? null;
      const exposeCoords = shouldExposeOperationalCoords({
        statut: r.statut,
        dateReunion: r.dateReunion,
        now,
      });

      const lieuAdresse = resolveLieuAdresseForDto({
        statut: r.statut,
        typeLieu: r.typeLieu,
        adresse: r.adresse,
        hostAdresse,
        dateReunion: r.dateReunion,
        now,
      });

      const hostTelephones =
        exposeCoords && host
          ? selectHostTelephones(host.Telephones)
          : null;

      return {
        id: r.id,
        titre: buildTitre(r.mois, r.annee),
        annee: r.annee,
        mois: r.mois,
        dateReunion:
          dateConfirmed && r.dateReunion
            ? r.dateReunion.toISOString()
            : null,
        statut: r.statut,
        typeLieu: r.typeLieu,
        lieuLabel: buildLieuLabel({
          typeLieu: r.typeLieu,
          adresse: r.adresse,
          nomRestaurant: r.nomRestaurant,
          hostFirstname: host?.firstname ?? null,
          hostLastname: host?.lastname ?? null,
        }),
        lieuAdresse,
        isHost: host?.id === adherent.id,
        hostName: host
          ? [host.firstname, host.lastname].filter(Boolean).join(" ").trim() ||
            null
          : null,
        hostTelephones:
          hostTelephones && hostTelephones.length > 0 ? hostTelephones : null,
        participationStatus: own?.statut ?? null,
        canUpdateParticipation: canUpdateParticipation({
          statut: r.statut,
          dateReunion: r.dateReunion,
        }),
        commentaires: r.commentaires,
      };
    });
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    console.error("[getMyReunions] Erreur:", error);
    throw new ServiceError(
      "INTERNAL_ERROR",
      "Erreur lors de la récupération des réunions"
    );
  }
}
