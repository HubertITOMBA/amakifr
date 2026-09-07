import type { AuthContext } from "@/lib/auth-context";
import { db } from "@/lib/db";
import { ServiceError } from "@/lib/service-error";
import {
  canMemberBeCandidate,
  canMemberVote,
  canWithdrawCandidacy,
  candidacyStatusLabel,
  electionListScope,
  electionStatusLabel,
  isElectionCandidacyOpen,
  memberElectionState,
  resolveSelfAdherentId,
} from "@/lib/services/elections/election-helpers";
import type {
  MyElectionDetailDto,
  MyElectionListItemDto,
  MyElectionsListDto,
  MyElectionsSummaryDto,
} from "@/lib/services/elections/types";

/**
 * Summary léger accueil : votes à faire + candidatures ouvertes.
 */
export async function getMyElectionsSummary(
  actor: AuthContext
): Promise<MyElectionsSummaryDto> {
  const adherentId = await resolveSelfAdherentId(actor);
  const voteElig = await canMemberVote(adherentId);
  const candElig = await canMemberBeCandidate(adherentId);

  const open = await db.election.findMany({
    where: { status: "Ouverte" },
    select: {
      id: true,
      status: true,
      dateOuverture: true,
      dateClotureCandidature: true,
      dateScrutin: true,
      dateCloture: true,
      positions: { select: { id: true } },
      votes: {
        where: { adherentId },
        select: { positionId: true },
      },
    },
  });

  let aVoterCount = 0;
  let candidaciesOpenCount = 0;
  const now = new Date();
  for (const e of open) {
    if (voteElig.allowed) {
      const state = memberElectionState({
        status: e.status,
        dateScrutin: e.dateScrutin,
        dateCloture: e.dateCloture,
        eligible: true,
        votedPositionIds: e.votes.map((v) => v.positionId),
        positionIds: e.positions.map((p) => p.id),
        now,
      });
      if (state.canVote) aVoterCount += 1;
    }
    if (candElig.allowed && isElectionCandidacyOpen(e, now)) {
      candidaciesOpenCount += 1;
    }
  }
  return { aVoterCount, candidaciesOpenCount };
}

/**
 * Liste élections visibles adhérent (Ouverte / Preparation / Cloturee).
 */
export async function getMyElections(
  actor: AuthContext,
  opts?: { limit?: number; offset?: number }
): Promise<MyElectionsListDto> {
  const adherentId = await resolveSelfAdherentId(actor);
  const eligibility = await canMemberVote(adherentId);
  const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 100);
  const offset = Math.max(opts?.offset ?? 0, 0);

  const where = {
    status: { in: ["Ouverte", "Preparation", "Cloturee"] as const },
  };

  const [total, rows] = await Promise.all([
    db.election.count({ where }),
    db.election.findMany({
      where,
      orderBy: [{ status: "asc" }, { dateScrutin: "desc" }],
      take: limit,
      skip: offset,
      select: {
        id: true,
        titre: true,
        description: true,
        status: true,
        dateOuverture: true,
        dateCloture: true,
        dateClotureCandidature: true,
        dateScrutin: true,
        positions: { select: { id: true } },
        votes: {
          where: { adherentId },
          select: { positionId: true },
        },
      },
    }),
  ]);

  const now = new Date();
  const items: MyElectionListItemDto[] = rows.map((e) => {
    const positionIds = e.positions.map((p) => p.id);
    const votedPositionIds = e.votes.map((v) => v.positionId);
    const window = {
      status: e.status,
      dateScrutin: e.dateScrutin,
      dateCloture: e.dateCloture,
    };
    const state = memberElectionState({
      ...window,
      eligible: eligibility.allowed,
      votedPositionIds,
      positionIds,
      now,
    });
    return {
      id: e.id,
      titre: e.titre,
      description: e.description,
      dateOuverture: e.dateOuverture.toISOString(),
      dateCloture: e.dateCloture.toISOString(),
      dateScrutin: e.dateScrutin.toISOString(),
      status: e.status,
      statusLabel: electionStatusLabel(e.status),
      scope: electionListScope(window, now),
      canVote: state.canVote,
      hasVoted: state.hasVoted,
      resultsAvailable: state.resultsAvailable,
      candidaciesOpen: isElectionCandidacyOpen(
        {
          status: e.status,
          dateOuverture: e.dateOuverture,
          dateClotureCandidature: e.dateClotureCandidature,
        },
        now
      ),
      personalLabel: state.personalLabel,
    };
  });

  return { items, total, limit, offset };
}

/**
 * Détail + postes + candidats Validee + candidature self + votes self.
 */
export async function getMyElection(
  actor: AuthContext,
  electionId: string
): Promise<MyElectionDetailDto> {
  const adherentId = await resolveSelfAdherentId(actor);
  const eligibility = await canMemberVote(adherentId);
  const candidateElig = await canMemberBeCandidate(adherentId);

  const election = await db.election.findUnique({
    where: { id: electionId },
    select: {
      id: true,
      titre: true,
      description: true,
      status: true,
      dateOuverture: true,
      dateCloture: true,
      dateClotureCandidature: true,
      dateScrutin: true,
      nombreMandats: true,
      quorumRequis: true,
      majoriteRequis: true,
      positions: {
        select: {
          id: true,
          titre: true,
          type: true,
          description: true,
          nombreMandats: true,
          PosteTemplate: { select: { ordre: true } },
          candidacies: {
            where: { status: "Validee" },
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              motivation: true,
              programme: true,
              adherent: {
                select: {
                  firstname: true,
                  lastname: true,
                  civility: true,
                  User: { select: { image: true } },
                },
              },
            },
          },
        },
      },
      votes: {
        where: { adherentId },
        select: {
          id: true,
          positionId: true,
          candidacyId: true,
          status: true,
          dateVote: true,
        },
      },
      candidacies: {
        where: { adherentId },
        select: {
          id: true,
          positionId: true,
          status: true,
        },
      },
    },
  });

  if (!election || election.status === "Annulee") {
    throw new ServiceError("NOT_FOUND", "Élection introuvable");
  }

  const positionsSorted = [...election.positions].sort((a, b) => {
    const oa = a.PosteTemplate?.ordre ?? 999;
    const ob = b.PosteTemplate?.ordre ?? 999;
    if (oa !== ob) return oa - ob;
    return a.titre.localeCompare(b.titre, "fr");
  });

  const positionIds = positionsSorted.map((p) => p.id);
  const votedPositionIds = election.votes.map((v) => v.positionId);
  const now = new Date();
  const window = {
    status: election.status,
    dateScrutin: election.dateScrutin,
    dateCloture: election.dateCloture,
  };
  const state = memberElectionState({
    ...window,
    eligible: eligibility.allowed,
    votedPositionIds,
    positionIds,
    now,
  });

  const candidaciesOpen = isElectionCandidacyOpen(
    {
      status: election.status,
      dateOuverture: election.dateOuverture,
      dateClotureCandidature: election.dateClotureCandidature,
    },
    now
  );

  const myVotesByPosition: Record<
    string,
    { candidacyId: string | null; status: string; dateVote: string }
  > = {};
  for (const v of election.votes) {
    myVotesByPosition[v.positionId] = {
      candidacyId: v.candidacyId,
      status: v.status,
      dateVote: v.dateVote.toISOString(),
    };
  }

  const myCandidacyByPosition: Record<
    string,
    { id: string; status: string }
  > = {};
  for (const c of election.candidacies) {
    myCandidacyByPosition[c.positionId] = { id: c.id, status: c.status };
  }

  const myCandidacyIds = election.candidacies.map((c) => c.id);
  const votedCandidacyIds = new Set<string>();
  if (myCandidacyIds.length > 0) {
    const votesOnMine = await db.vote.findMany({
      where: { candidacyId: { in: myCandidacyIds } },
      select: { candidacyId: true },
      distinct: ["candidacyId"],
    });
    for (const v of votesOnMine) {
      if (v.candidacyId) votedCandidacyIds.add(v.candidacyId);
    }
  }

  return {
    id: election.id,
    titre: election.titre,
    description: election.description,
    dateOuverture: election.dateOuverture.toISOString(),
    dateCloture: election.dateCloture.toISOString(),
    dateClotureCandidature: election.dateClotureCandidature.toISOString(),
    dateScrutin: election.dateScrutin.toISOString(),
    status: election.status,
    statusLabel: electionStatusLabel(election.status),
    scope: electionListScope(window, now),
    canVote: state.canVote,
    hasVoted: state.hasVoted,
    resultsAvailable: state.resultsAvailable,
    candidaciesOpen,
    personalLabel: state.personalLabel,
    nombreMandats: election.nombreMandats,
    quorumRequis: election.quorumRequis,
    majoriteRequis: election.majoriteRequis,
    eligible: eligibility.allowed,
    eligibilityReason: eligibility.allowed ? null : eligibility.reason ?? null,
    eligibleCandidate: candidateElig.allowed,
    eligibilityCandidateReason: candidateElig.allowed
      ? null
      : candidateElig.reason ?? null,
    voteIrrevocable: true,
    positions: positionsSorted.map((p) => {
      const mine = myCandidacyByPosition[p.id] ?? null;
      const canApply =
        candidaciesOpen && candidateElig.allowed && mine == null;
      const canWithdraw = canWithdrawCandidacy({
        electionStatus: election.status,
        myCandidacyStatus: mine?.status ?? null,
        dateScrutin: election.dateScrutin,
        hasVotesOnCandidacy: mine
          ? votedCandidacyIds.has(mine.id)
          : false,
        now,
      });
      return {
        id: p.id,
        titre: p.titre,
        type: p.type,
        description: p.description,
        nombreMandats: p.nombreMandats,
        alreadyVoted: Boolean(myVotesByPosition[p.id]),
        myVote: myVotesByPosition[p.id]
          ? {
              candidacyId: myVotesByPosition[p.id].candidacyId,
              isBlanc: myVotesByPosition[p.id].candidacyId == null,
              status: myVotesByPosition[p.id].status,
              dateVote: myVotesByPosition[p.id].dateVote,
            }
          : null,
        candidates:
          election.status === "Preparation"
            ? []
            : p.candidacies.map((c) => ({
                id: c.id,
                displayName:
                  `${c.adherent.civility ? c.adherent.civility + " " : ""}${c.adherent.firstname} ${c.adherent.lastname}`.trim(),
                image: c.adherent.User?.image ?? null,
                motivation: c.motivation,
                programme: c.programme,
              })),
        canApply,
        canWithdraw,
        myCandidacyStatus: mine?.status ?? null,
        myCandidacyStatusLabel: mine
          ? candidacyStatusLabel(mine.status)
          : null,
        myCandidacyId: mine?.id ?? null,
      };
    }),
  };
}
