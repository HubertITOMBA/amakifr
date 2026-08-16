import type { NextRequest } from "next/server";
import { resolveApiActor } from "@/lib/api/auth-resolve";
import { apiSuccess, apiError } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import { parseMeNotificationsQuery } from "@/lib/api/validation/me-notifications-query";
import { getMyNotifications } from "@/lib/services/notifications/get-my-notifications";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/me/notifications — liste des notifications de l'acteur.
 * Query : lue, type, limit (max 100), offset.
 * Auth : Bearer mobile OU session Web (composite).
 */
export async function GET(request: NextRequest) {
  try {
    const actor = await resolveApiActor(request);
    if (!actor) {
      return apiError("UNAUTHENTICATED", "Non authentifié", 401);
    }

    const options = parseMeNotificationsQuery(request.nextUrl.searchParams);
    const notifications = await getMyNotifications(actor, options);
    return apiSuccess(notifications);
  } catch (error) {
    return handleApiError(error);
  }
}
