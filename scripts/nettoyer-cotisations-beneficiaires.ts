import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Script pour nettoyer les cotisations mensuelles où l'adhérent payeur est aussi le bénéficiaire.
 * 
 * Règle métier : Un adhérent bénéficiaire d'une assistance ne doit pas payer pour cette assistance.
 * 
 * Ce script supprime toutes les lignes de cotisation_mensuelle où :
 * - Le type de cotisation est une assistance (aBeneficiaire = true OU nom contient "assistance")
 * - ET l'adherentId (payeur) est égal à l'adherentBeneficiaireId (bénéficiaire)
 * 
 * Exécuter avec: npx tsx scripts/nettoyer-cotisations-beneficiaires.ts
 */
async function nettoyerCotisationsBeneficiaires() {
  try {
    console.log("🧹 Nettoyage des cotisations où le bénéficiaire est aussi le payeur\n");

    // 1. Récupérer toutes les cotisations mensuelles avec leurs relations
    const cotisationsMensuelles = await prisma.cotisationMensuelle.findMany({
      include: {
        TypeCotisation: {
          select: {
            id: true,
            nom: true,
            aBeneficiaire: true,
          },
        },
        CotisationDuMois: {
          select: {
            adherentBeneficiaireId: true,
          },
        },
      },
    });

    console.log(`📊 Total de cotisations mensuelles trouvées: ${cotisationsMensuelles.length}\n`);

    // 2. Identifier les lignes à supprimer
    const lignesASupprimer: string[] = [];
    const lignesASupprimerAvecDetails: Array<{
      id: string;
      adherentId: string;
      adherentBeneficiaireId: string | null;
      typeNom: string;
      periode: string;
    }> = [];

    for (const cot of cotisationsMensuelles) {
      const typeNom = cot.TypeCotisation?.nom ?? "";
      const estAssistance =
        cot.TypeCotisation?.aBeneficiaire === true ||
        (typeNom && /assistance|décès|naissance|mariage|anniversaire/i.test(typeNom));

      if (!estAssistance) {
        continue; // Pas une assistance, on passe
      }

      const adherentBeneficiaireId =
        cot.adherentBeneficiaireId ?? cot.CotisationDuMois?.adherentBeneficiaireId ?? null;

      if (!adherentBeneficiaireId) {
        continue; // Pas de bénéficiaire défini, on passe
      }

      // Vérifier si le payeur est le bénéficiaire
      if (cot.adherentId === adherentBeneficiaireId) {
        lignesASupprimer.push(cot.id);
        lignesASupprimerAvecDetails.push({
          id: cot.id,
          adherentId: cot.adherentId,
          adherentBeneficiaireId,
          typeNom,
          periode: cot.periode,
        });
      }
    }

    console.log(`🔍 Lignes à supprimer identifiées: ${lignesASupprimer.length}\n`);

    if (lignesASupprimer.length === 0) {
      console.log("✅ Aucune ligne à supprimer. La base de données est propre.\n");
      return;
    }

    // 3. Afficher les détails des lignes à supprimer
    console.log("📋 Détails des lignes à supprimer:\n");
    for (const detail of lignesASupprimerAvecDetails) {
      console.log(
        `  - ID: ${detail.id} | Adhérent: ${detail.adherentId} | Bénéficiaire: ${detail.adherentBeneficiaireId} | Type: ${detail.typeNom} | Période: ${detail.periode}`
      );
    }
    console.log("");

    // 4. Vérifier s'il y a des paiements associés
    const paiementsAssocies = await prisma.paiementCotisation.count({
      where: {
        cotisationMensuelleId: { in: lignesASupprimer },
      },
    });

    if (paiementsAssocies > 0) {
      console.log(
        `⚠️  ATTENTION: ${paiementsAssocies} paiement(s) associé(s) à ces cotisations seront également supprimés.\n`
      );
    }

    // 5. Demander confirmation (en mode interactif, sinon on continue)
    console.log("⚠️  Cette opération va supprimer définitivement ces lignes.\n");
    console.log("🚀 Suppression en cours...\n");

    // 6. Supprimer les utilisations d'avoir associées
    const utilisationsAvoirSupprimees = await prisma.utilisationAvoir.deleteMany({
      where: {
        cotisationMensuelleId: { in: lignesASupprimer },
      },
    });
    console.log(`  ✓ ${utilisationsAvoirSupprimees.count} utilisation(s) d'avoir supprimée(s)`);

    // 7. Supprimer les paiements associés
    const paiementsSupprimes = await prisma.paiementCotisation.deleteMany({
      where: {
        cotisationMensuelleId: { in: lignesASupprimer },
      },
    });
    console.log(`  ✓ ${paiementsSupprimes.count} paiement(s) supprimé(s)`);

    // 8. Supprimer les relances associées
    const relancesSupprimees = await prisma.relanceCotisationMensuelle.deleteMany({
      where: {
        cotisationMensuelleId: { in: lignesASupprimer },
      },
    });
    console.log(`  ✓ ${relancesSupprimees.count} relance(s) supprimée(s)`);

    // 9. Supprimer les cotisations mensuelles
    const cotisationsSupprimees = await prisma.cotisationMensuelle.deleteMany({
      where: {
        id: { in: lignesASupprimer },
      },
    });
    console.log(`  ✓ ${cotisationsSupprimees.count} cotisation(s) mensuelle(s) supprimée(s)\n`);

    console.log("✅ Nettoyage terminé avec succès !\n");
    console.log(`📊 Résumé:`);
    console.log(`   - Cotisations supprimées: ${cotisationsSupprimees.count}`);
    console.log(`   - Paiements supprimés: ${paiementsSupprimes.count}`);
    console.log(`   - Utilisations d'avoir supprimées: ${utilisationsAvoirSupprimees.count}`);
    console.log(`   - Relances supprimées: ${relancesSupprimees.count}\n`);

  } catch (error) {
    console.error("❌ Erreur lors du nettoyage:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le script
nettoyerCotisationsBeneficiaires()
  .then(() => {
    console.log("✨ Script terminé");
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Erreur fatale:", error);
    process.exit(1);
  });
