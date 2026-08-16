import { authenticatedFetch } from "@/auth/session";
import type {
  DeleteNotificationResultDto,
  GetNotificationsOptions,
  MarkAllReadResultDto,
  MarkReadResultDto,
  NotificationDto,
  UnreadCountDto,
} from "@/api/types";

/**
 * Construit la query string GET notifications (jamais userId / adherentId).
 */
export function buildNotificationsQuery(
  options: GetNotificationsOptions = {}
): string {
  const params = new URLSearchParams();
  if (options.lue !== undefined) {
    params.set("lue", String(options.lue));
  }
  if (options.type) {
    params.set("type", options.type);
  }
  if (options.limit !== undefined) {
    params.set("limit", String(options.limit));
  }
  if (options.offset !== undefined) {
    params.set("offset", String(options.offset));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

/**
 * GET /api/v1/me/notifications
 */
export async function getNotifications(
  options: GetNotificationsOptions = { limit: 50, offset: 0 }
): Promise<NotificationDto[]> {
  const qs = buildNotificationsQuery(options);
  return authenticatedFetch<NotificationDto[]>(
    `/api/v1/me/notifications${qs}`
  );
}

/**
 * GET /api/v1/me/notifications/unread-count
 */
export async function getUnreadNotificationCount(): Promise<number> {
  const data = await authenticatedFetch<UnreadCountDto>(
    "/api/v1/me/notifications/unread-count"
  );
  return data.count;
}

/**
 * PATCH /api/v1/me/notifications/:id/read
 */
export async function markNotificationAsRead(
  id: string
): Promise<MarkReadResultDto> {
  return authenticatedFetch<MarkReadResultDto>(
    `/api/v1/me/notifications/${encodeURIComponent(id)}/read`,
    { method: "PATCH" }
  );
}

/**
 * POST /api/v1/me/notifications/read-all
 */
export async function markAllNotificationsAsRead(): Promise<MarkAllReadResultDto> {
  return authenticatedFetch<MarkAllReadResultDto>(
    "/api/v1/me/notifications/read-all",
    { method: "POST" }
  );
}

/**
 * DELETE /api/v1/me/notifications/:id
 */
export async function deleteNotification(
  id: string
): Promise<DeleteNotificationResultDto> {
  return authenticatedFetch<DeleteNotificationResultDto>(
    `/api/v1/me/notifications/${encodeURIComponent(id)}`,
    { method: "DELETE" }
  );
}
