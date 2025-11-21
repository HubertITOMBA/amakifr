import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Données de test pour les utilisateurs et adhérents
const testUsers = [
  {
    email: 'admin@amaki.fr',
    name: 'Administrateur',
    password: 'password',
    role: 'Admin' as const,
    status: 'Actif' as const,
    adherent: {
      civility: 'Monsieur' as const,
      firstname: 'Admin',
      lastname: 'Système',
    }
  },
  {
    email: 'president@amaki.fr',
    name: 'Monsieur Président',
    password: 'password',
    role: 'Membre' as const,
    status: 'Actif' as const,
    adherent: {
      civility: 'Monsieur' as const,
      firstname: 'Jean',
      lastname: 'Dupont',
    }
  },
  {
    email: 'vice-president@amaki.fr',
    name: 'Madame Vice-Présidente',
    password: 'password',
    role: 'Membre' as const,
    status: 'Actif' as const,
    adherent: {
      civility: 'Madame' as const,
      firstname: 'Marie',
      lastname: 'Martin',
    }
  },
  {
    email: 'secretaire@amaki.fr',
    name: 'Monsieur Secrétaire',
    password: 'password',
    role: 'Membre' as const,
    status: 'Actif' as const,
    adherent: {
      civility: 'Monsieur' as const,
      firstname: 'Pierre',
      lastname: 'Durand',
    }
  },
  {
    email: 'tresorier@amaki.fr',
    name: 'Madame Trésorière',
    password: 'password',
    role: 'Membre' as const,
    status: 'Actif' as const,
    adherent: {
      civility: 'Madame' as const,
      firstname: 'Sophie',
      lastname: 'Bernard',
    }
  },
  {
    email: 'membre1@amaki.fr',
    name: 'Monsieur Membre 1',
    password: 'password',
    role: 'Membre' as const,
    status: 'Actif' as const,
    adherent: {
      civility: 'Monsieur' as const,
      firstname: 'Antoine',
      lastname: 'Leroy',
    }
  },
  {
    email: 'membre2@amaki.fr',
    name: 'Madame Membre 2',
    password: 'password',
    role: 'Membre' as const,
    status: 'Actif' as const,
    adherent: {
      civility: 'Madame' as const,
      firstname: 'Claire',
      lastname: 'Moreau',
    }
  },
  {
    email: 'membre3@amaki.fr',
    name: 'Monsieur Membre 3',
    password: 'password',
    role: 'Membre' as const,
    status: 'Actif' as const,
    adherent: {
      civility: 'Monsieur' as const,
      firstname: 'Thomas',
      lastname: 'Petit',
    }
  },
  {
    email: 'membre4@amaki.fr',
    name: 'Madame Membre 4',
    password: 'password',
    role: 'Membre' as const,
    status: 'Actif' as const,
    adherent: {
      civility: 'Madame' as const,
      firstname: 'Julie',
      lastname: 'Rousseau',
    }
  },
  {
    email: 'membre5@amaki.fr',
    name: 'Monsieur Membre 5',
    password: 'password',
    role: 'Membre' as const,
    status: 'Actif' as const,
    adherent: {
      civility: 'Monsieur' as const,
      firstname: 'Nicolas',
      lastname: 'Simon',
    }
  },
  {
    email: 'invite@amaki.fr',
    name: 'Monsieur Invité',
    password: 'password',
    role: 'Invite' as const,
    status: 'Actif' as const,
    adherent: {
      civility: 'Monsieur' as const,
      firstname: 'Paul',
      lastname: 'Blanc',
    }
  }
];

async function tableExists(tableName: string): Promise<boolean> {
  try {
    // Liste des tables autorisées pour éviter les injections SQL
    const allowedTables = ['users', 'adherent', 'elections', 'evenements'];
    if (!allowedTables.includes(tableName)) {
      return false;
    }
    
    // Essayer d'abord une méthode simple : compter les enregistrements
    try {
      await prisma.$queryRawUnsafe(`SELECT 1 FROM ${tableName} LIMIT 1`);
      return true;
    } catch (queryError: any) {
      // Si la requête échoue parce que la table n'existe pas
      if (queryError.code === 'P2021' || queryError.code === '42P01' || queryError.message?.includes('does not exist')) {
        return false;
      }
      // Si c'est une autre erreur (table vide, etc.), la table existe
      if (queryError.code !== 'P2021' && queryError.code !== '42P01') {
        // La table existe probablement mais est vide ou a une autre erreur
        return true;
      }
    }
    
    // Méthode alternative : interroger information_schema
    try {
      const result = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = '${tableName}'
        ) as exists`
      );
      
      return result[0]?.exists || false;
    } catch (schemaError: any) {
      // Si l'erreur indique que la table n'existe pas, retourner false
      if (schemaError.code === 'P2021' || schemaError.code === '42P01') {
        return false;
      }
      // Autre erreur, on la propage
      throw schemaError;
    }
  } catch (error: any) {
    // Log l'erreur pour debug
    console.error(`Erreur lors de la vérification de la table '${tableName}':`, error.message || error);
    // Si la table n'existe pas, retourner false
    if (error.code === 'P2021' || error.code === '42P01' || error.message?.includes('does not exist')) {
      return false;
    }
    // Autre erreur, on la propage
    throw error;
  }
}

async function waitForTable(tableName: string, maxRetries: number = 10, delayMs: number = 1000): Promise<boolean> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const exists = await tableExists(tableName);
      if (exists) {
        console.log(`✅ La table '${tableName}' existe.`);
        return true;
      }
      if (i < maxRetries - 1) {
        console.log(`⏳ Attente de la création de la table '${tableName}'... (tentative ${i + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    } catch (error: any) {
      console.error(`❌ Erreur lors de la vérification de la table '${tableName}' (tentative ${i + 1}/${maxRetries}):`, error.message || error);
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }
  console.error(`❌ La table '${tableName}' n'existe toujours pas après ${maxRetries} tentatives.`);
  return false;
}

async function createTestUsers() {
  console.log('🚀 Création des utilisateurs de test...');
  
  try {
    // Vérifier si les tables existent, avec retry pour gérer les cas où les migrations sont en cours
    console.log('🔍 Vérification de l\'existence des tables...');
    const usersTableExists = await waitForTable('users', 10, 1000);
    
    if (!usersTableExists) {
      console.log('\n⚠️  Les tables de la base de données n\'existent pas encore.');
      console.log('💡 Veuillez d\'abord exécuter les migrations Prisma :');
      console.log('   npx prisma migrate deploy');
      console.log('   ou');
      console.log('   npx prisma migrate dev');
      console.log('   ou');
      console.log('   npx prisma db push');
      console.log('\n🔍 Vérification de la connexion à la base de données...');
      try {
        await prisma.$connect();
        console.log('✅ Connexion à la base de données réussie.');
        console.log('💡 La base de données est accessible mais les tables n\'existent pas.');
        console.log('💡 Essayez d\'exécuter: npx prisma db push');
      } catch (dbError: any) {
        console.error('❌ Erreur de connexion à la base de données:', dbError.message || dbError);
        console.log('💡 Vérifiez que la variable d\'environnement DATABASE_URL est correctement configurée.');
      }
      throw new Error('Les tables de la base de données n\'existent pas. Exécutez d\'abord les migrations Prisma.');
    }
    
    console.log('✅ Les tables de la base de données sont disponibles.');

    // Supprimer les utilisateurs existants (cascade supprimera aussi les adhérents)
    console.log('🧹 Nettoyage des données existantes...');
    try {
      await prisma.user.deleteMany({
        where: {
          email: {
            in: testUsers.map(user => user.email)
          }
        }
      });
    } catch (error: any) {
      // Si l'erreur indique que la table n'existe pas, on continue quand même
      if (error.code === 'P2021') {
        console.log('⚠️  La table users n\'existe pas, passage de la suppression...');
      } else {
        throw error;
      }
    }

    // Créer les utilisateurs avec leurs adhérents
    for (const userData of testUsers) {
      console.log(`👤 Création de l'utilisateur: ${userData.email}`);
      
      // Hasher le mot de passe
      const hashedPassword = await bcrypt.hash(userData.password, 12);
      
      const user = await prisma.user.create({
        data: {
          email: userData.email,
          name: userData.name,
          password: hashedPassword,
          role: userData.role,
          status: userData.status,
          adherent: {
            create: {
              civility: userData.adherent.civility,
              firstname: userData.adherent.firstname,
              lastname: userData.adherent.lastname,
              // Le poste sera assigné par défaut lors de la création via la logique de l'application
            }
          }
        },
        include: {
          adherent: true
        }
      });
      
      console.log(`✅ Utilisateur créé: ${user.email} (ID: ${user.id})`);
      console.log(`   Adhérent: ${user.adherent?.firstname} ${user.adherent?.lastname}`);
    }

    console.log('🎉 Tous les utilisateurs de test ont été créés avec succès!');
    console.log('\n📋 Résumé des comptes créés:');
    console.log('=====================================');
    
    for (const userData of testUsers) {
      console.log(`📧 ${userData.email} | 🔑 password | 👤 ${userData.adherent.firstname} ${userData.adherent.lastname} | 🎭 ${userData.role}`);
    }
    
    console.log('\n🔐 Tous les comptes utilisent le mot de passe: password');
    console.log('💡 Vous pouvez maintenant vous connecter avec n\'importe lequel de ces comptes pour tester l\'application.');
    
  } catch (error) {
    console.error('❌ Erreur lors de la création des utilisateurs:', error);
    throw error;
  }
}

async function main() {
  try {
    await createTestUsers();
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

export { createTestUsers, testUsers };
