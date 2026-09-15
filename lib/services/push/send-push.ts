import { db } from "@/lib/db";
import type {
  DetailedPushSendResult,
  ExpoPushHttpClient,
  ExpoPushMessage,
  ExpoPushSendResult,
  ExpoPushTicket,
  PushDeliveryDetail,
  PushErrorClass,
  PushMessagePayload,
} from "@/lib/services/push/types";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const BATCH_SIZE = 100;

/**
 * Client HTTP Expo Push par défaut (fetch).
 */
export function createDefaultExpoPushHttpClient(): ExpoPushHttpClient {
  return {
    async send(messages: ExpoPushMessage[]): Promise<ExpoPushTicket[]> {
      if (messages.length === 0) return [];
      const response = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(messages),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(
          `Expo Push HTTP ${response.status}${text ? `: ${text.slice(0, 200)}` : ""}`
        );
      }

      const json = (await response.json()) as {
        data?: ExpoPushTicket | ExpoPushTicket[];
      };
      const data = json.data;
      if (!data) return [];
      return Array.isArray(data) ? data : [data];
    },
  };
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

function redactExpoToken(token: string): string {
  if (token.length <= 16) return "<redacted>";
  return `${token.slice(0, 18)}…<redacted>`;
}

/**
 * Log DEV sanitizé du message Expo (jamais le token complet).
 */
export function sanitizeExpoPushMessageForLog(
  message: ExpoPushMessage
): Record<string, unknown> {
  return {
    to: redactExpoToken(message.to),
    title: message.title,
    body: message.body,
    sound: message.sound ?? null,
    channelId: message.channelId ?? null,
    priority: message.priority ?? null,
    data: message.data ?? null,
  };
}

/**
 * Log DEV sanitizé d'un ticket Expo.
 */
export function sanitizeExpoPushTicketForLog(
  ticket: ExpoPushTicket | undefined
): Record<string, unknown> {
  if (!ticket) return { status: "missing" };
  if (ticket.status === "ok") {
    return {
      status: "ok",
      idPresent: Boolean(ticket.id),
    };
  }
  return {
    status: "error",
    message: ticket.message?.slice(0, 160) ?? null,
    detailsError: ticket.details?.error ?? null,
  };
}

function isNodeDev(): boolean {
  return process.env.NODE_ENV !== "production";
}

/**
 * Classe une erreur ticket Expo via le code d'erreur (pas via des compteurs).
 */
export function classifyExpoTicketError(code?: string): PushErrorClass {
  if (code === "DeviceNotRegistered" || code === "InvalidCredentials") {
    return "definitive";
  }
  if (code === "MessageTooBig") {
    return "definitive";
  }
  return "temporary";
}

/**
 * Désactive les tokens définitivement invalides (DeviceNotRegistered).
 */
export async function disablePushTokens(tokens: string[]): Promise<number> {
  if (tokens.length === 0) return 0;
  const now = new Date();
  const result = await db.mobilePushToken.updateMany({
    where: {
      token: { in: tokens },
      disabledAt: null,
    },
    data: { disabledAt: now },
  });
  return result.count;
}

function summarizeDetailed(result: {
  attempted: number;
  ok: number;
  details: PushDeliveryDetail[];
}): DetailedPushSendResult["summary"] {
  if (result.attempted === 0) return "no_tokens";
  const hasTemp = result.details.some(
    (d) =>
      (d.kind === "ticket_error" && d.errorClass === "temporary") ||
      d.kind === "batch_transport_error"
  );
  const hasDef = result.details.some(
    (d) => d.kind === "ticket_error" && d.errorClass === "definitive"
  );
  if (result.ok === result.attempted) return "success";
  if (result.ok === 0 && hasTemp) return "all_failed_temporary";
  if (result.ok === 0 && hasDef && !hasTemp) return "all_failed_definitive";
  return "partial";
}

/**
 * Envoi push avec détails d'erreur classifiés (outbox notes-frais).
 * Ne remplace pas {@link sendPushToUsers}.
 */
export async function sendPushToUsersDetailed(
  userIds: string[],
  payload: PushMessagePayload,
  client: ExpoPushHttpClient = createDefaultExpoPushHttpClient()
): Promise<DetailedPushSendResult> {
  const uniqueIds = [...new Set(userIds.filter(Boolean))];
  if (uniqueIds.length === 0) {
    return {
      summary: "no_user_ids",
      attempted: 0,
      ok: 0,
      disabled: 0,
      details: [],
    };
  }

  const rows = await db.mobilePushToken.findMany({
    where: {
      userId: { in: uniqueIds },
      disabledAt: null,
    },
    select: { token: true, platform: true },
  });

  if (rows.length === 0) {
    return {
      summary: "no_tokens",
      attempted: 0,
      ok: 0,
      disabled: 0,
      details: [],
    };
  }

  const messages: ExpoPushMessage[] = rows.map((r) => ({
    to: r.token,
    title: payload.title,
    body: payload.body,
    data: payload.data,
    sound: "default",
    channelId: r.platform === "android" ? "amaki_alerts" : undefined,
    priority: "high",
  }));

  const details: PushDeliveryDetail[] = [];
  let ok = 0;
  const toDisable: string[] = [];

  for (const batch of chunk(messages, BATCH_SIZE)) {
    let tickets: ExpoPushTicket[];
    try {
      tickets = await client.send(batch);
    } catch (error) {
      const message =
        error instanceof Error ? error.message.slice(0, 200) : "transport_error";
      details.push({
        kind: "batch_transport_error",
        errorClass: "temporary",
        message,
        batchSize: batch.length,
      });
      continue;
    }

    for (let i = 0; i < batch.length; i++) {
      const ticket = tickets[i];
      const tokenRedacted = redactExpoToken(batch[i].to);
      if (!ticket) {
        details.push({
          kind: "ticket_error",
          tokenRedacted,
          errorClass: "temporary",
          message: "missing_ticket",
        });
        continue;
      }
      if (ticket.status === "ok") {
        ok += 1;
        details.push({ kind: "ok", tokenRedacted });
        continue;
      }
      const code = ticket.details?.error;
      const errorClass = classifyExpoTicketError(code);
      if (code === "DeviceNotRegistered") {
        toDisable.push(batch[i].to);
      }
      details.push({
        kind: "ticket_error",
        tokenRedacted,
        errorClass,
        code,
        message: ticket.message?.slice(0, 160),
      });
    }
  }

  let disabled = 0;
  try {
    disabled = await disablePushTokens(toDisable);
  } catch {
    // best-effort
  }

  const onlyTransport =
    details.length > 0 &&
    details.every((d) => d.kind === "batch_transport_error") &&
    ok === 0;

  return {
    summary: onlyTransport
      ? "transport_failed"
      : summarizeDetailed({ attempted: messages.length, ok, details }),
    attempted: messages.length,
    ok,
    disabled,
    details,
  };
}

/**
 * Envoie un push à tous les tokens actifs d'un user.
 * Best-effort : erreurs Expo loguées, jamais de throw métier.
 */
export async function sendPushToUser(
  userId: string,
  payload: PushMessagePayload,
  client: ExpoPushHttpClient = createDefaultExpoPushHttpClient()
): Promise<ExpoPushSendResult> {
  return sendPushToUsers([userId], payload, client);
}

/**
 * Envoie un push aux tokens actifs de plusieurs users.
 * Comportement historique conservé (y compris outer catch → compteurs à 0).
 */
export async function sendPushToUsers(
  userIds: string[],
  payload: PushMessagePayload,
  client: ExpoPushHttpClient = createDefaultExpoPushHttpClient()
): Promise<ExpoPushSendResult> {
  const uniqueIds = [...new Set(userIds.filter(Boolean))];
  const empty: ExpoPushSendResult = {
    attempted: 0,
    ok: 0,
    errors: 0,
    disabled: 0,
  };
  if (uniqueIds.length === 0) return empty;

  try {
    const rows = await db.mobilePushToken.findMany({
      where: {
        userId: { in: uniqueIds },
        disabledAt: null,
      },
      select: { token: true, platform: true },
    });

    if (rows.length === 0) return empty;

    const messages: ExpoPushMessage[] = rows.map((r) => ({
      to: r.token,
      title: payload.title,
      body: payload.body,
      data: payload.data,
      sound: "default",
      channelId: r.platform === "android" ? "amaki_alerts" : undefined,
      priority: "high",
    }));

    if (isNodeDev() && messages[0]) {
      console.log(
        "[PUSH_EXPO] payload sanitizé",
        sanitizeExpoPushMessageForLog(messages[0])
      );
    }

    let ok = 0;
    let errors = 0;
    const toDisable: string[] = [];

    for (const batch of chunk(messages, BATCH_SIZE)) {
      let tickets: ExpoPushTicket[];
      try {
        tickets = await client.send(batch);
      } catch (error) {
        console.error("[push] Expo send batch failed:", error);
        errors += batch.length;
        continue;
      }

      if (isNodeDev()) {
        console.log(
          "[PUSH_EXPO] tickets sanitizés",
          tickets.map((t) => sanitizeExpoPushTicketForLog(t))
        );
      }

      for (let i = 0; i < batch.length; i++) {
        const ticket = tickets[i];
        if (!ticket) {
          errors += 1;
          continue;
        }
        if (ticket.status === "ok") {
          ok += 1;
          continue;
        }
        errors += 1;
        const code = ticket.details?.error;
        if (code === "DeviceNotRegistered") {
          toDisable.push(batch[i].to);
        } else {
          console.error(
            "[push] Expo ticket error:",
            ticket.message,
            code ?? ""
          );
        }
      }
    }

    let disabled = 0;
    try {
      disabled = await disablePushTokens(toDisable);
    } catch (error) {
      console.error("[push] disable tokens failed:", error);
    }

    return {
      attempted: messages.length,
      ok,
      errors,
      disabled,
    };
  } catch (error) {
    console.error("[push] sendPushToUsers failed:", error);
    return empty;
  }
}
