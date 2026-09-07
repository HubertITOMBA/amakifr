import { describe, expect, it } from "vitest";
import {
  canWithdrawCandidacy,
  electionListScope,
  electionVotingPhase,
  getCandidacyWithdrawalBlockReason,
  isElectionCandidacyOpen,
  isElectionVotingOpen,
  memberElectionState,
} from "@/lib/services/elections/election-helpers";

const now = new Date("2026-06-15T12:00:00.000Z");
const before = new Date("2026-06-10T12:00:00.000Z");
const start = new Date("2026-06-14T12:00:00.000Z");
const end = new Date("2026-06-20T12:00:00.000Z");
const after = new Date("2026-06-21T12:00:00.000Z");

describe("election-helpers", () => {
  it("isElectionVotingOpen", () => {
    expect(
      isElectionVotingOpen(
        { status: "Ouverte", dateScrutin: start, dateCloture: end },
        now
      )
    ).toBe(true);
    expect(
      isElectionVotingOpen(
        { status: "Ouverte", dateScrutin: before, dateCloture: start },
        now
      )
    ).toBe(false);
  });

  it("isElectionCandidacyOpen", () => {
    expect(
      isElectionCandidacyOpen(
        {
          status: "Ouverte",
          dateOuverture: before,
          dateClotureCandidature: end,
        },
        now
      )
    ).toBe(true);
  });

  it("canWithdrawCandidacy — avant scrutin sans vote", () => {
    expect(
      canWithdrawCandidacy({
        electionStatus: "Ouverte",
        myCandidacyStatus: "EnAttente",
        dateScrutin: after,
        hasVotesOnCandidacy: false,
        now,
      })
    ).toBe(true);
    expect(
      canWithdrawCandidacy({
        electionStatus: "Ouverte",
        myCandidacyStatus: "Validee",
        dateScrutin: after,
        hasVotesOnCandidacy: false,
        now,
      })
    ).toBe(true);
  });

  it("canWithdrawCandidacy — après dateScrutin interdit", () => {
    expect(
      canWithdrawCandidacy({
        electionStatus: "Ouverte",
        myCandidacyStatus: "Validee",
        dateScrutin: before,
        hasVotesOnCandidacy: false,
        now,
      })
    ).toBe(false);
    expect(
      getCandidacyWithdrawalBlockReason({
        electionStatus: "Ouverte",
        myCandidacyStatus: "Validee",
        dateScrutin: before,
        hasVotesOnCandidacy: false,
        now,
      })
    ).toMatch(/scrutin a commencé/);
  });

  it("canWithdrawCandidacy — vote existant interdit même avant scrutin", () => {
    expect(
      canWithdrawCandidacy({
        electionStatus: "Ouverte",
        myCandidacyStatus: "Validee",
        dateScrutin: after,
        hasVotesOnCandidacy: true,
        now,
      })
    ).toBe(false);
    expect(
      getCandidacyWithdrawalBlockReason({
        electionStatus: "Ouverte",
        myCandidacyStatus: "Validee",
        dateScrutin: after,
        hasVotesOnCandidacy: true,
        now,
      })
    ).toMatch(/votes ont déjà été enregistrés/);
  });

  it("canWithdrawCandidacy — après scrutin + vote", () => {
    expect(
      canWithdrawCandidacy({
        electionStatus: "Ouverte",
        myCandidacyStatus: "Validee",
        dateScrutin: before,
        hasVotesOnCandidacy: true,
        now,
      })
    ).toBe(false);
  });

  it("canWithdrawCandidacy — Cloturee interdit", () => {
    expect(
      canWithdrawCandidacy({
        electionStatus: "Cloturee",
        myCandidacyStatus: "EnAttente",
        dateScrutin: after,
        hasVotesOnCandidacy: false,
        now,
      })
    ).toBe(false);
  });

  it("scopes / canVote", () => {
    expect(
      electionListScope(
        { status: "Ouverte", dateScrutin: start, dateCloture: end },
        now
      )
    ).toBe("open");
    expect(
      electionVotingPhase(
        { status: "Ouverte", dateScrutin: after, dateCloture: end },
        now
      )
    ).toBe("before");
    const open = memberElectionState({
      status: "Ouverte",
      dateScrutin: start,
      dateCloture: end,
      eligible: true,
      votedPositionIds: [],
      positionIds: ["p1"],
      now,
    });
    expect(open.canVote).toBe(true);
  });
});
