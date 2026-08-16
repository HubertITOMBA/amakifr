import { resolveApiActorFromWebSession } from "@/lib/api/auth-web";
import { apiSuccess, apiError } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import { getMyUnreadNotificationCount } from "@/lib/services/notifications/get-my-unread-count";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/me/notifications/unread-count — nombre de notifications non lues.
 * Auth temporaire : session Web NextAuth.
 */
export async function GET() {
  try {
    const actor = await resolveApiActorFromWebSession();
    if (!actor) {
      return apiError("UNAUTHENTICATED", "Non authentifié", 401);
    }

    const count = await getMyUnreadNotificationCount(actor);
    return apiSuccess({ count });
  } catch (error) {
    return handleApiError(error);
  }
}
