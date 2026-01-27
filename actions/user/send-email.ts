"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
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
    const user = await db.user.findUnique({
      where: { id: session.user.id! },
      select: { role: true },
    });

    if (!user || user.role !== "ADMIN") {
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
    const users = await db.user.findMany({
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
    const totalUsers = usersWithEmail.length;

    console.log(`[Email] Début de l'envoi de ${totalUsers} email(s)`);

    for (let i = 0; i < usersWithEmail.length; i++) {
      const user = usersWithEmail[i];
      try {
        const userName = user.adherent
          ? `${user.adherent.civility || ""} ${user.adherent.firstname || ""} ${user.adherent.lastname || ""}`.trim() || user.name || "Adhérent"
          : user.name || "Adhérent";

        console.log(`[Email] Envoi ${i + 1}/${totalUsers} à ${user.email}`);
        
        await sendCustomEmailToUsers(
          user.email!,
          userName,
          emailData.subject,
          emailData.body
        );
        sentCount++;
        console.log(`[Email] ✓ Email ${i + 1}/${totalUsers} envoyé avec succès`);
        
        // Attendre 2 secondes avant d'envoyer le prochain email (sauf pour le dernier)
        // Pour éviter l'erreur 429 (rate limit: 2 requêtes par seconde)
        // 2 secondes = 0.5 requête/seconde, bien en dessous de la limite
        if (i < usersWithEmail.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (error: any) {
        failedCount++;
        const errorMsg = `Erreur pour ${user.email}: ${error.message || "Erreur inconnue"}`;
        errors.push(errorMsg);
        console.error(`[Email] ✗ Erreur pour l'email ${i + 1}/${totalUsers}:`, errorMsg, error);
        
        // Attendre quand même 2 secondes même en cas d'erreur pour éviter le rate limit
        if (i < usersWithEmail.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }

    console.log(`[Email] Envoi terminé: ${sentCount} succès, ${failedCount} échecs`);

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

