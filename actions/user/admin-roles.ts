"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { AdminRole } from "@prisma/client";
import { z } from "zod";
import { isAdmin } from "@/lib/permissions";
import { getUserAdminRolesFromDb } from "@/lib/user-roles";

/**
 * Récupère tous les rôles d'administration d'un utilisateur
 * 
 * @param userId - L'ID de l'utilisateur
 * @returns Les rôles de l'utilisateur
 */
export async function getUserAdminRoles(userId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    // Seul un admin peut voir les rôles d'un utilisateur
    const userRoles = await getUserAdminRolesFromDb(session.user.id);
    if (!isAdmin(userRoles)) {
      return { success: false, error: "Seuls les administrateurs peuvent consulter les rôles" };
    }

    const user = await db.user.findUnique({
      where: { id: userId },
      include: {
        adminRoles: {
          include: {
            creator: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    if (!user) {
      return { success: false, error: "Utilisateur non trouvé" };
    }

    return {
      success: true,
      roles: user.adminRoles.map(r => ({
        id: r.id,
        role: r.role,
        createdAt: r.createdAt,
        createdBy: {
          id: r.creator.id,
          name: r.creator.name,
          email: r.creator.email,
        },
      })),
    };
  } catch (error) {
    console.error("Erreur getUserAdminRoles:", error);
    return { success: false, error: "Erreur lors de la récupération des rôles" };
  }
}

/**
 * Schéma de validation pour l'attribution de rôles
 */
const AssignRolesSchema = z.object({
  userId: z.string().min(1, "L'ID utilisateur est requis"),
  roles: z.array(z.nativeEnum(AdminRole)).min(1, "Au moins un rôle est requis"),
});

/**
 * Attribue des rôles d'administration à un utilisateur
 * 
 * @param formData - Les données du formulaire contenant userId et roles
 * @returns Un objet avec success (boolean) et message/error
 */
export async function assignAdminRoles(formData: FormData) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    // Vérifier que l'utilisateur est admin
    const userRoles = await getUserAdminRolesFromDb(session.user.id);
    if (!isAdmin(userRoles)) {
      return { success: false, error: "Seuls les administrateurs peuvent attribuer des rôles" };
    }

    const rawData = {
      userId: formData.get("userId") as string,
      roles: JSON.parse(formData.get("roles") as string || "[]") as AdminRole[],
    };

    const validatedData = AssignRolesSchema.parse(rawData);

    // Empêcher de modifier ses propres rôles
    if (validatedData.userId === session.user.id) {
      return { success: false, error: "Vous ne pouvez pas modifier vos propres rôles" };
    }

    // Vérifier que l'utilisateur cible existe
    const targetUser = await db.user.findUnique({
      where: { id: validatedData.userId },
    });

    if (!targetUser) {
      return { success: false, error: "Utilisateur cible non trouvé" };
    }

    // Récupérer les rôles actuels
    const currentRoles = await db.userAdminRole.findMany({
      where: { userId: validatedData.userId },
    });

    const currentRoleSet = new Set(currentRoles.map(r => r.role));
    const newRoleSet = new Set(validatedData.roles);

    // Supprimer les rôles qui ne sont plus dans la nouvelle liste
    const rolesToRemove = currentRoles.filter(r => !newRoleSet.has(r.role));
    if (rolesToRemove.length > 0) {
      await db.userAdminRole.deleteMany({
        where: {
          id: { in: rolesToRemove.map(r => r.id) },
        },
      });
    }

    // Ajouter les nouveaux rôles
    const rolesToAdd = validatedData.roles.filter(role => !currentRoleSet.has(role));
    if (rolesToAdd.length > 0) {
      await db.userAdminRole.createMany({
        data: rolesToAdd.map(role => ({
          userId: validatedData.userId,
          role,
          createdBy: session.user.id,
        })),
        skipDuplicates: true,
      });
    }

    return {
      success: true,
      message: `Rôles mis à jour avec succès pour ${targetUser.name || targetUser.email}`,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    console.error("Erreur assignAdminRoles:", error);
    return { success: false, error: "Erreur lors de l'attribution des rôles" };
  } finally {
    revalidatePath("/admin/users");
    revalidatePath("/admin/users/roles");
    revalidatePath(`/admin/users/${formData.get("userId")}`);
  }
}

/**
 * Retire un rôle d'administration à un utilisateur
 * 
 * @param userRoleId - L'ID du rôle à retirer
 * @returns Un objet avec success (boolean) et message/error
 */
export async function removeAdminRole(userRoleId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    // Vérifier que l'utilisateur est admin
    const userRoles = await getUserAdminRolesFromDb(session.user.id);
    if (!isAdmin(userRoles)) {
      return { success: false, error: "Seuls les administrateurs peuvent retirer des rôles" };
    }

    // Récupérer le rôle à supprimer
    const userRole = await db.userAdminRole.findUnique({
      where: { id: userRoleId },
      include: { user: true },
    });

    if (!userRole) {
      return { success: false, error: "Rôle non trouvé" };
    }

    // Empêcher de retirer ses propres rôles
    if (userRole.userId === session.user.id) {
      return { success: false, error: "Vous ne pouvez pas retirer vos propres rôles" };
    }

    await db.userAdminRole.delete({
      where: { id: userRoleId },
    });

    return {
      success: true,
      message: `Rôle retiré avec succès pour ${userRole.user.name || userRole.user.email}`,
    };
  } catch (error) {
    console.error("Erreur removeAdminRole:", error);
    return { success: false, error: "Erreur lors du retrait du rôle" };
  } finally {
    revalidatePath("/admin/users");
    revalidatePath("/admin/users/roles");
  }
}

/**
 * Récupère les rôles d'administration de l'utilisateur connecté
 * 
 * @returns Les rôles d'administration de l'utilisateur connecté
 */
export async function getCurrentUserAdminRoles() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      // Retourner silencieusement sans erreur - l'utilisateur n'est simplement pas connecté
      // Pas besoin d'afficher "Non autorisé" à l'utilisateur
      return { success: true, roles: [] };
    }

    const userRoles = await getUserAdminRolesFromDb(session.user.id);

    return {
      success: true,
      roles: userRoles || [],
    };
  } catch (error: any) {
    console.error("Erreur getCurrentUserAdminRoles:", error);
    // Ne pas bloquer l'application si la récupération des rôles échoue
    // Retourner silencieusement sans erreur pour ne pas perturber l'utilisateur
    return { 
      success: true, 
      roles: [] 
    };
  }
}

/**
 * Récupère tous les utilisateurs avec leurs rôles d'administration
 * 
 * @returns La liste des utilisateurs avec leurs rôles
 */
export async function getAllUsersWithRoles() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    // Vérifier que l'utilisateur est admin
    const userRoles = await getUserAdminRolesFromDb(session.user.id);
    if (!isAdmin(userRoles)) {
      return { success: false, error: "Seuls les administrateurs peuvent consulter cette liste" };
    }

    // Filtrer uniquement les utilisateurs avec UserRole.ADMIN ou AdminRole.ADMIN
    const users = await db.user.findMany({
      where: {
        OR: [
          { role: "ADMIN" }, // UserRole.ADMIN
          {
            adminRoles: {
              some: {
                role: "ADMIN", // AdminRole.ADMIN
              },
            },
          },
        ],
      },
      include: {
        adminRoles: {
          orderBy: {
            createdAt: "desc",
          },
        },
        adherent: {
          select: {
            firstname: true,
            lastname: true,
            civility: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return {
      success: true,
      users: users.map(user => ({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role, // Rôle principal (rétrocompatibilité)
        status: user.status,
        adminRoles: user.adminRoles.map(r => r.role),
        adherent: user.adherent,
      })),
    };
  } catch (error) {
    console.error("Erreur getAllUsersWithRoles:", error);
    return { success: false, error: "Erreur lors de la récupération des utilisateurs" };
  }
}
