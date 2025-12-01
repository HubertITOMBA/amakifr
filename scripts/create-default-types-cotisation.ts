import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

async function createDefaultTypesCotisationMensuelle() {
  console.log('🏦 Création des types de cotisation mensuelle par défaut...');

  try {
    // Trouver un admin pour créer les types
    const admin = await prisma.user.findFirst({
      where: { role: UserRole.Admin }
    });

    if (!admin) {
      throw new Error('Aucun administrateur trouvé. Veuillez d\'abord créer un utilisateur admin.');
    }

    console.log(`👤 Admin trouvé: ${admin.email}`);

    // Types de cotisation par défaut
    const typesParDefaut = [
      {
        nom: "Forfait Mensuel",
        description: "Cotisation forfait mensuelle obligatoire",
        montant: 15.00,
        obligatoire: true,
        actif: true,
        ordre: 1,
        aBeneficiaire: false
      },
      {
        nom: "Assistance anniversaire en salle",
        description: "Assistance anniversaire en salle",
        montant: 50.00,
        obligatoire: true,
        actif: true,
        ordre: 2,
        aBeneficiaire: true // Nécessite un adhérent bénéficiaire
      },
      {
        nom: "Assistance mariage",
        description: "Assistance mariage de l'adhérent ou de son enfant ",
        montant: 50.00,
        obligatoire: true,
        actif: true,
        ordre: 3,
        aBeneficiaire: true // Nécessite un adhérent bénéficiaire
      },
      {
        nom: "Assistance décès",
        description: "Assistance décès d'un membre de la famille restreint de l'adhérent",
        montant: 50.00,
        obligatoire: true,
        actif: true,
        ordre: 4,
        aBeneficiaire: true // Nécessite un adhérent bénéficiaire
      },
      {
        nom: "Formation",
        description: "Cotisation pour les formations et événements",
        montant: 25.00,
        obligatoire: false,
        actif: true,
        ordre: 5,
        aBeneficiaire: false
      },
      {
        nom: "Matériel",
        description: "Cotisation pour l'achat de matériel",
        montant: 10.00,
        obligatoire: false,
        actif: true,
        ordre: 6,
        aBeneficiaire: false
      }
    ];

    // Vérifier si des types existent déjà
    const typesExistants = await prisma.typeCotisationMensuelle.count();
    if (typesExistants > 0) {
      console.log(`⚠️  ${typesExistants} type(s) de cotisation existent déjà.`);
      console.log('Voulez-vous continuer et ajouter les types par défaut ? (y/N)');
      // Pour l'automatisation, on continue
    }

    console.log('📝 Création des types de cotisation...');

    for (const typeData of typesParDefaut) {
      const typeExistant = await prisma.typeCotisationMensuelle.findFirst({
        where: { nom: typeData.nom }
      });

      if (typeExistant) {
        console.log(`  ⚠️  Type "${typeData.nom}" existe déjà, ignoré.`);
        continue;
      }

      const typeCotisation = await prisma.typeCotisationMensuelle.create({
        data: {
          ...typeData,
          createdBy: admin.id
        }
      });

      console.log(`  ✅ Type créé: ${typeCotisation.nom} - ${typeCotisation.montant}€ (${typeCotisation.obligatoire ? 'Obligatoire' : 'Optionnel'})`);
    }

    console.log('🎉 Types de cotisation mensuelle créés avec succès!');
    
    // Afficher le résumé
    const totalTypes = await prisma.typeCotisationMensuelle.count();
    const typesActifs = await prisma.typeCotisationMensuelle.count({
      where: { actif: true }
    });
    const typesObligatoires = await prisma.typeCotisationMensuelle.count({
      where: { obligatoire: true }
    });

    console.log(`\n📊 Résumé:\n================`);
    console.log(`📋 Total types: ${totalTypes}`);
    console.log(`✅ Types actifs: ${typesActifs}`);
    console.log(`🔒 Types obligatoires: ${typesObligatoires}`);
    console.log(`📝 Types optionnels: ${totalTypes - typesObligatoires}`);

    console.log('\n💡 Vous pouvez maintenant:');
    console.log('• Créer des cotisations mensuelles avec ces types');
    console.log('• Modifier les montants et paramètres');
    console.log('• Ajouter de nouveaux types selon vos besoins');

  } catch (error) {
    console.error('💥 Erreur fatale lors de la création des types:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

createDefaultTypesCotisationMensuelle();
