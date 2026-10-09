/**
 * Sanitisation TipTap → HTML sûr pour le lecteur mobile M2-D.
 * Politique allowlist stricte, sans DOM / sans WebView.
 *
 * Autorisé : p, h1–h3, ul, ol, li, strong, b, em, i, u, blockquote, hr, br, a
 * Interdit : script, style, iframe, object, embed, form, input, button,
 *            attributs on*, CSS arbitraire, images/ressources distantes.
 * Liens : uniquement http/https après action utilisateur.
 */

/** Taille max du HTML source avant sanitization / tokenisation (caractères). */
export const MAX_MEETING_REPORT_HTML_LENGTH = 200_000;

/**
 * true si le HTML dépasse la borne autorisée (pas de troncature silencieuse).
 */
export function isMeetingReportHtmlOversize(html: string): boolean {
  return String(html ?? "").length > MAX_MEETING_REPORT_HTML_LENGTH;
}

const ALLOWED_TAGS = new Set([
  "p",
  "h1",
  "h2",
  "h3",
  "ul",
  "ol",
  "li",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "blockquote",
  "hr",
  "br",
  "a",
]);

/** Balises dont le contenu interne est entièrement jeté. */
const DROP_WITH_CONTENT = new Set([
  "script",
  "style",
  "iframe",
  "object",
  "embed",
  "form",
  "input",
  "button",
  "textarea",
  "select",
  "option",
  "noscript",
  "svg",
  "math",
  "link",
  "meta",
  "base",
  "img",
  "video",
  "audio",
  "source",
  "picture",
  "canvas",
]);

const VOID_TAGS = new Set(["br", "hr"]);

/**
 * Décode les entités HTML courantes (texte sûr).
 */
export function decodeHtmlEntities(input: string): string {
  return String(input ?? "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => {
      const code = Number(n);
      if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return "";
      try {
        return String.fromCodePoint(code);
      } catch {
        return "";
      }
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => {
      const code = Number.parseInt(h, 16);
      if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return "";
      try {
        return String.fromCodePoint(code);
      } catch {
        return "";
      }
    });
}

/**
 * Valide une URL de lien : http/https absolus uniquement.
 * Décode les entités HTML puis normalise avant validation.
 * Refuse protocol-relative (//…), javascript:, data:, file:, schémas inconnus.
 */
export function sanitizeHref(raw: string | null | undefined): string | null {
  const value = String(raw ?? "")
    .trim()
    .replace(/[\u0000-\u001f\u007f]/g, "");
  if (!value) return null;

  // Décode d’abord (javascript&#58;… → javascript:…) puis retire les espaces.
  const normalized = decodeHtmlEntities(value).replace(/\s+/g, "");
  if (!normalized) return null;

  // Protocol-relative : jamais d’URL absolue http(s) fiable.
  if (normalized.startsWith("//")) {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    return null;
  }
  const protocol = parsed.protocol.toLowerCase();
  if (protocol !== "http:" && protocol !== "https:") {
    return null;
  }
  // Exige une origine absolue (pas de schéma ambigu).
  if (!parsed.host) return null;
  return parsed.toString();
}

function escapeText(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function extractHref(attrs: string): string | null {
  const match = attrs.match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
  if (!match) return null;
  return sanitizeHref(match[1] ?? match[2] ?? match[3] ?? "");
}

/**
 * Sanitise un fragment HTML TipTap.
 * @returns HTML allowlist ; chaîne vide si rien d’affichable.
 * @throws {Error} code MEETING_REPORT_HTML_TOO_LARGE si dépassement de borne
 *   (aucun traitement / aucune troncature ; le contenu n’est pas logué).
 */
export function sanitizeMeetingReportHtml(html: string): string {
  const source = String(html ?? "");
  if (isMeetingReportHtmlOversize(source)) {
    const err = new Error("MEETING_REPORT_HTML_TOO_LARGE");
    err.name = "MeetingReportHtmlTooLargeError";
    throw err;
  }
  if (!source.trim()) return "";

  let i = 0;
  let out = "";
  const dropDepth: string[] = [];
  /** Pile des balises ouvrantes réellement émises (pour fermetures cohérentes). */
  const openStack: string[] = [];

  while (i < source.length) {
    const lt = source.indexOf("<", i);
    if (lt === -1) {
      const rest = source.slice(i);
      if (dropDepth.length === 0) out += escapeText(rest);
      break;
    }
    if (lt > i) {
      const text = source.slice(i, lt);
      if (dropDepth.length === 0) out += escapeText(text);
    }

    const gt = source.indexOf(">", lt + 1);
    if (gt === -1) {
      // fragment mal formé : ignorer le reste
      break;
    }
    const rawTag = source.slice(lt + 1, gt).trim();
    i = gt + 1;

    if (!rawTag || rawTag.startsWith("!") || rawTag.startsWith("?")) {
      continue;
    }

    const isClose = rawTag.startsWith("/");
    const body = isClose ? rawTag.slice(1).trim() : rawTag;
    const selfClosing = !isClose && body.endsWith("/");
    const core = selfClosing ? body.slice(0, -1).trim() : body;
    const spaceIdx = core.search(/[\s/]/);
    const tagName = (
      spaceIdx === -1 ? core : core.slice(0, spaceIdx)
    ).toLowerCase();
    const attrs = spaceIdx === -1 ? "" : core.slice(spaceIdx);

    if (isClose) {
      if (dropDepth.length > 0) {
        if (dropDepth[dropDepth.length - 1] === tagName) {
          dropDepth.pop();
        }
        continue;
      }
      if (
        ALLOWED_TAGS.has(tagName) &&
        !VOID_TAGS.has(tagName) &&
        openStack.length > 0 &&
        openStack[openStack.length - 1] === tagName
      ) {
        openStack.pop();
        out += `</${tagName}>`;
      }
      continue;
    }

    if (DROP_WITH_CONTENT.has(tagName)) {
      if (!selfClosing && !VOID_TAGS.has(tagName)) {
        dropDepth.push(tagName);
      }
      continue;
    }

    if (dropDepth.length > 0) {
      continue;
    }

    if (!ALLOWED_TAGS.has(tagName)) {
      // balise inconnue : ignorer la balise, garder le texte enfants
      continue;
    }

    if (tagName === "br" || tagName === "hr") {
      out += `<${tagName} />`;
      continue;
    }

    if (tagName === "a") {
      const href = extractHref(attrs);
      if (href && !selfClosing) {
        out += `<a href="${escapeText(href)}">`;
        openStack.push("a");
      }
      // href invalide ou auto-fermant : le texte enfants reste, sans balise.
      continue;
    }

    out += `<${tagName}>`;
    if (selfClosing) {
      out += `</${tagName}>`;
    } else {
      openStack.push(tagName);
    }
  }

  return out.trim();
}

/**
 * Extrait un texte brut sûr (fallback lecteur / accessibilité).
 * Ne traite pas un HTML hors borne (renvoie chaîne vide sans loguer le contenu).
 */
export function htmlToPlainText(html: string): string {
  if (isMeetingReportHtmlOversize(html)) return "";
  const sanitized = sanitizeMeetingReportHtml(html);
  const withoutTags = sanitized
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|h1|h2|h3|li|blockquote|div)>/gi, "\n")
    .replace(/<hr\s*\/?>/gi, "\n——\n")
    .replace(/<[^>]+>/g, "");
  return decodeHtmlEntities(withoutTags)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
