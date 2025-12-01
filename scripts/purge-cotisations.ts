import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Script pour purger toutes les données de cotisations_mensuelles et paiements_cotisation
 * ATTENTION: Cette opération est irréversible !
 * 
 * Exécuter avec: npm run db:purge-cotisations
 */
async function purgeCotisations() {
  try {
    console.log("🗑️  Début de la purge des cotisations mensuelles et paiements...\n");
    console.log("⚠️  ATTENTION: Cette opération est irréversible !\n");

    // 1. Compter les données avant suppression
    const countPaiements = await prisma.paiementCotisation.count({
      where: {
        cotisationMensuelleId: { not: null }
      }
    });
    const countCotisations = await prisma.cotisationMensuelle.count();
    const countRelances = await prisma.relanceCotisationMensuelle.count();
    const countUtilisations = await prisma.utilisationAvoir.count({
      where: {
        cotisationMensuelleId: { not: null }
      }
    });

    console.log("📊 Données à supprimer :");
    console.log(`   - Paiements de cotisations : ${countPaiements}`);
    console.log(`   - Cotisations mensuelles : ${countCotisations}`);
    console.log(`   - Relances : ${countRelances}`);
    console.log(`   - Utilisations d'avoirs : ${countUtilisations}\n`);

    if (countPaiements === 0 && countCotisations === 0 && countRelances === 0 && countUtilisations === 0) {
      console.log("✅ Aucune donnée à supprimer");
      return;
    }

    // 2. Supprimer dans l'ordre pour respecter les contraintes de clés étrangères
    
    // Supprimer les utilisations d'avoirs liées aux cotisations mensuelles
    const utilisationsAvoir = await prisma.utilisationAvoir.deleteMany({
      where: {
        cotisationMensuelleId: { not: null }
      }
    });
    console.log(`   ✓ ${utilisationsAvoir.count} utilisation(s) d'avoir(s) supprimée(s)`);

    // Supprimer les relances de cotisations mensuelles
    const relances = await prisma.relanceCotisationMensuelle.deleteMany({});
    console.log(`   ✓ ${relances.count} relance(s) supprimée(s)`);

    // Supprimer les paiements de cotisations
    const paiements = await prisma.paiementCotisation.deleteMany({
      where: {
        cotisationMensuelleId: { not: null }
      }
    });
    console.log(`   ✓ ${paiements.count} paiement(s) supprimé(s)`);

    // Supprimer toutes les cotisations mensuelles
    const cotisations = await prisma.cotisationMensuelle.deleteMany({});
    console.log(`   ✓ ${cotisations.count} cotisation(s) mensuelle(s) supprimée(s)\n`);

    // 3. Vérification finale
    const remainingPaiements = await prisma.paiementCotisation.count({
      where: {
        cotisationMensuelleId: { not: null }
      }
    });
    const remainingCotisations = await prisma.cotisationMensuelle.count();
    const remainingRelances = await prisma.relanceCotisationMensuelle.count();
    const remainingUtilisations = await prisma.utilisationAvoir.count({
      where: {
        cotisationMensuelleId: { not: null }
      }
    });

    console.log("📊 Vérification finale :");
    console.log(`   - Paiements restants : ${remainingPaiements}`);
    console.log(`   - Cotisations restantes : ${remainingCotisations}`);
    console.log(`   - Relances restantes : ${remainingRelances}`);
    console.log(`   - Utilisations d'avoirs restantes : ${remainingUtilisations}\n`);

    if (remainingPaiements === 0 && remainingCotisations === 0 && remainingRelances === 0 && remainingUtilisations === 0) {
      console.log("✅ Purge terminée avec succès !");
    } else {
      console.log("⚠️  Certaines données n'ont pas été supprimées");
    }

  } catch (error) {
    console.error("❌ Erreur lors de la purge:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le script
purgeCotisations()
  .then(() => {
    console.log("\n✅ Script terminé");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Erreur fatale:", error);
    process.exit(1);
  });

