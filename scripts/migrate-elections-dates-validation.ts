import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Script de migration pour mettre à jour les dates des élections existantes
 * selon les nouvelles règles de validation:
 * - dateOuverture < dateClotureCandidature
 * - dateClotureCandidature < dateScrutin
 * - dateCloture > dateScrutin
 * 
 * Pour les élections sans dateClotureCandidature, on la calcule à 10 jours avant dateScrutin.
 * Pour les élections avec des dates invalides, on ajuste automatiquement.
 */
async function migrateElectionsDates() {
  console.log('🔄 Migration des dates des élections...');

  try {
    const elections = await prisma.election.findMany();

    if (elections.length === 0) {
      console.log('✅ Aucune élection à migrer');
      return;
    }

    console.log(`📋 ${elections.length} élection(s) trouvée(s)`);

    let updatedCount = 0;
    let errorsCount = 0;

    for (const election of elections) {
      try {
        const dateOuverture = new Date(election.dateOuverture);
        const dateScrutin = new Date(election.dateScrutin);
        const dateCloture = new Date(election.dateCloture);
        
        // Si dateClotureCandidature est null, la calculer à 10 jours avant dateScrutin
        let dateClotureCandidature = election.dateClotureCandidature 
          ? new Date(election.dateClotureCandidature) 
          : new Date(dateScrutin);
        
        if (!election.dateClotureCandidature) {
          dateClotureCandidature.setDate(dateScrutin.getDate() - 10);
        }

        // Ajuster les dates si nécessaire pour respecter les règles
        // 1. dateOuverture < dateClotureCandidature
        if (dateOuverture >= dateClotureCandidature) {
          // Ajuster dateClotureCandidature pour être après dateOuverture
          dateClotureCandidature = new Date(dateOuverture);
          dateClotureCandidature.setDate(dateOuverture.getDate() + 1);
          console.log(`  ⚠️  Élection "${election.titre}": dateClotureCandidature ajustée après dateOuverture`);
        }

        // 2. dateClotureCandidature < dateScrutin
        if (dateClotureCandidature >= dateScrutin) {
          // Ajuster dateClotureCandidature pour être avant dateScrutin
          dateClotureCandidature = new Date(dateScrutin);
          dateClotureCandidature.setDate(dateScrutin.getDate() - 1);
          console.log(`  ⚠️  Élection "${election.titre}": dateClotureCandidature ajustée avant dateScrutin`);
        }

        // 3. dateCloture > dateScrutin
        if (dateCloture <= dateScrutin) {
          // Ajuster dateCloture pour être après dateScrutin
          const newDateCloture = new Date(dateScrutin);
          newDateCloture.setDate(dateScrutin.getDate() + 1);
          
          await prisma.election.update({
            where: { id: election.id },
            data: {
              dateClotureCandidature: dateClotureCandidature,
              dateCloture: newDateCloture,
            }
          });
          console.log(`  ✅ Élection "${election.titre}": dates ajustées (dateCloture et dateClotureCandidature)`);
        } else {
          await prisma.election.update({
            where: { id: election.id },
            data: {
              dateClotureCandidature: dateClotureCandidature,
            }
          });
          console.log(`  ✅ Élection "${election.titre}": dateClotureCandidature mise à jour`);
        }

        updatedCount++;
      } catch (error) {
        console.error(`  ❌ Erreur pour l'élection "${election.titre}":`, error);
        errorsCount++;
      }
    }

    console.log(`\n✅ Migration terminée:`);
    console.log(`   - ${updatedCount} élection(s) mise(s) à jour`);
    if (errorsCount > 0) {
      console.log(`   - ${errorsCount} erreur(s)`);
    }

  } catch (error) {
    console.error('💥 Erreur fatale lors de la migration:', error);
    throw error;
  }
}

async function main() {
  try {
    await migrateElectionsDates();
  } catch (error) {
    console.error('💥 Erreur fatale:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le script si appelé directement
if (require.main === module) {
  main();
}

export { migrateElectionsDates };

