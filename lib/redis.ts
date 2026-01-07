/**
 * Client Redis pour le cache, le rate limiting et les sessions
 * Utilise ioredis pour une meilleure performance et gestion d'erreurs
 */

import Redis, { RedisOptions } from 'ioredis';

let redisClient: Redis | null = null;
let connectionAttempted = false;
let isConnected = false;

/**
 * Initialise et retourne le client Redis
 * Utilise le pattern singleton pour éviter plusieurs connexions
 */
export function getRedisClient(): Redis | null {
  // Si Redis est explicitement désactivé, retourner null
  if (process.env.REDIS_DISABLED === 'true') {
    return null;
  }

  // Si Redis n'est pas configuré, retourner null (fallback en mémoire)
  if (!process.env.REDIS_URL && !process.env.REDIS_HOST) {
    return null;
  }

  // Si le client existe déjà et est connecté, le retourner
  if (redisClient && isConnected) {
    return redisClient;
  }

  // Si une tentative de connexion a déjà échoué, ne pas réessayer
  if (connectionAttempted && !isConnected) {
    return null;
  }

  try {
    connectionAttempted = true;
    
    // Créer le client Redis
    const options: RedisOptions = {
      // Utiliser REDIS_URL si disponible, sinon construire depuis REDIS_HOST/PORT
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || undefined,
      // Préfixe pour toutes les clés
      keyPrefix: process.env.REDIS_KEY_PREFIX || 'amakifr:',
      // Options de reconnexion - désactiver les tentatives automatiques
      retryStrategy: () => {
        // Ne pas reconnecter automatiquement
        return null;
      },
      // Timeout de connexion
      connectTimeout: 5000,
      // Options de performance
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      // Ne pas reconnecter automatiquement
      enableReadyCheck: true,
      enableOfflineQueue: false,
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

    // Gestion des erreurs - silencieuse par défaut
    // Les erreurs Redis sont gérées silencieusement, le fallback en mémoire est utilisé automatiquement
    let errorLogged = false;
    redisClient.on('error', (error) => {
      // Ne logger que si explicitement demandé via REDIS_DEBUG=true
      if (process.env.REDIS_DEBUG === 'true' && !errorLogged) {
        console.warn('[Redis] Redis n\'est pas disponible, utilisation du fallback en mémoire:', error.message);
        errorLogged = true;
      }
      isConnected = false;
    });

    redisClient.on('connect', () => {
      // Ne logger que si explicitement demandé
      if (process.env.REDIS_DEBUG === 'true') {
        console.log('[Redis] Connexion établie');
      }
      isConnected = true;
    });

    redisClient.on('ready', () => {
      // Ne logger que si explicitement demandé
      if (process.env.REDIS_DEBUG === 'true') {
        console.log('[Redis] Prêt à recevoir des commandes');
      }
      isConnected = true;
    });

    redisClient.on('close', () => {
      isConnected = false;
      // Ne pas logger la fermeture
    });

    // Connecter le client de manière silencieuse
    redisClient.connect().catch((error) => {
      // Ne logger que si explicitement demandé
      if (process.env.REDIS_DEBUG === 'true' && !errorLogged) {
        console.warn('[Redis] Impossible de se connecter à Redis, utilisation du fallback en mémoire');
      }
      isConnected = false;
      redisClient = null;
    });

    return redisClient;
  } catch (error) {
    connectionAttempted = true;
    isConnected = false;
    // Ne logger que si explicitement demandé
    if (process.env.REDIS_DEBUG === 'true') {
      console.warn('[Redis] Erreur lors de l\'initialisation, utilisation du fallback en mémoire');
    }
    return null;
  }
}

/**
 * Vérifie si Redis est disponible
 */
export async function isRedisAvailable(): Promise<boolean> {
  const client = getRedisClient();
  if (!client || !isConnected) {
    return false;
  }

  try {
    await client.ping();
    return true;
  } catch (error) {
    isConnected = false;
    return false;
  }
}

/**
 * Ferme la connexion Redis (utile pour les tests ou le nettoyage)
 */
export async function closeRedisConnection(): Promise<void> {
  if (redisClient) {
    try {
      await redisClient.quit();
    } catch (error) {
      // Ignorer les erreurs lors de la fermeture
    }
    redisClient = null;
    isConnected = false;
    connectionAttempted = false;
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
