#!/usr/bin/env tsx

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({ log: ["error", "warn"] });

/**
 * Ajoute le menu admin Boutique (/admin/boutique) dans la sidebar
 */
async function main() {
  console.log("📌 Ajout du menu Boutique produits dérivés");

  await prisma.$connect();

  const lien = "/admin/boutique";
  const expectedRoles = ["ADMIN"];

  const existingMenu = await prisma.menu.findFirst({
    where: { lien, niveau: "SIDEBAR" },
  });

  if (existingMenu) {
    await prisma.menu.update({
      where: { id: existingMenu.id },
      data: {
        libelle: "Boutique",
        description: "Gérer les produits dérivés et les commandes",
        roles: expectedRoles,
        icone: "ShoppingBag",
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
        libelle: "Boutique",
        description: "Gérer les produits dérivés et les commandes",
        lien,
        niveau: "SIDEBAR",
        roles: expectedRoles,
        icone: "ShoppingBag",
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
