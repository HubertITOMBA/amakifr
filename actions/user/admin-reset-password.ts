"use server"

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import crypto from "crypto";

/**
 * Génère un mot de passe temporaire sécurisé
 * Format: 3 lettres majuscules + 4 chiffres + 3 lettres minuscules (ex: ABC1234xyz)
 * 
 * @returns Un mot de passe temporaire de 10 caractères
 */
function generateTemporaryPassword(): string {
  const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // Sans I et O pour éviter confusion
  const numbers = '23456789'; // Sans 0 et 1 pour éviter confusion
  const lowercase = 'abcdefghjkmnpqrstuvwxyz'; // Sans i, l et o

  let password = '';
  
  // 3 lettres majuscules
  for (let i = 0; i < 3; i++) {
    password += uppercase[crypto.randomInt(0, uppercase.length)];
  }
  
  // 4 chiffres
  for (let i = 0; i < 4; i++) {
    password += numbers[crypto.randomInt(0, numbers.length)];
  }
  
  // 3 lettres minuscules
  for (let i = 0; i < 3; i++) {
    password += lowercase[crypto.randomInt(0, lowercase.length)];
  }
  
  return password;
}

/**
 * Réinitialise le mot de passe d'un utilisateur (réservé aux administrateurs)
 * Génère un nouveau mot de passe temporaire et l'envoie par email à l'utilisateur
 * 
 * @param userId - L'ID de l'utilisateur dont le mot de passe doit être réinitialisé
 * @returns Un objet avec success (boolean), message (string) en cas de succès,
 * ou error (string) en cas d'échec
 */
export async function adminResetUserPassword(userId: string) {
  try {
    // Vérifier que l'utilisateur connecté est admin
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return { 
        success: false, 
        error: "Non autorisé. Seuls les administrateurs peuvent réinitialiser les mots de passe." 
      };
    }

    // Vérifier que l'utilisateur existe
    const user = await db.user.findUnique({
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

    if (!user) {
      return { success: false, error: "Utilisateur introuvable." };
    }

    if (!user.email) {
      return { success: false, error: "Cet utilisateur n'a pas d'adresse email." };
    }

    // Empêcher la réinitialisation du mot de passe d'un autre admin (sécurité)
    if (user.role === "ADMIN" && user.id !== session.user.id) {
      return { 
        success: false, 
        error: "Vous ne pouvez pas réinitialiser le mot de passe d'un autre administrateur." 
      };
    }

    // Générer un nouveau mot de passe temporaire
    const temporaryPassword = generateTemporaryPassword();
    const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

    // Mettre à jour le mot de passe dans la base de données
    await db.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    // Envoyer l'email avec le nouveau mot de passe (non bloquant)
    try {
      const { sendPasswordResetByAdminEmail } = await import("@/lib/mail");
      const fullName = user.adherent 
        ? `${user.adherent.firstname} ${user.adherent.lastname}`
        : user.name || "Utilisateur";
      
      await sendPasswordResetByAdminEmail(
        user.email,
        fullName,
        temporaryPassword
      );
    } catch (emailError) {
      console.error("Erreur lors de l'envoi de l'email:", emailError);
      return {
        success: false,
        error: "Mot de passe réinitialisé mais l'email de notification n'a pas pu être envoyé. Veuillez communiquer le mot de passe manuellement."
      };
    }

    return {
      success: true,
      message: `Mot de passe réinitialisé avec succès. Un email a été envoyé à ${user.email}.`,
    };
  } catch (error) {
    console.error("Erreur lors de la réinitialisation du mot de passe:", error);
    return { 
      success: false, 
      error: "Une erreur s'est produite lors de la réinitialisation du mot de passe." 
    };
  } finally {
    revalidatePath("/admin/users");
  }
}
