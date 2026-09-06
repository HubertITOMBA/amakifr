import { describe, expect, it } from "vitest";
import {
  filterSurveysToAnswer,
  countSurveysToAnswer,
  formatSurveyProgress,
  shouldShowHomeSurveyCta,
  sondageErrorMessage,
} from "./sondages-state";

describe("sondages-state", () => {
  it("progression libellé", () => {
    expect(formatSurveyProgress(3, 5)).toMatch(/3/);
    expect(formatSurveyProgress(3, 5)).toMatch(/5/);
  });

  it("filtre à répondre", () => {
    const list = filterSurveysToAnswer([
      { estComplet: false, modifiable: true, id: "a" },
      { estComplet: true, modifiable: true, id: "b" },
      { estComplet: false, modifiable: false, id: "c" },
    ]);
    expect(list.map((x) => x.id)).toEqual(["a"]);
  });

  it("compteur exact multi-sondages + finalisé = 0", () => {
    expect(
      countSurveysToAnswer([
        { estComplet: false, modifiable: true },
        { estComplet: false, modifiable: true },
      ])
    ).toBe(2);
    expect(
      countSurveysToAnswer([{ estComplet: true, modifiable: true }])
    ).toBe(0);
  });

  it("erreur clôture", () => {
    expect(
      sondageErrorMessage({
        status: 403,
        code: "FORBIDDEN",
        message: "Ce sondage est maintenant clôturé.",
      })
    ).toMatch(/clôturé/i);
  });

  it("CTA accueil visible si count 1", () => {
    expect(shouldShowHomeSurveyCta(1)).toBe(true);
  });

  it("CTA accueil absent si count 0 (finalisé / aucun)", () => {
    expect(shouldShowHomeSurveyCta(0)).toBe(false);
  });

  it("CTA accueil absent si sondage clôturé (summary 0)", () => {
    // Clôturé → hors liste active backend → aCompleterCount = 0
    expect(
      countSurveysToAnswer([{ estComplet: false, modifiable: false }])
    ).toBe(0);
    expect(shouldShowHomeSurveyCta(0)).toBe(false);
  });

  it("plusieurs sondages dont un seul incomplet → CTA count 1", () => {
    const count = countSurveysToAnswer([
      { estComplet: false, modifiable: true },
      { estComplet: true, modifiable: true },
      { estComplet: false, modifiable: false },
    ]);
    expect(count).toBe(1);
    expect(shouldShowHomeSurveyCta(count)).toBe(true);
  });

  it("finalisation dernier sondage → CTA disparaît", () => {
    expect(shouldShowHomeSurveyCta(1)).toBe(true);
    expect(shouldShowHomeSurveyCta(0)).toBe(false);
  });
});
