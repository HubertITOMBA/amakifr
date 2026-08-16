import type { TypeNotification } from "@prisma/client";

/**
 * Options de lecture des notifications personnelles.
 */
export type GetMyNotificationsOptions = {
  lue?: boolean;
  type?: TypeNotification;
  limit?: number;
  offset?: number;
};

/**
 * DTO notification (JSON-safe) pour services partagés Web / futur mobile.
 */
export type NotificationDto = {
  id: string;
  userId: string;
  type: TypeNotification;
  titre: string;
  message: string;
  lien: string | null;
  lue: boolean;
  createdAt: string;
};
