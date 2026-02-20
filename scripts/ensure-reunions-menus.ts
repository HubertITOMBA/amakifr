#!/usr/bin/env tsx

/**
 * S'assure que les menus "Réunions mensuelles" existent en NAVBAR et SIDEBAR.
 * À lancer si le lien n'apparaît pas dans la barre de navigation ou la sidebar.
 *
 * Usage: npx tsx scripts/ensure-reunions-menus.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({ log: ["error", "warn"] });

async function main() {
  console.log("📅 Vérification des menus Réunions mensuelles");
  console.log("=============================================\n");

  await prisma.$connect();

  let created = 0;

  // 1. NAVBAR
  const existingNavbar = await prisma.menu.findFirst({
    where: { lien: "/reunions-mensuelles", niveau: "NAVBAR" },
  });
  if (!existingNavbar) {
    const maxOrdre = await prisma.menu.findFirst({
      where: { niveau: "NAVBAR" },
      orderBy: { ordre: "desc" },
      select: { ordre: true },
    });
    await prisma.menu.create({
      data: {
        libelle: "Réunions mensuelles",
        description: "Calendrier des réunions mensuelles (navbar admin)",
        lien: "/reunions-mensuelles",
        niveau: "NAVBAR",
        roles: ["ADMIN"],
        icone: "Calendar",
        statut: true,
        ordre: (maxOrdre?.ordre ?? 0) + 1,
        electoral: false,
      },
    });
    console.log("✅ Menu NAVBAR « Réunions mensuelles » créé (ADMIN uniquement).");
    created++;
  } else {
    const roles = (existingNavbar.roles as string[]) || [];
    if (!roles.includes("ADMIN") || roles.some((r) => r === "MEMBRE")) {
      await prisma.menu.update({
        where: { id: existingNavbar.id },
        data: { roles: ["ADMIN"], statut: true },
      });
      console.log("✅ Menu NAVBAR « Réunions mensuelles » mis à jour : réservé à l’admin (adhérents : menu latéral).");
      created++;
    } else if (!existingNavbar.statut) {
      await prisma.menu.update({
        where: { id: existingNavbar.id },
        data: { statut: true },
      });
      console.log("✅ Menu NAVBAR « Réunions mensuelles » réactivé.");
      created++;
    } else {
      console.log("⏭️  Menu NAVBAR « Réunions mensuelles » existe déjà (ADMIN).");
    }
  }

  // 2. SIDEBAR admin
  const existingSidebarAdmin = await prisma.menu.findFirst({
    where: { lien: "/admin/reunions-mensuelles", niveau: "SIDEBAR" },
  });
  if (!existingSidebarAdmin) {
    const maxOrdre = await prisma.menu.findFirst({
      where: { niveau: "SIDEBAR" },
      orderBy: { ordre: "desc" },
      select: { ordre: true },
    });
    await prisma.menu.create({
      data: {
        libelle: "Réunions Mensuelles",
        description: "Gérer les réunions mensuelles (validation, hôte, dates)",
        lien: "/admin/reunions-mensuelles",
        niveau: "SIDEBAR",
        roles: ["ADMIN"],
        icone: "Calendar",
        statut: true,
        ordre: (maxOrdre?.ordre ?? 0) + 1,
        electoral: false,
      },
    });
    console.log("✅ Menu SIDEBAR admin « Réunions Mensuelles » créé.");
    created++;
  } else {
    if (!existingSidebarAdmin.statut) {
      await prisma.menu.update({
        where: { id: existingSidebarAdmin.id },
        data: { statut: true },
      });
      console.log("✅ Menu SIDEBAR admin « Réunions Mensuelles » réactivé.");
      created++;
    } else {
      console.log("⏭️  Menu SIDEBAR admin « Réunions Mensuelles » existe déjà.");
    }
  }

  // 3. SIDEBAR membre (lien /reunions-mensuelles, rôle MEMBRE)
  const existingSidebarMembre = await prisma.menu.findFirst({
    where: { lien: "/reunions-mensuelles", niveau: "SIDEBAR" },
  });
  if (!existingSidebarMembre) {
    const maxOrdre = await prisma.menu.findFirst({
      where: { niveau: "SIDEBAR" },
      orderBy: { ordre: "desc" },
      select: { ordre: true },
    });
    await prisma.menu.create({
      data: {
        libelle: "Réunions mensuelles",
        description: "Calendrier des réunions mensuelles",
        lien: "/reunions-mensuelles",
        niveau: "SIDEBAR",
        roles: ["MEMBRE"],
        icone: "Calendar",
        statut: true,
        ordre: (maxOrdre?.ordre ?? 0) + 1,
        electoral: false,
      },
    });
    console.log("✅ Menu SIDEBAR membre « Réunions mensuelles » créé.");
    created++;
  } else {
    if (!existingSidebarMembre.statut) {
      await prisma.menu.update({
        where: { id: existingSidebarMembre.id },
        data: { statut: true },
      });
      console.log("✅ Menu SIDEBAR membre « Réunions mensuelles » réactivé.");
      created++;
    } else {
      console.log("⏭️  Menu SIDEBAR « Réunions mensuelles » existe déjà.");
    }
  }

  console.log(`\n🎉 Terminé. ${created} entrée(s) créée(s) ou réactivée(s).`);
  console.log("   Rafraîchissez la page pour voir les liens dans la navbar et la sidebar.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
