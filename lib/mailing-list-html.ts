/**
 * Parsing HTML simple pour les courriers postaux (corps formaté TipTap)
 */

import DOMPurify from "isomorphic-dompurify";

export type MailingTextRun = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  color?: string;
  fontSize?: string;
};

export type MailingHtmlBlock = {
  type: "paragraph" | "bullet" | "ordered";
  align?: "left" | "right" | "center";
  runs: MailingTextRun[];
};

const MAILING_ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "span",
  "ul",
  "ol",
  "li",
  "h1",
  "h2",
  "h3",
];

/**
 * Indique si le contenu contient du HTML
 */
export function isMailingHtmlContent(text: string): boolean {
  return /<[a-z][\s\S]*>/i.test(text.trim());
}

/**
 * Sanitise le HTML du corps de courrier
 */
export function sanitizeMailingBodyHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: MAILING_ALLOWED_TAGS,
    ALLOWED_ATTR: ["style"],
  });
}

/**
 * Convertit un texte brut en HTML minimal (paragraphes)
 */
export function plainTextToMailingHtml(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'");
}

function parseColorFromStyle(style: string): string | undefined {
  const hex = style.match(/color:\s*(#[0-9a-fA-F]{3,8})/i);
  if (hex) return hex[1].replace("#", "").toUpperCase();

  const rgb = style.match(/color:\s*rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i);
  if (rgb) {
    const r = Number(rgb[1]).toString(16).padStart(2, "0");
    const g = Number(rgb[2]).toString(16).padStart(2, "0");
    const b = Number(rgb[3]).toString(16).padStart(2, "0");
    return `${r}${g}${b}`.toUpperCase();
  }

  return undefined;
}

function parseFontSizeFromStyle(style: string): string | undefined {
  const match = style.match(/font-size:\s*([^;]+)/i);
  return match?.[1]?.trim();
}

function mergeAdjacentRuns(runs: MailingTextRun[]): MailingTextRun[] {
  const merged: MailingTextRun[] = [];
  for (const run of runs) {
    if (!run.text) continue;
    const prev = merged[merged.length - 1];
    if (
      prev &&
      prev.bold === run.bold &&
      prev.italic === run.italic &&
      prev.underline === run.underline &&
      prev.color === run.color &&
      prev.fontSize === run.fontSize
    ) {
      prev.text += run.text;
    } else {
      merged.push({ ...run });
    }
  }
  return merged;
}

type StyleState = {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  color?: string;
  fontSize?: string;
};

function parseInlineHtml(html: string, baseStyle: StyleState = {}): MailingTextRun[] {
  const runs: MailingTextRun[] = [];
  let i = 0;

  const pushText = (text: string, style: StyleState) => {
    if (!text) return;
    runs.push({
      text: decodeHtmlEntities(text),
      bold: style.bold,
      italic: style.italic,
      underline: style.underline,
      color: style.color,
      fontSize: style.fontSize,
    });
  };

  while (i < html.length) {
    if (html[i] !== "<") {
      const nextTag = html.indexOf("<", i);
      const chunk = nextTag === -1 ? html.slice(i) : html.slice(i, nextTag);
      pushText(chunk, baseStyle);
      i = nextTag === -1 ? html.length : nextTag;
      continue;
    }

    const tagEnd = html.indexOf(">", i);
    if (tagEnd === -1) break;

    const rawTag = html.slice(i + 1, tagEnd).trim();
    i = tagEnd + 1;

    if (rawTag.startsWith("br") || rawTag.startsWith("br/")) {
      pushText("\n", baseStyle);
      continue;
    }

    const isClosing = rawTag.startsWith("/");
    const tagName = (isClosing ? rawTag.slice(1) : rawTag.split(/\s/)[0])
      .replace("/", "")
      .toLowerCase();

    if (isClosing) {
      continue;
    }

    const closeTag = `</${tagName}>`;
    const closeIndex = html.toLowerCase().indexOf(closeTag, i);
    const inner = closeIndex === -1 ? html.slice(i) : html.slice(i, closeIndex);
    if (closeIndex !== -1) {
      i = closeIndex + closeTag.length;
    } else {
      i = html.length;
    }

    const nextStyle: StyleState = { ...baseStyle };
    if (tagName === "strong" || tagName === "b") nextStyle.bold = true;
    if (tagName === "em" || tagName === "i") nextStyle.italic = true;
    if (tagName === "u") nextStyle.underline = true;
    if (tagName === "span") {
      const styleMatch = rawTag.match(/style="([^"]*)"/i);
      if (styleMatch) {
        const color = parseColorFromStyle(styleMatch[1]);
        const fontSize = parseFontSizeFromStyle(styleMatch[1]);
        if (color) nextStyle.color = color;
        if (fontSize) nextStyle.fontSize = fontSize;
      }
    }
    if (tagName === "h1") nextStyle.bold = true;
    if (tagName === "h2") nextStyle.bold = true;
    if (tagName === "h3") nextStyle.bold = true;

    if (["strong", "b", "em", "i", "u", "span"].includes(tagName)) {
      runs.push(...parseInlineHtml(inner, nextStyle));
    } else {
      pushText(inner, nextStyle);
    }
  }

  return mergeAdjacentRuns(runs);
}

function parseAlignFromTag(rawTag: string): MailingHtmlBlock["align"] | undefined {
  const styleMatch = rawTag.match(/style="([^"]*)"/i);
  if (!styleMatch) return undefined;
  const align = styleMatch[1].match(/text-align:\s*(left|right|center)/i);
  return align?.[1] as MailingHtmlBlock["align"] | undefined;
}

/**
 * Transforme le corps (HTML ou texte) en blocs structurés pour PDF/DOCX
 */
export function parseMailingBodyBlocks(corps: string): MailingHtmlBlock[] {
  const trimmed = corps.trim();
  if (!trimmed) return [];

  const html = isMailingHtmlContent(trimmed)
    ? sanitizeMailingBodyHtml(trimmed)
    : plainTextToMailingHtml(trimmed);

  const blocks: MailingHtmlBlock[] = [];
  const blockRegex = /<(p|li|h1|h2|h3)([^>]*)>([\s\S]*?)<\/\1>/gi;
  let match: RegExpExecArray | null;

  while ((match = blockRegex.exec(html)) !== null) {
    const tag = match[1].toLowerCase();
    const attrs = match[2] || "";
    const inner = match[3] || "";
    const runs = parseInlineHtml(inner);
    if (!runs.length) continue;

    if (tag === "li") {
      const listType = html.slice(0, match.index).toLowerCase().includes("<ol")
        ? "ordered"
        : "bullet";
      blocks.push({ type: listType, runs });
      continue;
    }

    blocks.push({
      type: "paragraph",
      align: parseAlignFromTag(attrs),
      runs,
    });
  }

  if (blocks.length === 0) {
    const runs = parseInlineHtml(html.replace(/<[^>]+>/g, " "));
    if (runs.length) {
      blocks.push({ type: "paragraph", runs });
    }
  }

  return blocks;
}

/**
 * Extrait le texte brut (pour recherche / aperçu)
 */
export function mailingBodyToPlainText(corps: string): string {
  return parseMailingBodyBlocks(corps)
    .map((b) => b.runs.map((r) => r.text).join(""))
    .join("\n\n")
    .trim();
}
