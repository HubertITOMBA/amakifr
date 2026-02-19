/**
 * Purge : cotisations du mois + cotisations mensuelles + tous les paiements + tous les avoirs + assistances.
 * Conservé : dettes initiales uniquement (pour tester paiement avec avoir et dettes initiales).
 *
 * Ordre des suppressions (contraintes FK) :
 * 1. UtilisationAvoir (toutes)
 * 2. Relances cotisations mensuelles
 * 3. PaiementCotisation (tous)
 * 4. Assistance (toutes)
 * 5. CotisationMensuelle
 * 6. CotisationDuMois
 * 7. Avoir (tous)
 *
 * Exécution : npm run db:purge-cotisations-mois-et-paiements
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function purge() {
  console.log("🗑️  Purge : cotisations du mois + cotisations mensuelles + paiements + avoirs + assistances\n");
  console.log("⚠️  ATTENTION : opération irréversible.\n");
  console.log("Conservé : dettes initiales uniquement.\n");

  const countUtilisations = await prisma.utilisationAvoir.count();
  const countRelances = await prisma.relanceCotisationMensuelle.count();
  const countPaiements = await prisma.paiementCotisation.count();
  const countAssistances = await prisma.assistance.count();
  const countCotisationsMensuelles = await prisma.cotisationMensuelle.count();
  const countCotisationsDuMois = await prisma.cotisationDuMois.count();
  const countAvoirs = await prisma.avoir.count();

  console.log("📊 À supprimer :");
  console.log(`   - Utilisations d'avoirs : ${countUtilisations}`);
  console.log(`   - Relances cotisations mensuelles : ${countRelances}`);
  console.log(`   - Paiements : ${countPaiements}`);
  console.log(`   - Assistances : ${countAssistances}`);
  console.log(`   - Cotisations mensuelles : ${countCotisationsMensuelles}`);
  console.log(`   - Cotisations du mois : ${countCotisationsDuMois}`);
  console.log(`   - Avoirs : ${countAvoirs}\n`);

  const total =
    countUtilisations +
    countRelances +
    countPaiements +
    countAssistances +
    countCotisationsMensuelles +
    countCotisationsDuMois +
    countAvoirs;
  if (total === 0) {
    console.log("✅ Rien à purger.");
    return;
  }

  const u = await prisma.utilisationAvoir.deleteMany({});
  console.log(`   ✓ ${u.count} utilisation(s) d'avoir(s) supprimée(s)`);

  const r = await prisma.relanceCotisationMensuelle.deleteMany({});
  console.log(`   ✓ ${r.count} relance(s) supprimée(s)`);

  const p = await prisma.paiementCotisation.deleteMany({});
  console.log(`   ✓ ${p.count} paiement(s) supprimé(s)`);

  const ass = await prisma.assistance.deleteMany({});
  console.log(`   ✓ ${ass.count} assistance(s) supprimée(s)`);

  const cm = await prisma.cotisationMensuelle.deleteMany({});
  console.log(`   ✓ ${cm.count} cotisation(s) mensuelle(s) supprimée(s)`);

  const cdm = await prisma.cotisationDuMois.deleteMany({});
  console.log(`   ✓ ${cdm.count} cotisation(s) du mois supprimée(s)`);

  const av = await prisma.avoir.deleteMany({});
  console.log(`   ✓ ${av.count} avoir(s) supprimé(s)\n`);

  const remainingP = await prisma.paiementCotisation.count();
  const remainingAss = await prisma.assistance.count();
  const remainingCM = await prisma.cotisationMensuelle.count();
  const remainingCDM = await prisma.cotisationDuMois.count();
  const remainingA = await prisma.avoir.count();

  console.log("📊 Vérification :");
  console.log(`   - Paiements restants : ${remainingP}`);
  console.log(`   - Assistances restantes : ${remainingAss}`);
  console.log(`   - Cotisations mensuelles restantes : ${remainingCM}`);
  console.log(`   - Cotisations du mois restantes : ${remainingCDM}`);
  console.log(`   - Avoirs restants : ${remainingA}\n`);

  if (remainingP === 0 && remainingAss === 0 && remainingCM === 0 && remainingCDM === 0 && remainingA === 0) {
    console.log("✅ Purge terminée. Seules les dettes initiales sont conservées.");
  } else {
    console.log("⚠️  Certaines lignes n'ont pas été supprimées.");
  }
}

purge()
  .catch((e) => {
    console.error("❌ Erreur :", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
