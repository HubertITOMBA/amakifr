import { db } from "@/lib/db";
import { ServiceError } from "@/lib/service-error";
import { hashRefreshToken } from "@/lib/auth-mobile/refresh-token";
import { verifyAccessToken } from "@/lib/auth-mobile/access-token";
import { blacklistAccessTokenJti } from "@/lib/auth-mobile/access-token-blacklist";

export type LogoutMobileSessionInput = {
  refreshToken?: string | null;
  accessToken?: string | null;
};

/**
 * Révoque une session mobile (refresh) et blackliste l'access jti si fourni.
 * Idempotent : refresh inconnu ou déjà révoqué → succès silencieux.
 *
 * @param input - refreshToken (body) et/ou accessToken (Bearer)
 */
export async function logoutMobileSession(
  input: LogoutMobileSessionInput
): Promise<{ revoked: boolean }> {
  const refreshToken =
    typeof input.refreshToken === "string" ? input.refreshToken.trim() : "";
  const accessToken =
    typeof input.accessToken === "string" ? input.accessToken.trim() : "";

  if (!refreshToken && !accessToken) {
    throw new ServiceError(
      "VALIDATION_ERROR",
      "refreshToken ou access token requis"
    );
  }

  let revoked = false;
  const now = new Date();

  try {
    if (refreshToken) {
      const tokenHash = hashRefreshToken(refreshToken);
      const session = await db.mobileRefreshSession.findUnique({
        where: { refreshTokenHash: tokenHash },
        select: { id: true, revokedAt: true },
      });

      if (session && session.revokedAt == null) {
        await db.mobileRefreshSession.update({
          where: { id: session.id },
          data: { revokedAt: now, lastUsedAt: now },
        });
        revoked = true;
      }
      // déjà révoqué ou inconnu → idempotent OK
    }

    if (accessToken) {
      try {
        const claims = await verifyAccessToken(accessToken);
        await blacklistAccessTokenJti(claims.jti, claims.exp);
      } catch {
        // access déjà invalide / expiré → ne pas faire échouer le logout
      }
    }

    return { revoked };
  } catch (error) {
    if (error instanceof ServiceError) {
      throw error;
    }
    console.error("[logoutMobileSession] Erreur:", error);
    throw new ServiceError(
      "INTERNAL_ERROR",
      "Erreur lors de la déconnexion"
    );
  }
}
