/**
 * DTOs self-service élections (adhérent).
 * Ne jamais exposer votes d'autres électeurs.
 */

export type MyElectionListItemDto = {
  id: string;
  titre: string;
  description: string | null;
  dateOuverture: string;
  dateCloture: string;
  dateScrutin: string;
  status: string;
  statusLabel: string;
  scope: "open" | "upcoming" | "closed";
  canVote: boolean;
  hasVoted: boolean;
  resultsAvailable: boolean;
  /** Période de candidature ouverte (summary / liste). */
  candidaciesOpen: boolean;
  personalLabel: string;
};

export type MyElectionsListDto = {
  items: MyElectionListItemDto[];
  total: number;
  limit: number;
  offset: number;
};

export type MyElectionsSummaryDto = {
  aVoterCount: number;
  /** Élections avec période candidature ouverte (indication légère Home). */
  candidaciesOpenCount: number;
};

export type MyElectionCandidateDto = {
  id: string;
  displayName: string;
  image: string | null;
  motivation: string | null;
  programme: string | null;
};

export type MyElectionPositionDto = {
  id: string;
  titre: string;
  type: string;
  description: string | null;
  nombreMandats: number;
  alreadyVoted: boolean;
  myVote: {
    candidacyId: string | null;
    isBlanc: boolean;
    status: string;
    dateVote: string;
  } | null;
  /** Candidats publics (Validee uniquement). */
  candidates: MyElectionCandidateDto[];
  canApply: boolean;
  canWithdraw: boolean;
  myCandidacyStatus: string | null;
  myCandidacyStatusLabel: string | null;
  myCandidacyId: string | null;
};

export type MyElectionDetailDto = MyElectionListItemDto & {
  dateClotureCandidature: string;
  nombreMandats: number;
  quorumRequis: number | null;
  majoriteRequis: string | null;
  eligible: boolean;
  eligibilityReason: string | null;
  /** Éligibilité spécifique candidature. */
  eligibleCandidate: boolean;
  eligibilityCandidateReason: string | null;
  candidaciesOpen: boolean;
  voteIrrevocable: boolean;
  positions: MyElectionPositionDto[];
};

export type SubmitMyVoteItem = {
  positionId: string;
  /** null = vote blanc */
  candidacyId: string | null;
};

export type SubmitMyVoteResultDto = {
  recorded: number;
  message: string;
};

export type SubmitMyCandidacyResultDto = {
  id: string;
  status: string;
  message: string;
};

export type WithdrawMyCandidacyResultDto = {
  withdrawn: boolean;
  message: string;
};

export type MyElectionResultsDto = {
  electionId: string;
  titre: string;
  positions: Array<{
    positionId: string;
    titre: string;
    totalVotes: number;
    blankVotes: number;
    candidacies: Array<{
      candidacyId: string;
      displayName: string;
      votesCount: number;
      percentage: number;
    }>;
  }>;
};
