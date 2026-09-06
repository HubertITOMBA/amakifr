import { authenticatedFetch } from "@/auth/session";
import type {
  MyActiveSurveyDto,
  MySurveyAnswerItem,
  MySurveyDetailDto,
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
 * GET /api/v1/me/sondages — sondages à compléter.
 */
export async function getMyActiveSurveys(): Promise<MySurveysListDto> {
  return authenticatedFetch<MySurveysListDto>("/api/v1/me/sondages");
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
