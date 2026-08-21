import type { NextRequest } from "next/server";
import { resolveApiActor } from "@/lib/api/auth-resolve";
import { apiSuccess, apiError } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import { ServiceError } from "@/lib/service-error";
import { getMyPayments } from "@/lib/services/cotisations/get-my-payments";

export const dynamic = "force-dynamic";

const FORBIDDEN_KEYS = [
  "userId",
  "adherentId",
  "memberId",
  "ownerId",
  "paymentOwnerId",
] as const;

/**
 * GET /api/v1/me/cotisations/payments — historique paginé (lazy).
 * Query : annee? (optionnelle), limit (défaut 20, max 50), offset.
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
    let annee: number | undefined;
    if (anneeRaw !== null && anneeRaw.trim() !== "") {
      annee = Number(anneeRaw);
      if (!Number.isInteger(annee)) {
        throw new ServiceError("VALIDATION_ERROR", "Année invalide");
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

    const data = await getMyPayments(actor, { annee, limit, offset });
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}
