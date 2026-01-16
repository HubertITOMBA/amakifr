import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  log: ['error', 'warn'],
});

/**
 * Script pour ajouter le menu RGPD dans la sidebar admin
 * Ce script peut être exécuté sans supprimer les menus existants
 */
async function addRGPDMenu() {
  console.log("🌱 Ajout du menu RGPD...");

  try {
    await prisma.$connect();
    console.log("✅ Connexion à la base de données réussie");

    // Vérifier si le menu existe déjà
    const existingMenu = await prisma.menu.findFirst({
      where: {
        lien: "/admin/rgpd/demandes",
        niveau: "SIDEBAR",
      },
    });

    if (existingMenu) {
      console.log("ℹ️  Le menu RGPD existe déjà (ID: " + existingMenu.id + ")");
      console.log("✅ Aucune action nécessaire");
      return;
    }

    // Trouver le dernier ordre dans la sidebar
    const lastMenu = await prisma.menu.findFirst({
      where: {
        niveau: "SIDEBAR",
      },
      orderBy: {
        ordre: "desc",
      },
    });

    const newOrdre = lastMenu ? lastMenu.ordre + 1 : 26;

    // Créer le menu RGPD
    const rgpdMenu = await prisma.menu.create({
      data: {
        libelle: "Demandes RGPD",
        description: "Gérer les demandes de suppression de données",
        lien: "/admin/rgpd/demandes",
        niveau: "SIDEBAR",
        roles: ["ADMIN"],
        icone: "Shield",
        statut: true,
        ordre: newOrdre,
        electoral: false,
        parent: null,
        createdBy: null,
      },
    });

    console.log(`✅ Menu RGPD créé (ID: ${rgpdMenu.id}, Ordre: ${newOrdre})`);
    console.log("");
    console.log("=".repeat(50));
    console.log("✨ MENU RGPD AJOUTÉ AVEC SUCCÈS !");
    console.log("=".repeat(50));
    console.log("");

  } catch (error) {
    console.error("❌ Erreur lors de l'ajout du menu:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le script
if (require.main === module) {
  addRGPDMenu()
    .then(() => {
      console.log("✅ Script terminé avec succès");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Erreur:", error);
      process.exit(1);
    });
}

export { addRGPDMenu };
