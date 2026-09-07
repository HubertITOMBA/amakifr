import { describe, expect, it } from "vitest";
import {
  buildBallotSummary,
  buildVotePayload,
  candidacyBadgeTone,
  createEmptyBallot,
  hasPositionChoice,
  isBallotComplete,
  selectBallotChoice,
  shouldShowApplyCta,
  shouldShowHomeCandidaciesHint,
  shouldShowHomeElectionsBanner,
  shouldShowWithdrawCta,
} from "@/api/elections-state";
import type { MyElectionPositionDto } from "@/api/types";

function pos(
  patch: Partial<MyElectionPositionDto>
): MyElectionPositionDto {
  return {
    id: "p1",
    titre: "Président",
    type: "President",
    description: null,
    nombreMandats: 1,
    alreadyVoted: false,
    myVote: null,
    candidates: [],
    canApply: false,
    canWithdraw: false,
    myCandidacyStatus: null,
    myCandidacyStatusLabel: null,
    myCandidacyId: null,
    ...patch,
  };
}

describe("elections-state", () => {
  it("banner CTA vote", () => {
    expect(shouldShowHomeElectionsBanner(0)).toBe(false);
    expect(shouldShowHomeElectionsBanner(1)).toBe(true);
  });

  it("hint candidatures", () => {
    expect(shouldShowHomeCandidaciesHint(0)).toBe(false);
    expect(shouldShowHomeCandidaciesHint(2)).toBe(true);
  });

  it("aucune sélection par défaut (≠ vote blanc)", () => {
    const ballot = createEmptyBallot();
    expect(hasPositionChoice(ballot, "p1")).toBe(false);
    expect(isBallotComplete(["p1", "p2"], ballot)).toBe(false);
  });

  it("sélection exclusive candidat / blanc", () => {
    let ballot = createEmptyBallot();
    ballot = selectBallotChoice(ballot, "p1", "c1");
    expect(ballot.p1).toBe("c1");
    ballot = selectBallotChoice(ballot, "p1", "blanc");
    expect(ballot.p1).toBe("blanc");
    ballot = selectBallotChoice(ballot, "p2", "c2");
    expect(ballot.p1).toBe("blanc");
    expect(ballot.p2).toBe("c2");
  });

  it("indépendance 2 postes", () => {
    let ballot = createEmptyBallot();
    ballot = selectBallotChoice(ballot, "p1", "c1");
    ballot = selectBallotChoice(ballot, "p2", "blanc");
    expect(isBallotComplete(["p1", "p2"], ballot)).toBe(true);
    expect(buildVotePayload(ballot, [])).toEqual([
      { positionId: "p1", candidacyId: "c1" },
      { positionId: "p2", candidacyId: null },
    ]);
  });

  it("buildVotePayload ignore déjà votés + map blanc", () => {
    const payload = buildVotePayload(
      { p1: "c1", p2: "blanc", p3: "c2" },
      ["p3"]
    );
    expect(payload).toEqual([
      { positionId: "p1", candidacyId: "c1" },
      { positionId: "p2", candidacyId: null },
    ]);
  });

  it("isBallotComplete", () => {
    expect(isBallotComplete(["p1", "p2"], { p1: "c1", p2: "blanc" })).toBe(
      true
    );
    expect(isBallotComplete(["p1", "p2"], { p1: "c1" })).toBe(false);
    expect(isBallotComplete(["p1"], { p1: undefined })).toBe(false);
  });

  it("buildBallotSummary", () => {
    const summary = buildBallotSummary(
      [
        {
          id: "p1",
          titre: "Président",
          candidates: [{ id: "c1", displayName: "Ada Lovelace" }],
        },
        { id: "p2", titre: "Secrétaire", candidates: [] },
      ],
      { p1: "c1", p2: "blanc" }
    );
    expect(summary).toContain("Président : Ada Lovelace");
    expect(summary).toContain("Secrétaire : Vote blanc");
  });

  it("nombreMandats n'autorise pas multi-sélection (règle Web = 1 choix / poste)", () => {
    // DTO expose nombreMandats pour info / résultats ; bulletin = radio exclusif.
    const ballotWithTwoWouldBeInvalid = { p1: "c1", p1b: "c2" };
    expect(isBallotComplete(["p1"], { p1: "c1" })).toBe(true);
    expect(hasPositionChoice(createEmptyBallot(), "p1")).toBe(false);
    // Un seul slot LocalBallot par positionId (écrasement exclusif).
    const b = selectBallotChoice(
      selectBallotChoice(createEmptyBallot(), "p1", "c1"),
      "p1",
      "c2"
    );
    expect(b.p1).toBe("c2");
    expect(Object.keys(ballotWithTwoWouldBeInvalid).length).toBe(2);
  });

  it("CTA candidature / retrait selon DTO serveur", () => {
    expect(shouldShowApplyCta(pos({ canApply: true }))).toBe(true);
    expect(
      shouldShowWithdrawCta(
        pos({ canWithdraw: true, myCandidacyStatus: "EnAttente" })
      )
    ).toBe(true);
    expect(
      shouldShowWithdrawCta(
        pos({ canWithdraw: false, myCandidacyStatus: "Validee" })
      )
    ).toBe(false);
    expect(candidacyBadgeTone("EnAttente")).toBe("warning");
  });

  it("canWithdraw false après scrutin / vote (DTO serveur)", () => {
    // Le serveur calcule canWithdraw ; le mobile ne fait que respecter le flag.
    expect(
      shouldShowWithdrawCta(pos({ canWithdraw: false, myCandidacyStatus: "Validee" }))
    ).toBe(false);
    expect(
      shouldShowWithdrawCta(pos({ canWithdraw: true, myCandidacyStatus: "Validee" }))
    ).toBe(true);
  });
});
