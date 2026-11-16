import { authenticatedFetch } from "@/auth/session";
import type {
  MyActiveSurveyDto,
  MySurveyAnswerItem,
  MySurveyCollectiveResultsDto,
  MySurveyDetailDto,
  MySurveyPersonalSyntheseDto,
  MySurveysListDto,
  MySurveysSummaryDto,
} from "@/api/types";

/**
 * GET /api/v1/me/sondages?summary=1 — compteur accueil.
 */
export async function getMySurveysSummary(): Promise<MySurveysSummaryDto> {
  return authenticatedFetch<MySurveysSummaryDto>(
    "/api/v1/me/sondages?summary=1"
  );
}

/**
 * GET /api/v1/me/sondages — défaut historique : uniquement « à compléter »
 * (compat AMAKI 1.1.1 / bandeau).
 */
export async function getMyActiveSurveys(): Promise<MySurveysListDto> {
  return authenticatedFetch<MySurveysListDto>("/api/v1/me/sondages");
}

/**
 * GET /api/v1/me/sondages?scope=open — tous les ouverts (y compris complétés).
 */
export async function getMyOpenSurveys(): Promise<MySurveysListDto> {
  return authenticatedFetch<MySurveysListDto>(
    "/api/v1/me/sondages?scope=open"
  );
}

/**
 * GET /api/v1/me/sondages?scope=closed — archives lecture seule.
 */
export async function getMyClosedSurveys(): Promise<MySurveysListDto> {
  return authenticatedFetch<MySurveysListDto>(
    "/api/v1/me/sondages?scope=closed"
  );
}

/**
 * GET /api/v1/me/sondages/[id]
 */
export async function getMySurvey(id: string): Promise<MySurveyDetailDto> {
  return authenticatedFetch<MySurveyDetailDto>(
    `/api/v1/me/sondages/${encodeURIComponent(id)}`
  );
}

/**
 * GET /api/v1/me/sondages/[id]/synthese — après clôture uniquement.
 */
export async function getMySurveyPersonalSynthese(
  id: string
): Promise<MySurveyPersonalSyntheseDto> {
  return authenticatedFetch<MySurveyPersonalSyntheseDto>(
    `/api/v1/me/sondages/${encodeURIComponent(id)}/synthese`
  );
}

/**
 * GET /api/v1/me/sondages/[id]/resultats — après autorisation ADMIN.
 */
export async function getMySurveyCollectiveResults(
  id: string
): Promise<MySurveyCollectiveResultsDto> {
  return authenticatedFetch<MySurveyCollectiveResultsDto>(
    `/api/v1/me/sondages/${encodeURIComponent(id)}/resultats`
  );
}

/**
 * POST /api/v1/me/sondages/[id]/reponses
 */
export async function submitMySurveyAnswers(
  id: string,
  input: { items: MySurveyAnswerItem[]; mode?: "partial" | "complete" }
): Promise<{
  id: string;
  estComplet: boolean;
  requiredTotal: number;
  requiredAnswered: number;
}> {
  return authenticatedFetch(
    `/api/v1/me/sondages/${encodeURIComponent(id)}/reponses`,
    {
      method: "POST",
      body: {
        items: input.items,
        mode: input.mode ?? "partial",
      },
    }
  );
}

export type { MyActiveSurveyDto };
