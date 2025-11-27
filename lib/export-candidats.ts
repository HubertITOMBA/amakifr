// Fonctions d'export pour la liste des candidats en PDF et Word

import { PositionType } from "@prisma/client";
import { POSTES_LABELS } from "@/lib/elections-constants";

export interface Candidate {
  civility: string;
  firstname: string;
  lastname: string;
}

export interface CandidateGroup {
  position: PositionType;
  candidates: Candidate[];
}

/**
 * Génère un PDF avec la liste des candidats par poste
 */
export async function exportCandidatsToPDF(
  candidates: CandidateGroup[],
  electionDate: string,
  dateClotureCandidatures: string,
  dateClotureCampagne: string
): Promise<void> {
  const { default: jsPDF } = await import('jspdf');
  const { addPDFHeader, addPDFFooter } = await import('@/lib/pdf-helpers-client');
  
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  // En-tête
  await addPDFHeader(doc, `Liste des Candidats - Élections ${electionDate}`);
  
  let yPos = 60;
  const margin = 20;
  const maxWidth = pageWidth - 2 * margin;
  
  // Fonction pour obtenir le label de civilité
  const getCivilityLabel = (civility: string) => {
    switch (civility) {
      case "Monsieur":
        return "M.";
      case "Madame":
        return "Mme";
      case "Mademoiselle":
        return "Miss";
      default:
        return civility;
    }
  };
  
  // Message d'introduction
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');
  const introText = `Chers membres d'Amaki France,\n\nNous avons le plaisir de vous présenter la liste officielle des candidats retenus pour les élections du ${electionDate}.\n\nNous rappelons que la clôture des candidatures est intervenue le ${dateClotureCandidatures}, et que la campagne électorale se déroule jusqu'au ${dateClotureCampagne}.`;
  const introLines = doc.splitTextToSize(introText, maxWidth);
  doc.text(introLines, margin, yPos);
  yPos += introLines.length * 6 + 10;
  
  // Vérifier si on doit ajouter une nouvelle page
  if (yPos > pageHeight - 40) {
    doc.addPage();
    yPos = 20;
  }
  
  // Liste des candidats par poste
  candidates.forEach((group) => {
    // Vérifier si on doit ajouter une nouvelle page
    if (yPos > pageHeight - 50) {
      doc.addPage();
      yPos = 20;
    }
    
    const posteLabel = POSTES_LABELS[group.position] || group.position;
    
    // Titre du poste avec fond bleu (simulé avec un rectangle)
    const titleHeight = 12;
    doc.setFillColor(37, 99, 235); // blue-600
    doc.roundedRect(margin, yPos - titleHeight + 2, maxWidth, titleHeight, 3, 3, 'F');
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255); // Blanc
    doc.text(posteLabel, margin + 5, yPos);
    yPos += titleHeight + 5;
    
    // Candidats
    if (group.candidates.length === 0) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(128, 128, 128);
      doc.text("Aucun candidat", margin + 10, yPos);
      yPos += 8;
    } else {
      group.candidates.forEach((candidate) => {
        // Vérifier si on doit ajouter une nouvelle page
        if (yPos > pageHeight - 30) {
          doc.addPage();
          yPos = 20;
        }
        
        const civility = getCivilityLabel(candidate.civility);
        const fullName = `${candidate.firstname} ${candidate.lastname}`;
        
        // Case à cocher (simulée avec un carré)
        doc.setDrawColor(100, 100, 100);
        doc.setLineWidth(0.5);
        doc.rect(margin + 10, yPos - 4, 4, 4);
        
        // Nom du candidat
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        const candidateText = civility ? `${civility} ${fullName}` : fullName;
        doc.text(candidateText, margin + 18, yPos);
        yPos += 7;
      });
    }
    
    yPos += 5; // Espacement entre les postes
  });
  
  // Message de conclusion
  if (yPos > pageHeight - 60) {
    doc.addPage();
    yPos = 20;
  }
  
  yPos += 10;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  const conclusionText = `Nous souhaitons à tous les candidats une excellente campagne et invitons chaque membre à participer activement à ce moment important de la vie de notre association.\n\nEnsemble pour une Amaki France forte et dynamique !\n\nIntegration - Respect - Solidarité`;
  const conclusionLines = doc.splitTextToSize(conclusionText, maxWidth);
  doc.text(conclusionLines, margin, yPos);
  
  // Pied de page
  addPDFFooter(doc);
  
  // Télécharger le PDF
  doc.save(`Liste_Candidats_${electionDate.replace(/\s+/g, '_')}.pdf`);
}

/**
 * Génère un document Word avec la liste des candidats par poste
 */
export async function exportCandidatsToWord(
  candidates: CandidateGroup[],
  electionDate: string,
  dateClotureCandidatures: string,
  dateClotureCampagne: string
): Promise<void> {
  const docx = await import('docx');
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle, WidthType, Table, TableRow, TableCell, ShadingType } = docx;
  
  // Fonction pour obtenir le label de civilité
  const getCivilityLabel = (civility: string) => {
    switch (civility) {
      case "Monsieur":
        return "M.";
      case "Madame":
        return "Mme";
      case "Mademoiselle":
        return "Miss";
      default:
        return civility;
    }
  };
  
  // Créer les paragraphes pour chaque poste
  const posteParagraphs: any[] = [];
  
  // Message d'introduction
  posteParagraphs.push(
    new Paragraph({
      text: "Chers membres d'Amaki France,",
      heading: HeadingLevel.HEADING_2,
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `Nous avons le plaisir de vous présenter la liste officielle des candidats retenus pour les élections du ${electionDate}.`,
        }),
      ],
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `Nous rappelons que la clôture des candidatures est intervenue le ${dateClotureCandidatures}, et que la campagne électorale se déroule jusqu'au ${dateClotureCampagne}.`,
        }),
      ],
      spacing: { after: 400 },
    })
  );
  
  // Liste des candidats par poste
  candidates.forEach((group) => {
    const posteLabel = POSTES_LABELS[group.position] || group.position;
    
    // Titre du poste avec style (fond bleu simulé avec un paragraphe coloré)
    posteParagraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: posteLabel,
            bold: true,
            color: "FFFFFF",
            size: 24, // 12pt
          }),
        ],
        heading: HeadingLevel.HEADING_3,
        shading: {
          type: ShadingType.SOLID,
          color: "2563EB", // blue-600
        },
        spacing: { before: 200, after: 200 },
        border: {
          top: {
            color: "2563EB",
            size: 6,
            style: BorderStyle.SINGLE,
          },
          bottom: {
            color: "2563EB",
            size: 6,
            style: BorderStyle.SINGLE,
          },
          left: {
            color: "2563EB",
            size: 6,
            style: BorderStyle.SINGLE,
          },
          right: {
            color: "2563EB",
            size: 6,
            style: BorderStyle.SINGLE,
          },
        },
      })
    );
    
    // Candidats
    if (group.candidates.length === 0) {
      posteParagraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: "Aucun candidat",
              italics: true,
              color: "808080",
            }),
          ],
          spacing: { after: 200 },
        })
      );
    } else {
      group.candidates.forEach((candidate) => {
        const civility = getCivilityLabel(candidate.civility);
        const fullName = `${candidate.firstname} ${candidate.lastname}`;
        const candidateText = civility ? `${civility} ${fullName}` : fullName;
        
        // Case à cocher (simulée avec un symbole)
        posteParagraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: "☐ ",
                size: 20,
              }),
              new TextRun({
                text: candidateText,
                size: 20,
              }),
            ],
            spacing: { after: 150 },
            indent: {
              left: 400, // 0.2 pouces
            },
          })
        );
      });
    }
    
    posteParagraphs.push(
      new Paragraph({
        text: "",
        spacing: { after: 200 },
      })
    );
  });
  
  // Message de conclusion
  posteParagraphs.push(
    new Paragraph({
      text: "",
      spacing: { after: 400 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: "Nous souhaitons à tous les candidats une excellente campagne et invitons chaque membre à participer activement à ce moment important de la vie de notre association.",
        }),
      ],
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: "Ensemble pour une Amaki France forte et dynamique !",
          bold: true,
          size: 22,
        }),
      ],
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: "Integration - Respect - Solidarité",
          size: 20,
        }),
      ],
      spacing: { after: 200 },
    })
  );
  
  // Créer le document
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: `Liste des Candidats - Élections ${electionDate}`,
                bold: true,
                size: 28,
                color: "093DB5", // Bleu AMAKI
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
          }),
          ...posteParagraphs,
        ],
      },
    ],
  });
  
  // Générer et télécharger le document
  const blob = await Packer.toBlob(doc);
  const filename = `Liste_Candidats_${electionDate.replace(/\s+/g, '_')}.docx`;
  
  // Utiliser l'API du navigateur pour télécharger le fichier
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

