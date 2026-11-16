import type { NextRequest } from "next/server";
import { resolveApiActor } from "@/lib/api/auth-resolve";
import { apiSuccess, apiError } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import { ServiceError } from "@/lib/service-error";
import { getMySurveyCollectiveResults } from "@/lib/services/sondages/get-my-surveys";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const FORBIDDEN = ["userId", "adherentId", "respondentId", "authorId"] as const;

/**
 * GET /api/v1/me/sondages/[id]/resultats
 * Résultats collectifs — uniquement après autorisation ADMIN explicite
 * et clôture. Accès direct refusé sinon (fail closed).
 * Aucun corrigé admin / texte libre brut.
 */
export async function GET(request: NextRequest, context: Ctx) {
  try {
    const actor = await resolveApiActor(request);
    if (!actor) return apiError("UNAUTHENTICATED", "Non authentifié", 401);

    for (const key of FORBIDDEN) {
      if (request.nextUrl.searchParams.has(key)) {
        throw new ServiceError(
          "VALIDATION_ERROR",
          `Paramètre ${key} non autorisé`
        );
      }
    }

    const { id } = await context.params;
    const data = await getMySurveyCollectiveResults(actor, id);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}
