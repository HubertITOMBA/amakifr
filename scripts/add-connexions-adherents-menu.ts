#!/usr/bin/env tsx

import { PrismaClient, PermissionType } from "@prisma/client";

const prisma = new PrismaClient({ log: ["error", "warn"] });

async function main() {
  console.log("📌 Ajout du menu Connexions adhérents + permission par défaut ADMIN");

  await prisma.$connect();

  const lien = "/admin/connexions-adherents";
  const expectedRoles = ["ADMIN"];

  const existingMenu = await prisma.menu.findFirst({
    where: { lien, niveau: "SIDEBAR" },
  });

  if (existingMenu) {
    await prisma.menu.update({
      where: { id: existingMenu.id },
      data: {
        libelle: "Connexions adhérents",
        description: "Suivi des connexions au portail et badges de fidélité",
        roles: expectedRoles,
        icone: "LogIn",
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
        libelle: "Connexions adhérents",
        description: "Suivi des connexions au portail et badges de fidélité",
        lien,
        niveau: "SIDEBAR",
        roles: expectedRoles,
        icone: "LogIn",
        statut: true,
        ordre: (last?.ordre ?? 0) + 1,
        electoral: false,
        parent: null,
        createdBy: null,
      },
    });
    console.log("✅ Menu créé");
  }

  if ("permission" in prisma) {
    await (prisma as any).permission.upsert({
      where: {
        action_type: {
          action: "getAdherentConnexionsList",
          type: PermissionType.READ,
        },
      },
      create: {
        action: "getAdherentConnexionsList",
        resource: "connexions-adherents",
        type: PermissionType.READ,
        roles: expectedRoles,
        description: "Lister les connexions adhérents au portail (hors ADMIN)",
        route: lien,
        enabled: true,
      },
      update: {
        roles: expectedRoles,
        enabled: true,
        route: lien,
        description: "Lister les connexions adhérents au portail (hors ADMIN)",
      },
    });
    console.log("✅ Permission getAdherentConnexionsList (ADMIN par défaut)");
  }

  console.log("✨ Terminé.");
}

main()
  .then(() => process.exit(0))
  .catch(() => process.exit(1))
  .finally(() => prisma.$disconnect());
