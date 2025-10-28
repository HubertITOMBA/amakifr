"use server";

import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import jsPDF from "jspdf";

// Schémas de validation pour les filtres
const CotisationFilterSchema = z.object({
  statut: z.enum(['Valide', 'EnAttente', 'Annule']).optional(),
  type: z.enum(['Forfait', 'Assistance', 'Anniversaire', 'Adhesion']).optional(),
  dateDebut: z.string().optional(),
  dateFin: z.string().optional(),
  montantMin: z.number().optional(),
  montantMax: z.number().optional(),
});

const ObligationFilterSchema = z.object({
  statut: z.enum(['Paye', 'PartiellementPaye', 'EnAttente', 'EnRetard']).optional(),
  type: z.enum(['Forfait', 'Assistance', 'Anniversaire', 'Adhesion']).optional(),
  periode: z.string().optional(),
  montantMin: z.number().optional(),
  montantMax: z.number().optional(),
});

// Server Action pour filtrer les cotisations
export async function filterCotisations(filters: z.infer<typeof CotisationFilterSchema>) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    // Validation des filtres
    const validatedFilters = CotisationFilterSchema.parse(filters);

    // Récupérer l'adhérent de l'utilisateur
    const adherent = await prisma.adherent.findUnique({
      where: { userId: session.user.id }
    });

    if (!adherent) {
      return { success: false, error: "Adhérent non trouvé" };
    }

    // Construction de la clause WHERE
    const whereClause: any = {
      adherentId: adherent.id
    };

    if (validatedFilters.statut) {
      whereClause.statut = validatedFilters.statut;
    }

    if (validatedFilters.type) {
      whereClause.type = validatedFilters.type;
    }

    if (validatedFilters.dateDebut && validatedFilters.dateFin) {
      whereClause.dateCotisation = {
        gte: new Date(validatedFilters.dateDebut),
        lte: new Date(validatedFilters.dateFin),
      };
    }

    if (validatedFilters.montantMin !== undefined && validatedFilters.montantMax !== undefined) {
      whereClause.montant = {
        gte: validatedFilters.montantMin,
        lte: validatedFilters.montantMax,
      };
    }

    // Récupération des cotisations filtrées
    const cotisations = await prisma.cotisation.findMany({
      where: whereClause,
      orderBy: {
        dateCotisation: 'desc'
      }
    });

    // Conversion des Decimal en nombres
    const cotisationsConverted = cotisations.map((cotisation: any) => ({
      ...cotisation,
      montant: Number(cotisation.montant)
    }));

    return { success: true, data: cotisationsConverted };

  } catch (error) {
    console.error("Erreur lors du filtrage des cotisations:", error);
    return { success: false, error: "Erreur interne du serveur" };
  }
}

// Server Action pour filtrer les obligations
export async function filterObligations(filters: z.infer<typeof ObligationFilterSchema>) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    // Validation des filtres
    const validatedFilters = ObligationFilterSchema.parse(filters);

    // Récupérer l'adhérent de l'utilisateur
    const adherent = await prisma.adherent.findUnique({
      where: { userId: session.user.id }
    });

    if (!adherent) {
      return { success: false, error: "Adhérent non trouvé" };
    }

    // Construction de la clause WHERE
    const whereClause: any = {
      adherentId: adherent.id
    };

    if (validatedFilters.statut) {
      whereClause.statut = validatedFilters.statut;
    }

    if (validatedFilters.type) {
      whereClause.type = validatedFilters.type;
    }

    if (validatedFilters.periode) {
      whereClause.periode = validatedFilters.periode;
    }

    if (validatedFilters.montantMin !== undefined && validatedFilters.montantMax !== undefined) {
      whereClause.montantAttendu = {
        gte: validatedFilters.montantMin,
        lte: validatedFilters.montantMax,
      };
    }

    // Récupération des obligations filtrées
    const obligations = await prisma.obligationCotisation.findMany({
      where: whereClause,
      orderBy: {
        dateEcheance: 'desc'
      }
    });

    // Conversion des Decimal en nombres
    const obligationsConverted = obligations.map((obligation: any) => ({
      ...obligation,
      montantAttendu: Number(obligation.montantAttendu),
      montantPaye: Number(obligation.montantPaye),
      montantRestant: Number(obligation.montantRestant)
    }));

    return { success: true, data: obligationsConverted };

  } catch (error) {
    console.error("Erreur lors du filtrage des obligations:", error);
    return { success: false, error: "Erreur interne du serveur" };
  }
}

// Server Action pour exporter les cotisations en PDF
export async function exportCotisationsPDF() {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    // Récupérer l'adhérent de l'utilisateur
    const adherent = await prisma.adherent.findUnique({
      where: { userId: session.user.id }
    });

    if (!adherent) {
      return { success: false, error: "Adhérent non trouvé" };
    }

    // Récupérer toutes les cotisations de l'adhérent
    const cotisations = await prisma.cotisation.findMany({
      where: { adherentId: adherent.id },
      orderBy: {
        dateCotisation: 'desc'
      }
    });

    // Créer le PDF
    const doc = new jsPDF();
    
    // En-tête avec couleur bleue
    doc.setFillColor(59, 130, 246); // blue-500
    doc.rect(0, 0, 210, 40, 'F');
    
    doc.setTextColor(255, 255, 255); // Blanc pour le texte sur fond bleu
    doc.setFontSize(20);
    doc.text('Historique des Cotisations', 20, 25);
    
    // Informations adhérent avec fond gris clair
    doc.setFillColor(248, 250, 252); // slate-50
    doc.rect(0, 40, 210, 30, 'F');
    
    doc.setTextColor(0, 0, 0); // Noir pour le texte
    doc.setFontSize(12);
    doc.text(`Adhérent: ${adherent.firstname} ${adherent.lastname}`, 20, 55);
    doc.text(`Date de génération: ${new Date().toLocaleDateString('fr-FR')}`, 20, 65);
    
    // Tableau des cotisations
    let yPosition = 80;
    const pageHeight = doc.internal.pageSize.height;
    
    // En-têtes du tableau avec fond bleu clair
    doc.setFillColor(219, 234, 254); // blue-100
    doc.rect(20, yPosition - 5, 180, 10, 'F');
    
    doc.setTextColor(30, 64, 175); // blue-800
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.text('Type', 20, yPosition);
    doc.text('Montant', 60, yPosition);
    doc.text('Statut', 100, yPosition);
    doc.text('Date', 140, yPosition);
    doc.text('Référence', 180, yPosition);
    
    yPosition += 10;
    
    // Ligne de séparation bleue
    doc.setDrawColor(59, 130, 246); // blue-500
    doc.setLineWidth(0.5);
    doc.line(20, yPosition, 200, yPosition);
    yPosition += 5;
    
    // Données des cotisations
    cotisations.forEach((cotisation: any, index: any) => {
      // Vérifier si on doit passer à la page suivante
      if (yPosition > pageHeight - 30) {
        doc.addPage();
        yPosition = 30;
      }
      
      doc.setFontSize(9);
      doc.setFont(undefined, 'normal');
      
      // Couleurs selon le statut
      if (cotisation.statut === 'Valide') {
        doc.setTextColor(22, 163, 74); // green-600
      } else if (cotisation.statut === 'EnAttente') {
        doc.setTextColor(234, 179, 8); // yellow-500
      } else {
        doc.setTextColor(239, 68, 68); // red-500
      }
      
      doc.text(getTypeCotisationLabel(cotisation.type), 20, yPosition);
      
      // Montant en vert
      doc.setTextColor(22, 163, 74); // green-600
      doc.text(`${Number(cotisation.montant).toFixed(2).replace('.', ',')} €`, 60, yPosition);
      
      // Statut avec couleur appropriée
      if (cotisation.statut === 'Valide') {
        doc.setTextColor(22, 163, 74); // green-600
        doc.text('Validée', 100, yPosition);
      } else if (cotisation.statut === 'EnAttente') {
        doc.setTextColor(234, 179, 8); // yellow-500
        doc.text('En attente', 100, yPosition);
      } else {
        doc.setTextColor(239, 68, 68); // red-500
        doc.text('Annulée', 100, yPosition);
      }
      
      // Date en noir
      doc.setTextColor(0, 0, 0);
      doc.text(new Date(cotisation.dateCotisation).toLocaleDateString('fr-FR'), 140, yPosition);
      doc.text(cotisation.reference || 'N/A', 180, yPosition);
      
      yPosition += 8;
    });
    
    // Totaux avec fond bleu clair
    doc.setFillColor(219, 234, 254); // blue-100
    doc.rect(20, yPosition - 5, 180, 30, 'F');
    
    doc.setTextColor(30, 64, 175); // blue-800
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('TOTAUX:', 20, yPosition);
    yPosition += 8;
    
    const totalGeneral = cotisations.reduce((sum: any, c: any) => sum + Number(c.montant), 0);
    const totalValide = cotisations.filter((c: any) => c.statut === 'Valide').reduce((sum: any, c: any) => sum + Number(c.montant), 0);
    const totalEnAttente = cotisations.filter((c: any) => c.statut === 'EnAttente').reduce((sum: any, c: any) => sum + Number(c.montant), 0);
    
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    
    // Total général en bleu
    doc.setTextColor(30, 64, 175); // blue-800
    doc.text(`Total général: ${totalGeneral.toFixed(2).replace('.', ',')} €`, 20, yPosition);
    yPosition += 6;
    
    // Total validé en vert
    doc.setTextColor(22, 163, 74); // green-600
    doc.text(`Total validé: ${totalValide.toFixed(2).replace('.', ',')} €`, 20, yPosition);
    yPosition += 6;
    
    // Total en attente en jaune
    doc.setTextColor(234, 179, 8); // yellow-500
    doc.text(`Total en attente: ${totalEnAttente.toFixed(2).replace('.', ',')} €`, 20, yPosition);
    
    // Générer le nom du fichier
    const fileName = `cotisations_${adherent.firstname.toLowerCase()}_${adherent.lastname.toLowerCase()}.pdf`;
    
    // Convertir en base64 pour le téléchargement
    const pdfOutput = doc.output('datauristring');
    
    return { 
      success: true, 
      fileName,
      pdfData: pdfOutput
    };

  } catch (error) {
    console.error("Erreur lors de l'export PDF des cotisations:", error);
    return { success: false, error: "Erreur interne du serveur" };
  }
}

// Server Action pour exporter les obligations en PDF
export async function exportObligationsPDF() {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    // Récupérer l'adhérent de l'utilisateur
    const adherent = await prisma.adherent.findUnique({
      where: { userId: session.user.id }
    });

    if (!adherent) {
      return { success: false, error: "Adhérent non trouvé" };
    }

    // Récupérer toutes les obligations de l'adhérent
    const obligations = await prisma.obligationCotisation.findMany({
      where: { adherentId: adherent.id },
      orderBy: {
        dateEcheance: 'desc'
      }
    });

    // Créer le PDF
    const doc = new jsPDF();
    
    // En-tête avec couleur orange
    doc.setFillColor(249, 115, 22); // orange-500
    doc.rect(0, 0, 210, 40, 'F');
    
    doc.setTextColor(255, 255, 255); // Blanc pour le texte sur fond orange
    doc.setFontSize(20);
    doc.text('Obligations de Cotisation', 20, 25);
    
    // Informations adhérent avec fond gris clair
    doc.setFillColor(248, 250, 252); // slate-50
    doc.rect(0, 40, 210, 30, 'F');
    
    doc.setTextColor(0, 0, 0); // Noir pour le texte
    doc.setFontSize(12);
    doc.text(`Adhérent: ${adherent.firstname} ${adherent.lastname}`, 20, 55);
    doc.text(`Date de génération: ${new Date().toLocaleDateString('fr-FR')}`, 20, 65);
    
    // Tableau des obligations
    let yPosition = 80;
    const pageHeight = doc.internal.pageSize.height;
    
    // En-têtes du tableau avec fond orange clair
    doc.setFillColor(255, 237, 213); // orange-100
    doc.rect(20, yPosition - 5, 180, 10, 'F');
    
    doc.setTextColor(154, 52, 18); // orange-800
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.text('Type', 20, yPosition);
    doc.text('Attendu', 50, yPosition);
    doc.text('Payé', 80, yPosition);
    doc.text('Restant', 110, yPosition);
    doc.text('Statut', 140, yPosition);
    doc.text('Échéance', 170, yPosition);
    
    yPosition += 10;
    
    // Ligne de séparation orange
    doc.setDrawColor(249, 115, 22); // orange-500
    doc.setLineWidth(0.5);
    doc.line(20, yPosition, 200, yPosition);
    yPosition += 5;
    
    // Données des obligations
    obligations.forEach((obligation: any, index: any) => {
      // Vérifier si on doit passer à la page suivante
      if (yPosition > pageHeight - 30) {
        doc.addPage();
        yPosition = 30;
      }
      
      doc.setFontSize(9);
      doc.setFont(undefined, 'normal');
      
      // Type en orange
      doc.setTextColor(154, 52, 18); // orange-800
      doc.text(getTypeCotisationLabel(obligation.type), 20, yPosition);
      
      // Montant attendu en gris
      doc.setTextColor(75, 85, 99); // gray-600
      doc.text(`${Number(obligation.montantAttendu).toFixed(2).replace('.', ',')} €`, 50, yPosition);
      
      // Montant payé en vert
      doc.setTextColor(22, 163, 74); // green-600
      doc.text(`${Number(obligation.montantPaye).toFixed(2).replace('.', ',')} €`, 80, yPosition);
      
      // Montant restant en rouge si > 0, vert si = 0
      if (Number(obligation.montantRestant) > 0) {
        doc.setTextColor(239, 68, 68); // red-500
      } else {
        doc.setTextColor(22, 163, 74); // green-600
      }
      doc.text(`${Number(obligation.montantRestant).toFixed(2).replace('.', ',')} €`, 110, yPosition);
      
      // Statut avec couleur appropriée
      if (obligation.statut === 'Paye') {
        doc.setTextColor(22, 163, 74); // green-600
        doc.text('Payée', 140, yPosition);
      } else if (obligation.statut === 'PartiellementPaye') {
        doc.setTextColor(59, 130, 246); // blue-500
        doc.text('Partiellement payée', 140, yPosition);
      } else if (obligation.statut === 'EnAttente') {
        doc.setTextColor(234, 179, 8); // yellow-500
        doc.text('En attente', 140, yPosition);
      } else {
        doc.setTextColor(239, 68, 68); // red-500
        doc.text('En retard', 140, yPosition);
      }
      
      // Date en noir
      doc.setTextColor(0, 0, 0);
      doc.text(new Date(obligation.dateEcheance).toLocaleDateString('fr-FR'), 170, yPosition);
      
      yPosition += 8;
    });
    
    // Totaux avec fond orange clair
    doc.setFillColor(255, 237, 213); // orange-100
    doc.rect(20, yPosition - 5, 180, 40, 'F');
    
    doc.setTextColor(154, 52, 18); // orange-800
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('TOTAUX:', 20, yPosition);
    yPosition += 8;
    
    const totalAttendu = obligations.reduce((sum: any, o: any) => sum + Number(o.montantAttendu), 0);
    const totalPaye = obligations.reduce((sum: any, o: any) => sum + Number(o.montantPaye), 0);
    const totalRestant = obligations.reduce((sum: any, o: any) => sum + Number(o.montantRestant), 0);
    const totalEnRetard = obligations.filter((o: any) => o.statut === 'EnRetard').reduce((sum: any, o: any) => sum + Number(o.montantRestant), 0);
    
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    
    // Total attendu en gris
    doc.setTextColor(75, 85, 99); // gray-600
    doc.text(`Total attendu: ${totalAttendu.toFixed(2).replace('.', ',')} €`, 20, yPosition);
    yPosition += 6;
    
    // Total payé en vert
    doc.setTextColor(22, 163, 74); // green-600
    doc.text(`Total payé: ${totalPaye.toFixed(2).replace('.', ',')} €`, 20, yPosition);
    yPosition += 6;
    
    // Total restant en rouge
    doc.setTextColor(239, 68, 68); // red-500
    doc.text(`Total restant: ${totalRestant.toFixed(2).replace('.', ',')} €`, 20, yPosition);
    yPosition += 6;
    
    // Total en retard en rouge
    doc.setTextColor(239, 68, 68); // red-500
    doc.text(`Total en retard: ${totalEnRetard.toFixed(2).replace('.', ',')} €`, 20, yPosition);
    
    // Générer le nom du fichier
    const fileName = `obligations_${adherent.firstname.toLowerCase()}_${adherent.lastname.toLowerCase()}.pdf`;
    
    // Convertir en base64 pour le téléchargement
    const pdfOutput = doc.output('datauristring');
    
    return { 
      success: true, 
      fileName,
      pdfData: pdfOutput
    };

  } catch (error) {
    console.error("Erreur lors de l'export PDF des obligations:", error);
    return { success: false, error: "Erreur interne du serveur" };
  }
}

// Fonction utilitaire pour les labels des types
function getTypeCotisationLabel(type: string) {
  switch (type) {
    case 'Forfait': return 'Forfait';
    case 'Assistance': return 'Assistance';
    case 'Anniversaire': return 'Anniversaire';
    case 'Adhesion': return 'Adhésion';
    default: return type;
  }
}
