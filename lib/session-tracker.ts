/**
 * Système de tracking des sessions utilisateur avec Redis
 * Permet de suivre les sessions actives et de les gérer
 */

import { getRedisClient } from './redis';

export interface UserSession {
  sessionId: string;
  userId: string;
  userEmail: string;
  userName: string;
  ipAddress: string;
  userAgent: string;
  createdAt: number;
  lastActivity: number;
  isCurrentSession?: boolean;
}

/**
 * Enregistre ou met à jour une session utilisateur dans Redis
 */
export async function trackSession(
  userId: string,
  sessionId: string,
  userEmail: string,
  userName: string,
  ipAddress: string,
  userAgent: string
): Promise<void> {
  const redisClient = getRedisClient();
  if (!redisClient) {
    // Redis n'est pas disponible, ignorer silencieusement
    return;
  }

  try {
    const sessionKey = `session:${userId}:${sessionId}`;
    const userSessionsKey = `user:sessions:${userId}`;
    
    const sessionData: UserSession = {
      sessionId,
      userId,
      userEmail,
      userName,
      ipAddress,
      userAgent,
      createdAt: Date.now(),
      lastActivity: Date.now(),
    };

    // Stocker la session avec TTL de 30 jours (même durée que la session JWT)
    const ttl = 30 * 24 * 60 * 60; // 30 jours en secondes
    await redisClient.setex(sessionKey, ttl, JSON.stringify(sessionData));
    
    // Ajouter la session à la liste des sessions de l'utilisateur
    await redisClient.sadd(userSessionsKey, sessionId);
    await redisClient.expire(userSessionsKey, ttl);
  } catch (error) {
    console.error('[SessionTracker] Erreur lors du tracking de la session:', error);
  }
}

/**
 * Met à jour la dernière activité d'une session
 */
export async function updateSessionActivity(
  userId: string,
  sessionId: string
): Promise<void> {
  const redisClient = getRedisClient();
  if (!redisClient) {
    return;
  }

  try {
    const sessionKey = `session:${userId}:${sessionId}`;
    const sessionData = await redisClient.get(sessionKey);
    
    if (sessionData) {
      const session: UserSession = JSON.parse(sessionData);
      session.lastActivity = Date.now();
      
      const ttl = await redisClient.ttl(sessionKey);
      if (ttl > 0) {
        await redisClient.setex(sessionKey, ttl, JSON.stringify(session));
      }
    }
  } catch (error) {
    console.error('[SessionTracker] Erreur lors de la mise à jour de la session:', error);
  }
}

/**
 * Récupère toutes les sessions d'un utilisateur
 */
export async function getUserSessions(userId: string): Promise<UserSession[]> {
  const redisClient = getRedisClient();
  if (!redisClient) {
    return [];
  }

  try {
    const userSessionsKey = `user:sessions:${userId}`;
    const sessionIds = await redisClient.smembers(userSessionsKey);
    
    if (sessionIds.length === 0) {
      return [];
    }

    const sessions: UserSession[] = [];
    
    for (const sessionId of sessionIds) {
      const sessionKey = `session:${userId}:${sessionId}`;
      const sessionData = await redisClient.get(sessionKey);
      
      if (sessionData) {
        sessions.push(JSON.parse(sessionData));
      } else {
        // Session expirée, la retirer de la liste
        await redisClient.srem(userSessionsKey, sessionId);
      }
    }

    // Trier par dernière activité (plus récente en premier)
    return sessions.sort((a, b) => b.lastActivity - a.lastActivity);
  } catch (error) {
    console.error('[SessionTracker] Erreur lors de la récupération des sessions:', error);
    return [];
  }
}

/**
 * Récupère toutes les sessions actives de tous les utilisateurs
 */
export async function getAllActiveSessions(): Promise<UserSession[]> {
  const redisClient = getRedisClient();
  if (!redisClient) {
    return [];
  }

  try {
    // Chercher toutes les clés de sessions
    const keys = await redisClient.keys('session:*:*');
    
    if (keys.length === 0) {
      return [];
    }

    const sessions: UserSession[] = [];
    
    for (const key of keys) {
      const sessionData = await redisClient.get(key);
      if (sessionData) {
        sessions.push(JSON.parse(sessionData));
      }
    }

    // Trier par dernière activité (plus récente en premier)
    return sessions.sort((a, b) => b.lastActivity - a.lastActivity);
  } catch (error) {
    console.error('[SessionTracker] Erreur lors de la récupération de toutes les sessions:', error);
    return [];
  }
}

/**
 * Supprime une session (déconnexion)
 */
export async function revokeSession(
  userId: string,
  sessionId: string
): Promise<boolean> {
  const redisClient = getRedisClient();
  if (!redisClient) {
    return false;
  }

  try {
    const sessionKey = `session:${userId}:${sessionId}`;
    const userSessionsKey = `user:sessions:${userId}`;
    
    // Supprimer la session
    await redisClient.del(sessionKey);
    
    // Retirer la session de la liste de l'utilisateur
    await redisClient.srem(userSessionsKey, sessionId);
    
    // Ajouter le token à la liste noire (pour invalider le JWT)
    const blacklistKey = `blacklist:token:${sessionId}`;
    await redisClient.setex(blacklistKey, 30 * 24 * 60 * 60, '1'); // 30 jours
    
    return true;
  } catch (error) {
    console.error('[SessionTracker] Erreur lors de la révocation de la session:', error);
    return false;
  }
}

/**
 * Supprime toutes les sessions d'un utilisateur (déconnexion de tous les appareils)
 */
export async function revokeAllUserSessions(userId: string): Promise<number> {
  const redisClient = getRedisClient();
  if (!redisClient) {
    return 0;
  }

  try {
    const sessions = await getUserSessions(userId);
    let revokedCount = 0;
    
    for (const session of sessions) {
      if (await revokeSession(userId, session.sessionId)) {
        revokedCount++;
      }
    }
    
    return revokedCount;
  } catch (error) {
    console.error('[SessionTracker] Erreur lors de la révocation de toutes les sessions:', error);
    return 0;
  }
}

/**
 * Vérifie si un token est dans la liste noire
 */
export async function isTokenBlacklisted(sessionId: string): Promise<boolean> {
  const redisClient = getRedisClient();
  if (!redisClient) {
    return false;
  }

  try {
    const blacklistKey = `blacklist:token:${sessionId}`;
    const exists = await redisClient.exists(blacklistKey);
    return exists === 1;
  } catch (error) {
    console.error('[SessionTracker] Erreur lors de la vérification de la liste noire:', error);
    return false;
  }
}

/**
 * Nettoie les sessions expirées
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const redisClient = getRedisClient();
  if (!redisClient) {
    return 0;
  }

  try {
    const keys = await redisClient.keys('session:*:*');
    let cleanedCount = 0;
    
    for (const key of keys) {
      const ttl = await redisClient.ttl(key);
      if (ttl === -2) { // -2 signifie que la clé n'existe plus
        cleanedCount++;
        
        // Extraire userId et sessionId de la clé
        const parts = key.split(':');
        if (parts.length === 3) {
          const userId = parts[1];
          const sessionId = parts[2];
          const userSessionsKey = `user:sessions:${userId}`;
          await redisClient.srem(userSessionsKey, sessionId);
        }
      }
    }
    
    return cleanedCount;
  } catch (error) {
    console.error('[SessionTracker] Erreur lors du nettoyage des sessions:', error);
    return 0;
  }
}
