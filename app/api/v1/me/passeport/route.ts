import type { NextRequest } from "next/server";
import { resolveApiActor } from "@/lib/api/auth-resolve";
import { apiSuccess, apiError } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import { ServiceError } from "@/lib/service-error";
import { getMyPasseport } from "@/lib/services/passeport/get-my-passeport";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/me/passeport — métadonnées passeport self-service.
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

    const data = await getMyPasseport(actor);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}
