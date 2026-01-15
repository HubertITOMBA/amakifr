import { PrismaClient } from '@prisma/client';
import { normalizeEmail } from '../lib/utils';

const prisma = new PrismaClient();

/**
 * Script pour nettoyer les doublons d'emails (case-insensitive)
 * 
 * Ce script :
 * - Trouve tous les utilisateurs avec des emails en doublon (même email avec casse différente)
 * - Garde le premier utilisateur créé (le plus ancien)
 * - Supprime ou marque les doublons
 * - Normalise tous les emails en minuscules
 * 
 * Usage: npx tsx scripts/cleanup-duplicate-emails.ts
 */
async function cleanupDuplicateEmails() {
  console.log('🔍 Recherche des doublons d\'emails...\n');

  try {
    // Récupérer tous les utilisateurs avec un email
    const allUsers = await prisma.user.findMany({
      where: {
        email: {
          not: null,
        },
      },
      orderBy: {
        createdAt: 'asc', // Plus ancien en premier
      },
      include: {
        adherent: true,
      },
    });

    console.log(`📊 Total d'utilisateurs avec email: ${allUsers.length}\n`);

    // Grouper par email normalisé
    const emailGroups = new Map<string, typeof allUsers>();

    for (const user of allUsers) {
      if (!user.email) continue;

      const normalizedEmail = normalizeEmail(user.email);
      
      if (!emailGroups.has(normalizedEmail)) {
        emailGroups.set(normalizedEmail, []);
      }
      
      emailGroups.get(normalizedEmail)!.push(user);
    }

    // Trouver les groupes avec doublons
    const duplicates = Array.from(emailGroups.entries()).filter(
      ([, users]) => users.length > 1
    );

    console.log(`🔴 Groupes avec doublons trouvés: ${duplicates.length}\n`);

    if (duplicates.length === 0) {
      console.log('✅ Aucun doublon trouvé. Normalisation des emails...\n');
      
      // Normaliser tous les emails même s'il n'y a pas de doublons
      let normalized = 0;
      for (const user of allUsers) {
        if (!user.email) continue;
        
        const normalizedEmail = normalizeEmail(user.email);
        if (user.email !== normalizedEmail) {
          await prisma.user.update({
            where: { id: user.id },
            data: { email: normalizedEmail },
          });
          normalized++;
        }
      }
      
      console.log(`✅ ${normalized} email(s) normalisé(s)\n`);
      return;
    }

    let kept = 0;
    let deleted = 0;
    let normalized = 0;

    // Traiter chaque groupe de doublons
    for (const [normalizedEmail, users] of duplicates) {
      console.log(`\n📧 Email: ${normalizedEmail}`);
      console.log(`   Doublons trouvés: ${users.length}`);

      // Trier par date de création (garder le plus ancien)
      const sortedUsers = [...users].sort(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
      );

      const keepUser = sortedUsers[0];
      const duplicateUsers = sortedUsers.slice(1);

      console.log(`   ✅ Gardé: ${keepUser.email} (créé le ${keepUser.createdAt.toLocaleDateString('fr-FR')})`);
      console.log(`   ❌ Doublons à supprimer: ${duplicateUsers.length}`);

      // Normaliser l'email de l'utilisateur gardé
      if (keepUser.email !== normalizedEmail) {
        await prisma.user.update({
          where: { id: keepUser.id },
          data: { email: normalizedEmail },
        });
        normalized++;
        console.log(`   🔄 Email normalisé: ${keepUser.email} → ${normalizedEmail}`);
      }

      // Supprimer les doublons (cascade supprimera aussi les adhérents associés)
      for (const duplicateUser of duplicateUsers) {
        console.log(`   🗑️  Suppression: ${duplicateUser.email} (créé le ${duplicateUser.createdAt.toLocaleDateString('fr-FR')})`);
        
        // Afficher les informations de l'adhérent associé si existe
        if (duplicateUser.adherent) {
          console.log(`      └─ Adhérent: ${duplicateUser.adherent.firstname} ${duplicateUser.adherent.lastname}`);
        }

        await prisma.user.delete({
          where: { id: duplicateUser.id },
        });
        deleted++;
      }

      kept++;
    }

    // Normaliser tous les autres emails (ceux sans doublons)
    console.log('\n🔄 Normalisation des autres emails...\n');
    for (const user of allUsers) {
      if (!user.email) continue;
      
      const normalizedEmail = normalizeEmail(user.email);
      
      // Vérifier si l'utilisateur n'a pas déjà été traité dans les doublons
      const isInDuplicates = duplicates.some(([email]) => email === normalizedEmail);
      if (isInDuplicates) continue;
      
      if (user.email !== normalizedEmail) {
        await prisma.user.update({
          where: { id: user.id },
          data: { email: normalizedEmail },
        });
        normalized++;
      }
    }

    console.log('\n=====================================');
    console.log('📊 Résumé du nettoyage:');
    console.log('=====================================');
    console.log(`✅ Utilisateurs gardés: ${kept}`);
    console.log(`🗑️  Doublons supprimés: ${deleted}`);
    console.log(`🔄 Emails normalisés: ${normalized}`);
    console.log('\n✅ Nettoyage terminé avec succès!');

  } catch (error) {
    console.error('❌ Erreur lors du nettoyage:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le script si appelé directement
if (require.main === module) {
  cleanupDuplicateEmails()
    .then(() => {
      console.log('\n🎉 Script terminé avec succès!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Erreur fatale:', error);
      process.exit(1);
    });
}

export { cleanupDuplicateEmails };
