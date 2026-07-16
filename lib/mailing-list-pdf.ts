/**
 * Génération PDF : courriers postaux mailing list (un courrier par page)
 */

import type { jsPDF } from "jspdf";
import { addPDFHeader, addPDFFooter } from "@/lib/pdf-helpers";
import { mergeMailingTemplate, type MailingListRecipient } from "@/lib/mailing-list";
import {
  parseMailingBodyBlocks,
  type MailingHtmlBlock,
  type MailingTextRun,
} from "@/lib/mailing-list-html";

const MARGIN = 20;
const PAGE_WIDTH = 210;
const RIGHT_X = PAGE_WIDTH - MARGIN;
const CONTENT_WIDTH = RIGHT_X - MARGIN;
const LINE_HEIGHT = 5.5;
const PAGE_HEIGHT = 297;
const FOOTER_HEIGHT = 20;
const CONTENT_MAX_Y = PAGE_HEIGHT - FOOTER_HEIGHT - 10;
const HEADER_HEIGHT = 22;

/**
 * Colonne droite (fenêtre enveloppe + date/signature) :
 * texte à droite de la page, aligné à gauche dans cette zone (pas flush au bord droit).
 */
const RIGHT_COLUMN_X = 110;
const WINDOW_Y = 52;

function ensureSpace(doc: jsPDF, y: number, need: number): number {
  if (y + need > CONTENT_MAX_Y) {
    doc.addPage();
    addPDFHeader(doc, undefined, { headerHeight: HEADER_HEIGHT });
    return HEADER_HEIGHT + 8;
  }
  return y;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

function applyRunStyle(doc: jsPDF, run: MailingTextRun, baseSize = 10): void {
  const style =
    run.bold && run.italic
      ? "bolditalic"
      : run.bold
        ? "bold"
        : run.italic
          ? "italic"
          : "normal";
  doc.setFont("helvetica", style);

  let size = baseSize;
  if (run.fontSize) {
    const px = parseFloat(run.fontSize);
    if (!Number.isNaN(px)) {
      size = Math.max(8, Math.min(16, px * 0.75));
    }
  }
  doc.setFontSize(size);

  if (run.color) {
    const [r, g, b] = hexToRgb(run.color);
    doc.setTextColor(r, g, b);
  } else {
    doc.setTextColor(0, 0, 0);
  }
}

function measureRunWidth(doc: jsPDF, run: MailingTextRun, baseSize = 10): number {
  applyRunStyle(doc, run, baseSize);
  return doc.getTextWidth(run.text);
}

function wrapRunsToLines(
  doc: jsPDF,
  runs: MailingTextRun[],
  maxWidth: number,
  baseSize = 10
): MailingTextRun[][] {
  const lines: MailingTextRun[][] = [];
  let currentLine: MailingTextRun[] = [];
  let currentWidth = 0;

  const flushLine = () => {
    if (currentLine.length) {
      lines.push(currentLine);
      currentLine = [];
      currentWidth = 0;
    }
  };

  for (const run of runs) {
    const parts = run.text.split("\n");
    parts.forEach((part, partIndex) => {
      if (partIndex > 0) flushLine();

      const words = part.split(/(\s+)/);
      for (const word of words) {
        if (!word) continue;
        const wordRun = { ...run, text: word };
        const wordWidth = measureRunWidth(doc, wordRun, baseSize);

        if (currentWidth + wordWidth > maxWidth && currentLine.length > 0) {
          flushLine();
        }

        if (wordWidth > maxWidth) {
          const chars = word.split("");
          let chunk = "";
          for (const ch of chars) {
            const test = chunk + ch;
            const testRun = { ...run, text: test };
            if (measureRunWidth(doc, testRun, baseSize) > maxWidth && chunk) {
              currentLine.push({ ...run, text: chunk });
              flushLine();
              chunk = ch;
            } else {
              chunk = test;
            }
          }
          if (chunk) {
            currentLine.push({ ...run, text: chunk });
            currentWidth = measureRunWidth(doc, { ...run, text: chunk }, baseSize);
          }
          continue;
        }

        const last = currentLine[currentLine.length - 1];
        if (
          last &&
          last.bold === run.bold &&
          last.italic === run.italic &&
          last.underline === run.underline &&
          last.color === run.color &&
          last.fontSize === run.fontSize
        ) {
          last.text += word;
        } else {
          currentLine.push({ ...run, text: word });
        }
        currentWidth += wordWidth;
      }
    });
  }

  flushLine();
  return lines;
}

function drawRunLine(
  doc: jsPDF,
  runs: MailingTextRun[],
  y: number,
  align: MailingHtmlBlock["align"],
  baseSize = 10
): void {
  const lineWidth = runs.reduce((sum, run) => sum + measureRunWidth(doc, run, baseSize), 0);

  let x =
    align === "right"
      ? RIGHT_X - lineWidth
      : align === "center"
        ? MARGIN + (CONTENT_WIDTH - lineWidth) / 2
        : MARGIN;

  for (const run of runs) {
    applyRunStyle(doc, run, baseSize);
    doc.text(run.text, x, y);
    if (run.underline) {
      const w = doc.getTextWidth(run.text);
      doc.setDrawColor(0, 0, 0);
      doc.line(x, y + 0.8, x + w, y + 0.8);
    }
    x += doc.getTextWidth(run.text);
  }
}

function drawFormattedBlock(
  doc: jsPDF,
  block: MailingHtmlBlock,
  yStart: number,
  baseSize = 10
): number {
  let y = yStart;
  const prefix = block.type === "bullet" ? "• " : block.type === "ordered" ? "– " : "";
  const runs =
    prefix && block.runs.length
      ? [{ ...block.runs[0], text: prefix }, ...block.runs.slice(1).map((r) => ({ ...r }))]
      : block.runs;

  const lines = wrapRunsToLines(doc, runs, CONTENT_WIDTH, baseSize);
  for (const line of lines) {
    y = ensureSpace(doc, y, LINE_HEIGHT);
    drawRunLine(doc, line, y, block.align ?? "left", baseSize);
    y += LINE_HEIGHT;
  }

  return y + LINE_HEIGHT * 0.35;
}

function drawRecipientWindow(doc: jsPDF, recipient: MailingListRecipient, yStart: number): number {
  let y = yStart;
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(0, 0, 0);

  const lines: string[] = [];
  const civNom = [recipient.civilite, recipient.prenom, recipient.nom.toUpperCase()]
    .filter(Boolean)
    .join(" ");
  if (civNom) lines.push(civNom);
  if (recipient.adresseLigne1) lines.push(recipient.adresseLigne1);
  if (recipient.adresseLigne2) lines.push(recipient.adresseLigne2);
  const cpVille = [recipient.codePostal, recipient.ville.toUpperCase()].filter(Boolean).join(" ");
  if (cpVille) lines.push(cpVille);

  for (const line of lines) {
    // À droite de la page, justifié à gauche (pas aligné au bord droit)
    doc.text(line, RIGHT_COLUMN_X, y);
    y += LINE_HEIGHT + 0.5;
  }

  return y;
}

/**
 * Dessine un texte dans la colonne droite, aligné à gauche (date, signature).
 */
function drawRightColumnText(doc: jsPDF, text: string, y: number): void {
  doc.text(text, RIGHT_COLUMN_X, y);
}

function drawLetterContent(
  doc: jsPDF,
  yStart: number,
  objet: string,
  corps: string,
  lieu: string
): number {
  let y = yStart;

  const dateStr = new Date().toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  y = ensureSpace(doc, y, LINE_HEIGHT * 2);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(0, 0, 0);
  drawRightColumnText(doc, `${lieu}, le ${dateStr}`, y);
  y += LINE_HEIGHT * 2;

  y = ensureSpace(doc, y, LINE_HEIGHT * 2);
  doc.setFont("helvetica", "bold");
  doc.text(`Objet : ${objet}`, MARGIN, y);
  y += LINE_HEIGHT * 2;

  const blocks = parseMailingBodyBlocks(corps);
  for (const block of blocks) {
    y = drawFormattedBlock(doc, block, y);
  }

  y = ensureSpace(doc, y, LINE_HEIGHT * 4);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(0, 0, 0);
  drawRightColumnText(doc, "L'association AMAKI France", y);
  y += LINE_HEIGHT;
  drawRightColumnText(doc, "Le Bureau", y);

  return y;
}

/**
 * Dessine un courrier complet sur la page courante du PDF
 */
export function drawMailingListLetterPage(
  doc: jsPDF,
  recipient: MailingListRecipient,
  objet: string,
  corps: string,
  lieu = "Paris"
): void {
  addPDFHeader(doc, undefined, { headerHeight: HEADER_HEIGHT });

  drawRecipientWindow(doc, recipient, WINDOW_Y);

  const contentY = Math.max(WINDOW_Y + 38, 98);
  const mergedObjet = mergeMailingTemplate(objet, recipient);
  const mergedCorps = mergeMailingTemplate(corps, recipient);
  drawLetterContent(doc, contentY, mergedObjet, mergedCorps, lieu);
}

/**
 * Construit un PDF multi-destinataires (une page par courrier)
 */
export function buildMailingListPDF(
  doc: jsPDF,
  recipients: MailingListRecipient[],
  objet: string,
  corps: string,
  lieu = "Paris"
): void {
  recipients.forEach((recipient, index) => {
    if (index > 0) {
      doc.addPage();
    }
    drawMailingListLetterPage(doc, recipient, objet, corps, lieu);
  });

  addPDFFooter(doc);
}
