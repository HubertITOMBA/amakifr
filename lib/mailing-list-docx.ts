/**
 * Génération DOCX : courriers postaux mailing list
 */

import {
  AlignmentType,
  Document,
  ImageRun,
  Packer,
  PageBreak,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import { readBrandLogoBase64 } from "@/lib/brand-logo-server";
import { mergeMailingTemplate, type MailingListRecipient } from "@/lib/mailing-list";
import { parseMailingBodyBlocks, type MailingTextRun } from "@/lib/mailing-list-html";

function runsToTextRuns(runs: MailingTextRun[], size = 22): TextRun[] {
  return runs.map(
    (run) =>
      new TextRun({
        text: run.text,
        bold: run.bold,
        italics: run.italic,
        underline: run.underline ? {} : undefined,
        color: run.color,
        size: run.fontSize ? Math.round(parseFloat(run.fontSize) * 1.5) || size : size,
      })
  );
}

function buildBrandedHeader(): Table {
  const logoBase64 = readBrandLogoBase64();
  const children: (ImageRun | TextRun)[] = [];

  if (logoBase64) {
    children.push(
      new ImageRun({
        type: "jpg",
        data: Buffer.from(logoBase64, "base64"),
        transformation: { width: 42, height: 42 },
      })
    );
  }

  children.push(
    new TextRun({ text: "  AMA", bold: true, size: 32, color: "FFFFFF" }),
    new TextRun({ text: "K", bold: true, size: 32, color: "FF6B6B" }),
    new TextRun({ text: "I France", bold: true, size: 32, color: "FFFFFF" })
  );

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            shading: { fill: "093DB5" },
            margins: { top: 120, bottom: 120, left: 200, right: 200 },
            children: [new Paragraph({ children })],
          }),
        ],
      }),
    ],
  });
}

function buildRecipientParagraphs(recipient: MailingListRecipient): Paragraph[] {
  const lines: string[] = [];
  const civNom = [recipient.civilite, recipient.prenom, recipient.nom.toUpperCase()]
    .filter(Boolean)
    .join(" ");
  if (civNom) lines.push(civNom);
  if (recipient.adresseLigne1) lines.push(recipient.adresseLigne1);
  if (recipient.adresseLigne2) lines.push(recipient.adresseLigne2);
  const cpVille = [recipient.codePostal, recipient.ville.toUpperCase()].filter(Boolean).join(" ");
  if (cpVille) lines.push(cpVille);

  return lines.map(
    (line) =>
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [new TextRun({ text: line, size: 22 })],
        spacing: { after: 80 },
      })
  );
}

/**
 * Place un paragraphe dans la moitié droite de la page (aligné à gauche dans cette zone),
 * sans le coller au bord droit comme le bloc adresse destinataire.
 */
function buildRightSideParagraph(
  text: string,
  options?: { bold?: boolean; spacingBefore?: number; spacingAfter?: number }
): Paragraph {
  return new Paragraph({
    // ~ moitié de la largeur utile A4 : texte à droite, non flush comme l'adresse
    indent: { left: 4500 },
    alignment: AlignmentType.LEFT,
    children: [
      new TextRun({
        text,
        bold: options?.bold,
        size: 22,
      }),
    ],
    spacing: {
      before: options?.spacingBefore,
      after: options?.spacingAfter ?? 80,
    },
  });
}

function blockToParagraph(
  block: ReturnType<typeof parseMailingBodyBlocks>[number]
): Paragraph {
  const alignment =
    block.align === "right"
      ? AlignmentType.RIGHT
      : block.align === "center"
        ? AlignmentType.CENTER
        : AlignmentType.LEFT;

  const prefix =
    block.type === "bullet" ? "• " : block.type === "ordered" ? "– " : "";

  const runs = block.runs.length
    ? runsToTextRuns(
        prefix
          ? [{ ...block.runs[0], text: prefix }, ...block.runs.slice(1)]
          : block.runs
      )
    : [new TextRun({ text: "" })];

  return new Paragraph({
    alignment,
    children: runs,
    spacing: { after: 180 },
  });
}

/**
 * Construit un document Word avec un courrier par section
 */
export async function buildMailingListDOCX(
  recipients: MailingListRecipient[],
  objet: string,
  corps: string,
  lieu = "Paris"
): Promise<Buffer> {
  const children: (Paragraph | Table)[] = [];

  recipients.forEach((recipient, index) => {
    if (index > 0) {
      children.push(new Paragraph({ children: [new PageBreak()] }));
    }

    children.push(buildBrandedHeader());
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "Amicale des anciens élèves de Kipaku en France",
            size: 18,
            color: "505050",
          }),
        ],
        spacing: { after: 300 },
      })
    );

    children.push(...buildRecipientParagraphs(recipient));

    const mergedObjet = mergeMailingTemplate(objet, recipient);
    const mergedCorps = mergeMailingTemplate(corps, recipient);
    const dateStr = new Date().toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    children.push(
      buildRightSideParagraph(`${lieu}, le ${dateStr}`, {
        spacingBefore: 500,
        spacingAfter: 200,
      }),
      new Paragraph({
        children: [new TextRun({ text: `Objet : ${mergedObjet}`, bold: true, size: 22 })],
        spacing: { after: 280 },
      })
    );

    for (const block of parseMailingBodyBlocks(mergedCorps)) {
      children.push(blockToParagraph(block));
    }

    children.push(
      buildRightSideParagraph("L'association AMAKI France", {
        spacingBefore: 400,
        spacingAfter: 80,
      }),
      buildRightSideParagraph("Le Bureau")
    );
  });

  const doc = new Document({
    sections: [{ children: children as Paragraph[] }],
  });

  return Packer.toBuffer(doc);
}
