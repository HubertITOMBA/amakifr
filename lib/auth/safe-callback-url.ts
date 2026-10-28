/**
 * Validation centralisée des `callbackUrl` post-connexion.
 * Accepte uniquement un chemin relatif interne same-origin.
 * Refuse les redirections externes et les variantes open-redirect.
 */

/** Fallback historique du formulaire de login. */
export const DEFAULT_POST_LOGIN_REDIRECT = "/?loggedIn=true" as const;

/** Contrôles C0 (U+0000–U+001F) et DEL (U+007F). */
const CONTROL_OR_DEL = /[\u0000-\u001F\u007F]/;

/**
 * Indique si une chaîne contient un caractère de contrôle C0 ou DEL.
 *
 * @param value - Chaîne à inspecter
 */
function hasControlOrDel(value: string): boolean {
  return CONTROL_OR_DEL.test(value);
}

/**
 * Indique si une chaîne est un chemin relatif interne sûr pour redirection.
 *
 * Règles :
 * - non vide après trim ;
 * - aucun contrôle C0 / DEL dans la valeur **brute** (après trim) ni **décodée** ;
 * - commence par `/` ;
 * - ne commence pas par `//` (protocole-relatif) ;
 * - aucun antislash `\` ;
 * - pas de schéma `scheme:` après le slash initial ;
 * - pas de `@` (userinfo) ;
 * - au plus **un** `decodeURIComponent` si des séquences `%HH` sont présentes
 *   (pas de décodage récursif).
 *
 * @param raw - Valeur brute (query `callbackUrl`)
 */
export function isSafeInternalCallbackPath(
  raw: string | null | undefined
): raw is string {
  if (raw == null) return false;
  const trimmed = raw.trim();
  if (!trimmed) return false;
  // Brute (après trim) : refuser C0 / DEL avant tout décodage
  if (hasControlOrDel(trimmed)) return false;

  let candidate = trimmed;

  // Décoder **une seule fois** si encodé (middleware encodeURIComponent)
  if (/%[0-9A-Fa-f]{2}/.test(candidate)) {
    try {
      candidate = decodeURIComponent(candidate);
    } catch {
      return false;
    }
  }

  candidate = candidate.trim();
  if (!candidate) return false;
  // Décodée : refuser à nouveau C0 / DEL (ex. %09, %0a, %0d, %7F)
  if (hasControlOrDel(candidate)) return false;

  if (!candidate.startsWith("/")) return false;
  if (candidate.startsWith("//")) return false;
  if (candidate.includes("\\")) return false;

  // Refuser schéma dissimulé après le slash initial (ex. /https://…)
  const afterSlash = candidate.slice(1);
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(afterSlash)) return false;

  // Refuser @host style /user@evil.com
  if (candidate.includes("@")) return false;

  return true;
}

/**
 * Retourne le chemin de redirection post-login : callback validé ou repli.
 * Réutilise la validation centralisée ; décodage unique borné (identique).
 *
 * @param raw - `callbackUrl` éventuel
 */
export function resolvePostLoginRedirect(
  raw: string | null | undefined
): string {
  if (!isSafeInternalCallbackPath(raw)) {
    return DEFAULT_POST_LOGIN_REDIRECT;
  }
  let candidate = raw.trim();
  if (/%[0-9A-Fa-f]{2}/.test(candidate)) {
    try {
      candidate = decodeURIComponent(candidate);
    } catch {
      return DEFAULT_POST_LOGIN_REDIRECT;
    }
  }
  return candidate.trim();
}
