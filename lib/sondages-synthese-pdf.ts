/**
 * Génération PDF : synthèse des résultats d'un sondage
 */

import type { jsPDF } from "jspdf";
import { addPDFHeader, addPDFFooter } from "@/lib/pdf-helpers";
import type { SondageSynthese } from "@/lib/sondages-synthese";

const MARGIN = 18;
const LINE = 5.5;
const PAGE_HEIGHT = 297;
const FOOTER = 22;
const MAX_Y = PAGE_HEIGHT - FOOTER - 8;

function ensureSpace(doc: jsPDF, y: number, need: number, headerTitle: string): number {
  if (y + need > MAX_Y) {
    doc.addPage();
    addPDFHeader(doc, headerTitle, { headerHeight: 28, titleAlign: "center" });
    return 32;
  }
  return y;
}

function wrapText(doc: jsPDF, text: string, maxWidth: number): string[] {
  return doc.splitTextToSize(text, maxWidth) as string[];
}

/**
 * Dessine la synthèse complète dans un document PDF.
 */
export function buildSondageSynthesePDF(doc: jsPDF, synthese: SondageSynthese): void {
  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - MARGIN * 2;
  const title = "Synthèse du sondage";

  addPDFHeader(doc, title, { headerHeight: 28, titleAlign: "center" });

  let y = 36;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(0, 0, 0);
  const sujetLines = wrapText(doc, synthese.sujet, contentWidth);
  for (const line of sujetLines) {
    y = ensureSpace(doc, y, LINE, title);
    doc.text(line, MARGIN, y);
    y += LINE;
  }

  y += 2;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  y = ensureSpace(doc, y, LINE * 5, title);
  doc.text(
    `Période : ${sondageDate(synthese.dateDebut)} — ${sondageDate(synthese.dateFin)}`,
    MARGIN,
    y
  );
  y += LINE;
  doc.text(`Statut : ${synthese.status}`, MARGIN, y);
  y += LINE;
  doc.text(
    `Participation : ${synthese.totalReponses} réponse(s) sur ${synthese.totalAdherentsActifs} adhérent(s) actifs (${synthese.tauxParticipation} %)`,
    MARGIN,
    y
  );
  y += LINE;
  doc.text(
    `Généré le ${synthese.generatedAt.toLocaleString("fr-FR")}`,
    MARGIN,
    y
  );
  y += LINE * 2;

  let lastSection: string | null = null;

  for (const question of synthese.questions) {
    if (question.section && question.section !== lastSection) {
      lastSection = question.section;
      y = ensureSpace(doc, y, LINE * 2, title);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(9, 61, 181);
      doc.text(question.section, MARGIN, y);
      y += LINE * 1.5;
    }

    y = ensureSpace(doc, y, LINE * 3, title);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    const qLines = wrapText(
      doc,
      `Q${question.ordre + 1}. ${question.libelle} (${question.participations} réponse(s))`,
      contentWidth
    );
    for (const line of qLines) {
      y = ensureSpace(doc, y, LINE, title);
      doc.text(line, MARGIN, y);
      y += LINE;
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);

    if (question.choix?.length) {
      for (const opt of question.choix) {
        y = ensureSpace(doc, y, LINE * 2, title);
        const label = `• ${opt.libelle} : ${opt.count} (${opt.percent} %)`;
        doc.text(label, MARGIN + 4, y);
        y += LINE;
        drawBar(doc, MARGIN + 4, y, contentWidth - 8, opt.percent);
        y += LINE + 1;
      }
    }

    if (question.matrice?.length) {
      for (const ligne of question.matrice) {
        y = ensureSpace(doc, y, LINE * 2, title);
        doc.setFont("helvetica", "bold");
        doc.text(ligne.libelle, MARGIN + 4, y);
        y += LINE;
        doc.setFont("helvetica", "normal");
        for (const col of ligne.colonnes) {
          y = ensureSpace(doc, y, LINE * 2, title);
          doc.text(`  — ${col.libelle} : ${col.count} (${col.percent} %)`, MARGIN + 6, y);
          y += LINE;
        }
        y += 2;
      }
    }

    if (question.textes?.length) {
      for (const texte of question.textes) {
        const lines = wrapText(doc, `— ${texte}`, contentWidth - 8);
        for (const line of lines) {
          y = ensureSpace(doc, y, LINE, title);
          doc.text(line, MARGIN + 4, y);
          y += LINE;
        }
        y += 2;
      }
    } else if (question.type === "TexteLibre") {
      y = ensureSpace(doc, y, LINE, title);
      doc.setTextColor(120, 120, 120);
      doc.text("Aucune réponse texte.", MARGIN + 4, y);
      doc.setTextColor(0, 0, 0);
      y += LINE;
    }

    y += LINE;
  }

  addPDFFooter(doc);
}

function sondageDate(d: Date): string {
  return d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function drawBar(doc: jsPDF, x: number, y: number, width: number, percent: number): void {
  const h = 3;
  doc.setDrawColor(200, 200, 200);
  doc.setFillColor(230, 236, 255);
  doc.rect(x, y - h + 0.5, width, h, "FD");
  if (percent > 0) {
    doc.setFillColor(37, 99, 235);
    doc.rect(x, y - h + 0.5, (width * Math.min(100, percent)) / 100, h, "F");
  }
}
