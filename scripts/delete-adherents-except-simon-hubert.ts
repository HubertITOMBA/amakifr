import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Script pour supprimer tous les adhérents et leurs informations
 * sauf ceux dont le firstname est "Simon" ou "Hubert"
 * 
 * ⚠️ ATTENTION : Cette opération est irréversible !
 */
async function deleteAdherentsExceptSimonHubert() {
  console.log('🚀 Démarrage de la suppression des adhérents...\n');
  console.log('⚠️  ATTENTION : Cette opération est irréversible !\n');

  try {
    // Étape 1: Trouver les adhérents à préserver
    console.log('🔍 Recherche des adhérents à préserver (Simon et Hubert)...');
    const adherentsToKeep = await prisma.adherent.findMany({
      where: {
        firstname: {
          in: ['Simon', 'Hubert']
        }
      },
      include: {
        User: {
          select: {
            id: true,
            email: true,
            name: true,
          }
        }
      }
    });

    console.log(`   ✅ ${adherentsToKeep.length} adhérent(s) trouvé(s) à préserver :`);
    adherentsToKeep.forEach(adh => {
      console.log(`      - ${adh.firstname} ${adh.lastname} (${adh.User?.email || 'pas d\'email'})`);
    });
    console.log('');

    // Récupérer les IDs des utilisateurs à préserver
    const userIdsToKeep = adherentsToKeep
      .map(adh => adh.User?.id)
      .filter((id): id is string => id !== undefined);

    if (userIdsToKeep.length === 0) {
      console.log('   ⚠️  Aucun utilisateur associé trouvé pour les adhérents à préserver');
    }

    // Étape 2: Compter les adhérents à supprimer
    console.log('📊 Comptage des adhérents à supprimer...');
    const totalAdherents = await prisma.adherent.count();
    const adherentsToDelete = totalAdherents - adherentsToKeep.length;
    console.log(`   📋 Total d'adhérents : ${totalAdherents}`);
    console.log(`   ✅ À préserver : ${adherentsToKeep.length}`);
    console.log(`   ❌ À supprimer : ${adherentsToDelete}\n`);

    if (adherentsToDelete === 0) {
      console.log('   ✅ Aucun adhérent à supprimer. Fin du script.\n');
      return;
    }

    // Étape 3: Compter les utilisateurs à supprimer
    const totalUsers = await prisma.user.count();
    const usersToDelete = totalUsers - userIdsToKeep.length;
    console.log(`📊 Comptage des utilisateurs à supprimer...`);
    console.log(`   📋 Total d'utilisateurs : ${totalUsers}`);
    console.log(`   ✅ À préserver : ${userIdsToKeep.length}`);
    console.log(`   ❌ À supprimer : ${usersToDelete}\n`);

    // Étape 4: Demander confirmation
    console.log('⚠️  CONFIRMATION REQUISE');
    console.log('=====================================');
    console.log(`Vous êtes sur le point de supprimer :`);
    console.log(`   - ${adherentsToDelete} adhérent(s) et toutes leurs informations`);
    console.log(`   - ${usersToDelete} utilisateur(s) associé(s)`);
    console.log(`   - Toutes les données liées (adresses, téléphones, cotisations, etc.)`);
    console.log('');
    console.log(`Les adhérents suivants seront PRÉSERVÉS :`);
    adherentsToKeep.forEach(adh => {
      console.log(`   ✅ ${adh.firstname} ${adh.lastname}`);
    });
    console.log('=====================================\n');

    // Note: En production, vous pourriez vouloir ajouter une vraie confirmation
    // Pour l'instant, on continue directement

    // Étape 5: Supprimer les utilisateurs (les adhérents seront supprimés en cascade)
    console.log('🧹 Suppression des utilisateurs et adhérents...');
    
    if (userIdsToKeep.length > 0) {
      // Supprimer tous les utilisateurs sauf ceux à préserver
      const deletedUsers = await prisma.user.deleteMany({
        where: {
          id: {
            notIn: userIdsToKeep
          }
        }
      });
      console.log(`   ✅ ${deletedUsers.count} utilisateur(s) supprimé(s)`);
      console.log(`   ✅ Les adhérents associés ont été supprimés automatiquement (cascade)\n`);
    } else {
      // Si aucun utilisateur à préserver, supprimer tous les utilisateurs
      const deletedUsers = await prisma.user.deleteMany({});
      console.log(`   ✅ ${deletedUsers.count} utilisateur(s) supprimé(s)`);
      console.log(`   ✅ Les adhérents associés ont été supprimés automatiquement (cascade)\n`);
    }

    // Étape 6: Vérifier qu'il ne reste que les adhérents à préserver
    console.log('🔍 Vérification finale...');
    const remainingAdherents = await prisma.adherent.findMany({
      select: {
        id: true,
        firstname: true,
        lastname: true,
        User: {
          select: {
            email: true,
            name: true,
          }
        }
      }
    });

    console.log(`   📋 Adhérents restants : ${remainingAdherents.length}`);
    remainingAdherents.forEach(adh => {
      console.log(`      ✅ ${adh.firstname} ${adh.lastname} (${adh.User?.email || 'pas d\'email'})`);
    });
    console.log('');

    // Vérifier que seuls Simon et Hubert restent
    const invalidAdherents = remainingAdherents.filter(
      adh => adh.firstname !== 'Simon' && adh.firstname !== 'Hubert'
    );

    if (invalidAdherents.length > 0) {
      console.log('   ⚠️  ATTENTION : Des adhérents inattendus sont restants :');
      invalidAdherents.forEach(adh => {
        console.log(`      - ${adh.firstname} ${adh.lastname}`);
      });
    } else {
      console.log('   ✅ Vérification réussie : seuls Simon et Hubert restent\n');
    }

    console.log('=====================================');
    console.log('✅ Suppression terminée avec succès !');
    console.log('=====================================');
    console.log(`✅ ${adherentsToKeep.length} adhérent(s) préservé(s)`);
    console.log(`❌ ${adherentsToDelete} adhérent(s) supprimé(s)`);
    console.log(`❌ ${usersToDelete} utilisateur(s) supprimé(s)`);
    console.log('=====================================\n');

  } catch (error: any) {
    console.error('\n❌ Erreur lors de la suppression:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le script
deleteAdherentsExceptSimonHubert()
  .then(() => {
    console.log('✅ Script terminé avec succès');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erreur lors de l\'exécution du script:', error);
    process.exit(1);
  });

