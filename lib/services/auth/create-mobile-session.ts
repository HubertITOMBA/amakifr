import { db } from "@/lib/db";
import { ServiceError } from "@/lib/service-error";
import { issueAccessToken } from "@/lib/auth-mobile/access-token";
import {
  generateRefreshToken,
  hashRefreshToken,
} from "@/lib/auth-mobile/refresh-token";
import { MOBILE_REFRESH_TOKEN_TTL_MS } from "@/lib/auth-mobile/constants";
import { recordSuccessfulLogin } from "@/lib/services/auth/record-successful-login";
import type {
  AuthenticatedUserDto,
  MobileAuthSessionDto,
} from "@/lib/services/auth/types";

/**
 * Crée une session mobile : access JWT + refresh opaque hashé en DB.
 * Enregistre aussi la dernière connexion (login réel, pas refresh).
 *
 * @param user - Utilisateur déjà authentifié (sans password)
 * @returns Tokens + user minimal
 */
export async function createMobileSession(
  user: AuthenticatedUserDto
): Promise<MobileAuthSessionDto> {
  if (!user?.id) {
    throw new ServiceError("INTERNAL_ERROR", "Utilisateur invalide");
  }

  try {
    const access = await issueAccessToken(user.id);
    const refreshToken = generateRefreshToken();
    const refreshTokenHash = hashRefreshToken(refreshToken);
    const refreshExpiresAt = new Date(Date.now() + MOBILE_REFRESH_TOKEN_TTL_MS);

    await db.mobileRefreshSession.create({
      data: {
        userId: user.id,
        refreshTokenHash,
        expiresAt: refreshExpiresAt,
        lastUsedAt: null,
        revokedAt: null,
        rotatedFromId: null,
      },
    });

    // Aligné Web (NextAuth signIn) — login réussi uniquement
    await recordSuccessfulLogin(user.id);

    return {
      accessToken: access.token,
      refreshToken,
      accessTokenExpiresAt: access.expiresAt.toISOString(),
      refreshTokenExpiresAt: refreshExpiresAt.toISOString(),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
      },
    };
  } catch (error) {
    if (error instanceof ServiceError) {
      throw error;
    }
    console.error("[createMobileSession] Erreur:", error);
    throw new ServiceError(
      "INTERNAL_ERROR",
      "Erreur lors de la création de la session mobile"
    );
  }
}
