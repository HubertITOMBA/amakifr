import type { AuthContext } from "@/lib/auth-context";
import { ServiceError } from "@/lib/service-error";

/**
 * Exige un actor.userId non vide pour les opérations self-service.
 *
 * @throws {ServiceError} UNAUTHENTICATED
 */
export function requireActorUserId(actor: AuthContext): string {
  const userId = actor?.userId?.trim() ?? "";
  if (!userId) {
    throw new ServiceError("UNAUTHENTICATED", "Non autorisé");
  }
  return userId;
}
