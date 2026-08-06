"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

/**
 * S'assure que le menu admin Sondages existe dans la sidebar.
 */
export async function ensureSondagesMenu() {
  try {
    const lien = "/admin/sondages";
    const existing = await db.menu.findFirst({
      where: { lien, niveau: "SIDEBAR" },
    });

    if (existing) {
      await db.menu.update({
        where: { id: existing.id },
        data: {
          libelle: "Sondages",
          description: "Création et suivi des sondages adhérents",
          roles: ["ADMIN"],
          icone: "ClipboardList",
          statut: true,
        },
      });
      revalidatePath("/admin");
      return { success: true, message: "Menu Sondages mis à jour" };
    }

    const last = await db.menu.findFirst({
      where: { niveau: "SIDEBAR" },
      orderBy: { ordre: "desc" },
    });

    await db.menu.create({
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
      },
    });

    revalidatePath("/admin");
    return { success: true, message: "Menu Sondages créé" };
  } catch (error) {
    console.error("Erreur ensureSondagesMenu:", error);
    return { success: false, error: "Erreur lors de la création du menu Sondages" };
  }
}
