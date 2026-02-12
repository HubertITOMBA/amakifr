"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { generateNumeroPasseport, generatePasseportPDF } from "@/lib/passeport-helpers";
import { buildReglementDroitsObligationsPDF } from "@/lib/reglement-droits-obligations-pdf";
import { sendPasseportEmail } from "@/lib/mail";
import { UserRole } from "@prisma/client";
import { z } from "zod";
import jsPDF from "jspdf";

/**
 * Génère automatiquement le passeport pour un adhérent
 * Cette fonction est appelée lors de la validation du compte
 * 
 * @param userId - L'ID de l'utilisateur pour lequel générer le passeport
 * @returns Un objet avec success (boolean), message (string) en cas de succès, 
 *          ou error (string) en cas d'échec, et le numéro de passeport généré
 */
export async function generatePasseportForAdherent(
  userId: string
): Promise<{
  success: boolean;
  message?: string;
  error?: string;
  numeroPasseport?: string;
  pdfBuffer?: Buffer;
}> {
  try {
    // Récupérer l'adhérent avec toutes les informations nécessaires
    const adherent = await db.adherent.findUnique({
      where: { userId },
      include: {
        User: {
          select: {
            email: true,
            createdAt: true,
            status: true,
          },
        },
        Adresse: {
          where: {
            // Prendre la première adresse principale si disponible
          },
          take: 1,
        },
      },
    });

    if (!adherent) {
      return { success: false, error: "Adhérent non trouvé" };
    }

    // Vérifier que le compte est actif
    if (adherent.User.status !== "Actif") {
      return {
        success: false,
        error: "Le compte doit être actif pour générer le passeport",
      };
    }

    // Générer le numéro de passeport s'il n'existe pas
    let numeroPasseport = adherent.numeroPasseport;
    if (!numeroPasseport) {
      const dateCreation = adherent.User.createdAt || new Date();
      numeroPasseport = generateNumeroPasseport(adherent.id, dateCreation);
    }

    // Générer le PDF
    const doc = new jsPDF();
    await generatePasseportPDF(doc, {
      id: adherent.id,
      civility: adherent.civility,
      firstname: adherent.firstname,
      lastname: adherent.lastname,
      dateNaissance: adherent.dateNaissance,
      profession: adherent.profession,
      numeroPasseport,
      dateGenerationPasseport: new Date(),
      User: {
        email: adherent.User.email,
        createdAt: adherent.User.createdAt,
      },
    }, adherent.Adresse[0] || null);

    // Convertir le PDF en buffer
    const pdfBuffer = Buffer.from(doc.output("arraybuffer"));

    // Mettre à jour l'adhérent avec le numéro de passeport et la date de génération
    await db.adherent.update({
      where: { id: adherent.id },
      data: {
        numeroPasseport,
        dateGenerationPasseport: new Date(),
      },
    });

    // Envoyer le passeport par email
    if (adherent.User.email) {
      try {
        await sendPasseportEmail(
          adherent.User.email,
          `${adherent.civility || ""} ${adherent.firstname} ${adherent.lastname}`.trim(),
          pdfBuffer,
          numeroPasseport
        );
      } catch (emailError) {
        console.error("Erreur lors de l'envoi de l'email:", emailError);
        // Ne pas faire échouer l'opération si l'email échoue
      }
    }

    revalidatePath("/user/profile");
    revalidatePath(`/admin/users/${userId}/consultation`);

    // Convertir le buffer en Array pour la sérialisation JSON
    return {
      success: true,
      message: "Passeport généré avec succès",
      numeroPasseport,
      pdfBuffer: Array.from(pdfBuffer),
    };
  } catch (error) {
    console.error("Erreur lors de la génération du passeport:", error);
    return {
      success: false,
      error: "Erreur lors de la génération du passeport",
    };
  }
}

/**
 * Télécharge le passeport PDF pour l'adhérent connecté
 * 
 * @returns Un objet avec success (boolean), pdfBuffer (Buffer) en cas de succès, 
 *          ou error (string) en cas d'échec
 */
export async function downloadPasseportPDF(): Promise<{
  success: boolean;
  pdfBuffer?: Buffer;
  error?: string;
  numeroPasseport?: string;
}> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    // Récupérer l'adhérent avec toutes les informations nécessaires
    const adherent = await db.adherent.findUnique({
      where: { userId: session.user.id },
      include: {
        User: {
          select: {
            email: true,
            createdAt: true,
            status: true,
          },
        },
        Adresse: {
          take: 1,
        },
      },
    });

    if (!adherent) {
      return { success: false, error: "Adhérent non trouvé" };
    }

    // Vérifier que le compte est actif
    if (adherent.User.status !== "Actif") {
      return {
        success: false,
        error: "Votre compte doit être actif pour télécharger le passeport",
      };
    }

    // Générer le numéro de passeport s'il n'existe pas
    let numeroPasseport = adherent.numeroPasseport;
    if (!numeroPasseport) {
      const dateCreation = adherent.User.createdAt || new Date();
      numeroPasseport = generateNumeroPasseport(adherent.id, dateCreation);
      
      // Mettre à jour l'adhérent avec le numéro de passeport
      await db.adherent.update({
        where: { id: adherent.id },
        data: {
          numeroPasseport,
          dateGenerationPasseport: new Date(),
        },
      });
    }

    // Générer le PDF
    const doc = new jsPDF();
    await generatePasseportPDF(doc, {
      id: adherent.id,
      civility: adherent.civility,
      firstname: adherent.firstname,
      lastname: adherent.lastname,
      dateNaissance: adherent.dateNaissance,
      profession: adherent.profession,
      numeroPasseport,
      dateGenerationPasseport: adherent.dateGenerationPasseport || new Date(),
      User: {
        email: adherent.User.email,
        createdAt: adherent.User.createdAt,
      },
    }, adherent.Adresse[0] || null);

    // Convertir le PDF en buffer
    const pdfBuffer = Buffer.from(doc.output("arraybuffer"));

    // Convertir le buffer en Array pour la sérialisation JSON
    return {
      success: true,
      pdfBuffer: Array.from(pdfBuffer),
      numeroPasseport,
    };
  } catch (error) {
    console.error("Erreur lors du téléchargement du passeport:", error);
    return {
      success: false,
      error: "Erreur lors du téléchargement du passeport",
    };
  }
}

/**
 * Génère le passeport pour un adhérent (action admin)
 * 
 * @param formData - Les données du formulaire contenant l'ID de l'utilisateur
 * @returns Un objet avec success (boolean), message (string) en cas de succès, 
 *          ou error (string) en cas d'échec
 */
export async function adminGeneratePasseport(formData: FormData) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user || user.role !== UserRole.ADMIN) {
      return { success: false, error: "Accès réservé aux administrateurs" };
    }

    const userId = formData.get("userId") as string;
    if (!userId) {
      return { success: false, error: "ID utilisateur manquant" };
    }

    const result = await generatePasseportForAdherent(userId);

    if (result.success) {
      return {
        success: true,
        message: `Passeport généré avec succès. Numéro: ${result.numeroPasseport}`,
      };
    } else {
      return result;
    }
  } catch (error) {
    console.error("Erreur lors de la génération du passeport:", error);
    return {
      success: false,
      error: "Erreur lors de la génération du passeport",
    };
  }
}

/**
 * Génère et retourne un PDF contenant le Règlement d'ordre intérieur, les Droits et les Obligations de l'adhérent.
 * Accessible à tout utilisateur connecté (adhérent).
 */
export async function downloadReglementDroitsObligationsPDF(): Promise<{
  success: boolean;
  pdfBuffer?: number[];
  error?: string;
}> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    buildReglementDroitsObligationsPDF(doc);
    const pdfBuffer = Buffer.from(doc.output("arraybuffer"));

    return {
      success: true,
      pdfBuffer: Array.from(pdfBuffer),
    };
  } catch (error) {
    console.error("Erreur lors de la génération du PDF règlement/droits/obligations:", error);
    return {
      success: false,
      error: "Erreur lors de la génération du PDF",
    };
  }
}

