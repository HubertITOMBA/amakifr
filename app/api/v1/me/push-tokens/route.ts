import type { NextRequest } from "next/server";
import { resolveApiActor } from "@/lib/api/auth-resolve";
import { apiSuccess, apiError } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import {
  rejectMeIdorBody,
  rejectMeIdorSearchParams,
} from "@/lib/api/reject-me-idor";
import { registerMyPushToken } from "@/lib/services/push/register-my-push-token";
import { removeMyPushToken } from "@/lib/services/push/remove-my-push-token";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/me/push-tokens — enregistre / rattache le token Expo de l'appareil.
 * Body : { token, platform, deviceName? }
 */
export async function POST(request: NextRequest) {
  try {
    const actor = await resolveApiActor(request);
    if (!actor) return apiError("UNAUTHENTICATED", "Non authentifié", 401);
    rejectMeIdorSearchParams(request.nextUrl.searchParams);

    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    rejectMeIdorBody(body);

    const data = await registerMyPushToken(actor, {
      token: typeof body.token === "string" ? body.token : "",
      platform: typeof body.platform === "string" ? body.platform : "",
      deviceName:
        typeof body.deviceName === "string" ? body.deviceName : null,
    });
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/v1/me/push-tokens — détache le token de l'acteur courant.
 * Body : { token }
 */
export async function DELETE(request: NextRequest) {
  try {
    const actor = await resolveApiActor(request);
    if (!actor) return apiError("UNAUTHENTICATED", "Non authentifié", 401);
    rejectMeIdorSearchParams(request.nextUrl.searchParams);

    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    rejectMeIdorBody(body);

    const data = await removeMyPushToken(actor, {
      token: typeof body.token === "string" ? body.token : "",
    });
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}
