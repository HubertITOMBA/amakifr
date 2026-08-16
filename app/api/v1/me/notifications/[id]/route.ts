import type { NextRequest } from "next/server";
import { resolveApiActor } from "@/lib/api/auth-resolve";
import { apiSuccess, apiError } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import { requirePathId } from "@/lib/api/validation/path-id";
import { deleteMyNotification } from "@/lib/services/notifications/delete-my-notification";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }> | { id: string };
};

/**
 * DELETE /api/v1/me/notifications/:id — supprime une notification de l'acteur.
 * Ownership via actor.userId (service). Pas de revalidatePath.
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const actor = await resolveApiActor(request);
    if (!actor) {
      return apiError("UNAUTHENTICATED", "Non authentifié", 401);
    }

    const { id: rawId } = await Promise.resolve(context.params);
    const id = requirePathId(rawId);

    await deleteMyNotification(actor, id);
    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
