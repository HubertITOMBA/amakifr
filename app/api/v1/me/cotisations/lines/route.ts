import type { NextRequest } from "next/server";
import { resolveApiActor } from "@/lib/api/auth-resolve";
import { apiSuccess, apiError } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import { ServiceError } from "@/lib/service-error";
import { getMyCotisationLines } from "@/lib/services/cotisations/get-my-cotisation-lines";

export const dynamic = "force-dynamic";

const FORBIDDEN_KEYS = [
  "userId",
  "adherentId",
  "memberId",
  "ownerId",
  "paymentOwnerId",
] as const;

/**
 * GET /api/v1/me/cotisations/lines — vue « Toutes les années » paginée.
 * Query : limit (défaut 20, max 50), offset.
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

    const limitRaw = params.get("limit");
    const offsetRaw = params.get("offset");
    const limit =
      limitRaw !== null && limitRaw.trim() !== ""
        ? Number(limitRaw)
        : undefined;
    const offset =
      offsetRaw !== null && offsetRaw.trim() !== ""
        ? Number(offsetRaw)
        : undefined;

    if (limit !== undefined && !Number.isInteger(limit)) {
      throw new ServiceError("VALIDATION_ERROR", "limit invalide");
    }
    if (offset !== undefined && !Number.isInteger(offset)) {
      throw new ServiceError("VALIDATION_ERROR", "offset invalide");
    }

    const data = await getMyCotisationLines(actor, { limit, offset });
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}
