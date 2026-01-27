/**
 * Script pour supprimer les rôles MEMBRE de AdminRole avant la migration
 * 
 * Usage: npx tsx scripts/remove-membre-from-admin-roles.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function removeMembreFromAdminRoles() {
  console.log("🚀 Suppression des rôles MEMBRE de AdminRole...\n");

  try {
    // Supprimer tous les UserAdminRole avec role = MEMBRE
    const result = await prisma.userAdminRole.deleteMany({
      where: {
        role: "MEMBRE" as any, // Type assertion car MEMBRE sera supprimé de l'enum
      },
    });

    console.log(`✅ ${result.count} rôle(s) MEMBRE supprimé(s)\n`);
    console.log("✨ Nettoyage terminé avec succès!");
    console.log("\nVous pouvez maintenant exécuter: npx prisma db push");
  } catch (error) {
    console.error("❌ Erreur lors du nettoyage:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le nettoyage
removeMembreFromAdminRoles()
  .catch((error) => {
    console.error("Erreur fatale:", error);
    process.exit(1);
  });
