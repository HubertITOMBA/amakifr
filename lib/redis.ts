/**
 * Client Redis pour le cache, le rate limiting et les sessions
 * Utilise ioredis pour une meilleure performance et gestion d'erreurs
 */

import Redis, { RedisOptions } from 'ioredis';

let redisClient: Redis | null = null;

/**
 * Initialise et retourne le client Redis
 * Utilise le pattern singleton pour éviter plusieurs connexions
 */
export function getRedisClient(): Redis | null {
  // Si Redis n'est pas configuré, retourner null (fallback en mémoire)
  if (!process.env.REDIS_URL && !process.env.REDIS_HOST) {
    return null;
  }

  // Si le client existe déjà, le retourner
  if (redisClient) {
    return redisClient;
  }

  try {
    // Créer le client Redis
    const options: RedisOptions = {
      // Utiliser REDIS_URL si disponible, sinon construire depuis REDIS_HOST/PORT
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || undefined,
      // Préfixe pour toutes les clés
      keyPrefix: process.env.REDIS_KEY_PREFIX || 'amakifr:',
      // Options de reconnexion
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      // Timeout de connexion
      connectTimeout: 10000,
      // Options de performance
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    };

    // Si REDIS_URL est défini, l'utiliser (priorité)
    if (process.env.REDIS_URL) {
      redisClient = new Redis(process.env.REDIS_URL, {
        ...options,
        keyPrefix: process.env.REDIS_KEY_PREFIX || 'amakifr:',
      });
    } else {
      redisClient = new Redis(options);
    }

    // Gestion des erreurs
    redisClient.on('error', (error) => {
      console.error('[Redis] Erreur:', error);
      // Ne pas reconnecter automatiquement si Redis n'est pas disponible
      // Le fallback en mémoire sera utilisé
    });

    redisClient.on('connect', () => {
      console.log('[Redis] Connecté avec succès');
    });

    redisClient.on('ready', () => {
      console.log('[Redis] Prêt à recevoir des commandes');
    });

    redisClient.on('close', () => {
      console.log('[Redis] Connexion fermée');
    });

    // Connecter le client
    redisClient.connect().catch((error) => {
      console.error('[Redis] Erreur de connexion:', error);
      redisClient = null;
    });

    return redisClient;
  } catch (error) {
    console.error('[Redis] Erreur lors de l\'initialisation:', error);
    return null;
  }
}

/**
 * Vérifie si Redis est disponible
 */
export async function isRedisAvailable(): Promise<boolean> {
  const client = getRedisClient();
  if (!client) {
    return false;
  }

  try {
    await client.ping();
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Ferme la connexion Redis (utile pour les tests ou le nettoyage)
 */
export async function closeRedisConnection(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}

/**
 * Cache simple avec TTL (Time To Live)
 */
export class RedisCache {
  private client: Redis | null;

  constructor() {
    this.client = getRedisClient();
  }

  /**
   * Récupère une valeur du cache
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.client) {
      return null;
    }

    try {
      const value = await this.client.get(key);
      if (!value) {
        return null;
      }
      return JSON.parse(value) as T;
    } catch (error) {
      console.error(`[RedisCache] Erreur lors de la récupération de ${key}:`, error);
      return null;
    }
  }

  /**
   * Stocke une valeur dans le cache avec TTL
   */
  async set(key: string, value: any, ttlSeconds?: number): Promise<boolean> {
    if (!this.client) {
      return false;
    }

    try {
      const serialized = JSON.stringify(value);
      if (ttlSeconds) {
        await this.client.setex(key, ttlSeconds, serialized);
      } else {
        await this.client.set(key, serialized);
      }
      return true;
    } catch (error) {
      console.error(`[RedisCache] Erreur lors du stockage de ${key}:`, error);
      return false;
    }
  }

  /**
   * Supprime une clé du cache
   */
  async delete(key: string): Promise<boolean> {
    if (!this.client) {
      return false;
    }

    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      console.error(`[RedisCache] Erreur lors de la suppression de ${key}:`, error);
      return false;
    }
  }

  /**
   * Supprime toutes les clés correspondant à un pattern
   */
  async deletePattern(pattern: string): Promise<number> {
    if (!this.client) {
      return 0;
    }

    try {
      const keys = await this.client.keys(pattern);
      if (keys.length === 0) {
        return 0;
      }
      await this.client.del(...keys);
      return keys.length;
    } catch (error) {
      console.error(`[RedisCache] Erreur lors de la suppression du pattern ${pattern}:`, error);
      return 0;
    }
  }

  /**
   * Vérifie si une clé existe
   */
  async exists(key: string): Promise<boolean> {
    if (!this.client) {
      return false;
    }

    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      console.error(`[RedisCache] Erreur lors de la vérification de ${key}:`, error);
      return false;
    }
  }

  /**
   * Incrémente une valeur (utile pour les compteurs)
   */
  async increment(key: string, by: number = 1): Promise<number | null> {
    if (!this.client) {
      return null;
    }

    try {
      return await this.client.incrby(key, by);
    } catch (error) {
      console.error(`[RedisCache] Erreur lors de l'incrémentation de ${key}:`, error);
      return null;
    }
  }

  /**
   * Définit un TTL sur une clé existante
   */
  async expire(key: string, ttlSeconds: number): Promise<boolean> {
    if (!this.client) {
      return false;
    }

    try {
      await this.client.expire(key, ttlSeconds);
      return true;
    } catch (error) {
      console.error(`[RedisCache] Erreur lors de la définition du TTL pour ${key}:`, error);
      return false;
    }
  }
}

// Instance singleton du cache
export const redisCache = new RedisCache();
