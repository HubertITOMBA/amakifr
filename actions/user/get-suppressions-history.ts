"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";

/**
 * Récupère l'historique des suppressions d'adhérents
 * 
 * @param page - Numéro de page (défaut: 1)
 * @param limit - Nombre d'éléments par page (défaut: 20)
 * @param searchTerm - Terme de recherche (nom, email, raison)
 * @returns Un objet avec success (boolean), data (array) en cas de succès,
 * ou error (string) en cas d'échec
 */
export async function getSuppressionsHistory(
  page: number = 1,
  limit: number = 20,
  searchTerm?: string
) {
  try {
    // Vérifier que l'utilisateur connecté est admin
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return {
        success: false,
        error: "Non autorisé. Seuls les administrateurs peuvent consulter l'historique des suppressions.",
      };
    }

    const skip = (page - 1) * limit;

    // Construire la condition de recherche
    const where = searchTerm
      ? {
          OR: [
            { userName: { contains: searchTerm, mode: "insensitive" as const } },
            { userEmail: { contains: searchTerm, mode: "insensitive" as const } },
            { reason: { contains: searchTerm, mode: "insensitive" as const } },
            { deletedByName: { contains: searchTerm, mode: "insensitive" as const } },
            { adherentFirstName: { contains: searchTerm, mode: "insensitive" as const } },
            { adherentLastName: { contains: searchTerm, mode: "insensitive" as const } },
          ],
        }
      : {};

    // Récupérer les suppressions avec pagination
    const [suppressions, total] = await Promise.all([
      db.suppressionAdherent.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          DeletedBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }),
      db.suppressionAdherent.count({ where }),
    ]);

    return {
      success: true,
      data: suppressions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    console.error("Erreur lors de la récupération de l'historique des suppressions:", error);
    return {
      success: false,
      error: "Une erreur s'est produite lors de la récupération de l'historique.",
    };
  }
}

/**
 * Récupère les statistiques des suppressions
 * 
 * @returns Un objet avec success (boolean), data (stats) en cas de succès,
 * ou error (string) en cas d'échec
 */
export async function getSuppressionsStats() {
  try {
    // Vérifier que l'utilisateur connecté est admin
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return {
        success: false,
        error: "Non autorisé.",
      };
    }

    const [
      total,
      last30Days,
      last7Days,
      withNotification,
      withoutNotification,
    ] = await Promise.all([
      db.suppressionAdherent.count(),
      db.suppressionAdherent.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          },
        },
      }),
      db.suppressionAdherent.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      }),
      db.suppressionAdherent.count({
        where: { notifyUser: true },
      }),
      db.suppressionAdherent.count({
        where: { notifyUser: false },
      }),
    ]);

    return {
      success: true,
      data: {
        total,
        last30Days,
        last7Days,
        withNotification,
        withoutNotification,
      },
    };
  } catch (error) {
    console.error("Erreur lors de la récupération des statistiques:", error);
    return {
      success: false,
      error: "Une erreur s'est produite lors de la récupération des statistiques.",
    };
  }
}
