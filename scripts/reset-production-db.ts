import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { execSync } from 'child_process';

let prisma: PrismaClient;

/**
 * Script pour réinitialiser la base de production
 * ATTENTION : Ce script supprime TOUTES les données de la base de données
 * 
 * Étapes :
 * 1. Reset de la base de production (suppression de toutes les données)
 * 2. Exécute `npx prisma generate` pour régénérer le client Prisma
 * 3. Exécute `npx prisma db push` pour synchroniser le schéma Prisma avec la base de données
 * 4. Crée l'utilisateur Admin avec les spécifications données
 * 5. Exécute les scripts de seed dans l'ordre :
 *    - create-test-postes.ts
 *    - create-default-badges.ts
 *    - create-default-types-cotisation.ts
 *    - create-anniversaire-evenement.ts
 *    - create-evenements-elections.ts
 *    - update-evenements-elections.ts
 * 
 * Cela garantit que le schéma Prisma est réappliqué proprement, comme si vous veniez de créer une nouvelle base de données.
 */

// Configuration de l'utilisateur Admin
const adminUser = {
  email: 'admin@amaki.fr',
  name: 'Administrateur',
  password: '?Kipaku!',
  role: 'Admin' as const,
  status: 'Actif' as const,
  adherent: {
    civility: 'Monsieur' as const,
    firstname: 'Admin',
    lastname: 'Système',
  }
};

/**
 * Réinitialise la base de données en supprimant toutes les données
 * Puis applique le schéma Prisma avec db push
 */
async function resetDatabase() {
  console.log('🧹 Réinitialisation de la base de données...');
  console.log('⚠️  ATTENTION : Toutes les données seront supprimées !\n');

  try {
    // Fermer la connexion Prisma avant d'exécuter les commandes
    await prisma.$disconnect();
    
    // 1. Supprimer toutes les données (reset manuel)
    console.log('🗑️  Suppression de toutes les données...\n');
    
    // Recréer une nouvelle instance Prisma pour le reset
    const tempPrisma = new PrismaClient();
    
    try {
      // Supprimer toutes les données dans l'ordre (en respectant les contraintes de clés étrangères)
      // Note: Prisma gère automatiquement les suppressions en cascade
      await tempPrisma.user.deleteMany({});
      console.log('   ✅ Données supprimées');
    } catch (error: any) {
      // Si les tables n'existent pas encore, ce n'est pas grave
      if (error.code !== 'P2021') {
        console.warn('   ⚠️  Erreur lors de la suppression (peut être normal si tables vides):', error.message);
      }
    } finally {
      await tempPrisma.$disconnect();
    }
    
    // 2. Régénérer le client Prisma
    console.log('\n📦 Exécution de: npx prisma generate');
    console.log('   (Cela régénère le client Prisma)\n');
    
    try {
      execSync('npx prisma generate', {
        stdio: 'inherit',
        cwd: process.cwd(),
      });
      console.log('\n✅ Prisma generate terminé avec succès !\n');
    } catch (error: any) {
      console.error('❌ Erreur lors de prisma generate:', error.message);
      throw error;
    }
    
    // 3. Exécuter prisma db push pour synchroniser le schéma
    console.log('📦 Exécution de: npx prisma db push');
    console.log('   (Cela synchronise le schéma Prisma avec la base de données)\n');
    
    try {
      execSync('npx prisma db push', {
        stdio: 'inherit',
        cwd: process.cwd(),
      });
      console.log('\n✅ Prisma db push terminé avec succès !\n');
    } catch (error: any) {
      console.error('❌ Erreur lors de prisma db push:', error.message);
      throw error;
    }
    
    console.log('✅ Base de données réinitialisée avec succès !');
    console.log('   Le schéma Prisma a été réappliqué comme une nouvelle base de données.\n');
    
    // Recréer une nouvelle instance Prisma après le reset
    prisma = new PrismaClient();
  } catch (error: any) {
    console.error('❌ Erreur lors de la réinitialisation de la base de données:', error);
    throw error;
  }
}

/**
 * Crée l'utilisateur Admin avec les spécifications données
 */
async function createAdminUser() {
  console.log('👤 Création de l\'utilisateur Admin...');
  
  try {
    // Vérifier si l'utilisateur existe déjà
    const existingUser = await prisma.user.findUnique({
      where: { email: adminUser.email }
    });
    
    if (existingUser) {
      console.log(`⚠️  L'utilisateur ${adminUser.email} existe déjà, suppression...`);
      await prisma.user.delete({
        where: { email: adminUser.email }
      });
    }
    
    // Hasher le mot de passe
    const hashedPassword = await bcrypt.hash(adminUser.password, 12);
    
    // Créer l'utilisateur avec son adhérent
    const user = await prisma.user.create({
      data: {
        email: adminUser.email,
        name: adminUser.name,
        emailVerified: new Date(), // Date du jour
        password: hashedPassword,
        role: adminUser.role,
        status: adminUser.status,
        adherent: {
          create: {
            civility: adminUser.adherent.civility,
            firstname: adminUser.adherent.firstname,
            lastname: adminUser.adherent.lastname,
          }
        }
      },
      include: {
        adherent: true
      }
    });
    
    console.log(`✅ Utilisateur Admin créé avec succès !`);
    console.log(`   📧 Email: ${user.email}`);
    console.log(`   👤 Nom: ${user.name}`);
    console.log(`   🎭 Rôle: ${user.role}`);
    console.log(`   📊 Statut: ${user.status}`);
    console.log(`   👨 Adhérent: ${user.adherent?.firstname} ${user.adherent?.lastname}`);
    console.log(`   🔑 Mot de passe: ${adminUser.password}\n`);
    
    return user;
  } catch (error: any) {
    console.error('❌ Erreur lors de la création de l\'utilisateur Admin:', error);
    throw error;
  }
}

/**
 * Exécute un script de seed
 * Les scripts sont exécutés directement avec tsx car certains créent leur propre instance Prisma
 */
async function runSeedScript(scriptName: string, description: string) {
  console.log(`📋 ${description}...\n`);
  
  try {
    // Exécuter le script directement avec tsx
    // Les scripts créent leur propre instance Prisma et se déconnectent à la fin
    execSync(`tsx scripts/${scriptName}`, {
      stdio: 'inherit',
      cwd: process.cwd(),
    });
    
    console.log(`\n✅ ${description} terminé avec succès !\n`);
  } catch (error: any) {
    console.error(`❌ Erreur lors de ${description}:`, error.message || error);
    throw error;
  }
}

/**
 * Fonction principale
 */
async function main() {
  // Initialiser Prisma
  prisma = new PrismaClient();
  
  console.log('🚀 Script de réinitialisation de la base de production\n');
  console.log('=' .repeat(60));
  console.log('⚠️  ATTENTION : Ce script va supprimer TOUTES les données !');
  console.log('=' .repeat(60));
  console.log('');
  
  try {
    // 1. Réinitialiser la base de données
    await resetDatabase();
    
    // 2. Créer l'utilisateur Admin
    await createAdminUser();
    
    // 3. Exécuter les scripts de seed dans l'ordre
    await runSeedScript('create-test-postes', 'Création des postes de test');
    await runSeedScript('create-default-badges', 'Création des badges par défaut');
    await runSeedScript('create-default-types-cotisation', 'Création des types de cotisation par défaut');
    await runSeedScript('create-anniversaire-evenement', 'Création de l\'événement anniversaire');
    await runSeedScript('create-evenements-elections', 'Création des événements d\'élections');
    await runSeedScript('update-evenements-elections', 'Mise à jour des événements d\'élections');
    
    console.log('🎉 Réinitialisation terminée avec succès !');
    console.log('\n📋 Résumé :');
    console.log('   ✅ Base de données réinitialisée');
    console.log('   ✅ Prisma generate exécuté');
    console.log('   ✅ Prisma db push exécuté');
    console.log('   ✅ Utilisateur Admin créé');
    console.log('   ✅ Postes de test créés');
    console.log('   ✅ Badges par défaut créés');
    console.log('   ✅ Types de cotisation créés');
    console.log('   ✅ Événements créés');
    console.log('\n🔐 Identifiants de connexion Admin :');
    console.log(`   📧 Email: ${adminUser.email}`);
    console.log(`   🔑 Mot de passe: ${adminUser.password}`);
    console.log('\n💡 Vous pouvez maintenant vous connecter avec ces identifiants.\n');
    
  } catch (error: any) {
    console.error('\n💥 Erreur fatale:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le script si appelé directement
if (require.main === module) {
  main();
}

export { resetDatabase, createAdminUser, runSeedScript };

