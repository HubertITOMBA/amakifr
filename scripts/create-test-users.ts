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

async function createTestUsers() {
  console.log('🚀 Création des utilisateurs de test...');
  
  try {
    // Supprimer les utilisateurs existants (cascade supprimera aussi les adhérents)
    console.log('🧹 Nettoyage des données existantes...');
    await prisma.user.deleteMany({
      where: {
        email: {
          in: testUsers.map(user => user.email)
        }
      }
    });

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
