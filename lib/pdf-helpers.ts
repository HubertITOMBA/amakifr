// Fonctions helper pour générer les en-têtes et pieds de page des PDFs
import { readFileSync } from "fs";
import { join } from "path";

// Fonction pour encoder l'image logo en base64 pour les PDFs
export function getLogoBase64ForPDF(): string {
  try {
    const logoPath = join(process.cwd(), 'public', 'amakifav.jpeg');
    const logoBuffer = readFileSync(logoPath);
    const base64String = logoBuffer.toString('base64');
    return base64String;
  } catch (error) {
    console.error("Erreur lors du chargement du logo pour PDF:", error);
    return '';
  }
}

export type AddPDFHeaderOptions = {
  /** Hauteur de l'en-tête en mm (par défaut 60 avec titre, 50 sans) */
  headerHeight?: number;
  /** Centrer horizontalement le titre (par défaut à gauche) */
  titleAlign?: 'left' | 'center';
};

// Fonction pour ajouter l'en-tête avec logo sur la première page
export function addPDFHeader(doc: any, title?: string, options?: AddPDFHeaderOptions): void {
  const logoBase64 = getLogoBase64ForPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  const headerHeight = options?.headerHeight ?? (title ? 60 : 50);
  const isCompact = options?.headerHeight != null && options.headerHeight < 50;
  const isExtraCompact = options?.headerHeight != null && options.headerHeight < 30;
  const centerTitle = options?.titleAlign === 'center';

  doc.setFillColor(9, 61, 181);
  doc.rect(0, 0, pageWidth, headerHeight, 'F');

  if (logoBase64) {
    try {
      const dataUri = `data:image/jpeg;base64,${logoBase64}`;
      if (isExtraCompact) {
        doc.addImage(dataUri, 'JPEG', 12, 4, 16, 16);
      } else if (isCompact) {
        doc.addImage(dataUri, 'JPEG', 15, 6, 22, 22);
      } else {
        doc.addImage(dataUri, 'JPEG', 20, 10, 30, 30);
      }
    } catch (error) {
      console.error("Erreur lors de l'ajout du logo:", error);
    }
  }

  const textX = logoBase64 ? (isExtraCompact ? 32 : isCompact ? 42 : 55) : 20;
  const textY = isExtraCompact ? 12 : isCompact ? 18 : 25;
  doc.setFontSize(isExtraCompact ? 14 : isCompact ? 18 : 22);
  doc.setTextColor(255, 107, 107);
  doc.text('A', textX, textY);
  doc.setTextColor(255, 255, 255);
  const textWidth = doc.getTextWidth('A');
  doc.text('MAKI France', textX + textWidth, textY);

  if (title) {
    doc.setFontSize(isExtraCompact ? 9 : isCompact ? 11 : 16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    const titleY = isExtraCompact ? headerHeight - 5 : isCompact ? headerHeight - 8 : 52;
    if (centerTitle) {
      doc.text(title, pageWidth / 2, titleY, { align: 'center' });
    } else {
      doc.text(title, 20, titleY);
    }
  }
}

// Fonction pour ajouter le pied de page sur toutes les pages
export function addPDFFooter(doc: any): void {
  const pageCount = doc.internal.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  // Ajouter le pied de page sur toutes les pages
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    
    // Fond bleu pour le pied de page (#093DB5 = RGB(9, 61, 181))
    doc.setFillColor(9, 61, 181);
    doc.rect(0, pageHeight - 20, pageWidth, 20, 'F');
    
    // Texte du copyright en blanc
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'normal');
    const footerText = `© ${new Date().getFullYear()} AMAKI France - Tous droits réservés`;
    const footerTextWidth = doc.getTextWidth(footerText);
    doc.text(footerText, (pageWidth - footerTextWidth) / 2, pageHeight - 8);
  }
}

