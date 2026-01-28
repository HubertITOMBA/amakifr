/**
 * Système de permissions dynamiques basé sur la base de données
 * 
 * Ce module permet de vérifier les permissions sans rebuild de l'application.
 * Les permissions sont stockées dans la table `permissions` et peuvent être modifiées
 * dynamiquement via l'interface d'administration.
 */

import { db } from "@/lib/db";
import { PermissionType } from "@prisma/client";
import { getUserAdminRolesFromDb } from "@/lib/user-roles";
import { isAdminRole } from "@/lib/utils";

/**
 * Vérifie si un utilisateur a la permission d'effectuer une action spécifique
 * 
 * @param userId - ID de l'utilisateur
 * @param action - Nom de l'action Server Action (ex: "getAllDettesInitiales")
 * @param type - Type de permission (READ, WRITE, DELETE, MANAGE)
 * @returns true si l'utilisateur a la permission, false sinon
 */
export async function hasPermission(
  userId: string,
  action: string,
  type: PermissionType = PermissionType.READ
): Promise<boolean> {
  try {
    // Récupérer l'utilisateur et ses rôles
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!user) {
      return false;
    }

    // Si l'utilisateur est ADMIN, il a tous les droits
    const normalizedRole = user.role?.toString().trim().toUpperCase();
    if (normalizedRole === "ADMIN") {
      return true;
    }

    // Récupérer les rôles d'administration de l'utilisateur
    const adminRoles = await getUserAdminRolesFromDb(userId);
    const allRoles: string[] = [];

    // Ajouter le rôle utilisateur principal
    if (normalizedRole && isAdminRole(normalizedRole)) {
      allRoles.push(normalizedRole);
    }

    // Ajouter les rôles d'administration
    adminRoles.forEach((role) => {
      const roleStr = role.toString().trim().toUpperCase();
      if (!allRoles.includes(roleStr)) {
        allRoles.push(roleStr);
      }
    });

    // Si l'utilisateur n'a aucun rôle admin, refuser l'accès
    if (allRoles.length === 0) {
      return false;
    }

    // Vérifier que le modèle Permission existe
    if (!('permission' in db)) {
      // Si la permission n'existe pas, on peut soit :
      // 1. Refuser l'accès (sécurisé par défaut)
      // 2. Autoriser uniquement ADMIN (fallback)
      // On choisit l'option 2 pour la compatibilité avec le code existant
      return normalizedRole === "ADMIN";
    }

    // Récupérer la permission depuis la base de données
    const permission = await (db as any).permission.findUnique({
      where: {
        action_type: {
          action,
          type,
        },
      },
    });

    // Si la permission n'existe pas ou est désactivée, refuser l'accès
    if (!permission || !permission.enabled) {
      // Si la permission n'existe pas, on peut soit :
      // 1. Refuser l'accès (sécurisé par défaut)
      // 2. Autoriser uniquement ADMIN (fallback)
      // On choisit l'option 2 pour la compatibilité avec le code existant
      return normalizedRole === "ADMIN";
    }

    // Vérifier si l'un des rôles de l'utilisateur est autorisé
    const normalizedPermissionRoles = permission.roles.map((r) =>
      r.toString().trim().toUpperCase()
    );
    const hasAccess = allRoles.some((role) =>
      normalizedPermissionRoles.includes(role)
    );

    return hasAccess;
  } catch (error) {
    console.error(`[hasPermission] Erreur lors de la vérification de la permission pour ${action}:`, error);
    // En cas d'erreur, refuser l'accès par sécurité
    return false;
  }
}

/**
 * Vérifie si un utilisateur peut lire une ressource (permission READ)
 * 
 * @param userId - ID de l'utilisateur
 * @param action - Nom de l'action Server Action
 * @returns true si l'utilisateur peut lire, false sinon
 */
export async function canRead(
  userId: string,
  action: string
): Promise<boolean> {
  return hasPermission(userId, action, PermissionType.READ);
}

/**
 * Vérifie si un utilisateur peut écrire/modifier une ressource (permission WRITE)
 * 
 * @param userId - ID de l'utilisateur
 * @param action - Nom de l'action Server Action
 * @returns true si l'utilisateur peut écrire, false sinon
 */
export async function canWrite(
  userId: string,
  action: string
): Promise<boolean> {
  return hasPermission(userId, action, PermissionType.WRITE);
}

/**
 * Vérifie si un utilisateur peut supprimer une ressource (permission DELETE)
 * 
 * @param userId - ID de l'utilisateur
 * @param action - Nom de l'action Server Action
 * @returns true si l'utilisateur peut supprimer, false sinon
 */
export async function canDelete(
  userId: string,
  action: string
): Promise<boolean> {
  return hasPermission(userId, action, PermissionType.DELETE);
}

/**
 * Vérifie si un utilisateur peut gérer complètement une ressource (permission MANAGE)
 * MANAGE inclut READ, WRITE et DELETE
 * 
 * @param userId - ID de l'utilisateur
 * @param action - Nom de l'action Server Action
 * @returns true si l'utilisateur peut gérer, false sinon
 */
export async function canManage(
  userId: string,
  action: string
): Promise<boolean> {
  return hasPermission(userId, action, PermissionType.MANAGE);
}

/**
 * Récupère toutes les permissions d'un utilisateur pour une ressource donnée
 * 
 * @param userId - ID de l'utilisateur
 * @param resource - Nom de la ressource (ex: "finances", "dettes")
 * @returns Liste des actions autorisées avec leur type de permission
 */
export async function getUserPermissionsForResource(
  userId: string,
  resource: string
): Promise<Array<{ action: string; type: PermissionType }>> {
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!user) {
      return [];
    }

    // Si l'utilisateur est ADMIN, retourner toutes les permissions de la ressource
    const normalizedRole = user.role?.toString().trim().toUpperCase();
    if (normalizedRole === "ADMIN") {
      const allPermissions = await db.permission.findMany({
        where: {
          resource,
          enabled: true,
        },
        select: {
          action: true,
          type: true,
        },
      });
      return allPermissions;
    }

    // Récupérer les rôles de l'utilisateur
    const adminRoles = await getUserAdminRolesFromDb(userId);
    const allRoles: string[] = [];

    if (normalizedRole && isAdminRole(normalizedRole)) {
      allRoles.push(normalizedRole);
    }

    adminRoles.forEach((role) => {
      const roleStr = role.toString().trim().toUpperCase();
      if (!allRoles.includes(roleStr)) {
        allRoles.push(roleStr);
      }
    });

    if (allRoles.length === 0) {
      return [];
    }

    // Vérifier que le modèle Permission existe
    if (!('permission' in db)) {
      return [];
    }

    // Récupérer les permissions de la ressource
    const permissions = await (db as any).permission.findMany({
      where: {
        resource,
        enabled: true,
      },
    });

    // Filtrer les permissions selon les rôles de l'utilisateur
    const userPermissions = permissions
      .filter((perm) => {
        const normalizedPermissionRoles = perm.roles.map((r) =>
          r.toString().trim().toUpperCase()
        );
        return allRoles.some((role) =>
          normalizedPermissionRoles.includes(role)
        );
      })
      .map((perm) => ({
        action: perm.action,
        type: perm.type,
      }));

    return userPermissions;
  } catch (error) {
    console.error(
      `[getUserPermissionsForResource] Erreur lors de la récupération des permissions pour ${resource}:`,
      error
    );
    return [];
  }
}

/**
 * Récupère toutes les permissions disponibles dans le système
 * 
 * @returns Liste de toutes les permissions avec leurs détails
 */
export async function getAllPermissions() {
  try {
    // Vérifier que le modèle Permission existe
    if (!('permission' in db)) {
      console.error("[getAllPermissions] Le modèle Permission n'est pas disponible dans le client Prisma.");
      return [];
    }

    const permissions = await (db as any).permission.findMany({
      orderBy: [
        { resource: "asc" },
        { action: "asc" },
        { type: "asc" },
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

    return permissions;
  } catch (error) {
    console.error("[getAllPermissions] Erreur lors de la récupération des permissions:", error);
    return [];
  }
}

/**
 * Crée ou met à jour une permission
 * 
 * @param data - Données de la permission
 * @returns Résultat de l'opération
 */
export async function upsertPermission(data: {
  action: string;
  resource: string;
  type: PermissionType;
  roles: string[];
  description?: string;
  route?: string;
  enabled?: boolean;
  createdBy?: string;
}) {
  try {
    // Vérifier que le modèle Permission existe
    if (!('permission' in db)) {
      console.error("[upsertPermission] Le modèle Permission n'est pas disponible dans le client Prisma. Veuillez exécuter 'npx prisma generate' et redémarrer le serveur.");
      return { success: false, error: "Le modèle Permission n'est pas disponible. Veuillez régénérer le client Prisma et redémarrer le serveur." };
    }

    const permission = await (db as any).permission.upsert({
      where: {
        action_type: {
          action: data.action,
          type: data.type,
        },
      },
      update: {
        resource: data.resource,
        roles: data.roles,
        description: data.description,
        route: data.route,
        enabled: data.enabled ?? true,
        updatedAt: new Date(),
      },
      create: {
        action: data.action,
        resource: data.resource,
        type: data.type,
        roles: data.roles,
        description: data.description,
        route: data.route,
        enabled: data.enabled ?? true,
        createdBy: data.createdBy,
      },
    });

    return { success: true, data: permission };
  } catch (error) {
    console.error("[upsertPermission] Erreur lors de la création/mise à jour de la permission:", error);
    return { success: false, error: "Erreur lors de la création/mise à jour de la permission" };
  }
}
