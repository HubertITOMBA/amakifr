import type { NextRequest } from "next/server";
import { resolveApiActorFromWebSession } from "@/lib/api/auth-web";
import { apiSuccess, apiError } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import { ServiceError } from "@/lib/service-error";
import { getMyCotisationsMensuelles } from "@/lib/services/cotisations/get-my-cotisations-mensuelles";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/me/cotisations-mensuelles — mes cotisations mensuelles.
 * Aucun adherentId / userId query accepté (anti-IDOR).
 * Auth temporaire : session Web NextAuth.
 */
export async function GET(request: NextRequest) {
  try {
    const actor = await resolveApiActorFromWebSession();
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

    const cotisations = await getMyCotisationsMensuelles(actor);
    return apiSuccess(cotisations);
  } catch (error) {
    return handleApiError(error);
  }
}
