import { PrismaClient, TypeCotisation, MoyenPaiement } from '@prisma/client';

const prisma = new PrismaClient();

// Données de test pour les cotisations et obligations
const testCotisations = [
  {
    type: 'Adhesion' as TypeCotisation,
    montant: 50.00,
    moyenPaiement: 'Virement' as MoyenPaiement,
    description: 'Cotisation d\'adhésion annuelle 2024',
    reference: 'VIR-2024-001',
    statut: 'Valide'
  },
  {
    type: 'Forfait' as TypeCotisation,
    montant: 120.00,
    moyenPaiement: 'Cheque' as MoyenPaiement,
    description: 'Forfait assistance annuel',
    reference: 'CHQ-2024-002',
    statut: 'Valide'
  },
  {
    type: 'Assistance' as TypeCotisation,
    montant: 25.00,
    moyenPaiement: 'Especes' as MoyenPaiement,
    description: 'Cotisation assistance mensuelle',
    reference: 'ESP-2024-003',
    statut: 'Valide'
  },
  {
    type: 'Anniversaire' as TypeCotisation,
    montant: 30.00,
    moyenPaiement: 'CarteBancaire' as MoyenPaiement,
    description: 'Cotisation anniversaire',
    reference: 'CB-2024-004',
    statut: 'EnAttente'
  }
];

const testObligations = [
  {
    type: 'Adhesion' as TypeCotisation,
    montantAttendu: 50.00,
    montantPaye: 50.00,
    montantRestant: 0.00,
    periode: '2024-Adhésion',
    statut: 'Paye',
    description: 'Cotisation d\'adhésion 2024'
  },
  {
    type: 'Forfait' as TypeCotisation,
    montantAttendu: 120.00,
    montantPaye: 60.00,
    montantRestant: 60.00,
    periode: '2024-Forfait',
    statut: 'PartiellementPaye',
    description: 'Forfait assistance annuel - Paiement partiel'
  },
  {
    type: 'Assistance' as TypeCotisation,
    montantAttendu: 25.00,
    montantPaye: 0.00,
    montantRestant: 25.00,
    periode: '2024-12',
    statut: 'EnAttente',
    description: 'Cotisation assistance décembre 2024'
  },
  {
    type: 'Anniversaire' as TypeCotisation,
    montantAttendu: 30.00,
    montantPaye: 0.00,
    montantRestant: 30.00,
    periode: '2024-Anniversaire',
    statut: 'EnRetard',
    description: 'Cotisation anniversaire - En retard'
  }
];

async function createFinancialFixtures() {
  console.log('💰 Création des fixtures financières...');

  try {
    // Récupérer tous les adhérents
    const adherents = await prisma.adherent.findMany({
      include: {
        User: true
      }
    });

    if (adherents.length === 0) {
      throw new Error('Aucun adhérent trouvé. Veuillez d\'abord exécuter npm run db:seed');
    }

    console.log(`👥 ${adherents.length} adhérents trouvés`);

    // Supprimer les données existantes
    console.log('🧹 Nettoyage des données financières existantes...');
    await prisma.cotisation.deleteMany();
    await prisma.obligationCotisation.deleteMany();

    // Créer des cotisations pour chaque adhérent
    for (const adherent of adherents) {
      console.log(`💳 Création des cotisations pour: ${adherent.firstname} ${adherent.lastname}`);

      // Créer 2-4 cotisations aléatoires par adhérent
      const numCotisations = Math.floor(Math.random() * 3) + 2; // 2 à 4 cotisations
      const selectedCotisations = testCotisations
        .sort(() => 0.5 - Math.random())
        .slice(0, numCotisations);

      for (const cotisationData of selectedCotisations) {
        // Générer des dates aléatoires dans les 12 derniers mois
        const randomDays = Math.floor(Math.random() * 365);
        const dateCotisation = new Date();
        dateCotisation.setDate(dateCotisation.getDate() - randomDays);

        const cotisation = await prisma.cotisation.create({
          data: {
            adherentId: adherent.id,
            type: cotisationData.type,
            montant: cotisationData.montant,
            dateCotisation: dateCotisation,
            moyenPaiement: cotisationData.moyenPaiement,
            description: cotisationData.description,
            reference: `${cotisationData.reference}-${adherent.id.slice(-4)}`,
            statut: cotisationData.statut,
          },
        });

        console.log(`  ✅ Cotisation créée: ${cotisationData.type} - ${cotisationData.montant}€ (${cotisationData.statut})`);
      }

      // Créer des obligations pour chaque adhérent
      console.log(`📋 Création des obligations pour: ${adherent.firstname} ${adherent.lastname}`);

      for (const obligationData of testObligations) {
        // Générer des dates d'échéance variées
        const randomDays = Math.floor(Math.random() * 180) + 30; // 30 à 210 jours
        const dateEcheance = new Date();
        dateEcheance.setDate(dateEcheance.getDate() + randomDays);

        const obligation = await prisma.obligationCotisation.create({
          data: {
            adherentId: adherent.id,
            type: obligationData.type,
            montantAttendu: obligationData.montantAttendu,
            montantPaye: obligationData.montantPaye,
            montantRestant: obligationData.montantRestant,
            dateEcheance: dateEcheance,
            periode: `${obligationData.periode}-${adherent.id.slice(-4)}`,
            statut: obligationData.statut,
            description: obligationData.description,
          },
        });

        console.log(`  ✅ Obligation créée: ${obligationData.type} - ${obligationData.montantAttendu}€ (${obligationData.statut})`);
      }
    }

    // Statistiques finales
    const totalCotisations = await prisma.cotisation.count();
    const totalObligations = await prisma.obligationCotisation.count();

    console.log('🎉 Toutes les fixtures financières ont été créées avec succès!');
    console.log('\n📊 Statistiques:');
    console.log('================');
    console.log(`💰 Cotisations créées: ${totalCotisations}`);
    console.log(`📋 Obligations créées: ${totalObligations}`);
    console.log(`👥 Adhérents concernés: ${adherents.length}`);

    console.log('\n💡 Types de cotisations créées:');
    console.log('===============================');
    testCotisations.forEach(cotisation => {
      console.log(`• ${cotisation.type}: ${cotisation.montant}€ (${cotisation.statut})`);
    });

    console.log('\n📋 Types d\'obligations créées:');
    console.log('===============================');
    testObligations.forEach(obligation => {
      console.log(`• ${obligation.type}: ${obligation.montantAttendu}€ attendu, ${obligation.montantPaye}€ payé, ${obligation.montantRestant}€ restant (${obligation.statut})`);
    });

    console.log('\n🔍 Vous pouvez maintenant tester la section "Mes Cotisations" dans le profil utilisateur.');

  } catch (error) {
    console.error('💥 Erreur lors de la création des fixtures financières:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le script
createFinancialFixtures();
