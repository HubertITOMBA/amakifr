import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Script pour mettre à jour toutes les élections existantes
 * Définit dateClotureCandidature à 10 jours avant dateScrutin
 */
async function updateElectionsDateClotureCandidature() {
  console.log('🔄 Mise à jour des dates de clôture des candidatures...');

  try {
    // Récupérer toutes les élections
    const elections = await prisma.election.findMany();

    console.log(`📋 ${elections.length} élection(s) trouvée(s)`);

    if (elections.length === 0) {
      console.log('✅ Aucune élection à mettre à jour.');
      return;
    }

    let updated = 0;
    for (const election of elections) {
      // Calculer la date de clôture des candidatures (10 jours avant le scrutin)
      const dateScrutin = new Date(election.dateScrutin);
      const dateClotureCandidature = new Date(dateScrutin);
      dateClotureCandidature.setDate(dateScrutin.getDate() - 10);

      // Mettre à jour l'élection
      await prisma.election.update({
        where: { id: election.id },
        data: {
          dateClotureCandidature: dateClotureCandidature
        }
      });

      updated++;
      console.log(`   ✅ ${election.titre}: ${dateClotureCandidature.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`);
    }

    console.log(`\n✅ ${updated}/${elections.length} élection(s) mise(s) à jour avec succès !`);
  } catch (error) {
    console.error('❌ Erreur lors de la mise à jour:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le script
if (require.main === module) {
  updateElectionsDateClotureCandidature()
    .then(() => {
      console.log('\n✨ Mise à jour terminée avec succès !');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Erreur fatale:', error);
      process.exit(1);
    });
}

export default updateElectionsDateClotureCandidature;

