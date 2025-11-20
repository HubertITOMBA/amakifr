"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { TypeNotification } from "@prisma/client";
import { z } from "zod";

const CreateNotificationSchema = z.object({
  userId: z.string().min(1, "ID utilisateur requis"),
  type: z.nativeEnum(TypeNotification),
  titre: z.string().min(1, "Titre requis").max(255, "Titre trop long"),
  message: z.string().min(1, "Message requis"),
  lien: z.string().max(500, "Lien trop long").optional(),
});

const CreateNotificationsSchema = z.object({
  userIds: z.array(z.string().min(1)).min(1, "Au moins un utilisateur requis"),
  type: z.nativeEnum(TypeNotification),
  titre: z.string().min(1, "Titre requis").max(255, "Titre trop long"),
  message: z.string().min(1, "Message requis"),
  lien: z.string().max(500, "Lien trop long").optional(),
});

/**
 * Crée une nouvelle notification pour un utilisateur
 * 
 * @param data - Les données de la notification
 * @returns Un objet avec success (boolean), message (string) en cas de succès, 
 *          ou error (string) en cas d'échec, et id (string) de la notification créée
 */
export async function createNotification(data: z.infer<typeof CreateNotificationSchema>) {
  try {
    const validatedData = CreateNotificationSchema.parse(data);

    const notification = await db.notification.create({
      data: {
        userId: validatedData.userId,
        type: validatedData.type,
        titre: validatedData.titre,
        message: validatedData.message,
        lien: validatedData.lien || null,
        lue: false,
      },
    });

    revalidatePath("/notifications");
    revalidatePath("/");

    return {
      success: true,
      message: "Notification créée avec succès",
      id: notification.id,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    console.error("Erreur lors de la création de la notification:", error);
    return { success: false, error: "Erreur lors de la création de la notification" };
  }
}

/**
 * Crée des notifications pour plusieurs utilisateurs
 * 
 * @param data - Les données des notifications (userIds est un tableau)
 * @returns Un objet avec success (boolean), message (string) en cas de succès, 
 *          ou error (string) en cas d'échec, et count (number) de notifications créées
 */
export async function createNotifications(data: z.infer<typeof CreateNotificationsSchema>) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "Admin") {
      return { success: false, error: "Non autorisé. Admin requis." };
    }

    const validatedData = CreateNotificationsSchema.parse(data);

    // Créer les notifications en batch
    const notifications = await db.notification.createMany({
      data: validatedData.userIds.map((userId) => ({
        userId,
        type: validatedData.type,
        titre: validatedData.titre,
        message: validatedData.message,
        lien: validatedData.lien || null,
        lue: false,
      })),
    });

    revalidatePath("/notifications");
    revalidatePath("/");
    revalidatePath("/admin/notifications");

    return {
      success: true,
      message: `${notifications.count} notification(s) créée(s) avec succès`,
      count: notifications.count,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    console.error("Erreur lors de la création des notifications:", error);
    return { success: false, error: "Erreur lors de la création des notifications" };
  }
}

/**
 * Récupère les notifications de l'utilisateur connecté
 * 
 * @param options - Options de filtrage et pagination
 * @returns Un objet avec success (boolean), notifications (array) en cas de succès, 
 *          ou error (string) en cas d'échec
 */
export async function getNotifications(options?: {
  lue?: boolean;
  type?: TypeNotification;
  limit?: number;
  offset?: number;
}) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    const where: any = {
      userId: session.user.id,
    };

    if (options?.lue !== undefined) {
      where.lue = options.lue;
    }

    if (options?.type) {
      where.type = options.type;
    }

    const notifications = await safeFindMany(db.notification.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
      take: options?.limit || 50,
      skip: options?.offset || 0,
    }));

    return {
      success: true,
      notifications,
    };
  } catch (error) {
    console.error("Erreur lors de la récupération des notifications:", error);
    return { success: false, error: "Erreur lors de la récupération des notifications" };
  }
}

/**
 * Récupère toutes les notifications (pour les administrateurs)
 * 
 * @param options - Options de filtrage et pagination
 * @returns Un objet avec success (boolean), notifications (array) en cas de succès, 
 *          ou error (string) en cas d'échec
 */
export async function getAllNotifications(options?: {
  lue?: boolean;
  type?: TypeNotification;
  limit?: number;
  offset?: number;
}) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "Admin") {
      return { success: false, error: "Non autorisé" };
    }

    const where: any = {};

    if (options?.lue !== undefined) {
      where.lue = options.lue;
    }

    if (options?.type) {
      where.type = options.type;
    }

    const notifications = await safeFindMany(db.notification.findMany({
      where,
      include: {
        User: {
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
      take: options?.limit || 100,
      skip: options?.offset || 0,
    }));

    return {
      success: true,
      notifications,
    };
  } catch (error) {
    console.error("Erreur lors de la récupération des notifications:", error);
    return { success: false, error: "Erreur lors de la récupération des notifications" };
  }
}

/**
 * Récupère le nombre de notifications non lues de l'utilisateur connecté
 * 
 * @returns Un objet avec success (boolean), count (number) en cas de succès, 
 *          ou error (string) en cas d'échec
 */
export async function getUnreadNotificationCount() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    const count = await db.notification.count({
      where: {
        userId: session.user.id,
        lue: false,
      },
    });

    return {
      success: true,
      count,
    };
  } catch (error) {
    console.error("Erreur lors du comptage des notifications:", error);
    return { success: false, error: "Erreur lors du comptage des notifications" };
  }
}

/**
 * Marque une notification comme lue
 * 
 * @param notificationId - L'ID de la notification à marquer comme lue
 * @returns Un objet avec success (boolean), message (string) en cas de succès, 
 *          ou error (string) en cas d'échec
 */
export async function markNotificationAsRead(notificationId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    // Vérifier que la notification appartient à l'utilisateur
    const notification = await db.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      return { success: false, error: "Notification non trouvée" };
    }

    if (notification.userId !== session.user.id) {
      return { success: false, error: "Non autorisé" };
    }

    await db.notification.update({
      where: { id: notificationId },
      data: { lue: true },
    });

    revalidatePath("/notifications");
    revalidatePath("/");

    return {
      success: true,
      message: "Notification marquée comme lue",
    };
  } catch (error) {
    console.error("Erreur lors du marquage de la notification:", error);
    return { success: false, error: "Erreur lors du marquage de la notification" };
  }
}

/**
 * Marque toutes les notifications de l'utilisateur connecté comme lues
 * 
 * @returns Un objet avec success (boolean), message (string) en cas de succès, 
 *          ou error (string) en cas d'échec
 */
export async function markAllNotificationsAsRead() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    await db.notification.updateMany({
      where: {
        userId: session.user.id,
        lue: false,
      },
      data: { lue: true },
    });

    revalidatePath("/notifications");
    revalidatePath("/");

    return {
      success: true,
      message: "Toutes les notifications ont été marquées comme lues",
    };
  } catch (error) {
    console.error("Erreur lors du marquage des notifications:", error);
    return { success: false, error: "Erreur lors du marquage des notifications" };
  }
}

/**
 * Supprime une notification
 * 
 * @param notificationId - L'ID de la notification à supprimer
 * @returns Un objet avec success (boolean), message (string) en cas de succès, 
 *          ou error (string) en cas d'échec
 */
export async function deleteNotification(notificationId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    // Vérifier que la notification appartient à l'utilisateur
    const notification = await db.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      return { success: false, error: "Notification non trouvée" };
    }

    if (notification.userId !== session.user.id) {
      return { success: false, error: "Non autorisé" };
    }

    await db.notification.delete({
      where: { id: notificationId },
    });

    revalidatePath("/notifications");
    revalidatePath("/");

    return {
      success: true,
      message: "Notification supprimée avec succès",
    };
  } catch (error) {
    console.error("Erreur lors de la suppression de la notification:", error);
    return { success: false, error: "Erreur lors de la suppression de la notification" };
  }
}

