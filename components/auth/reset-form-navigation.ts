/**
 * Contrôleur de navigation post-demande « mot de passe oublié » (web).
 * Aucun email/code/token dans l’URL.
 */

/** Page de saisie du code + nouveau mot de passe. */
export const PASSWORD_RESET_NEW_PASSWORD_PATH = "/auth/new-password";

export type ResetActionResponse = {
  success?: string;
  error?: string;
};

/**
 * true uniquement si la demande est acceptée (succès anti-énumération)
 * et qu’aucune erreur actionnable n’est présente.
 *
 * @param response - Retour de l’action `reset`
 */
export function shouldNavigateAfterResetRequest(
  response: ResetActionResponse | null | undefined
): boolean {
  if (!response) return false;
  if (response.error) return false;
  return Boolean(response.success && String(response.success).trim());
}

/**
 * Chemin cible unique, sans query string.
 */
export function getPasswordResetConfirmPath(): string {
  return PASSWORD_RESET_NEW_PASSWORD_PATH;
}
