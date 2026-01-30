"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { sendCustomEmailToUsers } from "@/lib/mail";

const CreateEmailsSchema = z.object({
  userIds: z.array(z.string().min(1)).min(1, "Au moins un utilisateur requis"),
  subject: z.string().min(1, "Objet requis").max(255, "Objet trop long"),
  body: z.string().min(1, "Corps de l'email requis"),
});

/**
 * Envoie des emails à plusieurs utilisateurs et enregistre l'historique
 * 
 * @param data - Les données des emails (userIds est un tableau)
 * @returns Un objet avec success (boolean), message (string) en cas de succès, 
 *          ou error (string) en cas d'échec, et count (number) d'emails envoyés
 */
export async function sendEmails(data: z.infer<typeof CreateEmailsSchema>) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé." };
    }
    const { canWrite } = await import("@/lib/dynamic-permissions");
    const hasAccess = await canWrite(session.user.id, "sendEmails");
    if (!hasAccess) {
      return { success: false, error: "Non autorisé. Droit d'envoi de mails requis." };
    }

    // Validation des données
    const validatedData = CreateEmailsSchema.parse(data);

    // Vérifier que les userIds existent
    if (validatedData.userIds.length === 0) {
      return { success: false, error: "Aucun utilisateur sélectionné" };
    }

    // Vérifier que les utilisateurs existent dans la base de données
    const existingUsers = await db.user.findMany({
      where: {
        id: { in: validatedData.userIds },
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

    if (existingUsers.length === 0) {
      return { success: false, error: "Aucun utilisateur valide trouvé" };
    }

    if (existingUsers.length !== validatedData.userIds.length) {
      const missingIds = validatedData.userIds.filter(
        (id) => !existingUsers.some((u) => u.id === id)
      );
      console.warn(`[Emails] Certains utilisateurs n'existent pas:`, missingIds);
    }

    // Filtrer pour ne garder que les utilisateurs valides avec email
    const validUsers = existingUsers.filter((u) => u.email && u.email.trim().length > 0);

    if (validUsers.length === 0) {
      return { success: false, error: "Aucun utilisateur avec adresse email valide" };
    }

    // Envoyer les emails et enregistrer l'historique
    let sentCount = 0;
    let failedCount = 0;
    const errors: string[] = [];
    const totalUsers = validUsers.length;

    console.log(`[Emails] Début de l'envoi de ${totalUsers} email(s)`);

    for (let i = 0; i < validUsers.length; i++) {
      const user = validUsers[i];
      try {
        const userName = user.adherent
          ? `${user.adherent.civility || ""} ${user.adherent.firstname || ""} ${user.adherent.lastname || ""}`.trim() || user.name || "Adhérent"
          : user.name || "Adhérent";

        console.log(`[Emails] Envoi ${i + 1}/${totalUsers} à ${user.email}`);
        
        // Envoyer l'email
        await sendCustomEmailToUsers(
          user.email!,
          userName,
          validatedData.subject,
          validatedData.body
        );

        // Enregistrer l'historique avec succès
        await db.email.create({
          data: {
            userId: user.id,
            createdBy: session.user.id,
            subject: validatedData.subject,
            body: validatedData.body,
            recipientEmail: user.email!,
            sent: true,
          },
        });

        sentCount++;
        console.log(`[Emails] ✓ Email ${i + 1}/${totalUsers} envoyé avec succès`);
        
        // Attendre 2 secondes avant d'envoyer le prochain email (sauf pour le dernier)
        // Pour éviter l'erreur 429 (rate limit: 2 requêtes par seconde)
        if (i < validUsers.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (error: any) {
        failedCount++;
        const errorMsg = error.message || "Erreur inconnue";
        errors.push(`Erreur pour ${user.email}: ${errorMsg}`);
        console.error(`[Emails] ✗ Erreur pour l'email ${i + 1}/${totalUsers}:`, errorMsg, error);
        
        // Enregistrer l'historique avec erreur
        try {
          await db.email.create({
            data: {
              userId: user.id,
              createdBy: session.user.id,
              subject: validatedData.subject,
              body: validatedData.body,
              recipientEmail: user.email || "",
              sent: false,
              error: errorMsg,
            },
          });
        } catch (dbError) {
          console.error(`[Emails] Erreur lors de l'enregistrement de l'historique:`, dbError);
        }
        
        // Attendre quand même 2 secondes même en cas d'erreur pour éviter le rate limit
        if (i < validUsers.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }

    console.log(`[Emails] Envoi terminé: ${sentCount} succès, ${failedCount} échecs`);

    revalidatePath("/admin/emails");
    revalidatePath("/");

    if (sentCount === 0) {
      return {
        success: false,
        error: `Aucun email n'a pu être envoyé. ${errors.join("; ")}`,
        count: 0,
        sentCount: 0,
        failedCount,
      };
    }

    return {
      success: true,
      message: `${sentCount} email(s) envoyé(s) avec succès${failedCount > 0 ? ` (${failedCount} échec(s))` : ""}`,
      count: sentCount,
      sentCount,
      failedCount,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    console.error("Erreur lors de l'envoi des emails:", error);
    return { success: false, error: "Erreur lors de l'envoi des emails" };
  }
}

/**
 * Récupère tous les emails envoyés avec pagination et filtres
 * 
 * @param options - Options de filtrage et pagination
 * @returns Un objet avec success (boolean) et emails (array) ou error (string)
 */
export async function getAllEmails(options?: {
  limit?: number;
  offset?: number;
  userId?: string;
  createdBy?: string;
  sent?: boolean;
}) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return { success: false, error: "Non autorisé. Admin requis." };
    }

    const limit = options?.limit || 100;
    const offset = options?.offset || 0;

    const where: any = {};
    if (options?.userId) where.userId = options.userId;
    if (options?.createdBy) where.createdBy = options.createdBy;
    if (options?.sent !== undefined) where.sent = options.sent;

    const emails = await db.email.findMany({
      where,
      include: {
        User: {
          select: {
            id: true,
            name: true,
            email: true,
            adherent: {
              select: {
                firstname: true,
                lastname: true,
              },
            },
          },
        },
        CreatedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: limit,
      skip: offset,
    });

    const total = await db.email.count({ where });

    return {
      success: true,
      emails,
      total,
    };
  } catch (error) {
    console.error("Erreur lors de la récupération des emails:", error);
    return { success: false, error: "Erreur lors de la récupération des emails" };
  }
}

/**
 * Supprime un email de l'historique
 * 
 * @param emailId - L'ID de l'email à supprimer
 * @returns Un objet avec success (boolean) et message (string) ou error (string)
 */
export async function deleteEmail(emailId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return { success: false, error: "Non autorisé. Admin requis." };
    }

    await db.email.delete({
      where: { id: emailId },
    });

    revalidatePath("/admin/emails");

    return {
      success: true,
      message: "Email supprimé de l'historique",
    };
  } catch (error) {
    console.error("Erreur lors de la suppression de l'email:", error);
    return { success: false, error: "Erreur lors de la suppression de l'email" };
  }
}
