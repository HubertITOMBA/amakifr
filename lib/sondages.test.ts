import { describe, expect, it } from "vitest";
import {
  countSurveysToComplete,
  getSurveyRequiredProgress,
  isRequiredQuestionAnswered,
  isSurveyCompleteForMember,
  isSurveyToComplete,
  validateSondageDates,
} from "@/lib/sondages";

describe("validateSondageDates", () => {
  it("refuse fin <= début", () => {
    const d = new Date("2026-01-01T00:00:00.000Z");
    expect(validateSondageDates(d, d)).toMatch(/postérieure/);
  });

  it("accepte fin > début", () => {
    expect(
      validateSondageDates(
        new Date("2026-01-01T00:00:00.000Z"),
        new Date("2026-02-01T00:00:00.000Z")
      )
    ).toBeNull();
  });
});

describe("isSurveyCompleteForMember", () => {
  const questions = [
    {
      id: "q1",
      type: "ChoixUnique",
      obligatoire: true,
      lignesMatrice: [],
    },
    {
      id: "q2",
      type: "TexteLibre",
      obligatoire: false,
      lignesMatrice: [],
    },
    {
      id: "q3",
      type: "ChoixUnique",
      obligatoire: true,
      lignesMatrice: [],
    },
  ];

  it("incomplet sans réponse obligatoire", () => {
    expect(isSurveyCompleteForMember(questions, [])).toBe(false);
  });

  it("partiel 1/2 obligatoires → incomplet (summary doit rester > 0)", () => {
    expect(
      isSurveyCompleteForMember(questions, [
        { questionId: "q1", optionId: "o1" },
      ])
    ).toBe(false);
    expect(
      getSurveyRequiredProgress(questions, [
        { questionId: "q1", optionId: "o1" },
      ])
    ).toEqual({ requiredTotal: 2, requiredAnswered: 1 });
  });

  it("complet 3/3 obligatoires, facultative manquante → complete", () => {
    expect(
      isSurveyCompleteForMember(questions, [
        { questionId: "q1", optionId: "o1" },
        { questionId: "q3", optionId: "o3" },
      ])
    ).toBe(true);
  });
});

describe("Matrice obligatoire", () => {
  const matrix = {
    id: "qm",
    type: "Matrice",
    obligatoire: true,
    lignesMatrice: [{ id: "l1" }, { id: "l2" }],
  };

  it("incomplète si une ligne manque", () => {
    expect(
      isRequiredQuestionAnswered(matrix, [
        { questionId: "qm", ligneMatriceId: "l1", optionId: "c1" },
      ])
    ).toBe(false);
    expect(
      isSurveyCompleteForMember([matrix], [
        { questionId: "qm", ligneMatriceId: "l1", optionId: "c1" },
      ])
    ).toBe(false);
  });

  it("complète si toutes les lignes ont une option", () => {
    const items = [
      { questionId: "qm", ligneMatriceId: "l1", optionId: "c1" },
      { questionId: "qm", ligneMatriceId: "l2", optionId: "c2" },
    ];
    expect(isRequiredQuestionAnswered(matrix, items)).toBe(true);
    expect(isSurveyCompleteForMember([matrix], items)).toBe(true);
  });
});

describe("countSurveysToComplete / summary rule", () => {
  it("summary = 0 après complet", () => {
    expect(
      countSurveysToComplete([
        { estComplet: true, modifiable: true },
        { estComplet: false, modifiable: false },
      ])
    ).toBe(0);
  });

  it("summary = 1 si un seul à compléter", () => {
    expect(
      countSurveysToComplete([
        { estComplet: false, modifiable: true },
        { estComplet: true, modifiable: true },
      ])
    ).toBe(1);
  });

  it("isSurveyToComplete source unique", () => {
    expect(isSurveyToComplete({ estComplet: false, modifiable: true })).toBe(
      true
    );
    expect(isSurveyToComplete({ estComplet: true, modifiable: true })).toBe(
      false
    );
  });
});
