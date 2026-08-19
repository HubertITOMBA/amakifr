import { db } from "@/lib/db";
import type { AuthContext } from "@/lib/auth-context";
import { ServiceError } from "@/lib/service-error";
import type { MyTacheDto } from "@/lib/services/taches/types";

/**
 * Retourne les tâches affectées à l'adhérent de l'acteur authentifié.
 *
 * Anti-IDOR : résout l'adhérent via actor.userId — jamais d'adherentId client.
 * Filtre : affectations actives (dateFinAffectation IS NULL), reproduit le Web.
 *
 * @throws {ServiceError} UNAUTHENTICATED | NOT_FOUND | INTERNAL_ERROR
 */
export async function getMyTaches(actor: AuthContext): Promise<MyTacheDto[]> {
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

    const affectations = await db.affectationSousProjet.findMany({
      where: {
        adherentId: adherent.id,
        dateFinAffectation: null,
      },
      include: {
        SousProjet: {
          include: {
            Projet: {
              select: { id: true, titre: true },
            },
            Commentaires: {
              include: {
                Adherent: {
                  select: { id: true, firstname: true, lastname: true },
                },
              },
              orderBy: { createdAt: "desc" },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return affectations.map((aff) => {
      const sp = aff.SousProjet;
      return {
        id: sp.id,
        titre: sp.titre,
        description: sp.description,
        statut: sp.statut,
        dateDebut: sp.dateDebut?.toISOString() ?? null,
        dateFin: sp.dateFin?.toISOString() ?? null,
        projet: { id: sp.Projet.id, titre: sp.Projet.titre },
        responsable: aff.responsable,
        commentaires: sp.Commentaires.map((c) => ({
          id: c.id,
          contenu: c.contenu,
          pourcentageAvancement: c.pourcentageAvancement,
          auteur: {
            id: c.Adherent.id,
            firstname: c.Adherent.firstname,
            lastname: c.Adherent.lastname,
          },
          createdAt: c.createdAt.toISOString(),
        })),
      };
    });
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    console.error("[getMyTaches] Erreur:", error);
    throw new ServiceError(
      "INTERNAL_ERROR",
      "Erreur lors de la récupération des tâches"
    );
  }
}
