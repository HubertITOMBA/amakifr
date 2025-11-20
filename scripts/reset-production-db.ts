import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { execSync } from 'child_process';

let prisma: PrismaClient;

/**
 * Script pour réinitialiser la base de production
 * ATTENTION : Ce script supprime TOUTES les données de la base de données
 * 
 * Étapes :
 * 1. Exécute `npx prisma migrate reset --force --skip-seed` pour supprimer toutes les données et réapplique les migrations
 * 2. Exécute `npx prisma db push` pour synchroniser le schéma Prisma avec la base de données
 * 3. Exécute `npx prisma generate` pour régénérer le client Prisma
 * 4. Crée l'utilisateur Admin avec les spécifications données
 * 5. Exécute le script create-test-postes.ts pour créer les postes de test
 * 
 * Cela garantit que le schéma Prisma est réappliqué proprement, comme si vous veniez de créer une nouvelle base de données.
 */

// Configuration de l'utilisateur Admin
const adminUser = {
  email: 'admin@amaki.fr',
  name: 'Administrateur',
  password: '?Kipako!',
  role: 'Admin' as const,
  status: 'Actif' as const,
  adherent: {
    civility: 'Monsieur' as const,
    firstname: 'Admin',
    lastname: 'Système',
  }
};

/**
 * Réinitialise la base de données en utilisant Prisma migrate reset et db push
 * Cela garantit que le schéma Prisma est réappliqué proprement
 */
async function resetDatabase() {
  console.log('🧹 Réinitialisation de la base de données...');
  console.log('⚠️  ATTENTION : Toutes les données seront supprimées !\n');

  try {
    // Fermer la connexion Prisma avant d'exécuter les commandes
    await prisma.$disconnect();
    
    // 1. Exécuter prisma migrate reset
    console.log('📦 Exécution de: npx prisma migrate reset --force --skip-seed');
    console.log('   (Cela supprime toutes les données et réapplique les migrations)\n');
    
    try {
      execSync('npx prisma migrate reset --force --skip-seed', {
        stdio: 'inherit',
        cwd: process.cwd(),
      });
      console.log('\n✅ Prisma migrate reset terminé avec succès !\n');
    } catch (error: any) {
      console.error('❌ Erreur lors de prisma migrate reset:', error.message);
      throw error;
    }
    
    // 2. Exécuter prisma db push pour synchroniser le schéma
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
    
    // 3. Régénérer le client Prisma
    console.log('📦 Exécution de: npx prisma generate');
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
 * Exécute le script create-test-postes.ts
 */
async function createTestPostes() {
  console.log('📋 Création des postes de test...\n');
  
  try {
    // Importer et exécuter le script create-test-postes
    // Note: Le script create-test-postes utilise sa propre instance Prisma
    // et se déconnecte à la fin, donc on doit le réimporter à chaque fois
    const createTestPostesModule = await import('./create-test-postes');
    const createTestPostesFunction = createTestPostesModule.default;
    
    // Exécuter la fonction
    await createTestPostesFunction();
    
    console.log('\n✅ Postes de test créés avec succès !\n');
  } catch (error: any) {
    console.error('❌ Erreur lors de la création des postes de test:', error);
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
    
    // 3. Créer les postes de test
    await createTestPostes();
    
    console.log('🎉 Réinitialisation terminée avec succès !');
    console.log('\n📋 Résumé :');
    console.log('   ✅ Base de données réinitialisée');
    console.log('   ✅ Utilisateur Admin créé');
    console.log('   ✅ Postes de test créés');
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

export { resetDatabase, createAdminUser, createTestPostes };

