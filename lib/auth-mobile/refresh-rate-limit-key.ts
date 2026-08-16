import { hashRefreshToken } from "@/lib/auth-mobile/refresh-token";
import { MOBILE_REFRESH_RATE_HASH_PREFIX_LEN } from "@/lib/auth-mobile/constants";

/**
 * Construit la clé de rate-limit pour /auth/refresh.
 * Ne contient JAMAIS le refresh brut — uniquement IP + préfixe SHA-256.
 *
 * @param ip - Adresse IP client
 * @param refreshToken - Refresh opaque brut (hashé immédiatement, non stocké)
 */
export function buildMobileRefreshRateLimitKey(
  ip: string,
  refreshToken: string
): string {
  const digest = hashRefreshToken(refreshToken).slice(
    0,
    MOBILE_REFRESH_RATE_HASH_PREFIX_LEN
  );
  return `mobile-refresh:${ip}:${digest}`;
}
