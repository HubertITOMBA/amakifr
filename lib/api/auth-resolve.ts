import type { AuthContext } from "@/lib/auth-context";
import { resolveApiActorFromBearer } from "@/lib/api/auth-bearer";
import { resolveApiActorFromWebSession } from "@/lib/api/auth-web";

/**
 * Résolveur composite /api/v1 — Web cookie OU Bearer mobile.
 *
 * Règle ABSOLUE no-downgrade :
 * - Si Authorization est présent → Bearer uniquement.
 *   Bearer invalide → 401 (ServiceError), JAMAIS de fallback cookie Web.
 * - Si Authorization est absent → session Web NextAuth.
 *
 * @param request - Request HTTP
 * @returns AuthContext ou null si aucune identité
 */
export async function resolveApiActor(
  request: Request
): Promise<AuthContext | null> {
  const authorization = request.headers.get("authorization");

  if (authorization != null && authorization !== "") {
    const result = await resolveApiActorFromBearer(request);
    if (result.kind === "no_bearer") {
      // Header présent mais extract a renvoyé no_bearer (ne devrait pas arriver)
      // Fail closed : ne pas basculer vers Web
      return null;
    }
    return result.actor;
  }

  return resolveApiActorFromWebSession();
}
