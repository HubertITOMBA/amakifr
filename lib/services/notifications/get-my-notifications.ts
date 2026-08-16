import { db } from "@/lib/db";
import type { AuthContext } from "@/lib/auth-context";
import { ServiceError } from "@/lib/service-error";
import { safeFindMany } from "@/lib/prisma-helpers";
import type {
  GetMyNotificationsOptions,
  NotificationDto,
} from "@/lib/services/notifications/types";

/**
 * Liste les notifications de l'utilisateur authentifié (self-service).
 * Filtre toujours sur actor.userId — jamais d'userId client arbitraire.
 *
 * Pas d'authorize() : comportement historique = session uniquement, pas de permission dynamique.
 *
 * @throws {ServiceError} UNAUTHENTICATED | INTERNAL_ERROR
 */
export async function getMyNotifications(
  actor: AuthContext,
  options?: GetMyNotificationsOptions
): Promise<NotificationDto[]> {
  if (!actor?.userId || String(actor.userId).trim() === "") {
    throw new ServiceError("UNAUTHENTICATED", "Non autorisé");
  }

  try {
    const where: {
      userId: string;
      lue?: boolean;
      type?: GetMyNotificationsOptions["type"];
    } = {
      userId: actor.userId,
    };

    if (options?.lue !== undefined) {
      where.lue = options.lue;
    }

    if (options?.type) {
      where.type = options.type;
    }

    const notifications = await safeFindMany(
      db.notification.findMany({
        where,
        orderBy: {
          createdAt: "desc",
        },
        take: options?.limit || 50,
        skip: options?.offset || 0,
      })
    );

    return notifications.map((n) => ({
      id: n.id,
      userId: n.userId,
      type: n.type,
      titre: n.titre,
      message: n.message,
      lien: n.lien,
      lue: n.lue,
      createdAt: n.createdAt.toISOString(),
    }));
  } catch (error) {
    if (error instanceof ServiceError) {
      throw error;
    }
    console.error("[getMyNotifications] Erreur:", error);
    throw new ServiceError(
      "INTERNAL_ERROR",
      "Erreur lors de la récupération des notifications"
    );
  }
}
