import { getRedisClient } from "@/lib/redis";

/**
 * Blacklist un access token mobile par jti, avec TTL = temps restant avant exp.
 * Réutilise la clé Redis `blacklist:token:${jti}` (compatible isTokenBlacklisted).
 *
 * Best-effort uniquement : Redis n'est PAS la source de vérité du refresh
 * (PostgreSQL / MobileRefreshSession l'est). Si Redis est indisponible,
 * `false` ne signifie PAS « révocation access garantie » — l'access déjà
 * émis peut rester valide jusqu'à son `exp` (max ~15 min). Le logout refresh
 * en DB reste effectif indépendamment.
 *
 * Ne pas blacklister pour 30 jours un access de 15 minutes.
 *
 * @param jti - Claim jti de l'access token
 * @param expiresAtEpochSeconds - Claim exp (epoch secondes)
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
