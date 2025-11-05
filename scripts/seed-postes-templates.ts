import prisma from "../lib/prisma";
import { PositionType } from "@prisma/client";

/**
 * Script pour migrer les postes de l'enum vers la table PosteTemplate
 */
async function seedPostesTemplates() {
  console.log("🌱 Démarrage de la migration des postes...");

  try {
    // Vérifier s'il y a déjà des postes
    const existingPostes = await prisma.posteTemplate.count();
    if (existingPostes > 0) {
      console.log(`⚠️  ${existingPostes} poste(s) déjà existant(s). Migration annulée.`);
      return;
    }

    // Récupérer un admin pour createdBy
    const admin = await prisma.user.findFirst({
      where: { role: "Admin" },
    });

    if (!admin) {
      console.error("❌ Aucun administrateur trouvé. Impossible de créer les postes.");
      return;
    }

    // Mapping des postes existants avec codes de 6 caractères
    const postesToCreate = [
      {
        code: "PRESID",
        libelle: "Président",
        description: "Responsable de la direction de l'association",
        ordre: 1,
        nombreMandatsDefaut: 1,
        dureeMandatDefaut: 24,
      },
      {
        code: "VICEPR",
        libelle: "Vice-Président",
        description: "Assiste le président dans ses fonctions",
        ordre: 2,
        nombreMandatsDefaut: 1,
        dureeMandatDefaut: 24,
      },
      {
        code: "SECRET",
        libelle: "Secrétaire",
        description: "Gère l'administration et la communication de l'association",
        ordre: 3,
        nombreMandatsDefaut: 1,
        dureeMandatDefaut: 24,
      },
      {
        code: "VICESE",
        libelle: "Vice-Secrétaire",
        description: "Assiste le secrétaire dans ses fonctions",
        ordre: 4,
        nombreMandatsDefaut: 1,
        dureeMandatDefaut: 24,
      },
      {
        code: "TRESOR",
        libelle: "Trésorier",
        description: "Gère les finances de l'association",
        ordre: 5,
        nombreMandatsDefaut: 1,
        dureeMandatDefaut: 24,
      },
      {
        code: "VICETR",
        libelle: "Vice-Trésorier",
        description: "Assiste le trésorier dans ses fonctions",
        ordre: 6,
        nombreMandatsDefaut: 1,
        dureeMandatDefaut: 24,
      },
      {
        code: "COMCPT",
        libelle: "Commissaire aux comptes",
        description: "Contrôle les comptes de l'association",
        ordre: 7,
        nombreMandatsDefaut: 1,
        dureeMandatDefaut: 24,
      },
      {
        code: "MEMCDI",
        libelle: "Membre du comité directeur",
        description: "Membre du comité directeur de l'association",
        ordre: 8,
        nombreMandatsDefaut: 1,
        dureeMandatDefaut: 24,
      },
    ];

    // Créer les postes
    const createdPostes = await Promise.all(
      postesToCreate.map((poste) =>
        prisma.posteTemplate.create({
          data: {
            ...poste,
            createdBy: admin.id,
            actif: true,
          },
        })
      )
    );

    console.log(`✅ ${createdPostes.length} poste(s) créé(s) avec succès !`);
    console.log("📋 Postes créés :");
    createdPostes.forEach((poste) => {
      console.log(`   - ${poste.libelle} (${poste.code})`);
    });
  } catch (error) {
    console.error("❌ Erreur lors de la migration des postes:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le script
if (require.main === module) {
  seedPostesTemplates()
    .then(() => {
      console.log("✨ Migration terminée avec succès !");
      process.exit(0);
    })
    .catch((error) => {
      console.error("💥 Erreur fatale:", error);
      process.exit(1);
    });
}

export default seedPostesTemplates;

