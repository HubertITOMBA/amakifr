import type { NextRequest } from "next/server";
import { resolveApiActor } from "@/lib/api/auth-resolve";
import { apiSuccess, apiError } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import { ServiceError } from "@/lib/service-error";
import { getMyCotisationYear } from "@/lib/services/cotisations/get-my-cotisation-year";

export const dynamic = "force-dynamic";

const FORBIDDEN_KEYS = [
  "userId",
  "adherentId",
  "memberId",
  "ownerId",
  "paymentOwnerId",
] as const;

/**
 * GET /api/v1/me/cotisations/year?annee=YYYY — vue financière annuelle (lecture seule).
 * Identité via Bearer / session uniquement.
 */
export async function GET(request: NextRequest) {
  try {
    const actor = await resolveApiActor(request);
    if (!actor) {
      return apiError("UNAUTHENTICATED", "Non authentifié", 401);
    }

    const params = request.nextUrl.searchParams;
    for (const key of FORBIDDEN_KEYS) {
      if (params.has(key)) {
        throw new ServiceError(
          "VALIDATION_ERROR",
          `Paramètre ${key} non autorisé`
        );
      }
    }

    const anneeRaw = params.get("annee");
    if (anneeRaw === null || anneeRaw.trim() === "") {
      throw new ServiceError("VALIDATION_ERROR", "Paramètre annee requis");
    }

    const annee = Number(anneeRaw);
    if (!Number.isInteger(annee)) {
      throw new ServiceError("VALIDATION_ERROR", "Année invalide");
    }

    const data = await getMyCotisationYear(actor, annee);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}
