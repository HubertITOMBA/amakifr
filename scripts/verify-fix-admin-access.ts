import { db } from "@/lib/db";

/**
 * Script pour vérifier et corriger l'accès admin
 * - Vérifie les rôles des utilisateurs admin
 * - Vérifie les rôles des menus SIDEBAR
 * - Corrige les valeurs si nécessaire
 */
async function verifyAndFixAdminAccess() {
  console.log("🔍 Vérification de l'accès admin...\n");

  // 1. Vérifier les utilisateurs admin
  console.log("1. Vérification des utilisateurs admin:");
  const adminUsers = await db.user.findMany({
    where: {
      role: "ADMIN",
    },
    select: {
      id: true,
      email: true,
      role: true,
    },
  });

  console.log(`   Trouvé ${adminUsers.length} utilisateur(s) admin`);
  adminUsers.forEach((user) => {
    console.log(`   - ${user.email}: ${user.role}`);
    if (user.role !== "ADMIN") {
      console.log(`     ⚠️  Rôle incorrect: ${user.role} (devrait être ADMIN)`);
    }
  });

  // 2. Vérifier s'il y a des utilisateurs avec l'ancien rôle (requête SQL brute)
  console.log("\n2. Vérification des utilisateurs avec l'ancien rôle...");
  const usersWithOldRole = await db.$queryRaw<Array<{ id: string; email: string; role: string }>>`
    SELECT id, email, role::text as role
    FROM "users"
    WHERE role::text = 'Admin'
  `;
  
  if (usersWithOldRole.length > 0) {
    console.log(`   Trouvé ${usersWithOldRole.length} utilisateur(s) avec l'ancien rôle "Admin"`);
    for (const user of usersWithOldRole) {
      await db.user.update({
        where: { id: user.id },
        data: { role: "ADMIN" },
      });
      console.log(`   ✅ ${user.email} mis à jour: Admin → ADMIN`);
    }
  } else {
    console.log("   ✅ Aucun utilisateur avec l'ancien rôle trouvé");
  }

  // 3. Vérifier les menus SIDEBAR
  console.log("\n3. Vérification des menus SIDEBAR:");
  const sidebarMenus = await db.menu.findMany({
    where: {
      niveau: "SIDEBAR",
      statut: true,
    },
    select: {
      id: true,
      libelle: true,
      lien: true,
      roles: true,
    },
  });

  console.log(`   Trouvé ${sidebarMenus.length} menu(s) SIDEBAR`);
  
  // Vérifier si les menus ont "Admin" au lieu de "ADMIN"
  const menusToFix: Array<{ id: string; libelle: string; roles: string[] }> = [];
  
  sidebarMenus.forEach((menu) => {
    const hasAdmin = menu.roles.includes("ADMIN");
    const hasOldAdmin = menu.roles.includes("Admin");
    
    if (hasOldAdmin && !hasAdmin) {
      menusToFix.push({
        id: menu.id,
        libelle: menu.libelle,
        roles: menu.roles,
      });
      console.log(`   ⚠️  ${menu.libelle} (${menu.lien}): a "Admin" au lieu de "ADMIN"`);
    } else if (!hasAdmin && !hasOldAdmin) {
      console.log(`   ℹ️  ${menu.libelle} (${menu.lien}): n'a pas de rôle ADMIN`);
    }
  });

  // 4. Corriger les menus si nécessaire
  if (menusToFix.length > 0) {
    console.log(`\n4. Correction de ${menusToFix.length} menu(s)...`);
    for (const menu of menusToFix) {
      const newRoles = menu.roles.map((role) => 
        role === "Admin" ? "ADMIN" : role
      );
      await db.menu.update({
        where: { id: menu.id },
        data: { roles: newRoles },
      });
      console.log(`   ✅ ${menu.libelle} mis à jour: ${menu.roles.join(", ")} → ${newRoles.join(", ")}`);
    }
  } else {
    console.log("\n4. ✅ Tous les menus ont les bons rôles");
  }

  // 5. Résumé
  console.log("\n📊 Résumé:");
  console.log(`   - Utilisateurs admin vérifiés: ${adminUsers.length}`);
  console.log(`   - Utilisateurs avec ancien rôle corrigés: ${usersWithOldRole.length}`);
  console.log(`   - Menus SIDEBAR vérifiés: ${sidebarMenus.length}`);
  console.log(`   - Menus corrigés: ${menusToFix.length}`);
  
  if (usersWithOldRole.length === 0 && menusToFix.length === 0) {
    console.log("\n✅ Tout est correct !");
  } else {
    console.log("\n✅ Corrections effectuées ! Veuillez vous reconnecter pour que les changements prennent effet.");
  }
}

// Exécuter le script
verifyAndFixAdminAccess()
  .then(() => {
    console.log("\n✨ Script terminé");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Erreur:", error);
    process.exit(1);
  });
