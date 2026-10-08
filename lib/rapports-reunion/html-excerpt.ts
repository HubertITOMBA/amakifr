import DOMPurify from "isomorphic-dompurify";

const DEFAULT_EXCERPT_LENGTH = 200;

/**
 * Sanitize le HTML TipTap d’un rapport de réunion pour affichage complet.
 */
export function sanitizeRapportHtml(html: string): string {
  return DOMPurify.sanitize(String(html ?? ""), {
    USE_PROFILES: { html: true },
  });
}

/**
 * Échappe du texte pour insertion dans un document HTML (titres d’impression).
 */
export function escapeHtmlText(text: string): string {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Décode les entités HTML courantes en texte brut.
 */
export function decodeHtmlEntities(text: string): string {
  return String(text ?? "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) =>
      String.fromCharCode(parseInt(h, 16))
    )
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&");
}

/**
 * Convertit du HTML TipTap en extrait texte lisible (jamais de balises).
 * Exclut script/style, décode les entités, tronque proprement.
 *
 * @param html - Contenu HTML source
 * @param maxLength - Longueur max de l’extrait (défaut 200)
 */
export function htmlToPlainExcerpt(
  html: string,
  maxLength: number = DEFAULT_EXCERPT_LENGTH
): string {
  if (typeof html !== "string" || !html.trim()) {
    return "";
  }

  const withoutBlocked = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ");

  const stripped = DOMPurify.sanitize(withoutBlocked, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
  });

  const plain = decodeHtmlEntities(stripped)
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!plain) return "";
  if (plain.length <= maxLength) return plain;

  const sliced = plain.slice(0, maxLength);
  const lastSpace = sliced.lastIndexOf(" ");
  const cut =
    lastSpace > Math.floor(maxLength * 0.6) ? sliced.slice(0, lastSpace) : sliced;
  return `${cut.trimEnd()}…`;
}

/**
 * Indique si une réunion a un rapport lié (relation Prisma Rapport).
 */
export function reunionHasLinkedRapport(reunion: {
  Rapport?: { id?: string | null } | null;
}): boolean {
  return Boolean(reunion?.Rapport?.id);
}
