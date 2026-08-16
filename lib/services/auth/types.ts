import type { UserRole, UserStatus } from "@prisma/client";

/**
 * Utilisateur authentifié après validation credentials (sans password).
 */
export type AuthenticatedUserDto = {
  id: string;
  name: string | null;
  email: string;
  role: UserRole | string;
  status: UserStatus | string;
};

/**
 * Paire de tokens mobile + expirations ISO.
 */
export type MobileTokenPairDto = {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
  refreshTokenExpiresAt: string;
};

/**
 * Réponse login / refresh mobile.
 */
export type MobileAuthSessionDto = MobileTokenPairDto & {
  user: AuthenticatedUserDto;
};
