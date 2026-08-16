import { db } from "@/lib/db";
import type { AuthContext } from "@/lib/auth-context";
import { ServiceError } from "@/lib/service-error";
import { requireActorUserId } from "@/lib/services/notifications/require-actor-user-id";

/**
 * Marque une notification de l'acteur comme lue (self-service).
 * Ownership atomique : where id + actor.userId (anti-IDOR).
 * Idempotent si déjà lue (succès, comme l'historique update).
 *
 * Absent / autre propriétaire → NOT_FOUND (même message, sans fuite).
 *
 * @throws {ServiceError} UNAUTHENTICATED | NOT_FOUND | INTERNAL_ERROR
 */
export async function markMyNotificationAsRead(
  actor: AuthContext,
  notificationId: string
): Promise<void> {
  const userId = requireActorUserId(actor);
  const id = notificationId?.trim() ?? "";
  if (!id) {
    throw new ServiceError("NOT_FOUND", "Notification non trouvée");
  }

  try {
    const result = await db.notification.updateMany({
      where: {
        id,
        userId,
      },
      data: { lue: true },
    });

    if (result.count === 0) {
      throw new ServiceError("NOT_FOUND", "Notification non trouvée");
    }
  } catch (error) {
    if (error instanceof ServiceError) {
      throw error;
    }
    console.error("[markMyNotificationAsRead] Erreur:", error);
    throw new ServiceError(
      "INTERNAL_ERROR",
      "Erreur lors du marquage de la notification"
    );
  }
}
