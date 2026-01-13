import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Script pour mettre à jour les codes des postes dans postes_templates
 * pour les aligner avec les rôles de menu (MenuRole)
 * 
 * Mapping:
 * - PRESID (Président) -> code: PRESID
 * - VICEPR (Vice-Président) -> code: VICEPR
 * - SECRET (Secrétaire) -> code: SECRET
 * - VICESE (Vice-Secrétaire) -> code: VICESE
 * - COMCPT (Comptable/Trésorier) -> code: COMCPT
 * - MEMBRE (Membre simple) -> code: MEMBRE (par défaut)
 */
async function updatePostesRoles() {
  console.log("🔧 Mise à jour des codes de postes...\n");

  try {
    // Mapping des postes vers les rôles de menu
    const postesMapping = [
      {
        nom: "Président",
        nouveauCode: "PRESID",
        description: "Président de l'association",
      },
      {
        nom: "Vice-Président",
        nouveauCode: "VICEPR",
        description: "Vice-Président de l'association",
      },
      {
        nom: "Secrétaire",
        nouveauCode: "SECRET",
        description: "Secrétaire de l'association",
      },
      {
        nom: "Vice-Secrétaire",
        nouveauCode: "VICESE",
        description: "Vice-Secrétaire de l'association",
      },
      {
        nom: "Trésorier",
        nouveauCode: "COMCPT",
        description: "Comptable/Trésorier de l'association",
      },
      {
        nom: "Comptable",
        nouveauCode: "COMCPT",
        description: "Comptable de l'association",
      },
      {
        nom: "Membre",
        nouveauCode: "MEMBRE",
        description: "Membre simple de l'association",
      },
      {
        nom: "Membre de l'association",
        nouveauCode: "MEMBRE",
        description: "Membre simple de l'association",
      },
    ];

    let updatedCount = 0;
    let notFoundCount = 0;

    for (const mapping of postesMapping) {
      // Chercher le poste par nom
      const poste = await prisma.posteTemplate.findFirst({
        where: {
          nom: {
            contains: mapping.nom,
            mode: "insensitive",
          },
        },
      });

      if (poste) {
        // Mettre à jour le code
        await prisma.posteTemplate.update({
          where: { id: poste.id },
          data: {
            code: mapping.nouveauCode,
            description: mapping.description,
          },
        });

        console.log(
          `✅ Poste "${poste.nom}" -> code: ${mapping.nouveauCode}`
        );
        updatedCount++;
      } else {
        console.log(
          `⚠️  Poste "${mapping.nom}" non trouvé dans la base de données`
        );
        notFoundCount++;
      }
    }

    console.log(`\n📊 Résumé:`);
    console.log(`- Postes mis à jour: ${updatedCount}`);
    console.log(`- Postes non trouvés: ${notFoundCount}`);

    // Afficher tous les postes actuels
    console.log(`\n📋 Liste des postes après mise à jour:\n`);
    const allPostes = await prisma.posteTemplate.findMany({
      orderBy: { ordre: "asc" },
    });

    for (const poste of allPostes) {
      console.log(
        `- ${poste.nom.padEnd(30)} | Code: ${(poste.code || "N/A").padEnd(10)} | Ordre: ${poste.ordre}`
      );
    }

    console.log(`\n💡 Note: Les codes de postes peuvent maintenant être utilisés pour mapper`);
    console.log(`   les rôles des adhérents aux rôles de menu (MenuRole).`);
    console.log(`\n   Pour activer cette fonctionnalité, il faudra:`);
    console.log(`   1. Charger le poste de l'adhérent depuis la DB`);
    console.log(`   2. Mapper le code du poste vers le rôle de menu correspondant`);
    console.log(`   3. Ajouter ce rôle aux rôles de l'utilisateur`);

  } catch (error) {
    console.error("❌ Erreur lors de la mise à jour:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le script
updatePostesRoles()
  .then(() => {
    console.log("\n✨ Script terminé avec succès!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Erreur fatale:", error);
    process.exit(1);
  });
