"use server";

import { db } from "@/lib/db";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { PermissionType } from "@prisma/client";
import { z } from "zod";
import { getAllPermissions, upsertPermission } from "@/lib/dynamic-permissions";

/**
 * Schéma de validation pour créer/mettre à jour une permission
 */
const PermissionSchema = z.object({
  action: z.string().min(1, "L'action est requise"),
  resource: z.string().min(1, "La ressource est requise"),
  type: z.nativeEnum(PermissionType),
  roles: z.array(z.string()).min(1, "Au moins un rôle est requis"),
  description: z.string().optional().nullable(),
  route: z.string().optional().nullable(),
  enabled: z.boolean().default(true),
});

/**
 * Récupère toutes les permissions (pour l'admin)
 */
export async function getAllPermissionsForAdmin() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (!user || user.role !== "ADMIN") {
      return { success: false, error: "Seuls les administrateurs peuvent accéder aux permissions" };
    }

    const permissions = await getAllPermissions();

    return {
      success: true,
      data: permissions,
    };
  } catch (error) {
    console.error("Erreur lors de la récupération des permissions:", error);
    return {
      success: false,
      error: "Erreur lors de la récupération des permissions",
    };
  }
}

/**
 * Crée ou met à jour une permission
 */
export async function createOrUpdatePermission(formData: FormData) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (!user || user.role !== "ADMIN") {
      return { success: false, error: "Seuls les administrateurs peuvent modifier les permissions" };
    }

    const rawData = {
      action: formData.get("action") as string,
      resource: formData.get("resource") as string,
      type: formData.get("type") as PermissionType,
      roles: JSON.parse(formData.get("roles") as string) as string[],
      description: formData.get("description") as string || null,
      route: formData.get("route") as string || null,
      enabled: formData.get("enabled") === "true",
      createdBy: session.user.id,
    };

    const validatedData = PermissionSchema.parse(rawData);

    const result = await upsertPermission(validatedData);

    if (result.success) {
      revalidatePath("/admin/permissions");
      return {
        success: true,
        message: `Permission "${validatedData.action}" ${validatedData.type} mise à jour avec succès`,
      };
    }

    return result;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    console.error("Erreur lors de la création/mise à jour de la permission:", error);
    return { success: false, error: "Erreur lors de la création/mise à jour de la permission" };
  }
}

/**
 * Active ou désactive une permission
 */
export async function togglePermissionStatus(action: string, type: PermissionType, enabled: boolean) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (!user || user.role !== "ADMIN") {
      return { success: false, error: "Seuls les administrateurs peuvent modifier les permissions" };
    }

    // Vérifier que le modèle Permission existe
    if (!('permission' in db)) {
      return { success: false, error: "Le modèle Permission n'est pas disponible. Veuillez appliquer la migration et redémarrer le serveur." };
    }

    await (db as any).permission.update({
      where: {
        action_type: {
          action,
          type,
        },
      },
      data: {
        enabled,
        updatedAt: new Date(),
      },
    });

    revalidatePath("/admin/permissions");

    return {
      success: true,
      message: `Permission "${action}" ${enabled ? "activée" : "désactivée"} avec succès`,
    };
  } catch (error) {
    console.error("Erreur lors du changement de statut de la permission:", error);
    return { success: false, error: "Erreur lors du changement de statut" };
  }
}

/**
 * Supprime une permission
 */
export async function deletePermission(action: string, type: PermissionType) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (!user || user.role !== "ADMIN") {
      return { success: false, error: "Seuls les administrateurs peuvent supprimer les permissions" };
    }

    // Vérifier que le modèle Permission existe
    if (!('permission' in db)) {
      return { success: false, error: "Le modèle Permission n'est pas disponible. Veuillez appliquer la migration et redémarrer le serveur." };
    }

    await (db as any).permission.delete({
      where: {
        action_type: {
          action,
          type,
        },
      },
    });

    revalidatePath("/admin/permissions");

    return {
      success: true,
      message: `Permission "${action}" ${type} supprimée avec succès`,
    };
  } catch (error) {
    console.error("Erreur lors de la suppression de la permission:", error);
    return { success: false, error: "Erreur lors de la suppression de la permission" };
  }
}
