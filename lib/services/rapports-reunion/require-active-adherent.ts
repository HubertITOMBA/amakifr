import { db } from "@/lib/db";
import type { AuthContext } from "@/lib/auth-context";
import { ServiceError } from "@/lib/service-error";

/**
 * Résout l’adhérent lié à l’acteur et vérifie le statut Actif.
 * Ne fait jamais confiance à un adherentId client.
 *
 * @throws {ServiceError} UNAUTHENTICATED | FORBIDDEN | NOT_FOUND
 */
export async function requireActiveAdherent(
  actor: AuthContext
): Promise<{ adherentId: string }> {
  if (!actor?.userId || String(actor.userId).trim() === "") {
    throw new ServiceError("UNAUTHENTICATED", "Non autorisé");
  }

  if (actor.status === "Inactif") {
    throw new ServiceError(
      "FORBIDDEN",
      "Votre compte est désactivé. Veuillez contacter le bureau de l'association."
    );
  }

  const adherent = await db.adherent.findUnique({
    where: { userId: actor.userId },
    select: { id: true },
  });

  if (!adherent) {
    throw new ServiceError("NOT_FOUND", "Adhérent non trouvé");
  }

  return { adherentId: adherent.id };
}
