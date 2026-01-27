#!/usr/bin/env tsx
/**
 * Script pour diagnostiquer et résoudre la migration échouée
 * 20260123150938_include_admin_roles_in_user_role
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function diagnose() {
  console.log("🔍 Diagnostic de la migration échouée...\n");

  try {
    // 1. Vérifier si UserRole_old existe encore
    const userRoleOldExists = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'UserRole_old'
      ) as exists;
    `;

    console.log(`1. UserRole_old existe: ${userRoleOldExists[0]?.exists ? "OUI ⚠️" : "NON ✅"}`);

    // 2. Vérifier les valeurs de l'enum UserRole
    const enumValues = await prisma.$queryRaw<Array<{ role_value: string }>>`
      SELECT unnest(enum_range(NULL::"UserRole")) AS role_value
      ORDER BY role_value;
    `;

    const values = enumValues.map(r => r.role_value);
    console.log(`\n2. Valeurs actuelles de UserRole:`);
    console.log(`   ${values.join(", ")}`);

    const expectedValues = ["ADMIN", "MEMBRE", "INVITE", "PRESID", "VICEPR", "SECRET", "VICESE", "COMCPT"];
    const hasAllValues = expectedValues.every(v => values.includes(v));
    
    console.log(`\n3. Contient toutes les valeurs attendues: ${hasAllValues ? "OUI ✅" : "NON ⚠️"}`);

    // 4. Vérifier les rôles des utilisateurs
    const userRoles = await prisma.$queryRaw<Array<{ role: string; count: bigint }>>`
      SELECT role, COUNT(*) as count
      FROM users
      GROUP BY role
      ORDER BY count DESC;
    `;

    console.log(`\n4. Distribution des rôles utilisateurs:`);
    userRoles.forEach(ur => {
      console.log(`   ${ur.role}: ${ur.count} utilisateur(s)`);
    });

    // 5. Vérifier si des utilisateurs ont des AdminRole
    const usersWithAdminRoles = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(DISTINCT u.id) as count
      FROM users u
      INNER JOIN user_admin_roles uar ON u.id = uar."userId";
    `;

    console.log(`\n5. Utilisateurs avec AdminRole: ${usersWithAdminRoles[0]?.count || 0}`);

    // Conclusion
    console.log("\n" + "=".repeat(60));
    console.log("📋 CONCLUSION:");
    
    if (userRoleOldExists[0]?.exists) {
      console.log("⚠️  La migration a été PARTIELLEMENT appliquée.");
      console.log("   UserRole_old existe encore, la migration n'est pas complète.");
      console.log("\n💡 ACTION: Marquer comme rolled-back et réappliquer:");
      console.log("   npx prisma migrate resolve --rolled-back 20260123150938_include_admin_roles_in_user_role");
      console.log("   npx prisma migrate deploy");
    } else if (hasAllValues) {
      console.log("✅ La migration semble avoir été COMPLÈTEMENT appliquée.");
      console.log("   Toutes les valeurs attendues sont présentes dans l'enum.");
      console.log("\n💡 ACTION: Marquer comme appliquée:");
      console.log("   npx prisma migrate resolve --applied 20260123150938_include_admin_roles_in_user_role");
      console.log("   npx prisma migrate deploy");
    } else {
      console.log("⚠️  État indéterminé - vérification manuelle nécessaire.");
      console.log("\n💡 ACTION: Vérifier manuellement l'état de la base de données.");
    }

  } catch (error: any) {
    console.error("❌ Erreur lors du diagnostic:", error.message);
    if (error.message.includes("plpgsql") || error.message.includes("58P01")) {
      console.log("\n⚠️  L'extension PL/pgSQL n'est pas disponible.");
      console.log("   Installez-la d'abord:");
      console.log("   sudo dnf reinstall postgresql-server postgresql-libs postgresql");
      console.log("   sudo systemctl restart postgresql");
    }
  } finally {
    await prisma.$disconnect();
  }
}

diagnose();
