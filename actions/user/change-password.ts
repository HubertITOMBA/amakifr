"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { ChangePasswordSchema } from "@/schemas";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";

/**
 * Change le mot de passe de l'utilisateur connecté
 * 
 * @param formData - Les données du formulaire contenant le mot de passe actuel, le nouveau mot de passe et sa confirmation
 * @returns Un objet avec success (boolean), message (string) en cas de succès, 
 *          ou error (string) en cas d'échec
 */
export async function changePassword(
  formData: FormData
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé. Vous devez être connecté." };
    }

    const rawData = {
      currentPassword: formData.get("currentPassword") as string,
      newPassword: formData.get("newPassword") as string,
      confirmPassword: formData.get("confirmPassword") as string,
    };

    // Valider les données avec Zod
    const validatedData = ChangePasswordSchema.parse(rawData);

    // Récupérer l'utilisateur avec son mot de passe
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, password: true, email: true },
    });

    if (!user || !user.password) {
      return { success: false, error: "Utilisateur non trouvé ou mot de passe non défini." };
    }

    // Vérifier que le mot de passe actuel est correct
    const isCurrentPasswordValid = await bcrypt.compare(
      validatedData.currentPassword,
      user.password
    );

    if (!isCurrentPasswordValid) {
      return { success: false, error: "Le mot de passe actuel est incorrect." };
    }

    // Vérifier que le nouveau mot de passe est différent de l'ancien
    const isSamePassword = await bcrypt.compare(
      validatedData.newPassword,
      user.password
    );

    if (isSamePassword) {
      return { success: false, error: "Le nouveau mot de passe doit être différent de l'ancien." };
    }

    // Hasher le nouveau mot de passe
    const hashedPassword = await bcrypt.hash(validatedData.newPassword, 10);

    // Mettre à jour le mot de passe
    await db.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
      },
    });

    return {
      success: true,
      message: "Votre mot de passe a été modifié avec succès.",
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    console.error("Erreur lors du changement de mot de passe:", error);
    return { success: false, error: "Une erreur est survenue lors du changement de mot de passe." };
  } finally {
    revalidatePath("/user/profile");
  }
}

