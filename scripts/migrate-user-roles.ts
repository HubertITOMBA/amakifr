/**
 * Script de migration pour initialiser les rôles d'administration
 * 
 * Ce script migre les utilisateurs existants vers le nouveau système de rôles multiples :
 * - Les utilisateurs avec role = "ADMIN" reçoivent le rôle AdminRole.ADMIN
 * - Les autres utilisateurs conservent leur rôle principal
 * 
 * Usage: npx tsx scripts/migrate-user-roles.ts
 */

import { PrismaClient, UserRole, AdminRole } from "@prisma/client";

const prisma = new PrismaClient();

async function migrateUserRoles() {
  console.log("🚀 Début de la migration des rôles utilisateurs...\n");

  try {
    // Récupérer tous les utilisateurs
    const users = await prisma.user.findMany({
      include: {
        adminRoles: true,
      },
    });

    console.log(`📊 ${users.length} utilisateur(s) trouvé(s)\n`);

    let migrated = 0;
    let skipped = 0;
    let errors = 0;

    for (const user of users) {
      try {
        // Si l'utilisateur a déjà des rôles d'administration, on passe
        if (user.adminRoles.length > 0) {
          console.log(`⏭️  ${user.name || user.email} : Déjà migré (${user.adminRoles.length} rôle(s))`);
          skipped++;
          continue;
        }

        // Si l'utilisateur est Admin, lui attribuer le rôle AdminRole.ADMIN
        if (user.role === UserRole.ADMIN) {
          // Créer un utilisateur système pour les migrations
          // En production, vous devriez utiliser un ID d'admin réel
          const systemAdmin = await prisma.user.findFirst({
            where: { role: UserRole.ADMIN },
            orderBy: { createdAt: "asc" },
          });

          if (!systemAdmin) {
            console.error(`❌ Aucun administrateur trouvé pour créer les rôles`);
            errors++;
            continue;
          }

          await prisma.userAdminRole.create({
            data: {
              userId: user.id,
              role: AdminRole.ADMIN,
              createdBy: systemAdmin.id,
            },
          });

          console.log(`✅ ${user.name || user.email} : Rôle ADMIN attribué`);
          migrated++;
        } else {
          // Pour les autres utilisateurs, on ne fait rien (ils gardent leur rôle principal)
          console.log(`⏭️  ${user.name || user.email} : Rôle principal conservé (${user.role})`);
          skipped++;
        }
      } catch (error) {
        console.error(`❌ Erreur pour ${user.name || user.email}:`, error);
        errors++;
      }
    }

    console.log("\n📈 Résumé de la migration:");
    console.log(`   ✅ Migrés: ${migrated}`);
    console.log(`   ⏭️  Ignorés: ${skipped}`);
    console.log(`   ❌ Erreurs: ${errors}`);
    console.log("\n✨ Migration terminée avec succès!");
  } catch (error) {
    console.error("❌ Erreur lors de la migration:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter la migration
migrateUserRoles()
  .catch((error) => {
    console.error("Erreur fatale:", error);
    process.exit(1);
  });
