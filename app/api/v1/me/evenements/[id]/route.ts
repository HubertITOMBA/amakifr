import type { NextRequest } from "next/server";
import { resolveApiActor } from "@/lib/api/auth-resolve";
import { apiSuccess, apiError } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import { ServiceError } from "@/lib/service-error";
import { getMyEvent } from "@/lib/services/evenements/get-my-events";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/me/evenements/[id]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await resolveApiActor(request);
    if (!actor) {
      return apiError("UNAUTHENTICATED", "Non authentifié", 401);
    }

    const query = request.nextUrl.searchParams;
    if (query.has("adherentId") || query.has("userId")) {
      throw new ServiceError(
        "VALIDATION_ERROR",
        "Paramètres userId et adherentId non autorisés"
      );
    }

    const { id } = await params;
    const data = await getMyEvent(actor, id);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}
