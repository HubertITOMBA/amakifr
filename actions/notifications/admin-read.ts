"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { TypeNotification } from "@prisma/client";
import { z } from "zod";

const AdminNotificationsPageSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  search: z.string().trim().max(200).optional(),
  type: z.nativeEnum(TypeNotification).optional(),
  lue: z.boolean().optional(),
});

const AdminNotificationIdSchema = z.object({
  id: z.string().trim().min(1, "Identifiant requis").max(64),
});

export type AdminNotificationListItem = {
  id: string;
  type: TypeNotification;
  titre: string;
  lue: boolean;
  createdAt: string;
  userId: string;
  User: {
    id: string;
    name: string | null;
    email: string | null;
  } | null;
};

export type AdminNotificationDetails = {
  id: string;
  type: TypeNotification;
  titre: string;
  message: string;
  lien: string | null;
  lue: boolean;
  createdAt: string;
  userId: string;
  User: {
    id: string;
    name: string | null;
    email: string | null;
  } | null;
};

function requireAdminSession() {
  return auth().then((session) => {
    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return null;
    }
    return session;
  });
}

/**
 * Construit le filtre Prisma partagé entre findMany et count.
 */
function buildAdminNotificationsWhere(input: {
  search?: string;
  type?: TypeNotification;
  lue?: boolean;
}) {
  const where: Record<string, unknown> = {};

  if (input.type !== undefined) {
    where.type = input.type;
  }

  if (input.lue !== undefined) {
    where.lue = input.lue;
  }

  const search = input.search?.trim();
  // Minimum 2 caractères ; message exclu (non visible dans le tableau)
  if (search && search.length >= 2) {
    where.OR = [
      { titre: { contains: search, mode: "insensitive" } },
      { User: { name: { contains: search, mode: "insensitive" } } },
      { User: { email: { contains: search, mode: "insensitive" } } },
    ];
  }

  return where;
}

/**
 * Liste paginée des notifications pour l'administration (lecture seule).
 * Payload léger : pas de message complet.
 *
 * @param options - page, pageSize, search, type, lue
 */
export async function getAdminNotificationsPage(options?: {
  page?: number;
  pageSize?: number;
  search?: string;
  type?: TypeNotification;
  lue?: boolean;
}) {
  try {
    const session = await requireAdminSession();
    if (!session) {
      return { success: false as const, error: "Non autorisé" };
    }

    const parsed = AdminNotificationsPageSchema.safeParse(options ?? {});
    if (!parsed.success) {
      return {
        success: false as const,
        error: parsed.error.errors[0]?.message || "Paramètres invalides",
      };
    }

    const { page, pageSize, search, type, lue } = parsed.data;
    const where = buildAdminNotificationsWhere({ search, type, lue });
    const skip = (page - 1) * pageSize;

    const [total, rows] = await Promise.all([
      db.notification.count({ where }),
      db.notification.findMany({
        where,
        select: {
          id: true,
          type: true,
          titre: true,
          lue: true,
          createdAt: true,
          userId: true,
          User: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip,
        take: pageSize,
      }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    const notifications: AdminNotificationListItem[] = rows.map((row) => ({
      id: row.id,
      type: row.type,
      titre: row.titre,
      lue: row.lue,
      createdAt: row.createdAt.toISOString(),
      userId: row.userId,
      User: row.User
        ? {
            id: row.User.id,
            name: row.User.name,
            email: row.User.email,
          }
        : null,
    }));

    return {
      success: true as const,
      notifications,
      total,
      page,
      pageSize,
      totalPages,
    };
  } catch (error) {
    console.error("[getAdminNotificationsPage] Erreur:", error);
    return {
      success: false as const,
      error: "Erreur lors de la récupération des notifications",
    };
  }
}

/**
 * Détail d'une notification pour consultation ADMIN (lecture seule).
 *
 * @param id - Identifiant de la notification
 */
export async function getAdminNotificationDetails(id: string) {
  try {
    const session = await requireAdminSession();
    if (!session) {
      return { success: false as const, error: "Non autorisé" };
    }

    const parsed = AdminNotificationIdSchema.safeParse({ id });
    if (!parsed.success) {
      return { success: false as const, error: "Notification introuvable" };
    }

    const row = await db.notification.findUnique({
      where: { id: parsed.data.id },
      select: {
        id: true,
        type: true,
        titre: true,
        message: true,
        lien: true,
        lue: true,
        createdAt: true,
        userId: true,
        User: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!row) {
      return { success: false as const, error: "Notification introuvable" };
    }

    const notification: AdminNotificationDetails = {
      id: row.id,
      type: row.type,
      titre: row.titre,
      message: row.message,
      lien: row.lien,
      lue: row.lue,
      createdAt: row.createdAt.toISOString(),
      userId: row.userId,
      User: row.User
        ? {
            id: row.User.id,
            name: row.User.name,
            email: row.User.email,
          }
        : null,
    };

    return { success: true as const, notification };
  } catch (error) {
    console.error("[getAdminNotificationDetails] Erreur:", error);
    return {
      success: false as const,
      error: "Erreur lors de la récupération de la notification",
    };
  }
}
