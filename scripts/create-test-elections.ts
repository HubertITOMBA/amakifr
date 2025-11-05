import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Données de test pour les élections
const testElections = [
  {
    titre: 'Élection du Comité Directeur 2024',
    description: 'Élection des membres du comité directeur pour l\'année 2024',
    status: 'Ouverte' as const,
    dateOuverture: new Date('2024-01-01'),
    dateCloture: new Date('2024-12-31'),
    dateScrutin: new Date('2024-12-31'),
    // dateClotureCandidature sera calculée automatiquement (10 jours avant dateScrutin)
    createdBy: 'admin-user-id', // Sera remplacé par l'ID réel de l'admin
    positions: [
      {
        type: 'President' as const,
        titre: 'Président',
        description: 'Représentant légal de l\'association',
        nombreMandats: 1,
        dureeMandat: 12,
        conditions: 'Membre actif depuis au moins 2 ans'
      },
      {
        type: 'VicePresident' as const,
        titre: 'Vice-Président',
        description: 'Suppléant du Président',
        nombreMandats: 1,
        dureeMandat: 12,
        conditions: 'Membre actif'
      },
      {
        type: 'Secretaire' as const,
        titre: 'Secrétaire',
        description: 'Gestion administrative',
        nombreMandats: 1,
        dureeMandat: 12,
        conditions: 'Membre actif'
      },
      {
        type: 'Tresorier' as const,
        titre: 'Trésorier',
        description: 'Gestion financière',
        nombreMandats: 1,
        dureeMandat: 12,
        conditions: 'Membre actif'
      },
      {
        type: 'MembreComiteDirecteur' as const,
        titre: 'Membre du Comité Directeur',
        description: 'Membre du comité directeur',
        nombreMandats: 3,
        dureeMandat: 12,
        conditions: 'Membre actif'
      }
    ]
  },
  {
    titre: 'Élection du Comité Directeur 2023',
    description: 'Élection des membres du comité directeur pour l\'année 2023 (clôturée)',
    status: 'Cloturee' as const,
    dateOuverture: new Date('2023-01-01'),
    dateCloture: new Date('2023-12-31'),
    dateScrutin: new Date('2023-12-31'),
    // dateClotureCandidature sera calculée automatiquement (10 jours avant dateScrutin)
    createdBy: 'admin-user-id', // Sera remplacé par l'ID réel de l'admin
    positions: [
      {
        type: 'President' as const,
        titre: 'Président',
        description: 'Représentant légal de l\'association',
        nombreMandats: 1,
        dureeMandat: 12,
        conditions: 'Membre actif depuis au moins 2 ans'
      },
      {
        type: 'VicePresident' as const,
        titre: 'Vice-Président',
        description: 'Suppléant du Président',
        nombreMandats: 1,
        dureeMandat: 12,
        conditions: 'Membre actif'
      }
    ]
  }
];

async function createTestElections() {
  console.log('🗳️ Création des élections de test...');
  
  try {
    // Supprimer les élections existantes
    console.log('🧹 Nettoyage des élections existantes...');
    await prisma.election.deleteMany({
      where: {
        titre: {
          in: testElections.map(election => election.titre)
        }
      }
    });

    // Récupérer l'admin pour createdBy
    const admin = await prisma.user.findFirst({
      where: { email: 'admin@amaki.fr' }
    });

    if (!admin) {
      throw new Error('Admin non trouvé. Veuillez d\'abord exécuter npm run db:seed');
    }

    // Récupérer les adhérents pour créer des candidatures
    const adherents = await prisma.adherent.findMany({
      include: {
        User: true
      }
    });

    console.log(`👥 ${adherents.length} adhérents trouvés pour les candidatures`);

    // Créer les élections avec leurs positions
    for (const electionData of testElections) {
      console.log(`🗳️ Création de l'élection: ${electionData.titre}`);
      
      // Calculer les dates selon les règles:
      // 1. dateOuverture < dateClotureCandidature
      // 2. dateClotureCandidature < dateScrutin
      // 3. dateCloture > dateScrutin
      const dateOuverture = new Date(electionData.dateOuverture);
      const dateScrutin = new Date(electionData.dateScrutin);
      
      // Calculer la date de clôture des candidatures (10 jours avant le scrutin)
      const dateClotureCandidature = new Date(dateScrutin);
      dateClotureCandidature.setDate(dateScrutin.getDate() - 10);
      
      // S'assurer que dateClotureCandidature est après dateOuverture
      if (dateClotureCandidature <= dateOuverture) {
        dateClotureCandidature.setDate(dateOuverture.getDate() + 1);
      }
      
      // Ajuster dateCloture pour qu'elle soit après dateScrutin
      const dateCloture = new Date(dateScrutin);
      dateCloture.setDate(dateScrutin.getDate() + 1);

      const election = await prisma.election.create({
        data: {
          titre: electionData.titre,
          description: electionData.description,
          status: electionData.status,
          dateOuverture: dateOuverture,
          dateCloture: dateCloture,
          dateClotureCandidature: dateClotureCandidature,
          dateScrutin: dateScrutin,
          createdBy: admin.id,
          positions: {
            create: electionData.positions.map(position => ({
              type: position.type,
              titre: position.titre,
              description: position.description,
              nombreMandats: position.nombreMandats,
              dureeMandat: position.dureeMandat,
              conditions: position.conditions
            }))
          }
        },
        include: {
          positions: true
        }
      });

      console.log(`✅ Élection créée: ${election.titre} (ID: ${election.id})`);
      console.log(`   Positions: ${election.positions.length}`);

      // Créer des candidatures pour chaque position
      for (const position of election.positions) {
        console.log(`   📝 Création de candidatures pour: ${position.titre}`);
        
        // Sélectionner quelques adhérents au hasard pour candidater
        const shuffledAdherents = adherents.sort(() => 0.5 - Math.random());
        const candidatesCount = Math.min(3, shuffledAdherents.length); // Max 3 candidats par poste
        
        for (let i = 0; i < candidatesCount; i++) {
          const adherent = shuffledAdherents[i];
          
          // Définir le statut de candidature
          let status: 'EnAttente' | 'Validee' | 'Rejetee' = 'EnAttente';
          if (Math.random() > 0.3) { // 70% de chance d'être validé
            status = 'Validee';
          } else if (Math.random() > 0.8) { // 20% de chance d'être rejeté
            status = 'Rejetee';
          }

          const candidacy = await prisma.candidacy.create({
            data: {
              electionId: election.id,
              positionId: position.id,
              adherentId: adherent.id,
              status: status,
              motivation: `Je souhaite candidater pour le poste de ${position.titre} car j'ai l'expérience nécessaire et la motivation pour contribuer au développement de l'association.`,
              programme: `Mon programme pour le poste de ${position.titre} inclut:\n- Amélioration de la communication\n- Développement des activités\n- Renforcement de la cohésion\n- Transparence dans la gestion`
            }
          });

          console.log(`     ✅ Candidature créée: ${adherent.firstname} ${adherent.lastname} (${status})`);
        }
      }
    }

    console.log('🎉 Toutes les élections de test ont été créées avec succès!');
    console.log('\n📋 Résumé des élections créées:');
    console.log('=====================================');
    
    for (const electionData of testElections) {
      console.log(`🗳️ ${electionData.titre} | 📊 ${electionData.status} | 📅 ${electionData.dateOuverture.toLocaleDateString()} - ${electionData.dateCloture.toLocaleDateString()}`);
    }
    
    console.log('\n💡 Vous pouvez maintenant tester le système de vote avec ces élections.');
    
  } catch (error) {
    console.error('❌ Erreur lors de la création des élections:', error);
    throw error;
  }
}

async function main() {
  try {
    await createTestElections();
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

export { createTestElections, testElections };
