import type { NextRequest } from "next/server";
import { resolveApiActor } from "@/lib/api/auth-resolve";
import { apiSuccess, apiError } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import { ServiceError } from "@/lib/service-error";
import { getActiveAssociationPaymentAccount } from "@/lib/services/payment-accounts/get-active-payment-account";

export const dynamic = "force-dynamic";

const FORBIDDEN_KEYS = [
  "userId",
  "adherentId",
  "memberId",
  "ownerId",
  "accountId",
] as const;

/**
 * GET /api/v1/me/payment-account — compte actif association (lecture seule).
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

    const account = await getActiveAssociationPaymentAccount(actor);
    return apiSuccess({ account });
  } catch (error) {
    return handleApiError(error);
  }
}
