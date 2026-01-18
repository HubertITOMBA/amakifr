"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

/**
 * S'assure que le menu "Activités utilisateurs" existe dans la sidebar admin
 */
export async function ensureActivitiesMenu() {
  try {
    // Vérifier si le menu existe déjà
    const existingMenu = await db.menu.findFirst({
      where: {
        lien: "/admin/activities",
        niveau: "SIDEBAR",
      },
    });

    if (existingMenu) {
      return { success: true, message: "Menu déjà existant" };
    }

    // Créer le menu
    await db.menu.create({
      data: {
        libelle: "Activités utilisateurs",
        description: "Consulter les activités et actions des utilisateurs",
        lien: "/admin/activities",
        niveau: "SIDEBAR",
        roles: ["ADMIN"],
        icone: "Activity",
        statut: true,
        ordre: 100, // Après les autres menus admin
        electoral: false,
      },
    });

    revalidatePath("/admin");
    return { success: true, message: "Menu créé avec succès" };
  } catch (error) {
    console.error("Erreur lors de la création du menu:", error);
    return { success: false, error: "Erreur lors de la création du menu" };
  }
}
