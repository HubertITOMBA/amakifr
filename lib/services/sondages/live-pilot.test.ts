import { describe, expect, it } from "vitest";
import { buildLivePilotSnapshot } from "@/lib/services/sondages/live-pilot";
import { mergeSurveyAnswerItems } from "@/lib/services/sondages/submit-my-survey-answers";
import { isSurveyToComplete } from "@/lib/sondages";

describe("buildLivePilotSnapshot", () => {
  it("repère la question ouverte et la suivante", () => {
    const snap = buildLivePilotSnapshot([
      {
        id: "q1",
        ordre: 0,
        libelle: "A",
        liveEtat: "Fermee",
      },
      {
        id: "q2",
        ordre: 1,
        libelle: "B",
        liveEtat: "Ouverte",
      },
      {
        id: "q3",
        ordre: 2,
        libelle: "C",
        liveEtat: "EnAttente",
      },
    ]);
    expect(snap.questionActiveId).toBe("q2");
    expect(snap.nextQuestionId).toBe("q3");
  });
});

describe("mergeSurveyAnswerItems", () => {
  it("conserve les réponses des autres questions", () => {
    const merged = mergeSurveyAnswerItems(
      [
        { questionId: "q1", optionId: "o1" },
        { questionId: "q2", optionId: "o2" },
      ],
      [{ questionId: "q2", optionId: "o2b" }],
      new Set(["q2"])
    );
    expect(merged).toEqual([
      { questionId: "q1", optionId: "o1" },
      { questionId: "q2", optionId: "o2b" },
    ]);
  });
});

describe("isSurveyToComplete + En direct", () => {
  it("exclut les quiz En direct du bandeau classique 1.1.1", () => {
    expect(
      isSurveyToComplete({
        estComplet: false,
        modifiable: true,
        modeEnDirect: true,
      })
    ).toBe(false);
    expect(
      isSurveyToComplete({
        estComplet: false,
        modifiable: true,
        modeEnDirect: false,
      })
    ).toBe(true);
  });
});
