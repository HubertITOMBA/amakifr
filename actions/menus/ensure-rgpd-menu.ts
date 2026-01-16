"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

/**
 * S'assure que le menu RGPD existe dans la sidebar admin
 * Cette fonction peut être appelée depuis l'interface admin
 * 
 * @returns Un objet avec success (boolean), message (string) en cas de succès,
 * ou error (string) en cas d'échec
 */
export async function ensureRGPDMenu() {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "Admin") {
      return {
        success: false,
        error: "Non autorisé. Seuls les administrateurs peuvent créer des menus.",
      };
    }

    // Vérifier si le menu existe déjà
    const existingMenu = await db.menu.findFirst({
      where: {
        lien: "/admin/rgpd/demandes",
        niveau: "SIDEBAR",
      },
    });

    if (existingMenu) {
      return {
        success: true,
        message: "Le menu RGPD existe déjà dans la sidebar.",
        menuId: existingMenu.id,
      };
    }

    // Trouver le dernier ordre dans la sidebar
    const lastMenu = await db.menu.findFirst({
      where: {
        niveau: "SIDEBAR",
      },
      orderBy: {
        ordre: "desc",
      },
    });

    const newOrdre = lastMenu ? lastMenu.ordre + 1 : 26;

    // Créer le menu RGPD
    const rgpdMenu = await db.menu.create({
      data: {
        libelle: "Demandes RGPD",
        description: "Gérer les demandes de suppression de données",
        lien: "/admin/rgpd/demandes",
        niveau: "SIDEBAR",
        roles: ["ADMIN"],
        icone: "Shield",
        statut: true,
        ordre: newOrdre,
        electoral: false,
        parent: null,
        createdBy: session.user.id,
      },
    });

    revalidatePath("/admin/menus");
    revalidatePath("/admin/rgpd/demandes");

    return {
      success: true,
      message: `Menu RGPD créé avec succès dans la sidebar (ordre: ${newOrdre})`,
      menuId: rgpdMenu.id,
    };
  } catch (error) {
    console.error("Erreur lors de la création du menu RGPD:", error);
    return {
      success: false,
      error: "Une erreur s'est produite lors de la création du menu.",
    };
  }
}
