"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { UserRole } from "@prisma/client";

/**
 * Purge toutes les cotisations mensuelles et paiements de cotisations
 * ATTENTION: Cette opération est irréversible !
 * 
 * @returns Un objet avec success (boolean), message (string) en cas de succès, 
 *          ou error (string) en cas d'échec, et les statistiques de suppression
 */
export async function purgeCotisationsEtPaiements() {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== UserRole.ADMIN) {
      return { success: false, error: "Non autorisé" };
    }

    console.log("[purgeCotisationsEtPaiements] Début de la purge...");

    // Supprimer dans l'ordre pour respecter les contraintes de clés étrangères
    
    // 1. Supprimer les utilisations d'avoirs liées aux cotisations mensuelles
    const utilisationsAvoir = await db.utilisationAvoir.deleteMany({
      where: {
        cotisationMensuelleId: { not: null }
      }
    });
    console.log(`[purgeCotisationsEtPaiements] ${utilisationsAvoir.count} utilisations d'avoirs supprimées`);

    // 2. Supprimer les relances de cotisations mensuelles
    const relances = await db.relanceCotisationMensuelle.deleteMany({});
    console.log(`[purgeCotisationsEtPaiements] ${relances.count} relances supprimées`);

    // 3. Supprimer les paiements de cotisations
    const paiements = await db.paiementCotisation.deleteMany({
      where: {
        cotisationMensuelleId: { not: null }
      }
    });
    console.log(`[purgeCotisationsEtPaiements] ${paiements.count} paiements supprimés`);

    // 4. Supprimer toutes les cotisations mensuelles
    const cotisations = await db.cotisationMensuelle.deleteMany({});
    console.log(`[purgeCotisationsEtPaiements] ${cotisations.count} cotisations mensuelles supprimées`);

    // Vérification finale
    const remainingPaiements = await db.paiementCotisation.count({
      where: {
        cotisationMensuelleId: { not: null }
      }
    });
    const remainingCotisations = await db.cotisationMensuelle.count();
    const remainingRelances = await db.relanceCotisationMensuelle.count();
    const remainingUtilisations = await db.utilisationAvoir.count({
      where: {
        cotisationMensuelleId: { not: null }
      }
    });

    const message = `Purge terminée avec succès :
- ${paiements.count} paiement(s) supprimé(s)
- ${cotisations.count} cotisation(s) mensuelle(s) supprimée(s)
- ${relances.count} relance(s) supprimée(s)
- ${utilisationsAvoir.count} utilisation(s) d'avoir(s) supprimée(s)

Vérification finale :
- Paiements restants : ${remainingPaiements}
- Cotisations restantes : ${remainingCotisations}
- Relances restantes : ${remainingRelances}
- Utilisations d'avoirs restantes : ${remainingUtilisations}`;

    return {
      success: true,
      message,
      stats: {
        paiementsSupprimes: paiements.count,
        cotisationsSupprimees: cotisations.count,
        relancesSupprimees: relances.count,
        utilisationsAvoirSupprimees: utilisationsAvoir.count,
        remainingPaiements,
        remainingCotisations,
        remainingRelances,
        remainingUtilisations,
      }
    };

  } catch (error) {
    console.error("[purgeCotisationsEtPaiements] Erreur lors de la purge:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Erreur lors de la purge des cotisations et paiements" 
    };
  } finally {
    revalidatePath("/admin/cotisations");
    revalidatePath("/admin/cotisations-du-mois");
    revalidatePath("/admin/cotisations/gestion");
  }
}

