"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

/**
 * S'assure que le menu "Emails" existe dans la sidebar admin.
 *
 * Utile en production pour ajouter le menu sans relancer un seed destructif.
 */
export async function ensureEmailsMenu() {
  try {
    const existingAdminMenu = await db.menu.findFirst({
      where: {
        lien: "/admin/emails",
        niveau: "SIDEBAR",
      },
    });

    if (!existingAdminMenu) {
      await db.menu.create({
        data: {
          libelle: "Emails",
          description: "Envoyer des emails et consulter l'historique",
          lien: "/admin/emails",
          niveau: "SIDEBAR",
          roles: ["ADMIN"],
          icone: "Mail",
          statut: true,
          // Après "Notifications" (14) dans votre seed actuel
          ordre: 15,
          electoral: false,
        },
      });
    }

    revalidatePath("/admin");
    return { success: true, message: "Menu Emails vérifié avec succès" };
  } catch (error) {
    console.error("Erreur lors de la création du menu Emails:", error);
    return { success: false, error: "Erreur lors de la création du menu Emails" };
  }
}

