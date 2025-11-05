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

// Fonction pour ajouter l'en-tête avec logo sur la première page
export function addPDFHeader(doc: any, title?: string): void {
  const logoBase64 = getLogoBase64ForPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Fond bleu pour l'en-tête (#093DB5 = RGB(9, 61, 181))
  doc.setFillColor(9, 61, 181);
  doc.rect(0, 0, pageWidth, 50, 'F');
  
  // Logo (si disponible)
  if (logoBase64) {
    try {
      // jsPDF attend un data URI pour addImage
      const dataUri = `data:image/jpeg;base64,${logoBase64}`;
      doc.addImage(dataUri, 'JPEG', 20, 10, 30, 30);
    } catch (error) {
      console.error("Erreur lors de l'ajout du logo:", error);
      // Continuer sans logo si l'ajout échoue
    }
  }
  
  // Texte "AMAKI France" avec "A" en rouge
  doc.setFontSize(22);
  doc.setTextColor(255, 255, 255); // Blanc
  
  // Calculer la position du texte (après le logo)
  const textX = logoBase64 ? 55 : 20;
  const textY = 25;
  
  // Dessiner "A" en rouge (#FF6B6B = RGB(255, 107, 107))
  doc.setTextColor(255, 107, 107);
  doc.text('A', textX, textY);
  
  // Dessiner le reste "MAKI France" en blanc
  doc.setTextColor(255, 255, 255);
  const textWidth = doc.getTextWidth('A');
  doc.text('MAKI France', textX + textWidth, textY);
  
  // Titre optionnel (si fourni)
  if (title) {
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255); // Blanc pour être visible sur le fond bleu
    doc.text(title, 20, 42);
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

