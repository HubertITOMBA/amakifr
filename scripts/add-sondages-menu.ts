#!/usr/bin/env tsx

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({ log: ["error", "warn"] });

/**
 * Ajoute le menu admin Sondages (/admin/sondages) dans la sidebar
 */
async function main() {
  console.log("📌 Ajout du menu Sondages");

  await prisma.$connect();

  const lien = "/admin/sondages";
  const existingMenu = await prisma.menu.findFirst({
    where: { lien, niveau: "SIDEBAR" },
  });

  if (existingMenu) {
    await prisma.menu.update({
      where: { id: existingMenu.id },
      data: {
        libelle: "Sondages",
        description: "Création et suivi des sondages adhérents",
        roles: ["ADMIN"],
        icone: "ClipboardList",
        statut: true,
      },
    });
    console.log("✅ Menu mis à jour");
  } else {
    const last = await prisma.menu.findFirst({
      where: { niveau: "SIDEBAR" },
      orderBy: { ordre: "desc" },
    });
    await prisma.menu.create({
      data: {
        libelle: "Sondages",
        description: "Création et suivi des sondages adhérents",
        lien,
        niveau: "SIDEBAR",
        roles: ["ADMIN"],
        icone: "ClipboardList",
        statut: true,
        ordre: (last?.ordre ?? 0) + 1,
        electoral: false,
        parent: null,
        createdBy: null,
      },
    });
    console.log("✅ Menu créé");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
