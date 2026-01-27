"use server";

import { db } from "@/lib/db";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";

/**
 * Récupère l'état d'activation des menus électoraux
 * 
 * @returns Un objet avec success (boolean), enabled (boolean) si le paramètre existe
 */
export async function getElectoralMenuStatus() {
  try {
    const setting = await db.appSettings.findUnique({
      where: { key: "electoral_menu_enabled" },
    });

    // Par défaut, les menus sont activés si le paramètre n'existe pas
    const enabled = setting ? setting.value === "true" : true;

    return {
      success: true,
      enabled,
    };
  } catch (error) {
    console.error("Erreur lors de la récupération du statut des menus électoraux:", error);
    // En cas d'erreur, on active par défaut pour ne pas bloquer
    return {
      success: true,
      enabled: true,
    };
  }
}

/**
 * Met à jour l'état d'activation des menus électoraux
 * 
 * @param enabled - true pour activer les menus, false pour les masquer
 * @returns Un objet avec success (boolean), message (string) en cas de succès, 
 * ou error (string) en cas d'échec
 */
export async function updateElectoralMenuStatus(enabled: boolean) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    // Vérifier que l'utilisateur est admin
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (user?.role !== "ADMIN") {
      return { success: false, error: "Accès réservé aux administrateurs" };
    }

    // Créer ou mettre à jour le paramètre
    await db.appSettings.upsert({
      where: { key: "electoral_menu_enabled" },
      update: {
        value: enabled.toString(),
        updatedBy: session.user.id,
      },
      create: {
        key: "electoral_menu_enabled",
        value: enabled.toString(),
        description: "Active ou désactive l'affichage des menus électoraux (Élections, Votes, Candidatures, Résultats)",
        category: "interface",
        updatedBy: session.user.id,
      },
    });

    // Revalider les pages concernées
    revalidatePath("/");
    revalidatePath("/admin");
    revalidatePath("/user/profile");
    revalidatePath("/admin/settings");

    return {
      success: true,
      message: enabled 
        ? "Les menus électoraux ont été activés" 
        : "Les menus électoraux ont été masqués",
    };
  } catch (error) {
    console.error("Erreur lors de la mise à jour du statut des menus électoraux:", error);
    return {
      success: false,
      error: "Erreur lors de la mise à jour des paramètres",
    };
  }
}
