import { readFileSync } from 'fs';
import { join } from 'path';
import { jsPDF } from 'jspdf';
import { addPDFHeader, addPDFFooter } from '../lib/pdf-helpers';

async function exportManualToPDF() {
  console.log('📄 Génération du PDF du mode d\'emploi administrateur...');

  try {
    // Lire le fichier markdown
    const markdownPath = join(process.cwd(), 'docs', 'MODE_EMPLOI_ADMIN.md');
    const markdownContent = readFileSync(markdownPath, 'utf-8');

    // Créer un nouveau document PDF
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const maxWidth = pageWidth - (margin * 2);
    let yPosition = 60; // Commencer après l'en-tête (50mm de hauteur + marge)
    const lineHeight = 7;
    const sectionHeight = 10;

    // Fonction pour ajouter une nouvelle page si nécessaire
    const checkPageBreak = (requiredHeight: number = lineHeight) => {
      if (yPosition + requiredHeight > pageHeight - 30) { // 30mm pour le footer
        doc.addPage();
        yPosition = margin;
        // Le footer sera ajouté à la fin sur toutes les pages
        return true;
      }
      return false;
    };

    // Ajouter l'en-tête uniquement sur la première page
    addPDFHeader(doc, 'Mode d\'emploi - Panneau Administrateur');

    // Fonction pour convertir markdown en texte simple (approximation)
    const markdownToText = (text: string): string => {
      return text
        .replace(/^#{1,6}\s+/gm, '') // Supprimer les titres markdown
        .replace(/\*\*(.*?)\*\*/g, '$1') // Supprimer le gras
        .replace(/\*(.*?)\*/g, '$1') // Supprimer l'italique
        .replace(/`(.*?)`/g, '$1') // Supprimer le code inline
        .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // Supprimer les liens
        .replace(/^-\s+/gm, '• ') // Convertir les listes
        .replace(/^\d+\.\s+/gm, '') // Supprimer la numérotation
        .trim();
    };

    // Fonction pour split le texte en lignes selon la largeur
    const splitText = (text: string, maxWidth: number): string[] => {
      const lines: string[] = [];
      const words = text.split(' ');
      let currentLine = '';

      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const testWidth = doc.getTextWidth(testLine);

        if (testWidth > maxWidth && currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) {
        lines.push(currentLine);
      }
      return lines;
    };

    // Fonction pour détecter les titres
    const isTitle = (line: string): { level: number; text: string } | null => {
      const match = line.match(/^(#{1,6})\s+(.+)$/);
      if (match) {
        return {
          level: match[1].length,
          text: match[2].trim()
        };
      }
      return null;
    };

    // Parser et ajouter le contenu
    const lines = markdownContent.split('\n');
    let inCodeBlock = false;
    let inList = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Ignorer les lignes vides ou les séparateurs markdown
      if (!line || line.startsWith('---')) {
        if (!line) {
          yPosition += lineHeight * 0.5;
        }
        continue;
      }

      // Détecter les blocs de code
      if (line.startsWith('```')) {
        inCodeBlock = !inCodeBlock;
        continue;
      }
      if (inCodeBlock) continue;

      // Détecter les titres
      const titleMatch = isTitle(line);
      if (titleMatch) {
        checkPageBreak(sectionHeight);
        
        // Appliquer le style selon le niveau
        if (titleMatch.level === 1) {
          doc.setFontSize(20);
          doc.setFont('helvetica', 'bold');
          yPosition += 5;
        } else if (titleMatch.level === 2) {
          doc.setFontSize(16);
          doc.setFont('helvetica', 'bold');
          yPosition += 4;
        } else if (titleMatch.level === 3) {
          doc.setFontSize(14);
          doc.setFont('helvetica', 'bold');
          yPosition += 3;
        } else {
          doc.setFontSize(12);
          doc.setFont('helvetica', 'bold');
          yPosition += 2;
        }

        checkPageBreak();
        doc.setTextColor(0, 0, 0);
        const titleLines = splitText(titleMatch.text, maxWidth);
        titleLines.forEach((titleLine) => {
          checkPageBreak();
          doc.text(titleLine, margin, yPosition);
          yPosition += lineHeight;
        });
        yPosition += lineHeight * 0.5;

        // Réinitialiser la police
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        inList = false;
        continue;
      }

      // Détecter les listes
      if (line.match(/^[-*•]\s+/) || line.match(/^\d+\.\s+/)) {
        checkPageBreak();
        doc.setFontSize(10);
        const isNumbered = line.match(/^\d+\.\s+/);
        const listText = line.replace(/^[-*•]\s+/, '').replace(/^\d+\.\s+/, '');
        const listLines = splitText(listText, maxWidth - 15);
        
        // Afficher la puce ou le numéro
        if (isNumbered) {
          const number = line.match(/^(\d+)\.\s+/)?.[1] || '';
          doc.text(number + '.', margin + 5, yPosition);
        } else {
          doc.text('•', margin + 5, yPosition);
        }
        
        listLines.forEach((listLine, idx) => {
          if (idx > 0) checkPageBreak();
          doc.text(listLine, margin + 15, yPosition);
          yPosition += lineHeight * 0.9;
        });
        inList = true;
        continue;
      }

      // Texte normal
      checkPageBreak();
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      
      const cleanText = markdownToText(line);
      const textLines = splitText(cleanText, maxWidth);
      
      textLines.forEach((textLine) => {
        checkPageBreak();
        doc.text(textLine, margin, yPosition);
        yPosition += lineHeight;
      });

      if (!inList) {
        yPosition += lineHeight * 0.3;
      }
      inList = false;
    }

    // Ajouter le footer sur toutes les pages
    addPDFFooter(doc);

    // Sauvegarder le PDF
    const outputPath = join(process.cwd(), 'docs', 'MODE_EMPLOI_ADMIN.pdf');
    doc.save(outputPath);

    console.log(`✅ PDF généré avec succès : ${outputPath}`);
    console.log(`📊 Nombre de pages : ${doc.getNumberOfPages()}`);
  } catch (error) {
    console.error('❌ Erreur lors de la génération du PDF:', error);
    throw error;
  }
}

// Exécuter le script
exportManualToPDF()
  .then(() => {
    console.log('🎉 Export terminé avec succès');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Erreur fatale:', error);
    process.exit(1);
  });

