#!/usr/bin/env tsx
/**
 * Script pour corriger l'état des migrations et réappliquer correctement
 */

import { PrismaClient } from "@prisma/client";
import { execSync } from "child_process";

const prisma = new PrismaClient();

async function fixMigrationState() {
  console.log("🔍 Analyse de l'état des migrations...\n");

  try {
    // Vérifier les valeurs actuelles de l'enum
    const enumValues = await prisma.$queryRaw<Array<{ role_value: string }>>`
      SELECT unnest(enum_range(NULL::"UserRole")) AS role_value
      ORDER BY role_value;
    `;

    const values = enumValues.map(r => r.role_value);
    console.log(`Valeurs actuelles de UserRole: ${values.join(", ")}`);

    const hasOldFormat = values.some(v => v === "Admin" || v === "Membre" || v === "Invite");
    const hasNewFormat = values.some(v => v === "ADMIN" || v === "MEMBRE" || v === "INVITE");

    console.log(`\nFormat ancien détecté: ${hasOldFormat ? "OUI ⚠️" : "NON ✅"}`);
    console.log(`Format nouveau détecté: ${hasNewFormat ? "OUI ✅" : "NON ⚠️"}`);

    if (hasOldFormat && !hasNewFormat) {
      console.log("\n⚠️  PROBLÈME DÉTECTÉ:");
      console.log("   La migration 20260123115834_update_user_role_enum");
      console.log("   est marquée comme 'finished' mais n'a PAS été appliquée.");
      console.log("   Les valeurs sont encore en minuscules.");
      
      console.log("\n💡 SOLUTION:");
      console.log("   1. Marquer la migration échouée comme rolled-back");
      console.log("   2. Vérifier pourquoi la première migration n'a pas été appliquée");
      console.log("   3. Réappliquer toutes les migrations");
      
      console.log("\n📋 Commandes à exécuter:");
      console.log("   npx prisma migrate resolve --rolled-back 20260123150938_include_admin_roles_in_user_role");
      console.log("   # Ensuite, vérifier manuellement pourquoi 20260123115834 n'a pas été appliquée");
      console.log("   # Puis réappliquer: npx prisma migrate deploy");
    }

    // Vérifier si user_admin_roles existe
    try {
      const adminRolesCheck = await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) as count FROM user_admin_roles LIMIT 1;
      `;
      console.log(`\n✅ Table user_admin_roles existe`);
    } catch (error: any) {
      if (error.message.includes("does not exist")) {
        console.log(`\n⚠️  Table user_admin_roles n'existe pas`);
        console.log("   La migration 20260123150938 n'a pas été appliquée.");
      }
    }

  } catch (error: any) {
    console.error("❌ Erreur:", error.message);
  } finally {
    await prisma.$disconnect();
  }
}

fixMigrationState();
