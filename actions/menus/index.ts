"use server";

import { db } from "@/lib/db";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";

/**
 * Schéma de validation pour la création d'un menu
 */
const CreateMenuSchema = z.object({
  libelle: z.string().min(1, "Le libellé est requis").max(100, "Maximum 100 caractères"),
  description: z.string().max(500, "Maximum 500 caractères").optional().nullable(),
  lien: z.string().min(1, "Le lien est requis").max(255, "Maximum 255 caractères"),
  niveau: z.enum(["NAVBAR", "SIDEBAR"], {
    errorMap: () => ({ message: "Le niveau doit être NAVBAR ou SIDEBAR" }),
  }),
  roles: z.array(z.string()).min(1, "Au moins un rôle est requis"),
  icone: z.string().max(100, "Maximum 100 caractères").optional().nullable(),
  statut: z.boolean().default(true),
  ordre: z.number().int().min(0, "L'ordre doit être >= 0").default(0),
  parent: z.string().optional().nullable(),
  electoral: z.boolean().default(false),
});

/**
 * Schéma de validation pour la mise à jour d'un menu
 */
const UpdateMenuSchema = CreateMenuSchema.partial();

/**
 * Récupère tous les menus actifs pour un niveau donné
 * 
 * @param niveau - Le niveau du menu (NAVBAR ou SIDEBAR)
 * @param userRoles - Les rôles de l'utilisateur pour filtrer les menus autorisés
 * @returns La liste des menus filtrés par niveau et rôle
 */
export async function getMenusByNiveau(niveau: "NAVBAR" | "SIDEBAR", userRoles: string[] = ["VISITEUR"]) {
  try {
    const menus = await db.menu.findMany({
      where: {
        niveau,
        statut: true,
      },
      orderBy: {
        ordre: "asc",
      },
    });

    // Log pour déboguer
    console.log("[getMenusByNiveau] Filtrage des menus:", {
      niveau,
      userRoles,
      totalMenus: menus.length,
      menusAvantFiltre: menus.map(m => ({ libelle: m.libelle, roles: m.roles })),
    });

    // Filtrer par rôles (normaliser pour la comparaison)
    const normalizedUserRoles = userRoles.map(r => r.toString().trim().toUpperCase());
    const filteredMenus = menus.filter((menu) => {
      // Normaliser les rôles du menu pour la comparaison
      const normalizedMenuRoles = menu.roles.map(r => r.toString().trim().toUpperCase());
      const hasAccess = normalizedMenuRoles.some((role) => normalizedUserRoles.includes(role));
      if (!hasAccess) {
        console.log(`[getMenusByNiveau] Menu "${menu.libelle}" filtré - rôles menu: ${menu.roles.join(", ")} (normalisés: ${normalizedMenuRoles.join(", ")}), rôles user: ${userRoles.join(", ")} (normalisés: ${normalizedUserRoles.join(", ")})`);
      }
      return hasAccess;
    });

    console.log("[getMenusByNiveau] Menus après filtrage:", {
      count: filteredMenus.length,
      menus: filteredMenus.map(m => ({ libelle: m.libelle, roles: m.roles })),
    });

    return {
      success: true,
      data: filteredMenus,
    };
  } catch (error) {
    console.error("Erreur lors de la récupération des menus:", error);
    return {
      success: false,
      error: "Erreur lors de la récupération des menus",
    };
  }
}

/**
 * Récupère tous les menus (pour l'admin)
 * 
 * @returns La liste complète des menus
 */
export async function getAllMenus() {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return { success: false, error: "Non autorisé" };
    }

    const menus = await db.menu.findMany({
      orderBy: [
        { niveau: "asc" },
        { ordre: "asc" },
      ],
      include: {
        CreatedBy: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    return {
      success: true,
      data: menus,
    };
  } catch (error) {
    console.error("Erreur lors de la récupération des menus:", error);
    return {
      success: false,
      error: "Erreur lors de la récupération des menus",
    };
  }
}

/**
 * Récupère un menu par son ID
 * 
 * @param id - L'identifiant du menu
 * @returns Le menu trouvé ou null
 */
export async function getMenuById(id: string) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return { success: false, error: "Non autorisé" };
    }

    const menu = await db.menu.findUnique({
      where: { id },
      include: {
        CreatedBy: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    if (!menu) {
      return { success: false, error: "Menu non trouvé" };
    }

    return {
      success: true,
      data: menu,
    };
  } catch (error) {
    console.error("Erreur lors de la récupération du menu:", error);
    return {
      success: false,
      error: "Erreur lors de la récupération du menu",
    };
  }
}

/**
 * Crée un nouveau menu
 * 
 * @param formData - Les données du formulaire
 * @returns Un objet avec success, message ou error
 */
export async function createMenu(formData: FormData) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return { success: false, error: "Non autorisé" };
    }

    const rawData = {
      libelle: formData.get("libelle") as string,
      description: formData.get("description") as string || null,
      lien: formData.get("lien") as string,
      niveau: formData.get("niveau") as "NAVBAR" | "SIDEBAR",
      roles: JSON.parse(formData.get("roles") as string),
      icone: formData.get("icone") as string || null,
      statut: formData.get("statut") === "true",
      ordre: parseInt(formData.get("ordre") as string) || 0,
      parent: formData.get("parent") as string || null,
      electoral: formData.get("electoral") === "true",
    };

    const validatedData = CreateMenuSchema.parse(rawData);

    // Vérifier les doublons
    const existing = await db.menu.findFirst({
      where: {
        libelle: validatedData.libelle,
        niveau: validatedData.niveau,
      },
    });

    if (existing) {
      return {
        success: false,
        error: `Un menu "${validatedData.libelle}" existe déjà pour ce niveau`,
      };
    }

    const newMenu = await db.menu.create({
      data: {
        ...validatedData,
        createdBy: session.user.id,
      },
    });

    revalidatePath("/admin/menus");
    revalidatePath("/");
    revalidatePath("/admin");

    return {
      success: true,
      message: `Menu "${newMenu.libelle}" créé avec succès`,
      id: newMenu.id,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    console.error("Erreur lors de la création du menu:", error);
    return { success: false, error: "Erreur lors de la création du menu" };
  }
}

/**
 * Met à jour un menu existant
 * 
 * @param id - L'identifiant du menu
 * @param formData - Les nouvelles données
 * @returns Un objet avec success, message ou error
 */
export async function updateMenu(id: string, formData: FormData) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return { success: false, error: "Non autorisé" };
    }

    const menu = await db.menu.findUnique({ where: { id } });
    if (!menu) {
      return { success: false, error: "Menu non trouvé" };
    }

    const rawData: any = {};
    
    if (formData.has("libelle")) rawData.libelle = formData.get("libelle") as string;
    if (formData.has("description")) rawData.description = formData.get("description") as string || null;
    if (formData.has("lien")) rawData.lien = formData.get("lien") as string;
    if (formData.has("niveau")) rawData.niveau = formData.get("niveau") as "NAVBAR" | "SIDEBAR";
    if (formData.has("roles")) rawData.roles = JSON.parse(formData.get("roles") as string);
    if (formData.has("icone")) rawData.icone = formData.get("icone") as string || null;
    if (formData.has("statut")) rawData.statut = formData.get("statut") === "true";
    if (formData.has("ordre")) rawData.ordre = parseInt(formData.get("ordre") as string);
    if (formData.has("parent")) rawData.parent = formData.get("parent") as string || null;
    if (formData.has("electoral")) rawData.electoral = formData.get("electoral") === "true";

    const validatedData = UpdateMenuSchema.parse(rawData);

    const updated = await db.menu.update({
      where: { id },
      data: validatedData,
    });

    revalidatePath("/admin/menus");
    revalidatePath("/");
    revalidatePath("/admin");

    return {
      success: true,
      message: `Menu "${updated.libelle}" mis à jour avec succès`,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    console.error("Erreur lors de la mise à jour du menu:", error);
    return { success: false, error: "Erreur lors de la mise à jour du menu" };
  }
}

/**
 * Supprime un menu
 * 
 * @param id - L'identifiant du menu
 * @returns Un objet avec success, message ou error
 */
export async function deleteMenu(id: string) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return { success: false, error: "Non autorisé" };
    }

    const menu = await db.menu.findUnique({ where: { id } });
    if (!menu) {
      return { success: false, error: "Menu non trouvé" };
    }

    await db.menu.delete({ where: { id } });

    revalidatePath("/admin/menus");
    revalidatePath("/");
    revalidatePath("/admin");

    return {
      success: true,
      message: `Menu "${menu.libelle}" supprimé avec succès`,
    };
  } catch (error) {
    console.error("Erreur lors de la suppression du menu:", error);
    return { success: false, error: "Erreur lors de la suppression du menu" };
  }
}

/**
 * Active ou désactive un menu
 * 
 * @param id - L'identifiant du menu
 * @param statut - Le nouveau statut
 * @returns Un objet avec success, message ou error
 */
export async function toggleMenuStatus(id: string, statut: boolean) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return { success: false, error: "Non autorisé" };
    }

    const menu = await db.menu.update({
      where: { id },
      data: { statut },
    });

    revalidatePath("/admin/menus");
    revalidatePath("/");
    revalidatePath("/admin");

    return {
      success: true,
      message: `Menu "${menu.libelle}" ${statut ? "activé" : "désactivé"} avec succès`,
    };
  } catch (error) {
    console.error("Erreur lors du changement de statut:", error);
    return { success: false, error: "Erreur lors du changement de statut" };
  }
}

/**
 * Récupère le mappage des rôles de postes vers les rôles de menu
 * 
 * @returns Le mappage des codes de postes vers les rôles de menu
 */
export async function getPosteToMenuRoleMapping(): Promise<Record<string, string>> {
  return {
    "PRESID": "PRESID",
    "VICEPR": "VICEPR",
    "SECRET": "SECRET",
    "VICESE": "VICESE",
    "COMCPT": "COMCPT",
    "MEMBRE": "MEMBRE",
  };
}
