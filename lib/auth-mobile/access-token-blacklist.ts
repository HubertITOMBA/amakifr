import { getRedisClient } from "@/lib/redis";

/**
 * Blacklist un access token mobile par jti, avec TTL = temps restant avant exp.
 *
 * BEST-EFFORT uniquement — Redis n'est PAS une source de vérité.
 * PostgreSQL (MobileRefreshSession) reste la source persistante du refresh.
 *
 * Si Redis est indisponible / erreur :
 * - `false` ≠ « access révoqué »
 * - logout refresh DB reste effectif
 * - access déjà émis peut rester valide jusqu'à `exp` (max ~15 min)
 * - `isTokenBlacklisted` retourne false → Bearer continue si JWT+User OK
 *
 * @returns true si écriture Redis effectuée ; false = best-effort échoué
 */
export async function blacklistAccessTokenJti(
  jti: string,
  expiresAtEpochSeconds: number
): Promise<boolean> {
  if (!jti?.trim()) {
    return false;
  }

  const redisClient = getRedisClient();
  if (!redisClient) {
    return false;
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const ttlSeconds = Math.max(1, expiresAtEpochSeconds - nowSeconds);

  try {
    const blacklistKey = `blacklist:token:${jti}`;
    await redisClient.setex(blacklistKey, ttlSeconds, "1");
    return true;
  } catch (error) {
    console.error("[auth-mobile] Erreur blacklist access jti:", error);
    return false;
  }
}
