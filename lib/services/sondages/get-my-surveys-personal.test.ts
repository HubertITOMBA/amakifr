import { describe, expect, it } from "vitest";
import { buildPersonalSyntheseQuestions } from "@/lib/services/sondages/get-my-surveys";

describe("buildPersonalSyntheseQuestions", () => {
  it("formate choix unique / multiple / texte / matrice", () => {
    const questions = [
      {
        id: "q1",
        libelle: "Couleur ?",
        type: "ChoixUnique",
        options: [
          { id: "o1", libelle: "Bleu" },
          { id: "o2", libelle: "Vert" },
        ],
        lignesMatrice: [],
      },
      {
        id: "q2",
        libelle: "Fruits ?",
        type: "ChoixMultiple",
        options: [
          { id: "o3", libelle: "Pomme" },
          { id: "o4", libelle: "Poire" },
        ],
        lignesMatrice: [],
      },
      {
        id: "q3",
        libelle: "Commentaire",
        type: "TexteLibre",
        options: [],
        lignesMatrice: [],
      },
      {
        id: "q4",
        libelle: "Notes",
        type: "Matrice",
        options: [
          { id: "oa", libelle: "Bien" },
          { id: "ob", libelle: "Moyen" },
        ],
        lignesMatrice: [
          { id: "l1", libelle: "Accueil" },
          { id: "l2", libelle: "Contenu" },
        ],
      },
    ];
    const items = [
      { questionId: "q1", optionId: "o1" },
      { questionId: "q2", optionId: "o3" },
      { questionId: "q2", optionId: "o4" },
      { questionId: "q3", texteLibre: "  Merci  " },
      { questionId: "q4", ligneMatriceId: "l1", optionId: "oa" },
      { questionId: "q4", ligneMatriceId: "l2", optionId: "ob" },
    ];
    const out = buildPersonalSyntheseQuestions(questions, items);
    expect(out[0].reponses).toEqual(["Bleu"]);
    expect(out[1].reponses).toEqual(["Pomme", "Poire"]);
    expect(out[2].reponses).toEqual(["Merci"]);
    expect(out[3].reponses).toEqual([
      "Accueil : Bien",
      "Contenu : Moyen",
    ]);
  });

  it("n’expose pas d’agrégat collectif", () => {
    const out = buildPersonalSyntheseQuestions(
      [
        {
          id: "q1",
          libelle: "Q",
          type: "ChoixUnique",
          options: [{ id: "o1", libelle: "A" }],
          lignesMatrice: [],
        },
      ],
      [{ questionId: "q1", optionId: "o1" }]
    );
    expect(JSON.stringify(out)).not.toMatch(/total|taux|participation|corrig/i);
  });

  it("sans includeCorrige : pas de bonne réponse / explication / score déductible", () => {
    const questions = [
      {
        id: "q1",
        libelle: "Capitale de la France ?",
        type: "ChoixUnique",
        explication: "Paris est la capitale.",
        options: [
          { id: "o1", libelle: "Lyon", estCorrecte: false },
          { id: "o2", libelle: "Paris", estCorrecte: true },
        ],
        lignesMatrice: [],
      },
    ];
    const out = buildPersonalSyntheseQuestions(
      questions,
      [{ questionId: "q1", optionId: "o1" }],
      false
    );
    expect(out[0].reponses).toEqual(["Lyon"]);
    expect(out[0].estCorrecte).toBeUndefined();
    expect(out[0].bonneReponse).toBeUndefined();
    expect(out[0].explication).toBeUndefined();
    const raw = JSON.stringify(out);
    expect(raw).not.toMatch(/Paris est la capitale/);
    expect(raw).not.toMatch(/bonneReponse|estCorrecte|explication/);
  });

  it("avec includeCorrige : expose corrigé et exactitude", () => {
    const questions = [
      {
        id: "q1",
        libelle: "Capitale de la France ?",
        type: "ChoixUnique",
        explication: "Paris est la capitale.",
        options: [
          { id: "o1", libelle: "Lyon", estCorrecte: false },
          { id: "o2", libelle: "Paris", estCorrecte: true },
        ],
        lignesMatrice: [],
      },
    ];
    const out = buildPersonalSyntheseQuestions(
      questions,
      [{ questionId: "q1", optionId: "o1" }],
      true
    );
    expect(out[0].estCorrecte).toBe(false);
    expect(out[0].bonneReponse).toBe("Paris");
    expect(out[0].explication).toBe("Paris est la capitale.");
  });
});
