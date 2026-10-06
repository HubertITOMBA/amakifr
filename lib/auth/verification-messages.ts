/**
 * Messages et formes publiques de la confirmation email.
 * Module partagé (pas de "use server") — importable depuis les Server Actions et les tests.
 */

/** Message unique — aucune énumération (token/utilisateur/expiration/verrou). */
export const EMAIL_VERIFICATION_GENERIC_ERROR =
  "Code invalide, expiré ou indisponible. Demandez un nouveau code."

/** Message unique — ne révèle pas l'existence ni l'état du compte. */
export const RESEND_VERIFICATION_GENERIC_MESSAGE =
  "Si un compte non confirmé correspond à cette adresse, un nouveau code sera envoyé."

/** Forme publique constante pour toute demande valide (anti-énumération). */
export const RESEND_VERIFICATION_PUBLIC_OK = {
  accepted: true as const,
  message: RESEND_VERIFICATION_GENERIC_MESSAGE,
  retryAfter: 60 as const,
}

export type ResendVerificationResult =
  | typeof RESEND_VERIFICATION_PUBLIC_OK
  | {
      error: string
    }
