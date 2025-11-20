// Fonctions helper pour générer le passeport adhérent PDF (Version Serveur)
// Cette version est utilisée dans les Server Actions

import { readFile } from "fs/promises";
import { join } from "path";

// Fonction pour charger le logo depuis le système de fichiers (version serveur)
async function getLogoBase64ForPDFServer(): Promise<string> {
  try {
    const logoPath = join(process.cwd(), "public", "amakifav.jpeg");
    const logoBuffer = await readFile(logoPath);
    return logoBuffer.toString("base64");
  } catch (error) {
    console.error("Erreur lors du chargement du logo pour PDF:", error);
    return "";
  }
}

// Fonction pour générer un numéro de passeport unique
export function generateNumeroPasseport(adherentId: string, dateCreation: Date): string {
  // Format: AMAKI-YYYY-XXXXXX
  // YYYY = Année de création
  // XXXXXX = 6 derniers caractères de l'ID de l'adhérent (en majuscules)
  const year = dateCreation.getFullYear();
  const idSuffix = adherentId.slice(-6).toUpperCase();
  return `AMAKI-${year}-${idSuffix}`;
}

// Fonction pour générer le PDF du passeport adhérent
export async function generatePasseportPDF(
  doc: any,
  adherent: {
    id: string;
    civility: string | null;
    firstname: string;
    lastname: string;
    dateNaissance: Date | null;
    profession: string | null;
    numeroPasseport: string | null;
    dateGenerationPasseport: Date | null;
    User: {
      email: string | null;
      createdAt: Date | null;
    };
  },
  adresse?: {
    streetnum?: string | null;
    street1?: string | null;
    street2?: string | null;
    codepost?: string | null;
    city?: string | null;
    country?: string | null;
  } | null
): Promise<void> {
  const logoBase64 = await getLogoBase64ForPDFServer();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // En-tête avec logo et fond bleu
  const headerHeight = 50;
  doc.setFillColor(9, 61, 181); // Bleu AMAKI
  doc.rect(0, 0, pageWidth, headerHeight, "F");

  // Logo
  if (logoBase64) {
    try {
      const dataUri = `data:image/jpeg;base64,${logoBase64}`;
      doc.addImage(dataUri, "JPEG", 15, 10, 30, 30);
    } catch (error) {
      console.error("Erreur lors de l'ajout du logo:", error);
    }
  }

  // Texte "AMAKI France" avec "A" en rouge
  doc.setFontSize(20);
  doc.setTextColor(255, 107, 107); // Rouge pour "A"
  doc.text("A", 50, 25);
  doc.setTextColor(255, 255, 255); // Blanc pour le reste
  doc.text("MAKI France", 58, 25);

  // Titre "PASSEPORT ADHÉRENT"
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("PASSEPORT ADHÉRENT", pageWidth / 2, 40, { align: "center" });

  // Position de départ pour le contenu
  let yPos = headerHeight + 20;

  // Cadre principal pour les informations
  const cardX = 20;
  const cardY = yPos;
  const cardWidth = pageWidth - 40;
  const cardHeight = pageHeight - cardY - 60;

  // Fond blanc avec bordure
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.roundedRect(cardX, cardY, cardWidth, cardHeight, 3, 3, "FD");

  yPos += 15;

  // Numéro de passeport (en haut, centré)
  if (adherent.numeroPasseport) {
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(9, 61, 181); // Bleu AMAKI
    doc.text(
      `N° ${adherent.numeroPasseport}`,
      pageWidth / 2,
      yPos,
      { align: "center" }
    );
    yPos += 10;
  }

  // Ligne de séparation
  doc.setDrawColor(200, 200, 200);
  doc.line(cardX + 10, yPos, cardX + cardWidth - 10, yPos);
  yPos += 15;

  // Informations personnelles
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text("INFORMATIONS PERSONNELLES", cardX + 15, yPos);
  yPos += 10;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);

  // Civilité, Prénom, Nom
  const civilityLabel = adherent.civility || "";
  doc.text(`Civilité:`, cardX + 15, yPos);
  doc.setTextColor(0, 0, 0);
  doc.text(`${civilityLabel}`, cardX + 50, yPos);
  yPos += 7;

  doc.setTextColor(100, 100, 100);
  doc.text(`Prénom:`, cardX + 15, yPos);
  doc.setTextColor(0, 0, 0);
  doc.text(`${adherent.firstname}`, cardX + 50, yPos);
  yPos += 7;

  doc.setTextColor(100, 100, 100);
  doc.text(`Nom:`, cardX + 15, yPos);
  doc.setTextColor(0, 0, 0);
  doc.text(`${adherent.lastname}`, cardX + 50, yPos);
  yPos += 7;

  // Date de naissance
  if (adherent.dateNaissance) {
    doc.setTextColor(100, 100, 100);
    doc.text(`Date de naissance:`, cardX + 15, yPos);
    doc.setTextColor(0, 0, 0);
    doc.text(
      `${new Date(adherent.dateNaissance).toLocaleDateString("fr-FR")}`,
      cardX + 70,
      yPos
    );
    yPos += 7;
  }

  // Profession
  if (adherent.profession) {
    doc.setTextColor(100, 100, 100);
    doc.text(`Profession:`, cardX + 15, yPos);
    doc.setTextColor(0, 0, 0);
    doc.text(`${adherent.profession}`, cardX + 50, yPos);
    yPos += 7;
  }

  yPos += 5;

  // Adresse
  if (adresse) {
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text("ADRESSE", cardX + 15, yPos);
    yPos += 10;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);

    const addressParts: string[] = [];
    if (adresse.streetnum) addressParts.push(adresse.streetnum);
    if (adresse.street1) addressParts.push(adresse.street1);
    if (adresse.street2) addressParts.push(adresse.street2);
    if (adresse.codepost && adresse.city) {
      addressParts.push(`${adresse.codepost} ${adresse.city}`);
    }
    if (adresse.country) addressParts.push(adresse.country);

    if (addressParts.length > 0) {
      const addressText = addressParts.join(", ");
      // Gérer le texte long en le divisant en plusieurs lignes
      const maxWidth = cardWidth - 30;
      const lines = doc.splitTextToSize(addressText, maxWidth);
      lines.forEach((line: string) => {
        doc.text(line, cardX + 15, yPos);
        yPos += 7;
      });
    }
    yPos += 5;
  }

  // Informations d'adhésion
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text("INFORMATIONS D'ADHÉSION", cardX + 15, yPos);
  yPos += 10;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);

  // Email
  if (adherent.User.email) {
    doc.text(`Email:`, cardX + 15, yPos);
    doc.setTextColor(0, 0, 0);
    doc.text(`${adherent.User.email}`, cardX + 50, yPos);
    yPos += 7;
  }

  // Date de création du compte
  if (adherent.User.createdAt) {
    doc.setTextColor(100, 100, 100);
    doc.text(`Date d'adhésion:`, cardX + 15, yPos);
    doc.setTextColor(0, 0, 0);
    doc.text(
      `${new Date(adherent.User.createdAt).toLocaleDateString("fr-FR")}`,
      cardX + 60,
      yPos
    );
    yPos += 7;
  }

  // Date de génération du passeport
  if (adherent.dateGenerationPasseport) {
    doc.setTextColor(100, 100, 100);
    doc.text(`Date d'émission:`, cardX + 15, yPos);
    doc.setTextColor(0, 0, 0);
    doc.text(
      `${new Date(adherent.dateGenerationPasseport).toLocaleDateString("fr-FR")}`,
      cardX + 60,
      yPos
    );
    yPos += 7;
  }

  // Zone de signature (en bas)
  const signatureY = pageHeight - 80;
  doc.setDrawColor(200, 200, 200);
  doc.line(cardX + 15, signatureY, cardX + cardWidth - 15, signatureY);
  yPos = signatureY + 10;

  doc.setFontSize(9);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(100, 100, 100);
  doc.text(
    "Signature du Président de l'Association",
    cardX + 15,
    yPos
  );
  yPos += 5;
  doc.text(
    "AMAKI France",
    cardX + 15,
    yPos
  );

  // Cachet / Sceau (optionnel, à droite)
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(
    "Cachet de l'Association",
    cardX + cardWidth - 60,
    signatureY + 10
  );

  // Pied de page
  doc.setFillColor(9, 61, 181);
  doc.rect(0, pageHeight - 20, pageWidth, 20, "F");
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "normal");
  const footerText = `© ${new Date().getFullYear()} AMAKI France - Tous droits réservés`;
  const footerTextWidth = doc.getTextWidth(footerText);
  doc.text(footerText, (pageWidth - footerTextWidth) / 2, pageHeight - 8);
}

