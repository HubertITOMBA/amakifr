"use server"

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { logDeletion } from "@/lib/activity-logger";
import {
  NotesFraisRgpdBlockError,
  deleteUserAtomicallyWithNotesFraisRgpd,
} from "@/lib/services/frais-avances/rgpd-account-deletion";

/**
 * Supprime définitivement un adhérent et toutes ses données associées
 *
 * ATTENTION : Cette action est IRRÉVERSIBLE et supprime :
 * - Le compte utilisateur
 * - L'adhérent et toutes ses données personnelles
 * - Toutes les cotisations et paiements
 * - Tous les votes et candidatures
 * - Tous les messages et conversations
 * - Tous les documents et réservations
 * - Tout l'historique complet
 * - Brouillons notes de frais (atomique, jobs UNLINK) ; notes soumises bloquées
 *   sans politique de conservation validée
 *
 * @param userId - L'ID de l'utilisateur à supprimer
 * @param reason - La raison de la suppression (pour logs)
 * @param notifyUser - Si true, envoie un email de notification à l'adhérent
 * @returns Un objet avec success (boolean), message (string) en cas de succès,
 * ou error (string) en cas d'échec
 */
export async function adminDeleteAdherent(
  userId: string,
  reason: string,
  notifyUser: boolean = false
) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return {
        success: false,
        error:
          "Non autorisé. Seuls les administrateurs peuvent supprimer des adhérents.",
      };
    }

    const userToDelete = await db.user.findUnique({
      where: { id: userId },
      include: {
        adherent: {
          select: {
            firstname: true,
            lastname: true,
          },
        },
      },
    });

    if (!userToDelete) {
      return { success: false, error: "Utilisateur introuvable." };
    }

    if (userId === session.user.id) {
      return {
        success: false,
        error: "Vous ne pouvez pas supprimer votre propre compte.",
      };
    }

    if (userToDelete.role === "ADMIN") {
      return {
        success: false,
        error:
          "Vous ne pouvez pas supprimer un autre administrateur. Contactez le super-admin.",
      };
    }

    const userEmail = userToDelete.email;
    const userName = userToDelete.adherent
      ? `${userToDelete.adherent.firstname} ${userToDelete.adherent.lastname}`
      : userToDelete.name || "Utilisateur";

    if (notifyUser && userEmail) {
      try {
        const { sendAccountDeletionEmail } = await import("@/lib/mail");
        await sendAccountDeletionEmail(userEmail, userName, reason);
      } catch (emailError) {
        console.error(
          "Erreur lors de l'envoi de l'email de notification:",
          emailError
        );
        if (process.env.NODE_ENV === "production") {
          console.warn(
            "⚠️ Email de notification non envoyé, mais suppression continuée"
          );
        }
      }
    }

    try {
      if (!("suppressionAdherent" in db)) {
        console.error(
          "❌ Le modèle SuppressionAdherent n'est pas disponible dans le client Prisma. Veuillez redémarrer le serveur."
        );
        console.warn(
          "⚠️ Suppression effectuée sans historisation (client Prisma obsolète)"
        );
      } else {
        await db.suppressionAdherent.create({
          data: {
            userId: userId,
            userName: userName,
            userEmail: userEmail || null,
            userRole: userToDelete.role,
            adherentFirstName: userToDelete.adherent?.firstname || null,
            adherentLastName: userToDelete.adherent?.lastname || null,
            reason: reason,
            notifyUser: notifyUser,
            deletedBy: session.user.id,
            deletedByName: session.user.name || "ADMIN",
            deletedByEmail: session.user.email || null,
          },
        });
        console.log("✅ Suppression historisée avec succès");
      }
    } catch (historyError) {
      console.error(
        "❌ Erreur lors de l'historisation de la suppression:",
        historyError
      );
      console.warn(
        "⚠️ Suppression poursuivie sans historisation (erreur d'enregistrement)"
      );
    }

    // Notes frais (brouillons / garde-fou SOUMISE) + user.delete : même transaction.
    // Indépendant de NOTES_FRAIS_ENABLED. Pas de Completee RGPD si cette étape échoue.
    await deleteUserAtomicallyWithNotesFraisRgpd(userId);

    console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🗑️  SUPPRESSION D'ADHÉRENT - AUDIT LOG
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Date: ${new Date().toISOString()}
Admin: ${session.user.name} (${session.user.id})
Email Admin: ${session.user.email}

Adhérent supprimé:
- ID: ${userId}
- Nom: ${userName}
- Email: ${userEmail}
- Rôle: ${userToDelete.role}

Raison de suppression: ${reason}
Notification envoyée: ${notifyUser ? "OUI" : "NON"}

⚠️  SUPPRESSION IRRÉVERSIBLE - TOUTES LES DONNÉES ONT ÉTÉ SUPPRIMÉES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `);

    try {
      await logDeletion(
        `Suppression de l'adhérent ${userName}`,
        "User",
        userId,
        {
          reason,
          notifyUser,
          userRole: userToDelete.role,
        }
      );
    } catch (logError) {
      console.error("Erreur lors du logging de l'activité:", logError);
    }

    return {
      success: true,
      message: `L'adhérent ${userName} a été supprimé définitivement avec toutes ses données.${
        notifyUser && userEmail
          ? " Un email de notification a été envoyé."
          : ""
      }`,
    };
  } catch (error) {
    console.error("Erreur lors de la suppression de l'adhérent:", error);

    if (error instanceof NotesFraisRgpdBlockError) {
      return {
        success: false,
        error: error.message,
        code: error.code,
      };
    }

    if (
      error instanceof Error &&
      error.message.includes("foreign key constraint")
    ) {
      return {
        success: false,
        error:
          "Impossible de supprimer cet adhérent : des données liées existent encore. Contactez le support technique.",
      };
    }

    return {
      success: false,
      error:
        "Une erreur s'est produite lors de la suppression de l'adhérent. Vérifiez les logs serveur.",
    };
  } finally {
    revalidatePath("/admin/users");
  }
}
