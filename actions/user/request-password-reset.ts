"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";

/**
 * Demande une réinitialisation de mot de passe à l'admin
 * Crée une notification pour les administrateurs
 * 
 * @returns Un objet avec success (boolean), message (string) en cas de succès, 
 *          ou error (string) en cas d'échec
 */
export async function requestPasswordReset(): Promise<{ 
  success: boolean; 
  message?: string; 
  error?: string 
}> {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé. Vous devez être connecté." };
    }

    // Récupérer l'utilisateur avec ses informations
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { 
        id: true, 
        email: true, 
        name: true, 
        role: true 
      },
    });

    if (!user) {
      return { success: false, error: "Utilisateur non trouvé." };
    }

    // Vérifier que l'utilisateur n'est pas MEMBRE (les MEMBRE utilisent le système de réinitialisation par email)
    if (user.role === UserRole.MEMBRE) {
      return { 
        success: false, 
        error: "Les membres peuvent réinitialiser leur mot de passe via le lien envoyé par email." 
      };
    }

    // Récupérer tous les administrateurs
    // Filtrer les valeurs undefined au cas où certains rôles ne seraient pas encore disponibles
    const adminRoles = [
      UserRole.ADMIN, 
      UserRole.PRESID, 
      UserRole.VICEPR, 
      UserRole.SECRET, 
      UserRole.VICESE, 
      UserRole.COMCPT, 
      UserRole.TRESOR, 
      UserRole.VTRESO
    ].filter((role): role is UserRole => role !== undefined);

    const admins = await db.user.findMany({
      where: {
        role: { in: adminRoles },
      },
      select: { id: true },
    });

    if (admins.length === 0) {
      return { success: false, error: "Aucun administrateur trouvé pour traiter votre demande." };
    }

    // Créer une notification pour chaque administrateur
    const notifications = await db.notification.createMany({
      data: admins.map((admin) => ({
        userId: admin.id,
        type: "Systeme",
        titre: "Demande de réinitialisation de mot de passe",
        message: `${user.name || user.email} (${user.email}) a demandé une réinitialisation de son mot de passe. Rôle: ${user.role}`,
        lien: `/admin/users/${user.id}/edition`,
        lue: false,
      })),
      skipDuplicates: true,
    });

    revalidatePath("/notifications");
    revalidatePath("/admin/notifications");

    return {
      success: true,
      message: "Votre demande a été envoyée aux administrateurs. Vous serez contacté prochainement.",
    };
  } catch (error) {
    console.error("Erreur lors de la demande de réinitialisation:", error);
    return { 
      success: false, 
      error: "Une erreur est survenue lors de l'envoi de votre demande." 
    };
  }
}
