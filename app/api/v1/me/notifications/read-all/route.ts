import type { NextRequest } from "next/server";
import { resolveApiActor } from "@/lib/api/auth-resolve";
import { apiSuccess, apiError } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import { markAllMyNotificationsAsRead } from "@/lib/services/notifications/mark-all-my-notifications-as-read";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/me/notifications/read-all — marque toutes les non lues comme lues.
 * count === 0 = succès. Pas de revalidatePath.
 */
export async function POST(request: NextRequest) {
  try {
    const actor = await resolveApiActor(request);
    if (!actor) {
      return apiError("UNAUTHENTICATED", "Non authentifié", 401);
    }

    const count = await markAllMyNotificationsAsRead(actor);
    return apiSuccess({ count });
  } catch (error) {
    return handleApiError(error);
  }
}
