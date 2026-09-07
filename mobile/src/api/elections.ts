import { authenticatedFetch } from "@/auth/session";
import type {
  MyElectionDetailDto,
  MyElectionResultsDto,
  MyElectionsListDto,
  MyElectionsSummaryDto,
  SubmitMyCandidacyResultDto,
  SubmitMyVoteResultDto,
  WithdrawMyCandidacyResultDto,
} from "@/api/types";

/**
 * GET /api/v1/me/elections?summary=1
 */
export async function getMyElectionsSummary(): Promise<MyElectionsSummaryDto> {
  return authenticatedFetch<MyElectionsSummaryDto>(
    "/api/v1/me/elections?summary=1"
  );
}

/**
 * GET /api/v1/me/elections
 */
export async function getMyElections(): Promise<MyElectionsListDto> {
  return authenticatedFetch<MyElectionsListDto>("/api/v1/me/elections");
}

/**
 * GET /api/v1/me/elections/[id]
 */
export async function getMyElection(id: string): Promise<MyElectionDetailDto> {
  return authenticatedFetch<MyElectionDetailDto>(
    `/api/v1/me/elections/${encodeURIComponent(id)}`
  );
}

/**
 * POST /api/v1/me/elections/[id]/vote
 */
export async function submitMyVote(
  id: string,
  votes: Array<{ positionId: string; candidacyId: string | null }>
): Promise<SubmitMyVoteResultDto> {
  return authenticatedFetch<SubmitMyVoteResultDto>(
    `/api/v1/me/elections/${encodeURIComponent(id)}/vote`,
    {
      method: "POST",
      body: { votes },
    }
  );
}

/**
 * POST /api/v1/me/elections/[id]/positions/[positionId]/candidacy
 */
export async function submitMyCandidacy(
  electionId: string,
  positionId: string,
  input: { motivation: string; programme: string }
): Promise<SubmitMyCandidacyResultDto> {
  return authenticatedFetch<SubmitMyCandidacyResultDto>(
    `/api/v1/me/elections/${encodeURIComponent(electionId)}/positions/${encodeURIComponent(positionId)}/candidacy`,
    {
      method: "POST",
      body: input,
    }
  );
}

/**
 * DELETE /api/v1/me/elections/[id]/positions/[positionId]/candidacy
 */
export async function withdrawMyCandidacy(
  electionId: string,
  positionId: string
): Promise<WithdrawMyCandidacyResultDto> {
  return authenticatedFetch<WithdrawMyCandidacyResultDto>(
    `/api/v1/me/elections/${encodeURIComponent(electionId)}/positions/${encodeURIComponent(positionId)}/candidacy`,
    { method: "DELETE" }
  );
}

/**
 * GET /api/v1/me/elections/[id]/results
 */
export async function getMyElectionResults(
  id: string
): Promise<MyElectionResultsDto> {
  return authenticatedFetch<MyElectionResultsDto>(
    `/api/v1/me/elections/${encodeURIComponent(id)}/results`
  );
}
