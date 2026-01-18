"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

/**
 * S'assure que les menus "Projets" existent dans les sidebars admin et utilisateur
 */
export async function ensureProjetsMenu() {
  try {
    // Menu admin
    const existingAdminMenu = await db.menu.findFirst({
      where: {
        lien: "/admin/projets",
        niveau: "SIDEBAR",
      },
    });

    if (!existingAdminMenu) {
      await db.menu.create({
        data: {
          libelle: "Projets",
          description: "Gestion des projets et tâches",
          lien: "/admin/projets",
          niveau: "SIDEBAR",
          roles: ["ADMIN"],
          icone: "FolderKanban",
          statut: true,
          ordre: 30,
          electoral: false,
        },
      });
    }

    // Le menu "Mes tâches" n'est pas dans la sidebar, seulement dans le profil utilisateur

    revalidatePath("/admin");
    return { success: true, message: "Menus créés avec succès" };
  } catch (error) {
    console.error("Erreur lors de la création des menus:", error);
    return { success: false, error: "Erreur lors de la création des menus" };
  }
}
