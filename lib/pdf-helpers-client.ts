// Fonctions helper pour générer les en-têtes et pieds de page des PDFs (Version Client)
// Cette version est utilisée dans les composants client qui ne peuvent pas utiliser fs

// Fonction pour charger le logo depuis l'URL publique (version client)
async function getLogoBase64ForPDFClient(): Promise<string> {
  try {
    // Charger le logo depuis l'URL publique
    const response = await fetch('/amakifav.jpeg');
    const blob = await response.blob();
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        // Extraire seulement la partie base64 (sans le préfixe data:image/jpeg;base64,)
        const base64Data = base64String.split(',')[1] || base64String;
        resolve(base64Data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error("Erreur lors du chargement du logo pour PDF:", error);
    return '';
  }
}

// Fonction pour ajouter l'en-tête avec logo sur la première page (Version Client)
export async function addPDFHeader(doc: any, title?: string): Promise<void> {
  const logoBase64 = await getLogoBase64ForPDFClient();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Fond bleu pour l'en-tête (#093DB5 = RGB(9, 61, 181))
  // Hauteur réduite de l'en-tête avec padding réduit
  const headerHeight = title ? 30 : 25;
  doc.setFillColor(9, 61, 181);
  doc.rect(0, 0, pageWidth, headerHeight, 'F');
  
  // Logo (si disponible) - taille réduite et position ajustée
  if (logoBase64) {
    try {
      // jsPDF attend un data URI pour addImage
      const dataUri = `data:image/jpeg;base64,${logoBase64}`;
      doc.addImage(dataUri, 'JPEG', 10, 5, 15, 15); // Logo plus petit : 15x15 au lieu de 25x25
    } catch (error) {
      console.error("Erreur lors de l'ajout du logo:", error);
      // Continuer sans logo si l'ajout échoue
    }
  }
  
  // Texte "AMAKI France" avec "A" en rouge - taille réduite
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255); // Blanc
  
  // Calculer la position du texte (après le logo)
  const textX = logoBase64 ? 28 : 10;
  const textY = 14;
  
  // Dessiner "A" en rouge (#FF6B6B = RGB(255, 107, 107))
  doc.setTextColor(255, 107, 107);
  doc.text('A', textX, textY);
  
  // Dessiner le reste "MAKI France" en blanc
  doc.setTextColor(255, 255, 255);
  const textWidth = doc.getTextWidth('A');
  doc.text('MAKI France', textX + textWidth, textY);
  
  // Titre optionnel (si fourni) - taille et position réduites, centré
  if (title) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255); // Blanc pour être visible sur le fond bleu
    // Centrer le titre horizontalement
    const titleWidth = doc.getTextWidth(title);
    const titleX = (pageWidth - titleWidth) / 2;
    doc.text(title, titleX, 25);
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
    
    // Fond bleu pour le pied de page (#093DB5 = RGB(9, 61, 181)) - hauteur réduite
    doc.setFillColor(9, 61, 181);
    doc.rect(0, pageHeight - 15, pageWidth, 15, 'F');
    
    // Texte du copyright en blanc - taille réduite
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'normal');
    const footerText = `© ${new Date().getFullYear()} AMAKI France - Tous droits réservés`;
    const footerTextWidth = doc.getTextWidth(footerText);
    doc.text(footerText, (pageWidth - footerTextWidth) / 2, pageHeight - 6);
  }
}

