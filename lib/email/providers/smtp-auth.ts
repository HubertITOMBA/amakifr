/**
 * Résolution de l'authentification SMTP (prod avec auth / sink local sans auth).
 * Aucune valeur de credential dans les messages d'erreur.
 */

/** Paire d'identifiants SMTP non vides. */
export type SmtpAuthPair = {
  user: string;
  pass: string;
};

/**
 * Erreur de configuration SMTP catégorielle (sans secret).
 */
export class SmtpAuthConfigError extends Error {
  readonly code = "SMTP_AUTH_CONFIG_ERROR" as const;

  /**
   * @param message - Message catégoriel sans valeur de credential
   */
  constructor(message: string) {
    super(message);
    this.name = "SmtpAuthConfigError";
  }
}

/**
 * Normalise une credential SMTP optionnelle.
 * `null` / `undefined` / chaînes vides / espaces seuls → absent.
 *
 * @param raw - Valeur brute d'environnement
 * @returns Chaîne non vide ou undefined
 */
export function normalizeOptionalSmtpCredential(
  raw: string | undefined | null
): string | undefined {
  if (raw == null) return undefined;
  const trimmed = String(raw).trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Résout l'auth SMTP selon la politique :
 * - user + pass tous deux non vides → paire auth ;
 * - tous deux absents/vides → pas d'auth (Mailpit / sink local) ;
 * - un seul présent → refus catégoriel (jamais la valeur dans le message).
 *
 * @param userRaw - SMTP_USER brut
 * @param passRaw - SMTP_PASS brut
 * @returns Paire auth ou undefined si aucune auth
 * @throws {SmtpAuthConfigError} Si une seule des deux variables est définie
 */
export function resolveSmtpAuth(
  userRaw: string | undefined | null,
  passRaw: string | undefined | null
): SmtpAuthPair | undefined {
  const user = normalizeOptionalSmtpCredential(userRaw);
  const pass = normalizeOptionalSmtpCredential(passRaw);

  if (user !== undefined && pass !== undefined) {
    return { user, pass };
  }
  if (user === undefined && pass === undefined) {
    return undefined;
  }

  throw new SmtpAuthConfigError(
    "SMTP_AUTH_CONFIG_ERROR: SMTP_USER et SMTP_PASS doivent être tous deux définis ou tous deux absents"
  );
}
