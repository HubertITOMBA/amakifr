#!/usr/bin/env tsx

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({ log: ["error", "warn"] });

/**
 * Ajoute le menu admin Courriers postaux (/admin/mailing-list) dans la sidebar
 */
async function main() {
  console.log("📌 Ajout du menu Courriers postaux (mailing list)");

  await prisma.$connect();

  const lien = "/admin/mailing-list";
  const expectedRoles = ["ADMIN"];

  const existingMenu = await prisma.menu.findFirst({
    where: { lien, niveau: "SIDEBAR" },
  });

  if (existingMenu) {
    await prisma.menu.update({
      where: { id: existingMenu.id },
      data: {
        libelle: "Courriers postaux",
        description: "Mailing list — courriers imprimables PDF/Word",
        roles: expectedRoles,
        icone: "Mail",
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
        libelle: "Courriers postaux",
        description: "Mailing list — courriers imprimables PDF/Word",
        lien,
        niveau: "SIDEBAR",
        roles: expectedRoles,
        icone: "Mail",
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
