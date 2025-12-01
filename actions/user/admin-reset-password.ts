"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { sendAdminPasswordResetEmail } from "@/lib/mail";

/**
 * Génère un mot de passe sécurisé aléatoire
 * @param length - Longueur du mot de passe (défaut: 12)
 * @returns Mot de passe généré
 */
function generatePassword(length: number = 12): string {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  
  // S'assurer qu'il y a au moins une majuscule, une minuscule, un chiffre et un caractère spécial
  password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)];
  password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)];
  password += '0123456789'[Math.floor(Math.random() * 10)];
  password += '!@#$%^&*'[Math.floor(Math.random() * 8)];
  
  // Remplir le reste avec des caractères aléatoires
  for (let i = password.length; i < length; i++) {
    password += charset[Math.floor(Math.random() * charset.length)];
  }
  
  // Mélanger le mot de passe
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

/**
 * Réinitialise le mot de passe d'un utilisateur et lui envoie le nouveau mot de passe par email
 * (Admin uniquement)
 * 
 * @param userId - L'ID de l'utilisateur dont le mot de passe doit être réinitialisé
 * @returns Un objet avec success (boolean), message (string) en cas de succès, ou error (string) en cas d'échec
 */
export async function adminResetUserPassword(
  userId: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    // Vérifier que l'utilisateur est connecté et est admin
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    const adminUser = await db.user.findUnique({
      where: { id: session.user.id },
    });

    if (!adminUser || adminUser.role !== "Admin") {
      return { success: false, error: "Seuls les administrateurs peuvent réinitialiser les mots de passe" };
    }

    // Récupérer l'utilisateur cible
    const targetUser = await db.user.findUnique({
      where: { id: userId },
      include: {
        adherent: true,
      },
    });

    if (!targetUser) {
      return { success: false, error: "Utilisateur introuvable" };
    }

    if (!targetUser.email) {
      return { success: false, error: "L'utilisateur n'a pas d'email associé" };
    }

    // Générer un nouveau mot de passe sécurisé
    const newPassword = generatePassword(12);

    // Hasher le mot de passe
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Mettre à jour le mot de passe dans la base de données
    await db.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
      },
    });

    // Préparer le nom de l'utilisateur pour l'email
    const userName = targetUser.adherent
      ? `${targetUser.adherent.firstname || ''} ${targetUser.adherent.lastname || ''}`.trim() || targetUser.name || "Utilisateur"
      : targetUser.name || "Utilisateur";

    // Envoyer le nouveau mot de passe par email
    try {
      console.log(`[adminResetUserPassword] Tentative d'envoi d'email à ${targetUser.email}`);
      await sendAdminPasswordResetEmail(
        targetUser.email,
        userName,
        newPassword
      );
      console.log(`[adminResetUserPassword] Email envoyé avec succès à ${targetUser.email}`);
    } catch (emailError: any) {
      console.error("[adminResetUserPassword] Erreur lors de l'envoi de l'email:", {
        email: targetUser.email,
        error: emailError,
        message: emailError?.message,
        stack: emailError?.stack,
      });
      // Ne pas échouer complètement si l'email n'a pas pu être envoyé
      // Le mot de passe a déjà été changé dans la base de données
      const errorMessage = emailError?.message || emailError?.toString() || "Erreur inconnue";
      return {
        success: false,
        error: `Le mot de passe a été réinitialisé mais l'email n'a pas pu être envoyé à ${targetUser.email}. Veuillez contacter l'utilisateur manuellement. Erreur: ${errorMessage}`,
      };
    }

    return {
      success: true,
      message: `Le mot de passe a été réinitialisé et envoyé par email à ${targetUser.email}`,
    };
  } catch (error: any) {
    console.error("Erreur lors de la réinitialisation du mot de passe:", error);
    return {
      success: false,
      error: "Une erreur s'est produite lors de la réinitialisation du mot de passe",
    };
  }
}

