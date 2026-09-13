import {
  sendPushToUser,
  sendPushToUsers,
} from "@/lib/services/push/send-push";
import type { PushMessagePayload } from "@/lib/services/push/types";

const PUSH_BODY_MAX = 160;

export type InternalNotificationPushInput = {
  titre: string;
  message: string;
  lien?: string | null;
};

/**
 * Tronque le corps push (les messages DB / rappels peuvent être longs).
 */
export function truncatePushBody(message: string, max = PUSH_BODY_MAX): string {
  const normalized = message.replace(/\s+/g, " ").trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

/**
 * Construit le payload Expo à partir d'une notification interne.
 * data.url = lien métier ou fallback centre de notifications.
 */
export function buildPushPayloadFromInternalNotification(
  input: InternalNotificationPushInput
): PushMessagePayload {
  const url =
    typeof input.lien === "string" && input.lien.trim()
      ? input.lien.trim()
      : "/notifications";

  return {
    title: input.titre.trim() || "AMAKI",
    body: truncatePushBody(input.message),
    data: { url },
  };
}

/**
 * Envoie un push best-effort après création DB.
 * Ne throw jamais — l'échec push ne doit pas impacter le métier.
 *
 * @returns Promise du résultat (utile pour les tests) ; les callers métier peuvent void.
 */
export async function pushAfterInternalNotification(
  userId: string,
  input: InternalNotificationPushInput
): Promise<void> {
  if (!userId?.trim()) return;
  const payload = buildPushPayloadFromInternalNotification(input);
  try {
    await sendPushToUser(userId, payload);
  } catch (error) {
    console.error("[notifications] push after create failed");
    if (process.env.NODE_ENV !== "production") {
      console.error(error);
    }
  }
}

/**
 * Envoi groupé best-effort (admin createNotifications).
 */
export async function pushAfterInternalNotifications(
  userIds: string[],
  input: InternalNotificationPushInput
): Promise<void> {
  const ids = [...new Set(userIds.filter((id) => Boolean(id?.trim())))];
  if (ids.length === 0) return;
  const payload = buildPushPayloadFromInternalNotification(input);
  try {
    await sendPushToUsers(ids, payload);
  } catch (error) {
    console.error("[notifications] push after createMany failed");
    if (process.env.NODE_ENV !== "production") {
      console.error(error);
    }
  }
}
