#!/usr/bin/env tsx

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  log: ["error", "warn"],
});

async function main() {
  console.log("🎂 Ajout du menu Anniversaires dans la NAVBAR");

  try {
    await prisma.$connect();

    const existing = await prisma.menu.findFirst({
      where: {
        lien: "/anniversaires",
        niveau: "NAVBAR",
      },
    });

    const expectedRoles = ["ADMIN", "MEMBRE", "INVITE"];

    if (existing) {
      const rolesDifferents =
        JSON.stringify([...existing.roles].sort()) !==
        JSON.stringify([...expectedRoles].sort());

      if (rolesDifferents || existing.libelle !== "Anniversaires" || existing.icone !== "Cake") {
        await prisma.menu.update({
          where: { id: existing.id },
          data: {
            libelle: "Anniversaires",
            description: "Souhaiter les anniversaires des adhérents",
            roles: expectedRoles,
            icone: "Cake",
            statut: true,
          },
        });
        console.log("✅ Menu Anniversaires déjà présent, mis à jour.");
      } else {
        console.log("ℹ️  Menu Anniversaires déjà présent, aucune action.");
      }
      return;
    }

    const lastNavbarMenu = await prisma.menu.findFirst({
      where: { niveau: "NAVBAR" },
      orderBy: { ordre: "desc" },
    });

    const newOrdre = (lastNavbarMenu?.ordre ?? 0) + 1;

    await prisma.menu.create({
      data: {
        libelle: "Anniversaires",
        description: "Souhaiter les anniversaires des adhérents",
        lien: "/anniversaires",
        niveau: "NAVBAR",
        roles: expectedRoles,
        icone: "Cake",
        statut: true,
        ordre: newOrdre,
        electoral: false,
        parent: null,
        createdBy: null,
      },
    });

    console.log(`✅ Menu Anniversaires créé (ordre: ${newOrdre}).`);
  } catch (error) {
    console.error("❌ Erreur lors de l'ajout du menu Anniversaires:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
