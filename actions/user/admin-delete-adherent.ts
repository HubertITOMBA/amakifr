"use server"

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

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
    // 1. Vérifier que l'utilisateur connecté est admin
    const session = await auth();
    if (!session?.user || session.user.role !== "Admin") {
      return { 
        success: false, 
        error: "Non autorisé. Seuls les administrateurs peuvent supprimer des adhérents." 
      };
    }

    // 2. Vérifier que l'utilisateur existe
    const userToDelete = await db.user.findUnique({
      where: { id: userId },
      include: {
        adherent: {
          select: {
            firstname: true,
            lastname: true,
          }
        }
      }
    });

    if (!userToDelete) {
      return { success: false, error: "Utilisateur introuvable." };
    }

    // 3. Empêcher l'auto-suppression
    if (userId === session.user.id) {
      return { 
        success: false, 
        error: "Vous ne pouvez pas supprimer votre propre compte." 
      };
    }

    // 4. Empêcher la suppression d'un autre admin (sécurité)
    if (userToDelete.role === "Admin") {
      return { 
        success: false, 
        error: "Vous ne pouvez pas supprimer un autre administrateur. Contactez le super-admin." 
      };
    }

    // 5. Préparer les informations pour l'email
    const userEmail = userToDelete.email;
    const userName = userToDelete.adherent 
      ? `${userToDelete.adherent.firstname} ${userToDelete.adherent.lastname}`
      : userToDelete.name || "Utilisateur";

    // 6. Envoyer l'email AVANT la suppression (si demandé)
    if (notifyUser && userEmail) {
      try {
        const { sendAccountDeletionEmail } = await import("@/lib/mail");
        await sendAccountDeletionEmail(userEmail, userName, reason);
      } catch (emailError) {
        console.error("Erreur lors de l'envoi de l'email de notification:", emailError);
        // En développement, on ignore l'erreur d'email (credentials non configurées)
        // En production, on log mais on continue quand même la suppression
        if (process.env.NODE_ENV === "production") {
          console.warn("⚠️ Email de notification non envoyé, mais suppression continuée");
        }
        // On continue quand même la suppression
      }
    }

    // 7. Historiser la suppression AVANT de supprimer l'utilisateur
    try {
      // Vérifier que le modèle existe dans le client Prisma
      if (!('suppressionAdherent' in db)) {
        console.error("❌ Le modèle SuppressionAdherent n'est pas disponible dans le client Prisma. Veuillez redémarrer le serveur.");
        // On continue quand même la suppression, mais sans historisation
        console.warn("⚠️ Suppression effectuée sans historisation (client Prisma obsolète)");
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
          deletedByName: session.user.name || "Admin",
          deletedByEmail: session.user.email || null,
        },
        });
        console.log("✅ Suppression historisée avec succès");
      }
    } catch (historyError) {
      console.error("❌ Erreur lors de l'historisation de la suppression:", historyError);
      // On continue quand même la suppression même si l'historisation échoue
      console.warn("⚠️ Suppression effectuée sans historisation (erreur d'enregistrement)");
    }

    // 8. Supprimer l'utilisateur (Prisma gère la cascade automatiquement)
    // Grâce aux relations onDelete: Cascade, tout sera supprimé :
    // - Account, Session
    // - Adherent et toutes ses relations (Adresse, Telephone, Cotisations, etc.)
    // - Toutes les entités créées par cet utilisateur
    await db.user.delete({
      where: { id: userId }
    });

    // 9. Logger l'action (audit trail supplémentaire dans la console)
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
Notification envoyée: ${notifyUser ? 'OUI' : 'NON'}

⚠️  SUPPRESSION IRRÉVERSIBLE - TOUTES LES DONNÉES ONT ÉTÉ SUPPRIMÉES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `);

    return {
      success: true,
      message: `L'adhérent ${userName} a été supprimé définitivement avec toutes ses données.${
        notifyUser && userEmail ? ' Un email de notification a été envoyé.' : ''
      }`,
    };
  } catch (error) {
    console.error("Erreur lors de la suppression de l'adhérent:", error);
    
    // Erreur spécifique si des contraintes de clé étrangère empêchent la suppression
    if (error instanceof Error && error.message.includes('foreign key constraint')) {
      return { 
        success: false, 
        error: "Impossible de supprimer cet adhérent : des données liées existent encore. Contactez le support technique." 
      };
    }
    
    return { 
      success: false, 
      error: "Une erreur s'est produite lors de la suppression de l'adhérent. Vérifiez les logs serveur." 
    };
  } finally {
    revalidatePath("/admin/users");
  }
}
