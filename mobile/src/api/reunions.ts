import { authenticatedFetch } from "@/auth/session";
import type {
  MyReunionDto,
  UpdateMyReunionParticipationInput,
  UpdateMyReunionParticipationResult,
} from "@/api/types";

/**
 * GET /api/v1/me/reunions — calendrier collectif des réunions mensuelles.
 */
export async function getMyReunions(): Promise<MyReunionDto[]> {
  return authenticatedFetch<MyReunionDto[]>("/api/v1/me/reunions");
}

/**
 * PATCH /api/v1/me/reunions/[id]/participation — confirmer sa présence.
 */
export async function updateMyReunionParticipation(
  reunionId: string,
  input: UpdateMyReunionParticipationInput
): Promise<UpdateMyReunionParticipationResult> {
  return authenticatedFetch<UpdateMyReunionParticipationResult>(
    `/api/v1/me/reunions/${encodeURIComponent(reunionId)}/participation`,
    {
      method: "PATCH",
      body: input,
    }
  );
}
