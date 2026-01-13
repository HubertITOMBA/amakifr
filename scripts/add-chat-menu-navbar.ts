#!/usr/bin/env tsx

/**
 * Script pour ajouter le menu Chat dans la NAVBAR
 * Permet aux adhérents d'accéder facilement au chat depuis n'importe quelle page
 * 
 * Usage: npx tsx scripts/add-chat-menu-navbar.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  log: ['error', 'warn'],
});

async function main() {
  console.log("📱 Ajout du menu Chat dans la NAVBAR");
  console.log("====================================\n");

  try {
    // Connexion
    console.log("🔌 Connexion à la base de données...");
    await prisma.$connect();
    console.log("✅ Connexion réussie\n");

    // Vérifier si le menu Chat existe déjà dans la NAVBAR
    console.log("🔍 Vérification du menu Chat dans la NAVBAR...");
    const existingNavbarChat = await prisma.menu.findFirst({
      where: {
        lien: "/chat",
        niveau: "NAVBAR",
      },
    });

    if (existingNavbarChat) {
      console.log("⏭️  Le menu Chat existe déjà dans la NAVBAR");
      console.log(`   ID: ${existingNavbarChat.id}`);
      console.log(`   Rôles: ${JSON.stringify(existingNavbarChat.roles)}`);
      console.log("");
      
      // Mettre à jour les rôles si nécessaire
      const rolesAttendu = ["ADMIN", "PRESID", "VICEPR", "SECRET", "VICESE", "COMCPT", "MEMBRE"];
      const rolesActuels = existingNavbarChat.roles;
      const rolesDifferents = JSON.stringify(rolesAttendu.sort()) !== JSON.stringify(rolesActuels.sort());
      
      if (rolesDifferents) {
        console.log("📝 Mise à jour des rôles...");
        await prisma.menu.update({
          where: { id: existingNavbarChat.id },
          data: { roles: rolesAttendu },
        });
        console.log("✅ Rôles mis à jour");
      }
      
      console.log("✨ Terminé - Rien à faire");
      return;
    }

    // Chercher le menu Admin pour connaître l'ordre maximum
    const adminMenu = await prisma.menu.findFirst({
      where: {
        lien: "/admin",
        niveau: "NAVBAR",
      },
    });

    const ordreChat = adminMenu ? adminMenu.ordre : 7;
    const ordreAdmin = adminMenu ? adminMenu.ordre + 1 : 8;

    // Créer le menu Chat dans la NAVBAR
    console.log("📝 Création du menu Chat dans la NAVBAR...");
    const chatMenu = await prisma.menu.create({
      data: {
        libelle: "Messages",
        description: "Messagerie interne",
        lien: "/chat",
        niveau: "NAVBAR",
        roles: ["ADMIN", "PRESID", "VICEPR", "SECRET", "VICESE", "COMCPT", "MEMBRE"],
        icone: "MessageSquare",
        statut: true,
        ordre: ordreChat,
        electoral: false,
        createdBy: null,
      },
    });

    console.log(`✅ Menu Chat créé (ID: ${chatMenu.id})`);
    console.log("");

    // Mettre à jour l'ordre du menu Admin si nécessaire
    if (adminMenu && adminMenu.ordre === ordreChat) {
      console.log("📝 Mise à jour de l'ordre du menu Admin...");
      await prisma.menu.update({
        where: { id: adminMenu.id },
        data: { ordre: ordreAdmin },
      });
      console.log("✅ Menu Admin réordonné");
      console.log("");
    }

    // Mettre à jour aussi le menu Chat dans la SIDEBAR s'il existe
    console.log("🔍 Vérification du menu Chat dans la SIDEBAR...");
    const sidebarChat = await prisma.menu.findFirst({
      where: {
        lien: "/chat",
        niveau: "SIDEBAR",
      },
    });

    if (sidebarChat) {
      const rolesAttendu = ["ADMIN", "PRESID", "VICEPR", "SECRET", "VICESE", "COMCPT", "MEMBRE"];
      const rolesDifferents = JSON.stringify(rolesAttendu.sort()) !== JSON.stringify(sidebarChat.roles.sort());
      
      if (rolesDifferents) {
        console.log("📝 Mise à jour des rôles du menu Chat SIDEBAR...");
        await prisma.menu.update({
          where: { id: sidebarChat.id },
          data: { roles: rolesAttendu },
        });
        console.log("✅ Rôles du menu Chat SIDEBAR mis à jour");
      }
    }

    console.log("");
    console.log("=".repeat(50));
    console.log("✨ MENU CHAT AJOUTÉ AVEC SUCCÈS !");
    console.log("=".repeat(50));
    console.log("");
    console.log("📊 Résumé :");
    console.log("   - Menu Chat créé dans la NAVBAR");
    console.log("   - Accessible aux membres et responsables");
    console.log("   - Ordre : " + ordreChat);
    console.log("   - Icône : MessageSquare");
    console.log("");
    console.log("✅ Les adhérents peuvent maintenant accéder au chat depuis la navbar !");
    console.log("");
    console.log("💡 Prochaines étapes :");
    console.log("   1. L'application rechargera automatiquement les menus");
    console.log("   2. Le menu 'Messages' apparaîtra dans la navbar");
    console.log("   3. Un badge de notifications apparaîtra s'il y a de nouveaux messages");
    console.log("");

  } catch (error) {
    console.error("\n❌ Erreur lors de l'ajout du menu :", error);
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
