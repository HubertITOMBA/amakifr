#!/usr/bin/env tsx
/**
 * Script de diagnostic pour les réunions mensuelles
 * Vérifie : migration, tables, menus, permissions
 */

import prisma from "../lib/prisma";

async function checkReunionsMensuelles() {
  console.log("🔍 Diagnostic des réunions mensuelles...\n");

  // 1. Vérifier si les tables existent
  console.log("1️⃣ Vérification des tables...");
  try {
    const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename IN ('reunions_mensuelles', 'participations_reunion')
      ORDER BY tablename;
    `;
    
    const tableNames = tables.map(t => t.tablename);
    if (tableNames.includes('reunions_mensuelles') && tableNames.includes('participations_reunion')) {
      console.log("   ✅ Tables trouvées:", tableNames.join(", "));
    } else {
      console.log("   ❌ Tables manquantes !");
      console.log("   Tables trouvées:", tableNames.length > 0 ? tableNames.join(", ") : "aucune");
      console.log("   ⚠️  Exécutez: bash scripts/apply-reunions-mensuelles-migration.sh");
      return;
    }
  } catch (error: any) {
    console.log("   ❌ Erreur lors de la vérification des tables:", error.message);
    return;
  }

  // 2. Vérifier les enums
  console.log("\n2️⃣ Vérification des enums...");
  try {
    const enums = await prisma.$queryRaw<Array<{ typname: string }>>`
      SELECT typname 
      FROM pg_type 
      WHERE typtype = 'e' 
      AND typname IN ('StatutReunionMensuelle', 'TypeLieuReunion', 'StatutParticipationReunion')
      ORDER BY typname;
    `;
    const enumNames = enums.map(e => e.typname);
    if (enumNames.length === 3) {
      console.log("   ✅ Enums trouvés:", enumNames.join(", "));
    } else {
      console.log("   ❌ Enums manquants !");
      console.log("   Enums trouvés:", enumNames.length > 0 ? enumNames.join(", ") : "aucun");
      console.log("   ⚠️  Exécutez: bash scripts/apply-reunions-mensuelles-migration.sh");
      return;
    }
  } catch (error: any) {
    console.log("   ❌ Erreur lors de la vérification des enums:", error.message);
  }

  // 3. Vérifier le menu navbar
  console.log("\n3️⃣ Vérification du menu navbar...");
  try {
    const menuNavbar = await prisma.menu.findFirst({
      where: {
        lien: "/reunions-mensuelles",
        niveau: "NAVBAR",
      },
    });
    if (menuNavbar) {
      console.log("   ✅ Menu navbar trouvé:", menuNavbar.libelle);
      console.log("      Statut:", menuNavbar.statut ? "actif" : "inactif");
      console.log("      Rôles:", menuNavbar.roles.join(", "));
    } else {
      console.log("   ❌ Menu navbar non trouvé !");
      console.log("   ⚠️  Exécutez: npm run db:seed-menus");
    }
  } catch (error: any) {
    console.log("   ❌ Erreur lors de la vérification du menu:", error.message);
  }

  // 4. Vérifier le menu sidebar admin
  console.log("\n4️⃣ Vérification du menu sidebar admin...");
  try {
    const menuSidebar = await prisma.menu.findFirst({
      where: {
        lien: "/admin/reunions-mensuelles",
        niveau: "SIDEBAR",
      },
    });
    if (menuSidebar) {
      console.log("   ✅ Menu sidebar trouvé:", menuSidebar.libelle);
      console.log("      Statut:", menuSidebar.statut ? "actif" : "inactif");
    } else {
      console.log("   ❌ Menu sidebar non trouvé !");
      console.log("   ⚠️  Exécutez: npm run db:seed-menus");
    }
  } catch (error: any) {
    console.log("   ❌ Erreur lors de la vérification du menu:", error.message);
  }

  // 5. Vérifier les permissions
  console.log("\n5️⃣ Vérification des permissions...");
  const actions = [
    "getAllReunionsMensuelles",
    "createReunionMensuelle",
    "validerMoisReunion",
    "updateReunionMensuelle",
    "confirmerParticipationReunion",
    "deleteReunionMensuelle",
  ];
  try {
    const permissions = await prisma.permission.findMany({
      where: { action: { in: actions } },
      select: { action: true, role: true },
    });
    if (permissions.length > 0) {
      console.log("   ✅ Permissions trouvées:", permissions.length);
      const actionsFound = [...new Set(permissions.map(p => p.action))];
      const actionsMissing = actions.filter(a => !actionsFound.includes(a));
      if (actionsMissing.length > 0) {
        console.log("   ⚠️  Actions sans permission:", actionsMissing.join(", "));
      }
    } else {
      console.log("   ⚠️  Aucune permission trouvée pour les réunions mensuelles");
      console.log("   ⚠️  Les actions peuvent fonctionner avec les permissions par défaut");
    }
  } catch (error: any) {
    console.log("   ⚠️  Erreur lors de la vérification des permissions:", error.message);
    console.log("   (Peut être normal si le système de permissions n'est pas utilisé)");
  }

  // 6. Compter les réunions existantes
  console.log("\n6️⃣ Réunions existantes...");
  try {
    const count = await prisma.reunionMensuelle.count();
    console.log(`   📊 Nombre de réunions: ${count}`);
    if (count > 0) {
      const recentes = await prisma.reunionMensuelle.findMany({
        take: 3,
        orderBy: [{ annee: "desc" }, { mois: "desc" }],
        select: { id: true, annee: true, mois: true, statut: true },
      });
      console.log("   Dernières réunions:");
      recentes.forEach((r) => {
        console.log(`      - ${r.mois}/${r.annee} (${r.statut})`);
      });
    }
  } catch (error: any) {
    console.log("   ❌ Erreur:", error.message);
  }

  console.log("\n✅ Diagnostic terminé !");
  console.log("\n📋 Actions recommandées:");
  console.log("   1. Si tables manquantes: bash scripts/apply-reunions-mensuelles-migration.sh");
  console.log("   2. Si menus manquants: npm run db:seed-menus");
  console.log("   3. Redémarrer le serveur: npm run dev");
}

checkReunionsMensuelles()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Erreur:", error);
    process.exit(1);
  });
