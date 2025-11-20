import { PrismaClient } from '@prisma/client';
import { join } from 'path';
import { existsSync, copyFileSync } from 'fs';

const prisma = new PrismaClient();

/**
 * Script pour mettre à jour les événements liés aux élections du bureau
 * - Vérifie et met à jour les images si nécessaire
 * - Gère le cas où Bureau2.jpeg pourrait exister
 */
async function updateEvenementsElections() {
  console.log('🔄 Mise à jour des événements liés aux élections du bureau...\n');

  try {
    // Créer le dossier evenements s'il n'existe pas
    const evenementsDir = join(process.cwd(), 'public', 'ressources', 'evenements');
    if (!existsSync(evenementsDir)) {
      console.log('  ⚠️  Le dossier /public/ressources/evenements n\'existe pas');
      return;
    }

    // Vérifier si Bureau2.jpeg existe maintenant
    const bureau2Path = join(process.cwd(), 'public', 'ressources', 'Bureau2.jpeg');
    const bureau2Exists = existsSync(bureau2Path);
    
    if (bureau2Exists) {
      console.log('  ✓ Bureau2.jpeg trouvé, copie vers /ressources/evenements/...');
      const destPath = join(evenementsDir, 'Bureau2.jpeg');
      copyFileSync(bureau2Path, destPath);
      console.log('  ✓ Bureau2.jpeg copié avec succès\n');
    } else {
      console.log('  ℹ️  Bureau2.jpeg n\'existe pas, utilisation de Bureau1.jpeg\n');
    }

    // Trouver les événements des élections
    const evenement1 = await prisma.evenement.findFirst({
      where: {
        titre: {
          contains: 'ÉLECTIONS DU BUREAU',
        },
      },
    });

    const evenement2 = await prisma.evenement.findFirst({
      where: {
        titre: {
          contains: 'Vote - Élections du Bureau',
        },
      },
    });

    if (!evenement1 || !evenement2) {
      console.log('  ⚠️  Les événements n\'ont pas été trouvés');
      console.log('     Exécutez d\'abord: npm run db:create-evenements-elections');
      return;
    }

    // Mettre à jour l'événement 1 avec les bonnes images
    const imagesSecondaires = bureau2Exists
      ? [
          '/ressources/evenements/Bureau0.jpeg',
          '/ressources/evenements/Bureau2.jpeg',
        ]
      : [
          '/ressources/evenements/Bureau0.jpeg',
          '/ressources/evenements/Bureau1.jpeg',
        ];

    await prisma.evenement.update({
      where: { id: evenement1.id },
      data: {
        imagePrincipale: '/ressources/evenements/amaki_flag_cf.jpeg',
        images: JSON.stringify(imagesSecondaires),
      },
    });

    console.log('  ✅ Événement 1 mis à jour :');
    console.log(`     - Image principale : /ressources/evenements/amaki_flag_cf.jpeg`);
    console.log(`     - Images secondaires : ${imagesSecondaires.join(', ')}`);

    // Vérifier et mettre à jour l'événement 2 si nécessaire
    const evenement2Data = await prisma.evenement.findUnique({
      where: { id: evenement2.id },
      select: { imagePrincipale: true, images: true },
    });

    if (
      evenement2Data?.imagePrincipale !== '/ressources/evenements/vote_1.jpeg' ||
      evenement2Data?.images !== JSON.stringify(['/ressources/evenements/vote_2.jpeg'])
    ) {
      await prisma.evenement.update({
        where: { id: evenement2.id },
        data: {
          imagePrincipale: '/ressources/evenements/vote_1.jpeg',
          images: JSON.stringify(['/ressources/evenements/vote_2.jpeg']),
        },
      });

      console.log('\n  ✅ Événement 2 mis à jour :');
      console.log(`     - Image principale : /ressources/evenements/vote_1.jpeg`);
      console.log(`     - Image secondaire : /ressources/evenements/vote_2.jpeg`);
    } else {
      console.log('\n  ✓ Événement 2 déjà à jour');
    }

    console.log('\n✅ Mise à jour terminée avec succès !');

  } catch (error) {
    console.error('❌ Erreur lors de la mise à jour des événements:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

updateEvenementsElections();

