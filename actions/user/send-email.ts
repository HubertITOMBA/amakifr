"use server";

import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { sendCustomEmailToUsers } from "@/lib/mail";

export interface SendEmailData {
  userIds: string[];
  subject: string;
  body: string;
}

/**
 * Envoyer un email personnalisé à un ou plusieurs utilisateurs
 */
export async function sendCustomEmailToAdherents(
  emailData: SendEmailData
): Promise<{ success: boolean; error?: string; sentCount?: number; failedCount?: number }> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "Non authentifié" };
    }

    // Vérifier que l'utilisateur est admin
    const user = await prisma.user.findUnique({
      where: { id: session.user.id! },
      select: { role: true },
    });

    if (!user || user.role !== "Admin") {
      return { success: false, error: "Accès non autorisé. Administrateur requis." };
    }

    // Validation des données
    if (!emailData.userIds || emailData.userIds.length === 0) {
      return { success: false, error: "Aucun destinataire sélectionné" };
    }

    if (!emailData.subject || emailData.subject.trim().length === 0) {
      return { success: false, error: "L'objet de l'email est requis" };
    }

    if (!emailData.body || emailData.body.trim().length === 0) {
      return { success: false, error: "Le corps de l'email est requis" };
    }

    // Récupérer les utilisateurs avec leurs emails
    const users = await prisma.user.findMany({
      where: {
        id: { in: emailData.userIds },
      },
      include: {
        adherent: {
          select: {
            firstname: true,
            lastname: true,
            civility: true,
          },
        },
      },
    });

    if (users.length === 0) {
      return { success: false, error: "Aucun utilisateur trouvé" };
    }

    // Filtrer les utilisateurs avec email valide
    const usersWithEmail = users.filter((u) => u.email && u.email.trim().length > 0);

    if (usersWithEmail.length === 0) {
      return { success: false, error: "Aucun utilisateur avec adresse email valide" };
    }

    // Envoyer les emails
    let sentCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    for (const user of usersWithEmail) {
      try {
        const userName = user.adherent
          ? `${user.adherent.civility || ""} ${user.adherent.firstname || ""} ${user.adherent.lastname || ""}`.trim() || user.name || "Adhérent"
          : user.name || "Adhérent";

        await sendCustomEmailToUsers(
          user.email!,
          userName,
          emailData.subject,
          emailData.body
        );
        sentCount++;
      } catch (error: any) {
        failedCount++;
        const errorMsg = `Erreur pour ${user.email}: ${error.message || "Erreur inconnue"}`;
        errors.push(errorMsg);
        console.error(errorMsg, error);
      }
    }

    if (sentCount === 0) {
      return {
        success: false,
        error: `Aucun email n'a pu être envoyé. ${errors.join("; ")}`,
        sentCount: 0,
        failedCount,
      };
    }

    return {
      success: true,
      sentCount,
      failedCount,
    };
  } catch (error: any) {
    console.error("Erreur lors de l'envoi des emails:", error);
    return {
      success: false,
      error: error.message || "Erreur lors de l'envoi des emails",
    };
  }
}

