/**
 * Génération PDF : Lettre de relance cotisations (à imprimer, avec ou sans pré-remplissage)
 * Utilisé côté serveur. Entête et pied de page AMAKI. Emplacement destinataire + détail dettes/forfaits/assistances + règlement.
 */

import type { jsPDF } from "jspdf";
import { addPDFHeader, addPDFFooter } from "@/lib/pdf-helpers";
import type { RappelDetailleData } from "@/lib/mail";
import { REGLEMENT_COTISATIONS_EXCERPT_TEXT } from "@/lib/mail";

const MARGIN = 20;
const LINE_HEIGHT = 5.5;
const PAGE_HEIGHT = 297;
const FOOTER_HEIGHT = 20;
const CONTENT_MAX_Y = PAGE_HEIGHT - FOOTER_HEIGHT - 10;

export type CoordonneesDestinataire = {
  nom?: string;
  prenom?: string;
  adresseLigne1?: string;
  adresseLigne2?: string;
  codePostal?: string;
  ville?: string;
  email?: string;
  telephone?: string;
};

function fmt(n: number) {
  return n.toFixed(2).replace(".", ",");
}
function fmtDate(d: Date) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

function ensureSpace(doc: jsPDF, need: number): number {
  let y = (doc as any).__letterY ?? MARGIN;
  if (y + need > CONTENT_MAX_Y) {
    doc.addPage();
    y = MARGIN;
    (doc as any).__letterY = y;
  }
  return y;
}

function addLine(doc: jsPDF, text: string, options?: { bold?: boolean; size?: number }): void {
  let y = ensureSpace(doc, LINE_HEIGHT + 2);
  doc.setFontSize(options?.size ?? 10);
  doc.setFont("helvetica", options?.bold ? "bold" : "normal");
  doc.setTextColor(0, 0, 0);
  const maxW = 170;
  const lines = doc.splitTextToSize(text, maxW);
  for (const line of lines) {
    if (y + LINE_HEIGHT > CONTENT_MAX_Y) {
      doc.addPage();
      y = MARGIN;
    }
    doc.text(line, MARGIN, y);
    y += LINE_HEIGHT;
  }
  (doc as any).__letterY = y;
}

function addEmpty(doc: jsPDF, count = 1): void {
  let y = (doc as any).__letterY ?? MARGIN;
  (doc as any).__letterY = y + LINE_HEIGHT * count;
}

function drawTable(
  doc: jsPDF,
  headers: string[],
  rows: string[][],
  colWidths: number[]
): void {
  const rowH = 7;
  let y = ensureSpace(doc, rowH * (rows.length + 1) + 10);
  const tableX = MARGIN;
  const totalW = colWidths.reduce((a, b) => a + b, 0);

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setFillColor(240, 240, 240);
  doc.rect(tableX, y - 5, totalW, rowH, "F");
  doc.setTextColor(0, 0, 0);
  let x = tableX;
  headers.forEach((h, i) => {
    doc.text(h, x + 3, y);
    x += colWidths[i];
  });
  y += rowH;

  doc.setFont("helvetica", "normal");
  doc.setDrawColor(200, 200, 200);
  for (const row of rows) {
    if (y + rowH > CONTENT_MAX_Y) {
      doc.addPage();
      y = MARGIN;
      (doc as any).__letterY = y;
    }
    x = tableX;
    row.forEach((cell, i) => {
      doc.setFillColor(255, 255, 255);
      doc.rect(x, y - 4, colWidths[i], rowH, "FD");
      const cellLines = doc.splitTextToSize(cell, Math.max(colWidths[i] - 4, 10));
      doc.text(cellLines[0] ?? cell, x + 3, y + 1);
      x += colWidths[i];
    });
    y += rowH;
  }
  (doc as any).__letterY = y + 5;
}

/**
 * Construit le PDF lettre de relance. Si data est fourni, les tableaux sont remplis ; sinon modèle vierge avec lignes à remplir.
 */
export function buildLettreRelancePDF(
  doc: jsPDF,
  options: {
    coordonnees?: CoordonneesDestinataire | null;
    data?: RappelDetailleData | null;
  }
): void {
  const { coordonnees, data } = options;
  (doc as any).__letterY = 55; // après en-tête

  addPDFHeader(doc, "Lettre de relance – Cotisations", { headerHeight: 45, titleAlign: "center" });

  // ----- Destinataire -----
  addLine(doc, "Destinataire", { bold: true, size: 11 });
  addEmpty(doc, 0.5);
  const nomComplet = [coordonnees?.prenom, coordonnees?.nom].filter(Boolean).join(" ") || "_________________________";
  addLine(doc, `Nom et prénom : ${nomComplet}`);
  const adr1 = coordonnees?.adresseLigne1 || "_________________________________________";
  addLine(doc, `Adresse : ${adr1}`);
  const adr2 = coordonnees?.adresseLigne2;
  if (adr2) addLine(doc, `         ${adr2}`);
  const cp = coordonnees?.codePostal || "_____";
  const ville = coordonnees?.ville || "_________________________";
  addLine(doc, `Code postal et ville : ${cp} ${ville}`);
  const email = coordonnees?.email || "_________________________________________";
  addLine(doc, `Email : ${email}`);
  const tel = coordonnees?.telephone || "_________________________________________";
  addLine(doc, `Téléphone : ${tel}`);
  addEmpty(doc, 1.5);

  // ----- Date et objet -----
  addLine(doc, "Fait à ____________________ , le ____________________");
  addEmpty(doc, 0.5);
  addLine(doc, "Objet : Rappel de cotisation – Régularisation de votre situation", { bold: true });
  addEmpty(doc, 1.5);

  // ----- Corps -----
  addLine(doc, "Madame, Monsieur,");
  addEmpty(doc, 0.5);
  addLine(
    doc,
    "Nous vous rappelons que votre situation au regard des cotisations de l'association AMAKI France n'est pas à jour. Vous trouverez ci-dessous le détail des sommes restant dues."
  );
  addEmpty(doc, 1);

  if (data && data.total > 0) {
    if (data.dettesInitiales.length > 0) {
      addLine(doc, "Dettes initiales", { bold: true });
      drawTable(
        doc,
        ["Année", "Restant dû"],
        data.dettesInitiales.map((d) => [String(d.annee), `${fmt(d.montantRestant)} €`]),
        [30, 40]
      );
      addEmpty(doc, 0.5);
    }
    if (data.forfaitsNonPayes.length > 0) {
      addLine(doc, "Forfaits non payés", { bold: true });
      drawTable(
        doc,
        ["Période", "Échéance", "Restant dû"],
        data.forfaitsNonPayes.map((f) => [f.periode, fmtDate(f.dateEcheance), `${fmt(f.montantRestant)} €`]),
        [50, 55, 40]
      );
      addEmpty(doc, 0.5);
    }
    if (data.assistancesNonPayees.length > 0) {
      addLine(doc, "Assistances non payées", { bold: true });
      drawTable(
        doc,
        ["Période / Libellé", "Échéance", "Restant dû"],
        data.assistancesNonPayees.map((a) => [a.description || a.periode, fmtDate(a.dateEcheance), `${fmt(a.montantRestant)} €`]),
        [70, 55, 40]
      );
      addEmpty(doc, 0.5);
    }
    addLine(doc, `Montant total à régler : ${fmt(data.total)} €`, { bold: true, size: 11 });
    addEmpty(doc, 1);
  } else {
    addLine(doc, "Détail des cotisations restant dues : voir portail adhérent ou relevé joint.");
    addEmpty(doc, 0.5);
    addLine(doc, "Montant total à régler : ______________ €", { bold: true });
    addEmpty(doc, 1);
  }

  addLine(
    doc,
    "Merci de régulariser votre situation au plus vite. Vous pouvez consulter vos cotisations et effectuer un paiement depuis votre espace adhérent : https://amakifr.fr/user/profile"
  );
  addEmpty(doc, 1);

  // ----- Rappel règlement -----
  addLine(doc, "Rappel (Règlement d'ordre intérieur) :", { bold: true, size: 9 });
  const regLines = REGLEMENT_COTISATIONS_EXCERPT_TEXT.split("\n").filter((l) => l.trim());
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  for (const line of regLines) {
    let y = ensureSpace(doc, LINE_HEIGHT);
    const parts = doc.splitTextToSize(line.replace(/^•\s*/, "• "), 170);
    for (const p of parts) {
      if (y + LINE_HEIGHT > CONTENT_MAX_Y) {
        doc.addPage();
        y = MARGIN;
      }
      doc.text(p, MARGIN, y);
      y += LINE_HEIGHT;
    }
    (doc as any).__letterY = y;
  }
  addEmpty(doc, 1.5);

  // ----- Formule de politesse et signature -----
  addLine(doc, "Nous vous prions d'agréer, Madame, Monsieur, l'expression de nos salutations distinguées.");
  addEmpty(doc, 2);
  addLine(doc, "Pour l'association AMAKI France", { bold: true });
  addEmpty(doc, 0.5);
  addLine(doc, "_________________________________________");
  addLine(doc, "Signature / Cachet");
  addEmpty(doc, 1);

  addPDFFooter(doc);
}
