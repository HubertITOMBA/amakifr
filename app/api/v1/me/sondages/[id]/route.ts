import type { NextRequest } from "next/server";
import { resolveApiActor } from "@/lib/api/auth-resolve";
import { apiSuccess, apiError } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import { ServiceError } from "@/lib/service-error";
import { getMySurvey } from "@/lib/services/sondages/get-my-surveys";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const FORBIDDEN = ["userId", "adherentId", "respondentId", "authorId"] as const;

/**
 * GET /api/v1/me/sondages/[id]
 */
export async function GET(request: NextRequest, context: Ctx) {
  try {
    const actor = await resolveApiActor(request);
    if (!actor) return apiError("UNAUTHENTICATED", "Non authentifié", 401);

    for (const key of FORBIDDEN) {
      if (request.nextUrl.searchParams.has(key)) {
        throw new ServiceError("VALIDATION_ERROR", `Paramètre ${key} non autorisé`);
      }
    }

    const { id } = await context.params;
    const detail = await getMySurvey(actor, id);
    return apiSuccess(detail);
  } catch (error) {
    return handleApiError(error);
  }
}
