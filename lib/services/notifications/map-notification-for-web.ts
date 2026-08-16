import type { NotificationDto } from "@/lib/services/notifications/types";

/**
 * Adaptateur DTO service → contrat historique Web de getNotifications().
 * Avant Phase 2D, createdAt était un Date Prisma côté Server Action.
 * NotificationDto.createdAt reste une string ISO dans le service.
 */
export type WebNotification = Omit<NotificationDto, "createdAt"> & {
  createdAt: Date;
};

/**
 * Convertit un NotificationDto (ISO) vers le shape Web historique (createdAt: Date).
 *
 * @param dto - Notification issue du service partagé
 * @returns Notification compatible avec le contrat pré-Phase 2D de getNotifications()
 */
export function mapNotificationDtoForWebAction(
  dto: NotificationDto
): WebNotification {
  return {
    ...dto,
    createdAt: new Date(dto.createdAt),
  };
}
