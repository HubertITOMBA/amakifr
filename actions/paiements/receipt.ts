"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { writeFile, mkdirSync } from "fs";
import { join } from "path";
import { existsSync } from "fs";
import { promisify } from "util";
import jsPDF from "jspdf";

const writeFileAsync = promisify(writeFile);

/**
 * Génère un reçu PDF pour un paiement
 * 
 * @param paiementId - L'ID du paiement
 * @returns Un objet avec success et l'URL du reçu PDF
 */
export async function generateReceiptPDF(paiementId: string): Promise<{
  success: boolean;
  receiptUrl?: string;
  error?: string;
}> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    // Récupérer le paiement avec toutes ses relations
    const paiement = await db.paiementCotisation.findUnique({
      where: { id: paiementId },
      include: {
        Adherent: {
          include: {
            User: true,
          },
        },
        CotisationMensuelle: {
          include: {
            TypeCotisation: true,
          },
        },
        Assistance: true,
        DetteInitiale: true,
        ObligationCotisation: true,
      },
    });

    if (!paiement) {
      return { success: false, error: "Paiement non trouvé" };
    }

    // Vérifier que l'utilisateur est l'adhérent concerné ou un admin
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      include: { adherent: true },
    });

    if (!user) {
      return { success: false, error: "Utilisateur non trouvé" };
    }

    if (user.role !== "Admin" && user.adherent?.id !== paiement.adherentId) {
      return { success: false, error: "Non autorisé à télécharger ce reçu" };
    }

    // Si le reçu existe déjà, retourner son URL
    if (paiement.receiptUrl && paiement.receiptGenerated) {
      return { success: true, receiptUrl: paiement.receiptUrl };
    }

    // Générer le PDF
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    let yPosition = margin;

    // En-tête
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("AMAKI France", pageWidth / 2, yPosition, { align: "center" });
    yPosition += 10;

    doc.setFontSize(14);
    doc.setFont("helvetica", "normal");
    doc.text("Association des Anciens de Kipaku", pageWidth / 2, yPosition, { align: "center" });
    yPosition += 15;

    // Titre
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("REÇU DE PAIEMENT", pageWidth / 2, yPosition, { align: "center" });
    yPosition += 15;

    // Ligne de séparation
    doc.setLineWidth(0.5);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 10;

    // Informations du paiement
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");

    const adherent = paiement.Adherent;
    const datePaiement = new Date(paiement.datePaiement).toLocaleDateString("fr-FR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    // Informations adhérent
    doc.setFont("helvetica", "bold");
    doc.text("Adhérent:", margin, yPosition);
    doc.setFont("helvetica", "normal");
    doc.text(
      `${adherent.firstname} ${adherent.lastname}`,
      margin + 40,
      yPosition
    );
    yPosition += 7;

    if (adherent.User?.email) {
      doc.setFont("helvetica", "bold");
      doc.text("Email:", margin, yPosition);
      doc.setFont("helvetica", "normal");
      doc.text(adherent.User.email, margin + 40, yPosition);
      yPosition += 7;
    }

    // Date de paiement
    doc.setFont("helvetica", "bold");
    doc.text("Date de paiement:", margin, yPosition);
    doc.setFont("helvetica", "normal");
    doc.text(datePaiement, margin + 50, yPosition);
    yPosition += 7;

    // Montant
    doc.setFont("helvetica", "bold");
    doc.text("Montant payé:", margin, yPosition);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.text(`${paiement.montant.toFixed(2)} €`, margin + 50, yPosition);
    yPosition += 7;

    // Moyen de paiement
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Moyen de paiement:", margin, yPosition);
    doc.setFont("helvetica", "normal");
    const moyenPaiementLabels: Record<string, string> = {
      Especes: "Espèces",
      Cheque: "Chèque",
      Virement: "Virement",
      CarteBancaire: "Carte bancaire",
      Stripe: "Carte bancaire (Stripe)",
      PayPal: "PayPal",
      GooglePay: "Google Pay",
    };
    doc.text(
      moyenPaiementLabels[paiement.moyenPaiement] || paiement.moyenPaiement,
      margin + 60,
      yPosition
    );
    yPosition += 7;

    // Référence
    if (paiement.reference) {
      doc.setFont("helvetica", "bold");
      doc.text("Référence:", margin, yPosition);
      doc.setFont("helvetica", "normal");
      doc.text(paiement.reference, margin + 40, yPosition);
      yPosition += 7;
    }

    // Description
    if (paiement.description) {
      yPosition += 5;
      doc.setFont("helvetica", "bold");
      doc.text("Description:", margin, yPosition);
      yPosition += 5;
      doc.setFont("helvetica", "normal");
      const descriptionLines = doc.splitTextToSize(paiement.description, pageWidth - 2 * margin);
      doc.text(descriptionLines, margin, yPosition);
      yPosition += descriptionLines.length * 5;
    }

    // Détails selon le type
    yPosition += 10;
    doc.setLineWidth(0.3);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 10;

    if (paiement.CotisationMensuelle) {
      const cotisation = paiement.CotisationMensuelle;
      doc.setFont("helvetica", "bold");
      doc.text("Détails de la cotisation:", margin, yPosition);
      yPosition += 7;
      doc.setFont("helvetica", "normal");
      const nomType = cotisation.TypeCotisation?.nom || "Type inconnu";
      doc.text(`Type: ${nomType}`, margin, yPosition);
      yPosition += 7;
      doc.text(`Période: ${cotisation.periode}`, margin, yPosition);
    } else if (paiement.Assistance) {
      const assistance = paiement.Assistance;
      doc.setFont("helvetica", "bold");
      doc.text("Détails de l'assistance:", margin, yPosition);
      yPosition += 7;
      doc.setFont("helvetica", "normal");
      doc.text(`Type: ${assistance.type}`, margin, yPosition);
    } else if (paiement.DetteInitiale) {
      const dette = paiement.DetteInitiale;
      doc.setFont("helvetica", "bold");
      doc.text("Détails de la dette:", margin, yPosition);
      yPosition += 7;
      doc.setFont("helvetica", "normal");
      doc.text(`Année: ${dette.annee}`, margin, yPosition);
    }

    // Pied de page
    yPosition = pageHeight - 40;
    doc.setLineWidth(0.3);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 10;

    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    doc.text(
      "Ce document constitue un reçu de paiement officiel.",
      pageWidth / 2,
      yPosition,
      { align: "center" }
    );
    yPosition += 5;
    doc.text(
      `Généré le ${new Date().toLocaleDateString("fr-FR")} - AMAKI France`,
      pageWidth / 2,
      yPosition,
      { align: "center" }
    );

    // Sauvegarder le PDF
    const receiptsDir = join(process.cwd(), "public", "ressources", "receipts");
    if (!existsSync(receiptsDir)) {
      mkdirSync(receiptsDir, { recursive: true });
    }

    const fileName = `receipt_${paiementId}_${Date.now()}.pdf`;
    const filePath = join(receiptsDir, fileName);
    const receiptUrl = `/ressources/receipts/${fileName}`;

    await writeFileAsync(filePath, Buffer.from(doc.output("arraybuffer")));

    // Mettre à jour le paiement avec l'URL du reçu
    await db.paiementCotisation.update({
      where: { id: paiementId },
      data: {
        receiptUrl,
        receiptGenerated: true,
      },
    });

    return { success: true, receiptUrl };
  } catch (error) {
    console.error("Erreur lors de la génération du reçu:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erreur lors de la génération du reçu",
    };
  }
}

