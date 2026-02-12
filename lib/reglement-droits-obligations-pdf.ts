/**
 * Génération PDF : Règlement d'ordre intérieur, Droits et Obligations de l'adhérent
 * Utilisé côté serveur (Server Action).
 * En-tête identique au passeport (logo AMAKI, titre). Rubriques principales mises en valeur.
 */

import type { jsPDF } from "jspdf";
import { addPDFHeader } from "@/lib/pdf-helpers";

const MARGIN = 20;
const LINE_HEIGHT = 5.5;
const SECTION_TITLE_SIZE = 12;
const BODY_SIZE = 10;
const MAX_WIDTH = 170;
const HEADER_CONTENT_GAP = 12;

/** Hauteur de l'en-tête (réduite de 40 % par rapport à 44 mm) */
const HEADER_HEIGHT = Math.round(44 * 0.6);

function getContentStartY(): number {
  return HEADER_HEIGHT + HEADER_CONTENT_GAP;
}

function addText(doc: jsPDF, text: string, options: { size?: number; bold?: boolean; indent?: number } = {}): void {
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = (doc as any).__reglementY ?? MARGIN;
  const fontSize = options.size ?? BODY_SIZE;
  const indent = options.indent ?? 0;
  doc.setFontSize(fontSize);
  doc.setFont("helvetica", options.bold ? "bold" : "normal");
  doc.setTextColor(0, 0, 0);

  const w = MAX_WIDTH - indent;
  const lines = doc.splitTextToSize(text, w);
  for (const line of lines) {
    if (y + LINE_HEIGHT > pageHeight - MARGIN) {
      doc.addPage();
      y = MARGIN;
    }
    doc.text(line, MARGIN + indent, y);
    y += LINE_HEIGHT;
  }
  (doc as any).__reglementY = y;
}

/**
 * Titre des trois rubriques principales : bande colorée + titre en blanc, bien mis en valeur.
 */
function addMainRubricTitle(doc: jsPDF, text: string, fillRgb: [number, number, number]): void {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = (doc as any).__reglementY ?? MARGIN;
  const bandHeight = 7; // réduit de 50 % (14 → 7)
  if (y + bandHeight + 8 > pageHeight - MARGIN) {
    doc.addPage();
    y = MARGIN;
  }
  doc.setFillColor(fillRgb[0], fillRgb[1], fillRgb[2]);
  doc.rect(0, y - 2, pageWidth, bandHeight, "F");
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text(text, MARGIN, y + 3);
  (doc as any).__reglementY = y + bandHeight + 4;
}

function addSectionTitle(doc: jsPDF, text: string): void {
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = (doc as any).__reglementY ?? MARGIN;
  if (y + 12 > pageHeight - MARGIN) {
    doc.addPage();
    y = MARGIN;
  }
  y += 3;
  doc.setFontSize(SECTION_TITLE_SIZE);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text(text, MARGIN, y);
  y += LINE_HEIGHT + 2;
  (doc as any).__reglementY = y;
}

function addEmptyLine(doc: jsPDF, count = 1): void {
  let y = (doc as any).__reglementY ?? MARGIN;
  (doc as any).__reglementY = y + LINE_HEIGHT * count;
}

/**
 * Remplit le document jsPDF avec le Règlement d'ordre intérieur, les Droits et les Obligations.
 * En-tête application (comme le passeport). Les trois rubriques sont mises en valeur par une bande colorée.
 */
export function buildReglementDroitsObligationsPDF(doc: jsPDF): void {
  addPDFHeader(doc, "Règlements - Droits - Obligations", { headerHeight: HEADER_HEIGHT, titleAlign: 'center' });
  (doc as any).__reglementY = getContentStartY();

  // ========== Règlements d'ordre intérieur (rubrique mise en valeur) ==========
  addMainRubricTitle(doc, "Règlements d'Ordre Intérieur", [93, 51, 168]); // violet/purple
  addEmptyLine(doc);

  addSectionTitle(doc, "Article 1 – Objet du règlement intérieur");
  addText(doc, "Le présent règlement intérieur a pour objet de préciser les règles de fonctionnement de l'association, conformément aux statuts. Il s'impose à tous les membres.");
  addEmptyLine(doc);

  addSectionTitle(doc, "Article 2 – Cotisation");
  addText(doc, "1. Le montant de la cotisation est fixé à 15 € par mois, soit 180 € par an.");
  addText(doc, "2. La cotisation est due par tous les membres actifs.");
  addText(doc, "3. Tout retard de cotisation supérieur ou égal à trois (3) mois entraîne :");
  addText(doc, "• la perte du droit d'assistance financière de l'association ;", { indent: 5 });
  addText(doc, "• la suspension du droit de vote jusqu'à régularisation.", { indent: 5 });
  addEmptyLine(doc);

  addSectionTitle(doc, "Article 3 – Perte de la qualité de membre");
  addText(doc, "La qualité de membre se perd automatiquement dans les cas suivants :");
  addText(doc, "• Retard de cotisation de trois (3) mois ou plus non régularisé malgré relance ;", { indent: 5 });
  addText(doc, "• Absence prolongée et injustifiée aux activités de l'association ;", { indent: 5 });
  addText(doc, "• Indiscipline grave ou faute portant préjudice moral ou matériel à l'association.", { indent: 5 });
  addText(doc, "La radiation est prononcée conformément aux statuts, après audition éventuelle du membre concerné.");
  addEmptyLine(doc);

  addSectionTitle(doc, "Article 4 – Assistance financière et solidarité");
  addText(doc, "L'association peut accorder une aide financière ou matérielle aux membres en difficulté. Toutefois, cette aide est réservée exclusivement aux membres :");
  addText(doc, "• À jour de leurs cotisations ;", { indent: 5 });
  addText(doc, "• Ayant une participation active et régulière à la vie de l'association ;", { indent: 5 });
  addText(doc, "• Respectueux du règlement intérieur et du code de conduite.", { indent: 5 });
  addText(doc, "Aucun membre en retard de cotisation de trois (3) mois ou plus ne pourra bénéficier d'une assistance.", { bold: true });
  addEmptyLine(doc);

  addSectionTitle(doc, "Article 5 – Discipline et sanctions");
  addText(doc, "1. Les membres doivent observer une attitude respectueuse vis-à-vis des autres membres et des organes dirigeants.");
  addText(doc, "2. Tout comportement indiscipliné, violent, diffamatoire ou portant atteinte à l'image de l'association est interdit.");
  addText(doc, "3. Les sanctions applicables sont :");
  addText(doc, "• Avertissement ;", { indent: 5 });
  addText(doc, "• Suspension temporaire ;", { indent: 5 });
  addText(doc, "• Exclusion définitive (radiation).", { indent: 5 });
  addEmptyLine(doc);

  addSectionTitle(doc, "Article 6 – Application et modification");
  addText(doc, "Le présent règlement intérieur entre en vigueur dès son adoption par l'Assemblée Générale. Il peut être modifié par décision de l'Assemblée Générale sur proposition du Conseil d'Administration.");
  addEmptyLine(doc, 2);

  // ========== Droits de l'adhérent (rubrique mise en valeur) ==========
  addMainRubricTitle(doc, "Droits de l'Adhérent", [22, 163, 74]); // vert
  addEmptyLine(doc);

  const droits = [
    { titre: "Droit de vote", texte: "Participer aux élections et votes de l'association lors des assemblées générales et consultations." },
    { titre: "Droit de candidature", texte: "Se porter candidat aux différents postes électifs de l'association selon les conditions établies." },
    { titre: "Droit de participation", texte: "Participer à toutes les activités, événements et réunions organisés par l'association." },
    { titre: "Droit d'expression", texte: "Proposer des idées, faire des suggestions et exprimer son opinion lors des assemblées et consultations." },
    { titre: "Droit à l'information", texte: "Recevoir toutes les informations concernant les activités, décisions et projets de l'association." },
    { titre: "Droit aux assistances", texte: "Bénéficier des assistances prévues par l'association (naissance, mariage, décès, anniversaire de salle, etc.)." },
    { titre: "Droit de consultation", texte: "Consulter les documents et comptes de l'association selon les modalités prévues par les statuts." },
  ];
  for (const d of droits) {
    addText(doc, d.titre, { bold: true });
    addText(doc, d.texte, { indent: 5 });
    addEmptyLine(doc, 0.5);
  }
  addEmptyLine(doc, 2);

  // ========== Obligations de l'adhérent (rubrique mise en valeur) ==========
  addMainRubricTitle(doc, "Obligations de l'Adhérent", [234, 88, 12]); // orange
  addEmptyLine(doc);

  const obligations = [
    { titre: "Paiement des cotisations", texte: "Payer régulièrement les cotisations mensuelles et les frais d'adhésion selon les modalités établies." },
    { titre: "Respect des statuts", texte: "Respecter les statuts, le règlement intérieur et les décisions prises par les instances de l'association." },
    { titre: "Participation active", texte: "Participer activement à la vie de l'association et contribuer à son développement." },
    { titre: "Respect des valeurs", texte: "Respecter les valeurs de l'association : Intégration, Respect et Solidarité." },
    { titre: "Mise à jour des informations", texte: "Maintenir à jour ses informations personnelles et notifier tout changement à l'association." },
    { titre: "Confidentialité", texte: "Respecter la confidentialité des informations et discussions internes à l'association." },
    { titre: "Assiduité", texte: "Assister aux assemblées générales et réunions importantes de l'association dans la mesure du possible." },
  ];
  for (const o of obligations) {
    addText(doc, o.titre, { bold: true });
    addText(doc, o.texte, { indent: 5 });
    addEmptyLine(doc, 0.5);
  }
}
