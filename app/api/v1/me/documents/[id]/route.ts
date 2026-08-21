import type { NextRequest } from "next/server";
import { resolveApiActor } from "@/lib/api/auth-resolve";
import { apiSuccess, apiError } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import { ServiceError } from "@/lib/service-error";
import { deleteMyDocument } from "@/lib/services/documents/delete-my-document";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * DELETE /api/v1/me/documents/[id] — suppression self-service (owner).
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const actor = await resolveApiActor(request);
    if (!actor) {
      return apiError("UNAUTHENTICATED", "Non authentifié", 401);
    }

    const params = request.nextUrl.searchParams;
    if (
      params.has("userId") ||
      params.has("adherentId") ||
      params.has("ownerId")
    ) {
      throw new ServiceError(
        "VALIDATION_ERROR",
        "Paramètres d'identité non autorisés"
      );
    }

    const { id } = await context.params;
    const result = await deleteMyDocument(actor, id);
    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}
