import type { NextRequest } from "next/server";
import { resolveApiActor } from "@/lib/api/auth-resolve";
import { apiSuccess, apiError } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import { ServiceError } from "@/lib/service-error";
import { getMyDocuments } from "@/lib/services/documents/get-my-documents";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/me/documents — mes documents.
 * Aucun userId / adherentId query accepté (anti-IDOR).
 * Auth : Bearer mobile OU session Web (composite).
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

    const documents = await getMyDocuments(actor);
    return apiSuccess(documents);
  } catch (error) {
    return handleApiError(error);
  }
}
