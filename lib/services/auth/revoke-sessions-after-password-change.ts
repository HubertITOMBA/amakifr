import { revokeAllUserSessions } from "@/lib/session-tracker";

/**
 * Nettoyage Redis best-effort APRÈS commit de la transaction DB de confirm.
 * Les Session web et MobileRefreshSession sont révoquées atomiquement dans
 * confirmPasswordResetChallenge (même transaction Serializable).
 *
 * @param userId - Identifiant utilisateur
 *
 * Dette séparée : adminResetUserPassword envoie encore un MDP temporaire en clair.
 */
export async function revokeRedisSessionsBestEffort(
  userId: string
): Promise<void> {
  try {
    await revokeAllUserSessions(userId);
  } catch {
    console.error("[password-reset] redis_session_revoke_failed", {
      category: "best_effort",
    });
  }
}
