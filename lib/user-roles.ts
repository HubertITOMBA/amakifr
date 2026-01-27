/**
 * Utilitaires pour récupérer et gérer les rôles d'administration des utilisateurs
 */

import { db } from "@/lib/db";
import { AdminRole } from "@prisma/client";

/**
 * Récupère les rôles d'administration d'un utilisateur depuis la base de données
 * 
 * @param userId - L'ID de l'utilisateur
 * @returns Un tableau des rôles d'administration de l'utilisateur
 */
export async function getUserAdminRolesFromDb(userId: string): Promise<AdminRole[]> {
  try {
    if (!userId || typeof userId !== 'string') {
      console.warn("[getUserAdminRolesFromDb] userId invalide:", userId);
      return [];
    }

    const user = await db.user.findUnique({
      where: { id: userId },
      include: {
        adminRoles: {
          select: {
            role: true,
          },
        },
      },
    });

    if (!user) {
      return [];
    }

    // S'assurer que adminRoles existe et est un tableau
    if (!user.adminRoles || !Array.isArray(user.adminRoles)) {
      return [];
    }

    return user.adminRoles.map(r => r.role).filter((role): role is AdminRole => role !== null && role !== undefined);
  } catch (error) {
    console.error("Erreur getUserAdminRolesFromDb:", error);
    return [];
  }
}

/**
 * Vérifie si un utilisateur a au moins un des rôles spécifiés
 * 
 * @param userId - L'ID de l'utilisateur
 * @param roles - Les rôles à vérifier
 * @returns true si l'utilisateur a au moins un des rôles
 */
export async function userHasAnyRole(userId: string, roles: AdminRole[]): Promise<boolean> {
  const userRoles = await getUserAdminRolesFromDb(userId);
  return roles.some(role => userRoles.includes(role));
}

/**
 * Vérifie si un utilisateur a tous les rôles spécifiés
 * 
 * @param userId - L'ID de l'utilisateur
 * @param roles - Les rôles à vérifier
 * @returns true si l'utilisateur a tous les rôles
 */
export async function userHasAllRoles(userId: string, roles: AdminRole[]): Promise<boolean> {
  const userRoles = await getUserAdminRolesFromDb(userId);
  return roles.every(role => userRoles.includes(role));
}
