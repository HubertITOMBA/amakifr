import type { NextRequest } from "next/server";
import { resolveApiActor } from "@/lib/api/auth-resolve";
import { apiSuccess, apiError } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import { ServiceError } from "@/lib/service-error";
import { getMyReunionYear } from "@/lib/services/reunions/get-my-reunion-year";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/me/reunions/year?annee=2026 — calendrier annuel 12 mois.
 */
export async function GET(request: NextRequest) {
  try {
    const actor = await resolveApiActor(request);
    if (!actor) {
      return apiError("UNAUTHENTICATED", "Non authentifié", 401);
    }

    const params = request.nextUrl.searchParams;
    for (const key of [
      "userId",
      "adherentId",
      "hostId",
      "adherentHoteId",
      "force",
      "override",
      "isAdmin",
    ]) {
      if (params.has(key)) {
        throw new ServiceError(
          "VALIDATION_ERROR",
          `Paramètre ${key} non autorisé`
        );
      }
    }

    const anneeRaw = params.get("annee");
    if (!anneeRaw) {
      throw new ServiceError("VALIDATION_ERROR", "Paramètre annee requis");
    }
    const annee = Number(anneeRaw);
    if (!Number.isInteger(annee)) {
      throw new ServiceError("VALIDATION_ERROR", "Année invalide");
    }

    const data = await getMyReunionYear(actor, annee);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}
