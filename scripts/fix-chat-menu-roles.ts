#!/usr/bin/env tsx

/**
 * Script pour corriger les rôles du menu Chat
 * Le menu Chat doit être accessible à tous les membres, pas seulement aux admins
 * 
 * Usage: npx tsx scripts/fix-chat-menu-roles.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  log: ['error', 'warn'],
});

async function main() {
  console.log("🔧 Correction des rôles du menu Chat");
  console.log("====================================\n");

  try {
    // Connexion à la base
    console.log("🔌 Connexion à la base de données...");
    await prisma.$connect();
    console.log("✅ Connexion réussie\n");

    // Trouver le menu Chat
    console.log("🔍 Recherche du menu Chat...");
    const chatMenu = await prisma.menu.findFirst({
      where: {
        lien: "/chat",
      },
    });

    if (!chatMenu) {
      console.error("❌ Menu Chat non trouvé");
      console.error("   Vérifiez que le menu existe dans la base de données");
      console.error("");
      console.log("💡 Pour créer le menu Chat, exécutez :");
      console.log("   npx tsx scripts/seed-menus.ts");
      process.exit(1);
    }

    console.log(`✅ Menu trouvé : "${chatMenu.libelle}" (ID: ${chatMenu.id})`);
    console.log(`   Rôles actuels : ${JSON.stringify(chatMenu.roles)}`);
    console.log("");

    // Définir les nouveaux rôles (tous les membres peuvent accéder au chat)
    const nouveauxRoles = [
      "ADMIN",
      "PRESID",
      "VICEPR",
      "SECRET",
      "VICESE",
      "COMCPT",
      "MEMBRE",
      // Note: INVITE et VISITEUR ne sont pas inclus volontairement
      // car ils n'ont pas besoin d'accéder au chat interne
    ];

    console.log("📝 Mise à jour des rôles...");
    const updatedMenu = await prisma.menu.update({
      where: {
        id: chatMenu.id,
      },
      data: {
        roles: nouveauxRoles,
      },
    });

    console.log("✅ Rôles mis à jour avec succès !");
    console.log(`   Nouveaux rôles : ${JSON.stringify(updatedMenu.roles)}`);
    console.log("");

    // Résumé
    console.log("=".repeat(50));
    console.log("✨ MISE À JOUR TERMINÉE AVEC SUCCÈS !");
    console.log("=".repeat(50));
    console.log("");
    console.log("📊 Résumé :");
    console.log("   - Menu : Chat");
    console.log("   - Anciens rôles : " + JSON.stringify(chatMenu.roles));
    console.log("   - Nouveaux rôles : " + JSON.stringify(nouveauxRoles));
    console.log("   - Nombre de rôles autorisés : " + nouveauxRoles.length);
    console.log("");
    console.log("✅ Tous les membres peuvent maintenant accéder au chat !");
    console.log("");
    console.log("💡 Prochaines étapes :");
    console.log("   1. Redémarrez l'application : pm2 restart amakifr");
    console.log("   2. Vérifiez que le menu Chat apparaît pour les membres");
    console.log("   3. Testez la création de conversations");
    console.log("");

  } catch (error) {
    console.error("\n❌ Erreur lors de la mise à jour :", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .then(() => {
    console.log("✅ Script terminé");
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Erreur fatale :", error);
    process.exit(1);
  });
