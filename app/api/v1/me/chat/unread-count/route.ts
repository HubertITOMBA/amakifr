import type { NextRequest } from "next/server";
import { resolveApiActor } from "@/lib/api/auth-resolve";
import { apiSuccess, apiError } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import { getMyChatUnreadCount } from "@/lib/services/chat/get-my-conversations";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/me/chat/unread-count
 */
export async function GET(request: NextRequest) {
  try {
    const actor = await resolveApiActor(request);
    if (!actor) return apiError("UNAUTHENTICATED", "Non authentifié", 401);
    const data = await getMyChatUnreadCount(actor);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}
