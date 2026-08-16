import { db } from "@/lib/db";
import type { AuthContext } from "@/lib/auth-context";
import { ServiceError } from "@/lib/service-error";
import { requireActorUserId } from "@/lib/services/notifications/require-actor-user-id";

/**
 * Marque toutes les notifications non lues de l'acteur comme lues.
 * Filtre strict : userId = actor.userId, lue = false.
 * count === 0 reste un succès (comportement historique).
 *
 * @returns Nombre de notifications mises à jour
 * @throws {ServiceError} UNAUTHENTICATED | INTERNAL_ERROR
 */
export async function markAllMyNotificationsAsRead(
  actor: AuthContext
): Promise<number> {
  const userId = requireActorUserId(actor);

  try {
    const result = await db.notification.updateMany({
      where: {
        userId,
        lue: false,
      },
      data: { lue: true },
    });

    return result.count;
  } catch (error) {
    if (error instanceof ServiceError) {
      throw error;
    }
    console.error("[markAllMyNotificationsAsRead] Erreur:", error);
    throw new ServiceError(
      "INTERNAL_ERROR",
      "Erreur lors du marquage des notifications"
    );
  }
}
