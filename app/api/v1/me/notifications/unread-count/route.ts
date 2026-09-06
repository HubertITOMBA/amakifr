import type { NextRequest } from "next/server";
import { resolveApiActor } from "@/lib/api/auth-resolve";
import { apiSuccess, apiError } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import { ServiceError } from "@/lib/service-error";
import { getMyUnreadNotificationCount } from "@/lib/services/notifications/get-my-unread-count";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/me/notifications/unread-count — nombre de notifications non lues.
 * Auth : Bearer mobile OU session Web (composite).
 * Refuse userId / adherentId en query (ownership via actor uniquement).
 */
export async function GET(request: NextRequest) {
  try {
    const actor = await resolveApiActor(request);
    if (!actor) {
      return apiError("UNAUTHENTICATED", "Non authentifié", 401);
    }

    const { searchParams } = request.nextUrl;
    if (searchParams.has("userId") || searchParams.has("adherentId")) {
      throw new ServiceError(
        "VALIDATION_ERROR",
        "Paramètres userId et adherentId non autorisés"
      );
    }

    const count = await getMyUnreadNotificationCount(actor);
    return apiSuccess({ count });
  } catch (error) {
    return handleApiError(error);
  }
}
