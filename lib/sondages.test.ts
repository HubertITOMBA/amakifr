import { describe, expect, it } from "vitest";
import {
  countSurveysToComplete,
  getSondageStatusPresentation,
  getSurveyRequiredProgress,
  isRequiredQuestionAnswered,
  isSondageCorrigeVisiblesPourAdherent,
  isSondageResultatsCollectifsVisiblesPourAdherent,
  isSurveyCompleteForMember,
  isSurveyToComplete,
  validateQuizReadyForOpen,
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

describe("getSondageStatusPresentation", () => {
  it("Ouvert + échéance passée → Terminé — échéance passée (sans écrire DB)", () => {
    const p = getSondageStatusPresentation(
      {
        status: "Ouvert",
        dateDebut: new Date("2026-01-01T00:00:00.000Z"),
        dateFin: new Date("2026-01-31T00:00:00.000Z"),
      },
      new Date("2026-02-15T00:00:00.000Z")
    );
    expect(p.effectif).toBe("Cloture");
    expect(p.badgeKey).toBe("Cloture");
    expect(p.label).toBe("Terminé — échéance passée");
    expect(p.echeancePassee).toBe(true);
  });

  it("Cloture stockée → Terminé", () => {
    const p = getSondageStatusPresentation({
      status: "Cloture",
      dateDebut: new Date("2026-01-01T00:00:00.000Z"),
      dateFin: new Date("2026-01-31T00:00:00.000Z"),
    });
    expect(p.label).toBe("Terminé");
    expect(p.echeancePassee).toBe(false);
  });
});

describe("isSondageResultatsCollectifsVisiblesPourAdherent", () => {
  const past = {
    status: "Cloture" as const,
    dateDebut: new Date("2026-01-01T00:00:00.000Z"),
    dateFin: new Date("2026-01-31T00:00:00.000Z"),
  };

  it("clôture seule → masqués", () => {
    expect(
      isSondageResultatsCollectifsVisiblesPourAdherent({
        ...past,
        resultatsVisiblesAdherents: false,
      })
    ).toBe(false);
  });

  it("autorisés après clôture + flag ADMIN", () => {
    expect(
      isSondageResultatsCollectifsVisiblesPourAdherent({
        ...past,
        resultatsVisiblesAdherents: true,
      })
    ).toBe(true);
  });

  it("flag true mais encore ouvert → masqués", () => {
    const now = new Date("2026-01-15T12:00:00.000Z");
    expect(
      isSondageResultatsCollectifsVisiblesPourAdherent(
        {
          status: "Ouvert",
          dateDebut: new Date("2026-01-01T00:00:00.000Z"),
          dateFin: new Date("2026-01-31T00:00:00.000Z"),
          resultatsVisiblesAdherents: true,
        },
        now
      )
    ).toBe(false);
  });
});

describe("validateQuizReadyForOpen", () => {
  const baseOpt = (id: string, estCorrecte = false) => ({
    id,
    ordre: 0,
    libelle: id,
    permetTexteLibre: false,
    estCorrecte,
  });

  it("ignore les sondages classiques", () => {
    expect(
      validateQuizReadyForOpen("Sondage", [
        {
          ordre: 0,
          libelle: "Q",
          type: "TexteLibre",
          obligatoire: true,
          options: [],
          lignesMatrice: [],
        },
      ])
    ).toBeNull();
  });

  it("exige ChoixUnique + une bonne réponse", () => {
    expect(
      validateQuizReadyForOpen("Quiz", [
        {
          ordre: 0,
          libelle: "Capitale",
          type: "ChoixMultiple",
          obligatoire: true,
          options: [baseOpt("a", true), baseOpt("b")],
          lignesMatrice: [],
        },
      ])
    ).toMatch(/choix unique/i);

    expect(
      validateQuizReadyForOpen("Quiz", [
        {
          ordre: 0,
          libelle: "Capitale",
          type: "ChoixUnique",
          obligatoire: true,
          options: [baseOpt("a"), baseOpt("b")],
          lignesMatrice: [],
        },
      ])
    ).toMatch(/bonne réponse/i);

    expect(
      validateQuizReadyForOpen("Quiz", [
        {
          ordre: 0,
          libelle: "Capitale",
          type: "ChoixUnique",
          obligatoire: true,
          options: [baseOpt("a", true), baseOpt("b")],
          lignesMatrice: [],
        },
      ])
    ).toBeNull();
  });
});

describe("isSondageCorrigeVisiblesPourAdherent", () => {
  const closed = {
    status: "Cloture" as const,
    dateDebut: new Date("2026-01-01T00:00:00.000Z"),
    dateFin: new Date("2026-01-31T00:00:00.000Z"),
  };

  it("masqué si pas Quiz / pas flag / encore ouvert", () => {
    expect(
      isSondageCorrigeVisiblesPourAdherent({
        ...closed,
        kind: "Sondage",
        corrigeVisiblesAdherents: true,
      })
    ).toBe(false);
    expect(
      isSondageCorrigeVisiblesPourAdherent({
        ...closed,
        kind: "Quiz",
        corrigeVisiblesAdherents: false,
      })
    ).toBe(false);
    expect(
      isSondageCorrigeVisiblesPourAdherent(
        {
          status: "Ouvert",
          dateDebut: new Date("2026-01-01T00:00:00.000Z"),
          dateFin: new Date("2026-12-31T00:00:00.000Z"),
          kind: "Quiz",
          corrigeVisiblesAdherents: true,
        },
        new Date("2026-06-01T00:00:00.000Z")
      )
    ).toBe(false);
  });

  it("visible après clôture Quiz + flag ADMIN", () => {
    expect(
      isSondageCorrigeVisiblesPourAdherent({
        ...closed,
        kind: "Quiz",
        corrigeVisiblesAdherents: true,
      })
    ).toBe(true);
  });
});
