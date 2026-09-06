import { db } from "@/lib/db";
import { ServiceError } from "@/lib/service-error";

/**
 * Enregistre une authentification réussie (login réel).
 * Met à jour `lastLogin` + incrémente `loginCount`.
 * Ne pas appeler sur refresh token / restore session.
 *
 * @param userId - Identifiant utilisateur authentifié
 */
export async function recordSuccessfulLogin(userId: string): Promise<void> {
  if (!userId?.trim()) {
    throw new ServiceError("INTERNAL_ERROR", "Utilisateur invalide");
  }

  try {
    await db.user.update({
      where: { id: userId },
      data: {
        lastLogin: new Date(),
        loginCount: { increment: 1 },
      },
    });
  } catch (error) {
    console.error("[recordSuccessfulLogin] Erreur:", error);
    throw new ServiceError(
      "INTERNAL_ERROR",
      "Erreur lors de l'enregistrement de la connexion"
    );
  }
}
