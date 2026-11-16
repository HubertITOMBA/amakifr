import type { NextRequest } from "next/server";
import { resolveApiActor } from "@/lib/api/auth-resolve";
import { apiSuccess, apiError } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import { ServiceError } from "@/lib/service-error";
import { isSurveyToComplete } from "@/lib/sondages";
import {
  getMyActiveSurveys,
  getMyClosedSurveys,
  getMySurveysSummary,
} from "@/lib/services/sondages/get-my-surveys";

export const dynamic = "force-dynamic";

const FORBIDDEN = ["userId", "adherentId", "respondentId", "authorId", "force", "override"] as const;

/**
 * GET /api/v1/me/sondages
 * - ?summary=1 → compteur léger accueil (inchangé)
 * - (défaut) → uniquement « à compléter » (compat AMAKI 1.1.1 / bandeau)
 * - ?scope=open → tous les sondages ouverts (y compris complétés modifiables)
 * - ?scope=closed → archives clôturées / période écoulée (lecture seule)
 */
export async function GET(request: NextRequest) {
  try {
    const actor = await resolveApiActor(request);
    if (!actor) return apiError("UNAUTHENTICATED", "Non authentifié", 401);

    const params = request.nextUrl.searchParams;
    for (const key of FORBIDDEN) {
      if (params.has(key)) {
        throw new ServiceError("VALIDATION_ERROR", `Paramètre ${key} non autorisé`);
      }
    }

    if (params.get("summary") === "1" || params.get("summary") === "true") {
      const summary = await getMySurveysSummary(actor);
      return apiSuccess(summary);
    }

    const scopeRaw = params.get("scope");
    if (scopeRaw != null && scopeRaw !== "open" && scopeRaw !== "closed") {
      throw new ServiceError(
        "VALIDATION_ERROR",
        "scope invalide (open|closed)"
      );
    }

    if (scopeRaw === "closed") {
      const items = await getMyClosedSurveys(actor);
      return apiSuccess({ items, total: items.length, scope: "closed" });
    }

    const items = await getMyActiveSurveys(actor);
    if (scopeRaw === "open") {
      return apiSuccess({ items, total: items.length, scope: "open" });
    }

    // Défaut : filtre « à compléter » — comportement historique clients 1.1.1
    const aCompleter = items.filter(isSurveyToComplete);
    return apiSuccess({ items: aCompleter, total: aCompleter.length });
  } catch (error) {
    return handleApiError(error);
  }
}
