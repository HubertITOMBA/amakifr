import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContext } from "@/lib/auth-context";
import { ServiceError } from "@/lib/service-error";

const {
  findUniqueAdherent,
  findUniqueSondage,
  findUniqueReponse,
  transaction,
} = vi.hoisted(() => ({
  findUniqueAdherent: vi.fn(),
  findUniqueSondage: vi.fn(),
  findUniqueReponse: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    adherent: { findUnique: findUniqueAdherent },
    sondage: { findUnique: findUniqueSondage },
    sondageReponse: { findUnique: findUniqueReponse },
    $transaction: transaction,
  },
}));

import { submitMySurveyAnswers } from "@/lib/services/sondages/submit-my-survey-answers";
import { getMyActiveSurveys } from "@/lib/services/sondages/get-my-surveys";

function actor(): AuthContext {
  return {
    userId: "user-A",
    role: "MEMBRE",
    status: "Actif",
    email: "a@example.com",
    name: "Ada",
    sessionId: null,
    adminRoles: [],
    adherentId: null,
    channel: "mobile",
  };
}

const nowOpen = {
  status: "Ouvert" as const,
  dateDebut: new Date(Date.now() - 86400000),
  dateFin: new Date(Date.now() + 86400000),
};

describe("submitMySurveyAnswers", () => {
  beforeEach(() => {
    findUniqueAdherent.mockReset();
    findUniqueSondage.mockReset();
    findUniqueReponse.mockReset();
    transaction.mockReset();
    findUniqueAdherent.mockResolvedValue({ id: "adh-A" });
  });

  it("refuse sondage clôturé", async () => {
    findUniqueSondage.mockResolvedValue({
      id: "s1",
      status: "Cloture",
      dateDebut: nowOpen.dateDebut,
      dateFin: nowOpen.dateFin,
      questions: [],
    });
    await expect(
      submitMySurveyAnswers(actor(), "s1", {
        items: [],
        mode: "partial",
      })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: expect.stringMatching(/clôturé/i),
    });
  });

  it("refuse choix d'une autre question", async () => {
    findUniqueSondage.mockResolvedValue({
      id: "s1",
      ...nowOpen,
      questions: [
        {
          id: "q1",
          type: "ChoixUnique",
          obligatoire: true,
          maxSelections: null,
          minCaracteres: null,
          maxCaracteres: null,
          options: [{ id: "o1" }],
          lignesMatrice: [],
        },
      ],
    });
    await expect(
      submitMySurveyAnswers(actor(), "s1", {
        items: [{ questionId: "q1", optionId: "o-foreign" }],
        mode: "partial",
      })
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("partial sans toutes les obligatoires OK", async () => {
    findUniqueSondage.mockResolvedValue({
      id: "s1",
      ...nowOpen,
      questions: [
        {
          id: "q1",
          type: "ChoixUnique",
          obligatoire: true,
          maxSelections: null,
          minCaracteres: null,
          maxCaracteres: null,
          options: [{ id: "o1" }],
          lignesMatrice: [],
        },
        {
          id: "q2",
          type: "TexteLibre",
          obligatoire: true,
          maxSelections: null,
          minCaracteres: null,
          maxCaracteres: null,
          options: [],
          lignesMatrice: [],
        },
      ],
    });
    transaction.mockImplementation(async (fn: any) =>
      fn({
        sondageReponse: {
          findUnique: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({
            id: "r1",
            items: [{ questionId: "q1", optionId: "o1", ligneMatriceId: null, texteLibre: null }],
          }),
          update: vi.fn(),
        },
        sondageReponseItem: { deleteMany: vi.fn() },
      })
    );

    const res = await submitMySurveyAnswers(actor(), "s1", {
      items: [{ questionId: "q1", optionId: "o1" }],
      mode: "partial",
    });
    expect(res.estComplet).toBe(false);
    expect(res.requiredAnswered).toBe(1);
  });
});

describe("getMyActiveSurveys filtering logic", () => {
  it("anti-IDOR : résolution adherent via actor.userId", async () => {
    findUniqueAdherent.mockResolvedValue(null);
    await expect(getMyActiveSurveys(actor())).rejects.toBeInstanceOf(ServiceError);
  });
});
