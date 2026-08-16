import { db } from "@/lib/db";
import type { AuthContext } from "@/lib/auth-context";
import { ServiceError } from "@/lib/service-error";
import { decimalToMoneyString } from "@/lib/services/cotisations/decimal-to-money-string";
import type { CotisationMensuelleDto } from "@/lib/services/cotisations/types";

/**
 * Liste les cotisations mensuelles de l'adhérent lié à l'acteur (self-service).
 *
 * Anti-IDOR : résout Adherent via actor.userId uniquement — jamais d'adherentId client.
 * Pas d'authorize() : ownership implicite (comme le chemin self historique).
 * Pas de bypass ADMIN cross-user (réservé à getCotisationsMensuellesAdherent Web).
 *
 * @param actor - Identité authentifiée
 * @returns Liste de CotisationMensuelleDto (éventuellement vide)
 * @throws {ServiceError} UNAUTHENTICATED | NOT_FOUND | INTERNAL_ERROR
 */
export async function getMyCotisationsMensuelles(
  actor: AuthContext
): Promise<CotisationMensuelleDto[]> {
  if (!actor?.userId || String(actor.userId).trim() === "") {
    throw new ServiceError("UNAUTHENTICATED", "Non autorisé");
  }

  let adherentId: string;

  try {
    const adherent = await db.adherent.findUnique({
      where: { userId: actor.userId },
      select: { id: true },
    });

    if (!adherent) {
      throw new ServiceError("NOT_FOUND", "Adhérent non trouvé");
    }

    adherentId = adherent.id;
  } catch (error) {
    if (error instanceof ServiceError) {
      throw error;
    }
    console.error("[getMyCotisationsMensuelles] Erreur résolution Adherent:", error);
    throw new ServiceError(
      "INTERNAL_ERROR",
      "Erreur lors de la récupération des cotisations mensuelles"
    );
  }

  try {
    const rows = await db.cotisationMensuelle.findMany({
      where: { adherentId },
      select: {
        id: true,
        periode: true,
        annee: true,
        mois: true,
        typeCotisationId: true,
        adherentId: true,
        adherentBeneficiaireId: true,
        montantAttendu: true,
        montantPaye: true,
        montantRestant: true,
        dateEcheance: true,
        statut: true,
        description: true,
        cotisationDuMoisId: true,
        createdAt: true,
        updatedAt: true,
        TypeCotisation: {
          select: {
            id: true,
            nom: true,
            description: true,
            montant: true,
            obligatoire: true,
            actif: true,
            ordre: true,
            categorie: true,
            aBeneficiaire: true,
          },
        },
      },
      orderBy: {
        periode: "desc",
      },
    });

    return rows.map((row) => ({
      id: row.id,
      periode: row.periode,
      annee: row.annee,
      mois: row.mois,
      typeCotisationId: row.typeCotisationId,
      adherentId: row.adherentId,
      adherentBeneficiaireId: row.adherentBeneficiaireId,
      montantAttendu: decimalToMoneyString(row.montantAttendu),
      montantPaye: decimalToMoneyString(row.montantPaye),
      montantRestant: decimalToMoneyString(row.montantRestant),
      dateEcheance: row.dateEcheance.toISOString(),
      statut: row.statut,
      description: row.description,
      cotisationDuMoisId: row.cotisationDuMoisId,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      typeCotisation: {
        id: row.TypeCotisation.id,
        nom: row.TypeCotisation.nom,
        description: row.TypeCotisation.description,
        montant: decimalToMoneyString(row.TypeCotisation.montant),
        obligatoire: row.TypeCotisation.obligatoire,
        actif: row.TypeCotisation.actif,
        ordre: row.TypeCotisation.ordre,
        categorie: row.TypeCotisation.categorie,
        aBeneficiaire: row.TypeCotisation.aBeneficiaire,
      },
    }));
  } catch (error) {
    if (error instanceof ServiceError) {
      throw error;
    }
    console.error("[getMyCotisationsMensuelles] Erreur lecture CotisationMensuelle:", error);
    throw new ServiceError(
      "INTERNAL_ERROR",
      "Erreur lors de la récupération des cotisations mensuelles"
    );
  }
}
