import { authenticatedFetch } from "@/auth/session";
import type {
  MyReunionDto,
  MyReunionYearDto,
  ProposeMyselfAsReunionHostInput,
  ProposeMyselfAsReunionHostResult,
  UpdateMyReunionParticipationInput,
  UpdateMyReunionParticipationResult,
  WithdrawMyReunionHostProposalResult,
} from "@/api/types";

/**
 * GET /api/v1/me/reunions — calendrier collectif des réunions mensuelles.
 */
export async function getMyReunions(): Promise<MyReunionDto[]> {
  return authenticatedFetch<MyReunionDto[]>("/api/v1/me/reunions");
}

/**
 * GET /api/v1/me/reunions/year?annee= — calendrier annuel 12 mois.
 */
export async function getMyReunionYear(annee: number): Promise<MyReunionYearDto> {
  return authenticatedFetch<MyReunionYearDto>(
    `/api/v1/me/reunions/year?annee=${encodeURIComponent(String(annee))}`
  );
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

/**
 * POST /api/v1/me/reunions/host-proposals — se proposer comme hôte.
 */
export async function proposeMyselfAsReunionHost(
  input: ProposeMyselfAsReunionHostInput
): Promise<ProposeMyselfAsReunionHostResult> {
  return authenticatedFetch<ProposeMyselfAsReunionHostResult>(
    "/api/v1/me/reunions/host-proposals",
    {
      method: "POST",
      body: input,
    }
  );
}

/**
 * DELETE /api/v1/me/reunions/[id]/host-proposal — se désister comme hôte.
 */
export async function withdrawMyReunionHostProposal(
  reunionId: string
): Promise<WithdrawMyReunionHostProposalResult> {
  return authenticatedFetch<WithdrawMyReunionHostProposalResult>(
    `/api/v1/me/reunions/${encodeURIComponent(reunionId)}/host-proposal`,
    {
      method: "DELETE",
    }
  );
}
