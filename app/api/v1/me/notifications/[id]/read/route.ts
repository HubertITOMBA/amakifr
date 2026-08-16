import type { NextRequest } from "next/server";
import { resolveApiActor } from "@/lib/api/auth-resolve";
import { apiSuccess, apiError } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import { requirePathId } from "@/lib/api/validation/path-id";
import { markMyNotificationAsRead } from "@/lib/services/notifications/mark-my-notification-as-read";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }> | { id: string };
};

/**
 * PATCH /api/v1/me/notifications/:id/read — marque une notification comme lue.
 * Ownership via actor.userId (service). Pas de revalidatePath.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const actor = await resolveApiActor(request);
    if (!actor) {
      return apiError("UNAUTHENTICATED", "Non authentifié", 401);
    }

    const { id: rawId } = await Promise.resolve(context.params);
    const id = requirePathId(rawId);

    await markMyNotificationAsRead(actor, id);
    return apiSuccess({ updated: true });
  } catch (error) {
    return handleApiError(error);
  }
}
