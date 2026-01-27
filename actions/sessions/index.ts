"use server";

import { auth } from "@/auth";
import { UserRole } from "@prisma/client";
import {
  getAllActiveSessions,
  getUserSessions,
  revokeSession,
  revokeAllUserSessions,
  UserSession,
} from "@/lib/session-tracker";
import { db } from "@/lib/db";

/**
 * Récupère toutes les sessions actives (admin uniquement)
 */
export async function getAllSessions(): Promise<{
  success: boolean;
  sessions?: UserSession[];
  error?: string;
}> {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return { success: false, error: "Non authentifié" };
    }

    if (session.user.role !== UserRole.ADMIN) {
      return { success: false, error: "Accès refusé" };
    }

    const sessions = await getAllActiveSessions();
    
    // Enrichir avec les informations utilisateur depuis la base de données
    const enrichedSessions = await Promise.all(
      sessions.map(async (session) => {
        try {
          const user = await db.user.findUnique({
            where: { id: session.userId },
            select: {
              name: true,
              email: true,
              role: true,
              status: true,
            },
          });

          return {
            ...session,
            userName: user?.name || session.userName,
            userEmail: user?.email || session.userEmail,
          };
        } catch (error) {
          return session;
        }
      })
    );

    return { success: true, sessions: enrichedSessions };
  } catch (error) {
    console.error("[getAllSessions] Erreur:", error);
    return { success: false, error: "Erreur lors de la récupération des sessions" };
  }
}

/**
 * Récupère les sessions d'un utilisateur spécifique
 */
export async function getUserSessionsAction(userId: string): Promise<{
  success: boolean;
  sessions?: UserSession[];
  error?: string;
}> {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return { success: false, error: "Non authentifié" };
    }

    // L'utilisateur peut voir ses propres sessions, ou un admin peut voir toutes les sessions
    if (session.user.id !== userId && session.user.role !== UserRole.ADMIN) {
      return { success: false, error: "Accès refusé" };
    }

    const sessions = await getUserSessions(userId);
    return { success: true, sessions };
  } catch (error) {
    console.error("[getUserSessionsAction] Erreur:", error);
    return { success: false, error: "Erreur lors de la récupération des sessions" };
  }
}

/**
 * Déconnecte une session spécifique
 */
export async function revokeSessionAction(
  userId: string,
  sessionId: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return { success: false, error: "Non authentifié" };
    }

    // L'utilisateur peut déconnecter ses propres sessions, ou un admin peut déconnecter toutes les sessions
    if (session.user.id !== userId && session.user.role !== UserRole.ADMIN) {
      return { success: false, error: "Accès refusé" };
    }

    const revoked = await revokeSession(userId, sessionId);
    
    if (revoked) {
      return { success: true, message: "Session déconnectée avec succès" };
    } else {
      return { success: false, error: "Erreur lors de la déconnexion de la session" };
    }
  } catch (error) {
    console.error("[revokeSessionAction] Erreur:", error);
    return { success: false, error: "Erreur lors de la déconnexion de la session" };
  }
}

/**
 * Déconnecte toutes les sessions d'un utilisateur
 */
export async function revokeAllUserSessionsAction(
  userId: string
): Promise<{ success: boolean; message?: string; error?: string; count?: number }> {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return { success: false, error: "Non authentifié" };
    }

    // L'utilisateur peut déconnecter ses propres sessions, ou un admin peut déconnecter toutes les sessions
    if (session.user.id !== userId && session.user.role !== UserRole.ADMIN) {
      return { success: false, error: "Accès refusé" };
    }

    const count = await revokeAllUserSessions(userId);
    
    return {
      success: true,
      message: `${count} session(s) déconnectée(s) avec succès`,
      count,
    };
  } catch (error) {
    console.error("[revokeAllUserSessionsAction] Erreur:", error);
    return { success: false, error: "Erreur lors de la déconnexion des sessions" };
  }
}
