import { db } from "@/lib/db";
import type { AuthContext } from "@/lib/auth-context";
import { ServiceError } from "@/lib/service-error";

/**
 * Compte les notifications non lues de l'utilisateur authentifié (self-service).
 * Filtre toujours sur actor.userId.
 *
 * Pas d'authorize() : comportement historique = session uniquement.
 *
 * @throws {ServiceError} UNAUTHENTICATED | INTERNAL_ERROR
 */
export async function getMyUnreadNotificationCount(
  actor: AuthContext
): Promise<number> {
  if (!actor?.userId || String(actor.userId).trim() === "") {
    throw new ServiceError("UNAUTHENTICATED", "Non autorisé");
  }

  try {
    return await db.notification.count({
      where: {
        userId: actor.userId,
        lue: false,
      },
    });
  } catch (error) {
    if (error instanceof ServiceError) {
      throw error;
    }
    console.error("[getMyUnreadNotificationCount] Erreur:", error);
    throw new ServiceError(
      "INTERNAL_ERROR",
      "Erreur lors du comptage des notifications"
    );
  }
}
