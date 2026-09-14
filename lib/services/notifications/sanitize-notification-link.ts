/**
 * Sanitize un lien de notification pour affichage admin (lecture seule).
 * Helper pur, sans effet de bord — testable unitairement.
 */

export type SafeNotificationLink =
  | { kind: "internal"; href: string }
  | { kind: "external"; href: string }
  | { kind: "unsafe"; raw: string }
  | { kind: "empty" };

const BLOCKED_SCHEMES =
  /^(javascript|data|file|vbscript|blob|about|mailto|tel):/i;

/**
 * Valide et classifie un lien de notification.
 *
 * Autorisé :
 * - chemin interne commençant par un seul `/` (pas `//…`) ;
 * - URL absolue `http://` ou `https://`.
 *
 * Refusé : protocoles dangereux, `//domaine`, chaînes vides, autres schémas.
 *
 * @param raw - Valeur brute du champ lien
 */
export function sanitizeNotificationLink(
  raw: string | null | undefined
): SafeNotificationLink {
  if (raw == null) {
    return { kind: "empty" };
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    return { kind: "empty" };
  }

  // Protocol-relative URL : contourne la règle « chemin interne »
  if (trimmed.startsWith("//")) {
    return { kind: "unsafe", raw: trimmed };
  }

  // Chemin interne : un seul slash initial
  if (trimmed.startsWith("/")) {
    return { kind: "internal", href: trimmed };
  }

  const lower = trimmed.toLowerCase();

  if (BLOCKED_SCHEMES.test(lower)) {
    return { kind: "unsafe", raw: trimmed };
  }

  if (lower.startsWith("https://") || lower.startsWith("http://")) {
    try {
      const url = new URL(trimmed);
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        return { kind: "unsafe", raw: trimmed };
      }
      return { kind: "external", href: url.href };
    } catch {
      return { kind: "unsafe", raw: trimmed };
    }
  }

  return { kind: "unsafe", raw: trimmed };
}
