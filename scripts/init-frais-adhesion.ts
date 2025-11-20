/**
 * Script d'initialisation des frais d'adhésion
 * 
 * Ce script crée la configuration initiale des frais d'adhésion à 50,00 €
 * 
 * Usage:
 *   npx tsx scripts/init-frais-adhesion.ts
 * 
 * Ou avec ts-node:
 *   ts-node scripts/init-frais-adhesion.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function initFraisAdhesion() {
  try {
    console.log("🚀 Initialisation des frais d'adhésion...\n");

    // Vérifier si une configuration existe déjà
    const existingConfig = await prisma.configurationFraisAdhesion.findFirst({
      where: { actif: true },
    });

    if (existingConfig) {
      console.log("⚠️  Une configuration active existe déjà :");
      console.log(`   - Montant: ${Number(existingConfig.montantFraisAdhesion).toFixed(2)} €`);
      console.log(`   - Description: ${existingConfig.description || "Aucune"}`);
      console.log(`   - Créée le: ${existingConfig.createdAt.toLocaleDateString("fr-FR")}`);
      console.log("\n❌ Aucune nouvelle configuration n'a été créée.");
      console.log("   Pour créer une nouvelle configuration, désactivez d'abord la configuration existante.");
      return;
    }

    // Récupérer le premier utilisateur admin pour créer la configuration
    const admin = await prisma.user.findFirst({
      where: {
        role: "Admin",
        status: "Actif",
      },
    });

    if (!admin) {
      console.error("❌ Aucun administrateur actif trouvé.");
      console.error("   Veuillez créer un administrateur avant d'initialiser les frais d'adhésion.");
      return;
    }

    // Créer la configuration initiale
    const config = await prisma.configurationFraisAdhesion.create({
      data: {
        montantFraisAdhesion: 50.0,
        description: "Frais d'adhésion initial - 50,00 €",
        actif: true,
        createdBy: admin.id,
      },
    });

    console.log("✅ Configuration des frais d'adhésion créée avec succès !\n");
    console.log("📋 Détails :");
    console.log(`   - ID: ${config.id}`);
    console.log(`   - Montant: ${Number(config.montantFraisAdhesion).toFixed(2)} €`);
    console.log(`   - Description: ${config.description}`);
    console.log(`   - Statut: ${config.actif ? "Actif" : "Inactif"}`);
    console.log(`   - Créée par: ${admin.name || admin.email}`);
    console.log(`   - Date de création: ${config.createdAt.toLocaleDateString("fr-FR")} ${config.createdAt.toLocaleTimeString("fr-FR")}`);
    console.log("\n✨ Les nouveaux adhérents devront payer 50,00 € de frais d'adhésion.");
    console.log("   Les anciens adhérents (inscrits avant le 10/10/2026) ne paieront pas ces frais.");
  } catch (error) {
    console.error("❌ Erreur lors de l'initialisation des frais d'adhésion :", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le script
initFraisAdhesion()
  .then(() => {
    console.log("\n✅ Script terminé avec succès !");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Erreur lors de l'exécution du script :", error);
    process.exit(1);
  });

