import { PASSWORD_RESET_COOLDOWN_MS } from "@/lib/auth/password-reset-constants";

/**
 * Message public unique pour toute demande (anti-énumération).
 * Ne prétend jamais qu'un e-mail a été effectivement envoyé.
 */
export const PASSWORD_RESET_REQUEST_MESSAGE =
  "Si un compte correspond à cette adresse, un code de réinitialisation sera envoyé.";

/**
 * Refus générique de confirmation (code invalide/expiré/utilisé/verrouillé).
 * Ne pas différencier les causes côté client.
 */
export const PASSWORD_RESET_CONFIRM_GENERIC_ERROR =
  "Réinitialisation impossible. Vérifiez les informations ou demandez un nouveau code.";

export type PasswordResetRequestPublic = {
  accepted: true;
  message: string;
  /** Secondes avant une nouvelle demande utile (cooldown). */
  retryAfter: number;
};

/**
 * Construit la réponse publique constante de demande.
 *
 * @param retryAfterSeconds - Délai conseillé (défaut = cooldown complet)
 */
export function buildPasswordResetRequestPublic(
  retryAfterSeconds: number = Math.ceil(PASSWORD_RESET_COOLDOWN_MS / 1000)
): PasswordResetRequestPublic {
  return {
    accepted: true,
    message: PASSWORD_RESET_REQUEST_MESSAGE,
    retryAfter: Math.max(0, Math.ceil(retryAfterSeconds)),
  };
}
