/**
 * Types push Expo (self-service + envoi serveur).
 */

export type MobilePushPlatform = "android" | "ios";

export type RegisterMyPushTokenInput = {
  token: string;
  platform: string;
  deviceName?: string | null;
};

export type RegisterMyPushTokenResultDto = {
  id: string;
  token: string;
  platform: string;
  lastSeenAt: string;
};

export type RemoveMyPushTokenInput = {
  token: string;
};

export type RemoveMyPushTokenResultDto = {
  removed: boolean;
};

export type PushMessagePayload = {
  title: string;
  body: string;
  data?: Record<string, string>;
};

export type ExpoPushTicket =
  | { status: "ok"; id: string }
  | { status: "error"; message: string; details?: { error?: string } };

export type ExpoPushSendResult = {
  attempted: number;
  ok: number;
  errors: number;
  disabled: number;
};

/**
 * Client HTTP injectable pour l'API Expo Push (tests sans réseau).
 */
export type ExpoPushHttpClient = {
  send: (messages: ExpoPushMessage[]) => Promise<ExpoPushTicket[]>;
};

export type ExpoPushMessage = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  sound?: "default" | null;
  channelId?: string;
  /** Priorité livraison Expo/FCM — distincte de l'importance du channel Android. */
  priority?: "default" | "normal" | "high";
};
