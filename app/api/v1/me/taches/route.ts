import type { NextRequest } from "next/server";
import { resolveApiActor } from "@/lib/api/auth-resolve";
import { apiSuccess, apiError } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import { ServiceError } from "@/lib/service-error";
import { getMyTaches } from "@/lib/services/taches/get-my-taches";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/me/taches — mes tâches affectées.
 * Aucun userId / adherentId query accepté (anti-IDOR).
 */
export async function GET(request: NextRequest) {
  try {
    const actor = await resolveApiActor(request);
    if (!actor) {
      return apiError("UNAUTHENTICATED", "Non authentifié", 401);
    }

    const params = request.nextUrl.searchParams;
    if (params.has("adherentId") || params.has("userId")) {
      throw new ServiceError(
        "VALIDATION_ERROR",
        "Paramètres userId et adherentId non autorisés"
      );
    }

    const taches = await getMyTaches(actor);
    return apiSuccess(taches);
  } catch (error) {
    return handleApiError(error);
  }
}
