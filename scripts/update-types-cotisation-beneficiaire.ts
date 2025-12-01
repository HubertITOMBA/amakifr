import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Script pour mettre à jour les types de cotisation existants
 * et définir aBeneficiaire = true pour les types d'assistance
 * 
 * Exécuter avec: npm run db:update-types-beneficiaire
 */
async function updateTypesCotisationBeneficiaire() {
  try {
    console.log("🔄 Mise à jour des types de cotisation avec le champ aBeneficiaire...\n");

    // Types d'assistance qui nécessitent un bénéficiaire
    const assistanceTypes = [
      "Assistance anniversaire en salle",
      "Assistance mariage",
      "Assistance décès",
      "Décès",
      "Naissance",
      "Anniversaire en salle",
      "Mariage",
    ];

    // Mettre à jour tous les types d'assistance
    let updatedCount = 0;
    for (const typeName of assistanceTypes) {
      const result = await prisma.typeCotisationMensuelle.updateMany({
        where: {
          nom: { contains: typeName, mode: "insensitive" },
        },
        data: {
          aBeneficiaire: true,
        },
      });

      if (result.count > 0) {
        console.log(`  ✅ ${result.count} type(s) "${typeName}" mis à jour avec aBeneficiaire = true`);
        updatedCount += result.count;
      }
    }

    // S'assurer que tous les autres types ont aBeneficiaire = false
    const otherTypes = await prisma.typeCotisationMensuelle.updateMany({
      where: {
        AND: [
          { aBeneficiaire: { not: true } },
          {
            NOT: {
              OR: assistanceTypes.map(name => ({
                nom: { contains: name, mode: "insensitive" },
              })),
            },
          },
        ],
      },
      data: {
        aBeneficiaire: false,
      },
    });

    if (otherTypes.count > 0) {
      console.log(`  ✅ ${otherTypes.count} autre(s) type(s) mis à jour avec aBeneficiaire = false`);
    }

    // Afficher le résumé
    const totalTypes = await prisma.typeCotisationMensuelle.count();
    const typesAvecBeneficiaire = await prisma.typeCotisationMensuelle.count({
      where: { aBeneficiaire: true },
    });

    console.log(`\n📊 Résumé:`);
    console.log(`   - Total types: ${totalTypes}`);
    console.log(`   - Types avec bénéficiaire: ${typesAvecBeneficiaire}`);
    console.log(`   - Types sans bénéficiaire: ${totalTypes - typesAvecBeneficiaire}`);
    console.log(`\n✅ Mise à jour terminée !`);

  } catch (error) {
    console.error("❌ Erreur lors de la mise à jour:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le script
updateTypesCotisationBeneficiaire()
  .then(() => {
    console.log("\n✅ Script terminé");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Erreur fatale:", error);
    process.exit(1);
  });

