/**
 * Système de rate limiting avec Redis (fallback en mémoire)
 * Utilise Redis si disponible, sinon utilise un stockage en mémoire
 * 
 * NOTE: Le middleware Next.js s'exécute dans Edge Runtime qui ne supporte pas ioredis.
 * Le middleware utilise uniquement le fallback en mémoire.
 * Redis est utilisé uniquement dans les Server Actions et API routes (Node.js runtime).
 */

interface RateLimitStore {
  count: number;
  resetTime: number;
}

// Stockage en mémoire (fallback si Redis n'est pas disponible ou dans Edge Runtime)
const rateLimitStore = new Map<string, RateLimitStore>();

/**
 * Configuration du rate limiting
 */
interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

const defaultConfig: RateLimitConfig = {
  maxRequests: 10,
  windowMs: 10000, // 10 secondes
};

/**
 * Détecte si on est dans Edge Runtime
 */
function isEdgeRuntime(): boolean {
  // Edge Runtime n'a pas process.versions.node
  return typeof process === 'undefined' || !process.versions?.node;
}

/**
 * Vérifie si une requête est autorisée selon le rate limit
 * Utilise Redis si disponible (Node.js runtime uniquement), sinon utilise un stockage en mémoire
 * 
 * @param identifier - Identifiant unique (IP, userId, etc.)
 * @param config - Configuration du rate limit
 * @returns true si autorisé, false si limité
 */
export async function checkRateLimit(
  identifier: string,
  config: Partial<RateLimitConfig> = {}
): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
  const finalConfig = { ...defaultConfig, ...config };
  const now = Date.now();
  
  // Essayer d'utiliser Redis si disponible (uniquement dans Node.js runtime, pas dans Edge Runtime)
  // Le middleware Next.js s'exécute dans Edge Runtime qui ne supporte pas ioredis
  if (!isEdgeRuntime()) {
    try {
      // Import dynamique pour éviter les erreurs dans Edge Runtime
      const { getRedisClient } = await import('./redis');
      const redisClient = getRedisClient();
      
      if (redisClient) {
        try {
          const key = `ratelimit:${identifier}`;
          const windowSeconds = Math.ceil(finalConfig.windowMs / 1000);
          
          // Utiliser INCR avec EXPIRE pour un rate limiting atomique
          const count = await redisClient.incr(key);
          
          // Si c'est la première requête dans cette fenêtre, définir le TTL
          if (count === 1) {
            await redisClient.expire(key, windowSeconds);
          }
          
          // Vérifier si le TTL existe (si count > 1 mais pas de TTL, le définir)
          const ttl = await redisClient.ttl(key);
          if (ttl === -1) {
            await redisClient.expire(key, windowSeconds);
          }
          
          const allowed = count <= finalConfig.maxRequests;
          const resetTime = now + (ttl > 0 ? ttl * 1000 : finalConfig.windowMs);
          
          return {
            allowed,
            remaining: Math.max(0, finalConfig.maxRequests - count),
            resetTime,
          };
        } catch (error) {
          // En cas d'erreur Redis, fallback en mémoire
          console.warn('[RateLimit] Erreur Redis, fallback en mémoire:', error);
        }
      }
    } catch (error) {
      // Ignorer les erreurs d'import dans Edge Runtime
      // console.warn('[RateLimit] Impossible d'importer Redis:', error);
    }
  }
  
  // Fallback en mémoire (utilisé dans Edge Runtime ou si Redis n'est pas disponible)
  const stored = rateLimitStore.get(identifier);
  
  // Si pas de stockage ou fenêtre expirée, réinitialiser
  if (!stored || now > stored.resetTime) {
    const resetTime = now + finalConfig.windowMs;
    rateLimitStore.set(identifier, {
      count: 1,
      resetTime,
    });
    
    // Nettoyer les entrées expirées périodiquement
    if (Math.random() < 0.01) { // 1% de chance à chaque requête
      cleanupExpiredEntries();
    }
    
    return {
      allowed: true,
      remaining: finalConfig.maxRequests - 1,
      resetTime,
    };
  }
  
  // Incrémenter le compteur
  stored.count++;
  
  const allowed = stored.count <= finalConfig.maxRequests;
  
  return {
    allowed,
    remaining: Math.max(0, finalConfig.maxRequests - stored.count),
    resetTime: stored.resetTime,
  };
}

/**
 * Nettoie les entrées expirées du store
 */
function cleanupExpiredEntries(): void {
  const now = Date.now();
  for (const [key, value] of rateLimitStore.entries()) {
    if (now > value.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}

/**
 * Presets de rate limiting pour différents types d'endpoints
 */
export const rateLimitPresets = {
  // API routes générales
  api: { maxRequests: 100, windowMs: 60000 }, // 100 req/min
  
  // Authentification (plus strict)
  auth: { maxRequests: 5, windowMs: 60000 }, // 5 req/min
  
  // Upload de fichiers
  upload: { maxRequests: 10, windowMs: 60000 }, // 10 req/min
  
  // Webhooks (très permissif)
  webhook: { maxRequests: 1000, windowMs: 60000 }, // 1000 req/min
  
  // Server Actions
  serverAction: { maxRequests: 50, windowMs: 60000 }, // 50 req/min
} as const;

/**
 * Helper pour obtenir l'identifiant depuis une requête
 */
export function getRateLimitIdentifier(request: { headers: Headers; ip?: string | null }): string {
  // Priorité: userId > IP
  // Pour l'instant, on utilise l'IP
  // TODO: Utiliser userId si disponible dans la session
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0] : request.ip || 'unknown';
  
  return ip;
}
