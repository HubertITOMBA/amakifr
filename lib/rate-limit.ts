/**
 * Système de rate limiting simple en mémoire
 * Pour la production, migrer vers Redis (@upstash/ratelimit)
 */

interface RateLimitStore {
  count: number;
  resetTime: number;
}

// Stockage en mémoire (perdu au redémarrage)
// En production, utiliser Redis
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
 * Vérifie si une requête est autorisée selon le rate limit
 * 
 * @param identifier - Identifiant unique (IP, userId, etc.)
 * @param config - Configuration du rate limit
 * @returns true si autorisé, false si limité
 */
export function checkRateLimit(
  identifier: string,
  config: Partial<RateLimitConfig> = {}
): { allowed: boolean; remaining: number; resetTime: number } {
  const finalConfig = { ...defaultConfig, ...config };
  const now = Date.now();
  
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
export function getRateLimitIdentifier(request: NextRequest): string {
  // Priorité: userId > IP
  // Pour l'instant, on utilise l'IP
  // TODO: Utiliser userId si disponible dans la session
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0] : request.ip || 'unknown';
  
  return ip;
}

