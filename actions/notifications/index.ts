"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { safeFindMany } from "@/lib/prisma-helpers";
import { revalidatePath } from "next/cache";
import { TypeNotification } from "@prisma/client";
import { z } from "zod";
import type { AuthContext } from "@/lib/auth-context";
import { isServiceError } from "@/lib/service-error";
import { getMyNotifications } from "@/lib/services/notifications/get-my-notifications";
import { getMyUnreadNotificationCount } from "@/lib/services/notifications/get-my-unread-count";
import { mapNotificationDtoForWebAction } from "@/lib/services/notifications/map-notification-for-web";
import { markMyNotificationAsRead } from "@/lib/services/notifications/mark-my-notification-as-read";
import { markAllMyNotificationsAsRead } from "@/lib/services/notifications/mark-all-my-notifications-as-read";
import { deleteMyNotification } from "@/lib/services/notifications/delete-my-notification";

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
 * AuthContext minimal pour lectures notifications self-service
 * (uniquement userId + role session — pas de resolver générique).
 */
function authContextFromSession(session: {
  user: { id: string; role?: string | null; email?: string | null; name?: string | null };
}): AuthContext {
  return {
    userId: session.user.id,
    role: (session.user.role || "MEMBRE").toString().trim().toUpperCase(),
    status: "Actif",
    email: session.user.email,
    name: session.user.name,
    sessionId: null,
    adminRoles: [],
    adherentId: null,
    channel: "web",
  };
}
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

    // Push après commit DB — best-effort (chat/paiements n'utilisent pas cette action)
    const { pushAfterInternalNotification } = await import(
      "@/lib/services/notifications/push-after-internal-notification"
    );
    void pushAfterInternalNotification(validatedData.userId, {
      titre: validatedData.titre,
      message: validatedData.message,
      lien: validatedData.lien,
    }).catch(() => {
      // déjà journalisé dans pushAfterInternalNotification
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
    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return { success: false, error: "Non autorisé. Admin requis." };
    }

    // Validation des données
    const validatedData = CreateNotificationsSchema.parse(data);

    // Vérifier que les userIds existent
    if (validatedData.userIds.length === 0) {
      return { success: false, error: "Aucun utilisateur sélectionné" };
    }

    // Vérifier que les utilisateurs existent dans la base de données
    const existingUsers = await db.user.findMany({
      where: {
        id: { in: validatedData.userIds },
      },
      select: { id: true },
    });

    if (existingUsers.length === 0) {
      return { success: false, error: "Aucun utilisateur valide trouvé" };
    }

    if (existingUsers.length !== validatedData.userIds.length) {
      const missingIds = validatedData.userIds.filter(
        (id) => !existingUsers.some((u) => u.id === id)
      );
      console.warn(`[Notifications] Certains utilisateurs n'existent pas:`, missingIds);
    }

    // Filtrer pour ne garder que les utilisateurs valides
    const validUserIds = existingUsers.map((u) => u.id);

    // Créer les notifications en batch
    const notifications = await db.notification.createMany({
      data: validUserIds.map((userId) => ({
        userId,
        type: validatedData.type,
        titre: validatedData.titre,
        message: validatedData.message,
        lien: validatedData.lien || null,
        lue: false,
      })),
      skipDuplicates: true, // Ignorer les doublons si nécessaire
    });

    // Push groupé après commit — best-effort, une fois par userId valide
    const { pushAfterInternalNotifications } = await import(
      "@/lib/services/notifications/push-after-internal-notification"
    );
    void pushAfterInternalNotifications(validUserIds, {
      titre: validatedData.titre,
      message: validatedData.message,
      lien: validatedData.lien,
    }).catch(() => {
      // déjà journalisé dans pushAfterInternalNotifications
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
      const errorMessage = error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ");
      console.error("[Notifications] Erreur de validation Zod:", errorMessage);
      return { success: false, error: `Erreur de validation: ${errorMessage}` };
    }
    
    // Gérer les erreurs Prisma spécifiques
    if (error && typeof error === "object" && "code" in error) {
      const prismaError = error as { code: string; message: string };
      console.error("[Notifications] Erreur Prisma:", prismaError.code, prismaError.message);
      
      if (prismaError.code === "P2002") {
        return { success: false, error: "Une notification similaire existe déjà" };
      }
      if (prismaError.code === "P2003") {
        return { success: false, error: "Un ou plusieurs utilisateurs sélectionnés n'existent pas" };
      }
      
      return { success: false, error: `Erreur de base de données: ${prismaError.message}` };
    }
    
    console.error("[Notifications] Erreur lors de la création des notifications:", error);
    const errorMessage = error instanceof Error ? error.message : "Erreur inconnue";
    return { success: false, error: `Erreur lors de la création des notifications: ${errorMessage}` };
  }
}

/**
 * Récupère les notifications de l'utilisateur connecté
 * Adapter Web → getMyNotifications (contrat public inchangé).
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

    const notificationsDto = await getMyNotifications(
      authContextFromSession(session),
      options
    );

    // Contrat Web historique : createdAt = Date (lignes Prisma), pas ISO string DTO
    const notifications = notificationsDto.map(mapNotificationDtoForWebAction);

    return {
      success: true,
      notifications,
    };
  } catch (error) {
    if (isServiceError(error)) {
      if (error.code === "UNAUTHENTICATED") {
        return { success: false, error: "Non autorisé" };
      }
      return { success: false, error: error.message };
    }
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
    if (!session?.user?.id || session.user.role !== "ADMIN") {
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
 * Adapter Web → getMyUnreadNotificationCount (contrat public inchangé).
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

    const count = await getMyUnreadNotificationCount(
      authContextFromSession(session)
    );

    return {
      success: true,
      count,
    };
  } catch (error) {
    if (isServiceError(error)) {
      if (error.code === "UNAUTHENTICATED") {
        return { success: false, error: "Non autorisé" };
      }
      return { success: false, error: error.message };
    }
    console.error("Erreur lors du comptage des notifications:", error);
    return { success: false, error: "Erreur lors du comptage des notifications" };
  }
}

/**
 * Marque une notification comme lue
 * Adapter Web → markMyNotificationAsRead (ownership actor.userId).
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

    await markMyNotificationAsRead(
      authContextFromSession(session),
      notificationId
    );

    revalidatePath("/notifications");
    revalidatePath("/");

    return {
      success: true,
      message: "Notification marquée comme lue",
    };
  } catch (error) {
    if (isServiceError(error)) {
      if (error.code === "UNAUTHENTICATED") {
        return { success: false, error: "Non autorisé" };
      }
      if (error.code === "NOT_FOUND") {
        return { success: false, error: "Notification non trouvée" };
      }
      return { success: false, error: error.message };
    }
    console.error("Erreur lors du marquage de la notification:", error);
    return { success: false, error: "Erreur lors du marquage de la notification" };
  }
}

/**
 * Marque toutes les notifications de l'utilisateur connecté comme lues
 * Adapter Web → markAllMyNotificationsAsRead.
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

    await markAllMyNotificationsAsRead(authContextFromSession(session));

    revalidatePath("/notifications");
    revalidatePath("/");

    return {
      success: true,
      message: "Toutes les notifications ont été marquées comme lues",
    };
  } catch (error) {
    if (isServiceError(error)) {
      if (error.code === "UNAUTHENTICATED") {
        return { success: false, error: "Non autorisé" };
      }
      return { success: false, error: error.message };
    }
    console.error("Erreur lors du marquage des notifications:", error);
    return { success: false, error: "Erreur lors du marquage des notifications" };
  }
}

/**
 * Supprime une notification
 * Adapter Web → deleteMyNotification (ownership actor.userId).
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

    await deleteMyNotification(
      authContextFromSession(session),
      notificationId
    );

    revalidatePath("/notifications");
    revalidatePath("/");

    return {
      success: true,
      message: "Notification supprimée avec succès",
    };
  } catch (error) {
    if (isServiceError(error)) {
      if (error.code === "UNAUTHENTICATED") {
        return { success: false, error: "Non autorisé" };
      }
      if (error.code === "NOT_FOUND") {
        return { success: false, error: "Notification non trouvée" };
      }
      return { success: false, error: error.message };
    }
    console.error("Erreur lors de la suppression de la notification:", error);
    return { success: false, error: "Erreur lors de la suppression de la notification" };
  }
}

