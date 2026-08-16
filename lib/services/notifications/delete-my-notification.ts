import { db } from "@/lib/db";
import type { AuthContext } from "@/lib/auth-context";
import { ServiceError } from "@/lib/service-error";
import { requireActorUserId } from "@/lib/services/notifications/require-actor-user-id";

/**
 * Supprime une notification appartenant à l'acteur (self-service).
 * Ownership atomique : deleteMany où id + actor.userId (anti-IDOR).
 *
 * Absent / autre propriétaire → NOT_FOUND (même message, sans fuite).
 *
 * @throws {ServiceError} UNAUTHENTICATED | NOT_FOUND | INTERNAL_ERROR
 */
export async function deleteMyNotification(
  actor: AuthContext,
  notificationId: string
): Promise<void> {
  const userId = requireActorUserId(actor);
  const id = notificationId?.trim() ?? "";
  if (!id) {
    throw new ServiceError("NOT_FOUND", "Notification non trouvée");
  }

  try {
    const result = await db.notification.deleteMany({
      where: {
        id,
        userId,
      },
    });

    if (result.count === 0) {
      throw new ServiceError("NOT_FOUND", "Notification non trouvée");
    }
  } catch (error) {
    if (error instanceof ServiceError) {
      throw error;
    }
    console.error("[deleteMyNotification] Erreur:", error);
    throw new ServiceError(
      "INTERNAL_ERROR",
      "Erreur lors de la suppression de la notification"
    );
  }
}
