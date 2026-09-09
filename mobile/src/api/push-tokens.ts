import { authenticatedFetch } from "@/auth/session";

export type RegisterPushTokenBody = {
  token: string;
  platform: "android" | "ios";
  deviceName?: string | null;
};

export type RegisterPushTokenResult = {
  id: string;
  token: string;
  platform: string;
  lastSeenAt: string;
};

export type RemovePushTokenResult = {
  removed: boolean;
};

/**
 * POST /api/v1/me/push-tokens
 */
export async function registerPushTokenApi(
  body: RegisterPushTokenBody
): Promise<RegisterPushTokenResult> {
  return authenticatedFetch<RegisterPushTokenResult>(
    "/api/v1/me/push-tokens",
    {
      method: "POST",
      body: {
        token: body.token,
        platform: body.platform,
        ...(body.deviceName ? { deviceName: body.deviceName } : {}),
      },
    }
  );
}

/**
 * DELETE /api/v1/me/push-tokens
 */
export async function unregisterPushTokenApi(
  token: string
): Promise<RemovePushTokenResult> {
  return authenticatedFetch<RemovePushTokenResult>("/api/v1/me/push-tokens", {
    method: "DELETE",
    body: { token },
  });
}
