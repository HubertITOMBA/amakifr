"use server";

import { db } from "@/lib/db";
import { auth } from "@/auth";
import { UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { EmailProvider } from "@/lib/email/providers/types";

/**
 * Schéma de validation pour la mise à jour du provider email
 */
const UpdateEmailProviderSchema = z.object({
  provider: z.enum(["resend", "smtp"]),
});

/**
 * Récupère le provider email configuré dans la base de données
 * 
 * @returns Le provider email ou null si non configuré
 */
export async function getEmailProviderFromDB(): Promise<EmailProvider | null> {
  try {
    const setting = await db.appSettings.findUnique({
      where: { key: "email_provider" },
    });

    if (!setting) {
      return null;
    }

    const provider = setting.value as EmailProvider;
    if (["resend", "smtp"].includes(provider)) {
      return provider;
    }

    return null;
  } catch (error) {
    console.error("Erreur lors de la récupération du provider email:", error);
    return null;
  }
}

/**
 * Met à jour le provider email dans la base de données
 * 
 * @param data - Les données contenant le provider à configurer
 * @returns Un objet avec success (boolean) et message ou error
 */
export async function updateEmailProvider(
  data: z.infer<typeof UpdateEmailProviderSchema>
) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== UserRole.ADMIN) {
      return { success: false, error: "Non autorisé. Admin requis." };
    }

    const validatedData = UpdateEmailProviderSchema.parse(data);

    // Créer ou mettre à jour le paramètre
    await db.appSettings.upsert({
      where: { key: "email_provider" },
      update: {
        value: validatedData.provider,
        updatedBy: session.user.id,
        updatedAt: new Date(),
      },
      create: {
        key: "email_provider",
        value: validatedData.provider,
        description: "Provider email par défaut pour l'application (resend, smtp)",
        category: "email",
        updatedBy: session.user.id,
      },
    });

    revalidatePath("/admin/settings");

    return {
      success: true,
      message: `Provider email mis à jour : ${validatedData.provider}`,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    console.error("Erreur lors de la mise à jour du provider email:", error);
    return { success: false, error: "Erreur serveur" };
  }
}

/**
 * Récupère tous les paramètres d'une catégorie
 * 
 * @param category - La catégorie des paramètres à récupérer
 * @returns Un objet avec les paramètres
 */
export async function getSettingsByCategory(category: string) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== UserRole.ADMIN) {
      return { success: false, error: "Non autorisé. Admin requis." };
    }

    const settings = await db.appSettings.findMany({
      where: { category },
    });

    const result: Record<string, string> = {};
    for (const setting of settings) {
      result[setting.key] = setting.value;
    }

    return { success: true, data: result };
  } catch (error) {
    console.error("Erreur lors de la récupération des paramètres:", error);
    return { success: false, error: "Erreur serveur" };
  }
}

