"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { TypeActivite } from "@prisma/client";

/**
 * Récupère les activités utilisateurs avec pagination et filtres
 * 
 * @param page - Numéro de page (défaut: 1)
 * @param limit - Nombre d'activités par page (défaut: 50)
 * @param type - Filtrer par type d'activité (optionnel)
 * @param userId - Filtrer par utilisateur (optionnel)
 * @param entityType - Filtrer par type d'entité (optionnel)
 * @param searchTerm - Recherche dans l'action (optionnel)
 * @param startDate - Date de début (optionnel)
 * @param endDate - Date de fin (optionnel)
 * @returns Un objet avec success (boolean), activities (array) et pagination en cas de succès
 */
export async function getUserActivities(
  page: number = 1,
  limit: number = 50,
  type?: TypeActivite,
  userId?: string,
  entityType?: string,
  searchTerm?: string,
  startDate?: Date,
  endDate?: Date
) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return { success: false, error: "Non autorisé" };
    }

    // Vérifier que le modèle existe
    if (!('userActivity' in db)) {
      return {
        success: false,
        error: "Le modèle userActivity n'est pas disponible. Veuillez redémarrer le serveur après la migration.",
      };
    }

    const skip = (page - 1) * limit;

    // Construire les filtres
    const where: any = {};

    if (type) {
      where.type = type;
    }

    if (userId) {
      where.userId = userId;
    }

    if (entityType) {
      where.entityType = entityType;
    }

    if (searchTerm) {
      where.OR = [
        { action: { contains: searchTerm, mode: "insensitive" } },
        { userName: { contains: searchTerm, mode: "insensitive" } },
        { userEmail: { contains: searchTerm, mode: "insensitive" } },
      ];
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = startDate;
      }
      if (endDate) {
        where.createdAt.lte = endDate;
      }
    }

    // Récupérer les activités
    const [activities, total] = await Promise.all([
      (db as any).userActivity.findMany({
        where,
        include: {
          User: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              image: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        skip,
        take: limit,
      }),
      (db as any).userActivity.count({ where }),
    ]);

    return {
      success: true,
      activities,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (error: any) {
    // Gérer l'erreur P2021 (table does not exist) gracieusement
    if (error?.code === 'P2021' || error?.message?.includes('does not exist')) {
      console.warn("⚠️ La table user_activities n'existe pas encore. Exécutez la migration Prisma.");
      return {
        success: true,
        activities: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0,
        },
      };
    }
    console.error("Erreur lors de la récupération des activités:", error);
    return {
      success: false,
      error: "Erreur lors de la récupération des activités",
    };
  }
}

/**
 * Récupère les statistiques des activités
 * 
 * @returns Un objet avec success (boolean) et stats (object) en cas de succès
 */
export async function getActivityStats() {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return { success: false, error: "Non autorisé" };
    }

    // Vérifier que le modèle existe
    if (!('userActivity' in db)) {
      return {
        success: false,
        error: "Le modèle userActivity n'est pas disponible. Veuillez redémarrer le serveur après la migration.",
      };
    }

    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      total,
      last24h,
      last7d,
      last30d,
      byType,
      byUser,
      errors,
    ] = await Promise.all([
      (db as any).userActivity.count(),
      (db as any).userActivity.count({
        where: { createdAt: { gte: last24Hours } },
      }),
      (db as any).userActivity.count({
        where: { createdAt: { gte: last7Days } },
      }),
      (db as any).userActivity.count({
        where: { createdAt: { gte: last30Days } },
      }),
      (db as any).userActivity.groupBy({
        by: ["type"],
        _count: { type: true },
        orderBy: { _count: { type: "desc" } },
      }),
      (db as any).userActivity.groupBy({
        by: ["userId"],
        _count: { userId: true },
        orderBy: { _count: { userId: "desc" } },
        take: 10,
      }),
      (db as any).userActivity.count({
        where: { success: false },
      }),
    ]);

    return {
      success: true,
      stats: {
        total,
        last24h,
        last7d,
        last30d,
        byType,
        byUser,
        errors,
      },
    };
  } catch (error: any) {
    // Gérer l'erreur P2021 (table does not exist) gracieusement
    if (error?.code === 'P2021' || error?.message?.includes('does not exist')) {
      console.warn("⚠️ La table user_activities n'existe pas encore. Exécutez la migration Prisma.");
      return {
        success: true,
        stats: {
          total: 0,
          last24h: 0,
          last7d: 0,
          last30d: 0,
          byType: [],
          byUser: [],
          errors: 0,
        },
      };
    }
    console.error("Erreur lors de la récupération des statistiques:", error);
    return {
      success: false,
      error: "Erreur lors de la récupération des statistiques",
    };
  }
}

/**
 * Récupère les activités récentes pour le dashboard
 * 
 * @param limit - Nombre d'activités à récupérer (défaut: 10)
 * @returns Un objet avec success (boolean) et activities (array) en cas de succès
 */
export async function getRecentActivitiesForDashboard(limit: number = 10) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return { success: false, error: "Non autorisé" };
    }

    // Vérifier que le modèle existe
    if (!('userActivity' in db)) {
      return {
        success: true,
        activities: [],
      };
    }

    const activities = await (db as any).userActivity.findMany({
      include: {
        User: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            image: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: limit,
    });

    return {
      success: true,
      activities,
    };
  } catch (error: any) {
    // Gérer l'erreur P2021 (table does not exist) gracieusement
    if (error?.code === 'P2021' || error?.message?.includes('does not exist')) {
      console.warn("⚠️ La table user_activities n'existe pas encore. Exécutez la migration Prisma.");
      return {
        success: true,
        activities: [],
      };
    }
    console.error("Erreur lors de la récupération des activités récentes:", error);
    return {
      success: false,
      error: "Erreur lors de la récupération des activités récentes",
    };
  }
}

/**
 * Supprime les activités dont les IDs sont fournis (sélection manuelle).
 */
export async function deleteActivitiesByIds(ids: string[]) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return { success: false, error: "Non autorisé" };
    }
    if (!ids.length) {
      return { success: false, error: "Aucune activité sélectionnée" };
    }
    if (!("userActivity" in db)) {
      return { success: false, error: "Modèle userActivity non disponible" };
    }
    const result = await (db as any).userActivity.deleteMany({
      where: { id: { in: ids } },
    });
    revalidatePath("/admin/activities");
    revalidatePath("/admin");
    return {
      success: true,
      message: `${result.count} activité(s) supprimée(s)`,
      deletedCount: result.count,
    };
  } catch (error: any) {
    console.error("Erreur lors de la suppression des activités:", error);
    return { success: false, error: "Erreur lors de la suppression" };
  }
}

/**
 * Supprime les activités plus anciennes que X jours (vider partiellement la base).
 */
export async function deleteActivitiesOlderThanDays(days: number) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return { success: false, error: "Non autorisé" };
    }
    if (days < 1) {
      return { success: false, error: "Le nombre de jours doit être au moins 1" };
    }
    if (!("userActivity" in db)) {
      return { success: false, error: "Modèle userActivity non disponible" };
    }
    const before = new Date();
    before.setDate(before.getDate() - days);
    const result = await (db as any).userActivity.deleteMany({
      where: { createdAt: { lt: before } },
    });
    revalidatePath("/admin/activities");
    revalidatePath("/admin");
    return {
      success: true,
      message: `${result.count} activité(s) de plus de ${days} jours supprimée(s)`,
      deletedCount: result.count,
    };
  } catch (error: any) {
    console.error("Erreur lors de la suppression des activités:", error);
    return { success: false, error: "Erreur lors de la suppression" };
  }
}

/**
 * Supprime toutes les activités (vider complètement). À utiliser avec précaution.
 */
export async function deleteAllActivities() {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return { success: false, error: "Non autorisé" };
    }
    if (!("userActivity" in db)) {
      return { success: false, error: "Modèle userActivity non disponible" };
    }
    const result = await (db as any).userActivity.deleteMany({});
    revalidatePath("/admin/activities");
    revalidatePath("/admin");
    return {
      success: true,
      message: `${result.count} activité(s) supprimée(s)`,
      deletedCount: result.count,
    };
  } catch (error: any) {
    console.error("Erreur lors de la suppression des activités:", error);
    return { success: false, error: "Erreur lors de la suppression" };
  }
}
