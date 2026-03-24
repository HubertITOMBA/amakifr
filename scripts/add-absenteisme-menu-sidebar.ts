#!/usr/bin/env tsx

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  log: ["error", "warn"],
});

async function main() {
  console.log("📌 Ajout du menu Absentéisme dans la SIDEBAR");

  try {
    await prisma.$connect();

    const existing = await prisma.menu.findFirst({
      where: {
        lien: "/admin/absenteisme",
        niveau: "SIDEBAR",
      },
    });

    const expectedRoles = ["ADMIN"];

    if (existing) {
      const rolesDifferents =
        JSON.stringify([...existing.roles].sort()) !==
        JSON.stringify([...expectedRoles].sort());

      if (rolesDifferents || existing.libelle !== "Absentéisme" || existing.icone !== "UserX") {
        await prisma.menu.update({
          where: { id: existing.id },
          data: {
            libelle: "Absentéisme",
            description: "Suivi des absences et relances disciplinaires",
            roles: expectedRoles,
            icone: "UserX",
            statut: true,
          },
        });
        console.log("✅ Menu Absentéisme déjà présent, mis à jour.");
      } else {
        console.log("ℹ️  Menu Absentéisme déjà présent, aucune action.");
      }
      return;
    }

    const lastSidebarMenu = await prisma.menu.findFirst({
      where: { niveau: "SIDEBAR" },
      orderBy: { ordre: "desc" },
    });

    const newOrdre = (lastSidebarMenu?.ordre ?? 0) + 1;

    await prisma.menu.create({
      data: {
        libelle: "Absentéisme",
        description: "Suivi des absences et relances disciplinaires",
        lien: "/admin/absenteisme",
        niveau: "SIDEBAR",
        roles: expectedRoles,
        icone: "UserX",
        statut: true,
        ordre: newOrdre,
        electoral: false,
        parent: null,
        createdBy: null,
      },
    });

    console.log(`✅ Menu Absentéisme créé (ordre: ${newOrdre}).`);
  } catch (error) {
    console.error("❌ Erreur lors de l'ajout du menu Absentéisme:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
