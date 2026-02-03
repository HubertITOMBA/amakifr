import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Script pour purger TOUTES les données de cotisations (anciennes et mensuelles).
 * ATTENTION: Cette opération est irréversible !
 *
 * Tables vidées :
 * - utilisations_avoir (liées aux cotisations/obligations/assistances)
 * - paiements_cotisation (liés aux cotisations/obligations/assistances)
 * - relances_cotisation_mensuelle
 * - relances (obligations cotisation)
 * - cotisations_mensuelles
 * - cotisations_du_mois
 * - assistances
 * - obligations_cotisation
 * - cotisations (ancien système enum)
 *
 * Les TYPES de cotisation mensuelle (types_cotisation_mensuelle) sont conservés.
 *
 * Exécuter avec: npm run db:purge-cotisations
 */
async function purgeCotisations() {
  try {
    console.log("🗑️  Purge complète de toutes les cotisations\n");
    console.log("⚠️  ATTENTION: Cette opération est irréversible !\n");

    // 1. Compter les données avant suppression
    const countUtilisationsCotisation = await prisma.utilisationAvoir.count({
      where: {
        OR: [
          { cotisationMensuelleId: { not: null } },
          { obligationCotisationId: { not: null } },
          { assistanceId: { not: null } },
        ],
      },
    });
    const countPaiementsCotisation = await prisma.paiementCotisation.count({
      where: {
        OR: [
          { cotisationMensuelleId: { not: null } },
          { obligationCotisationId: { not: null } },
          { assistanceId: { not: null } },
        ],
      },
    });
    const countRelancesMensuelle = await prisma.relanceCotisationMensuelle.count();
    const countRelances = await prisma.relance.count();
    const countCotisationsMensuelles = await prisma.cotisationMensuelle.count();
    const countCotisationsDuMois = await prisma.cotisationDuMois.count();
    const countAssistances = await prisma.assistance.count();
    const countObligations = await prisma.obligationCotisation.count();
    const countCotisations = await prisma.cotisation.count();

    console.log("📊 Données à supprimer :");
    console.log(`   - Utilisations d'avoirs (cotisations/obligations/assistances) : ${countUtilisationsCotisation}`);
    console.log(`   - Paiements (cotisations/obligations/assistances) : ${countPaiementsCotisation}`);
    console.log(`   - Relances cotisations mensuelles : ${countRelancesMensuelle}`);
    console.log(`   - Relances (obligations) : ${countRelances}`);
    console.log(`   - Cotisations mensuelles : ${countCotisationsMensuelles}`);
    console.log(`   - Cotisations du mois (planification) : ${countCotisationsDuMois}`);
    console.log(`   - Assistances : ${countAssistances}`);
    console.log(`   - Obligations cotisation : ${countObligations}`);
    console.log(`   - Cotisations (ancien système) : ${countCotisations}\n`);

    const total =
      countUtilisationsCotisation +
      countPaiementsCotisation +
      countRelancesMensuelle +
      countRelances +
      countCotisationsMensuelles +
      countCotisationsDuMois +
      countAssistances +
      countObligations +
      countCotisations;

    if (total === 0) {
      console.log("✅ Aucune donnée de cotisation à supprimer.");
      return;
    }

    // 2. Supprimer dans l'ordre (enfants avant parents, contraintes FK)

    const u1 = await prisma.utilisationAvoir.deleteMany({
      where: {
        OR: [
          { cotisationMensuelleId: { not: null } },
          { obligationCotisationId: { not: null } },
          { assistanceId: { not: null } },
        ],
      },
    });
    console.log(`   ✓ ${u1.count} utilisation(s) d'avoir(s) supprimée(s)`);

    const p1 = await prisma.paiementCotisation.deleteMany({
      where: {
        OR: [
          { cotisationMensuelleId: { not: null } },
          { obligationCotisationId: { not: null } },
          { assistanceId: { not: null } },
        ],
      },
    });
    console.log(`   ✓ ${p1.count} paiement(s) cotisation/obligation/assistance supprimé(s)`);

    const rcm = await prisma.relanceCotisationMensuelle.deleteMany({});
    console.log(`   ✓ ${rcm.count} relance(s) cotisation mensuelle supprimée(s)`);

    const rl = await prisma.relance.deleteMany({});
    console.log(`   ✓ ${rl.count} relance(s) obligation supprimée(s)`);

    const cm = await prisma.cotisationMensuelle.deleteMany({});
    console.log(`   ✓ ${cm.count} cotisation(s) mensuelle(s) supprimée(s)`);

    const cdm = await prisma.cotisationDuMois.deleteMany({});
    console.log(`   ✓ ${cdm.count} cotisation(s) du mois supprimée(s)`);

    const as = await prisma.assistance.deleteMany({});
    console.log(`   ✓ ${as.count} assistance(s) supprimée(s)`);

    const ob = await prisma.obligationCotisation.deleteMany({});
    console.log(`   ✓ ${ob.count} obligation(s) cotisation supprimée(s)`);

    const co = await prisma.cotisation.deleteMany({});
    console.log(`   ✓ ${co.count} cotisation(s) (ancien) supprimée(s)\n`);

    // 3. Vérification finale
    const remainingCotisationsMensuelles = await prisma.cotisationMensuelle.count();
    const remainingCotisationsDuMois = await prisma.cotisationDuMois.count();
    const remainingAssistances = await prisma.assistance.count();
    const remainingObligations = await prisma.obligationCotisation.count();
    const remainingCotisations = await prisma.cotisation.count();

    console.log("📊 Vérification finale :");
    console.log(`   - Cotisations mensuelles restantes : ${remainingCotisationsMensuelles}`);
    console.log(`   - Cotisations du mois restantes : ${remainingCotisationsDuMois}`);
    console.log(`   - Assistances restantes : ${remainingAssistances}`);
    console.log(`   - Obligations restantes : ${remainingObligations}`);
    console.log(`   - Cotisations (ancien) restantes : ${remainingCotisations}\n`);

    if (
      remainingCotisationsMensuelles === 0 &&
      remainingCotisationsDuMois === 0 &&
      remainingAssistances === 0 &&
      remainingObligations === 0 &&
      remainingCotisations === 0
    ) {
      console.log("✅ Purge terminée avec succès. Vous pouvez repartir de zéro pour les cotisations.");
    } else {
      console.log("⚠️  Certaines données n'ont pas été supprimées.");
    }
  } catch (error) {
    console.error("❌ Erreur lors de la purge:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

purgeCotisations()
  .then(() => {
    console.log("\n✅ Script terminé");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Erreur fatale:", error);
    process.exit(1);
  });
