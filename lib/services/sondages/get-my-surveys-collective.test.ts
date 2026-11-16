import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContext } from "@/lib/auth-context";
import { ServiceError } from "@/lib/service-error";

const {
  findUniqueAdherent,
  findUniqueSondage,
  findUniqueReponse,
  countAdherent,
} = vi.hoisted(() => ({
  findUniqueAdherent: vi.fn(),
  findUniqueSondage: vi.fn(),
  findUniqueReponse: vi.fn(),
  countAdherent: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    adherent: {
      findUnique: findUniqueAdherent,
      count: countAdherent,
    },
    sondage: { findUnique: findUniqueSondage },
    sondageReponse: { findUnique: findUniqueReponse },
  },
}));

import {
  getMySurvey,
  getMySurveyCollectiveResults,
  getMySurveyPersonalSynthese,
} from "@/lib/services/sondages/get-my-surveys";

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

const closedBase = {
  id: "s1",
  sujet: "Quiz",
  introduction: "Consigne test",
  conclusion: null,
  status: "Cloture" as const,
  dateDebut: new Date("2026-01-01T00:00:00.000Z"),
  dateFin: new Date("2026-01-31T00:00:00.000Z"),
  resultatsVisiblesAdherents: false,
  questions: [
    {
      id: "q1",
      ordre: 1,
      section: null,
      libelle: "Couleur ?",
      type: "ChoixUnique",
      obligatoire: true,
      maxSelections: null,
      minCaracteres: null,
      maxCaracteres: null,
      options: [
        { id: "o1", ordre: 1, libelle: "Bleu", permetTexteLibre: false },
        { id: "o2", ordre: 2, libelle: "Vert", permetTexteLibre: false },
      ],
      lignesMatrice: [],
    },
  ],
};

describe("résultats collectifs vs synthèse personnelle", () => {
  beforeEach(() => {
    findUniqueAdherent.mockReset();
    findUniqueSondage.mockReset();
    findUniqueReponse.mockReset();
    countAdherent.mockReset();
    findUniqueAdherent.mockResolvedValue({ id: "adh-A" });
  });

  it("détail non répondu : questions + message, collectifs masqués", async () => {
    findUniqueSondage.mockResolvedValue(closedBase);
    findUniqueReponse.mockResolvedValue(null);

    const detail = await getMySurvey(actor(), "s1");
    expect(detail.vue).toBe("non_repondu");
    expect(detail.synthesePersonnelle?.message).toMatch(/pas répondu/i);
    expect(detail.questions).toHaveLength(1);
    expect(detail.questions[0].options).toHaveLength(2);
    expect(detail.introduction).toBe("Consigne test");
    expect(detail.resultatsCollectifsPublies).toBe(false);
  });

  it("synthèse personnelle OK même si collectifs masqués", async () => {
    findUniqueSondage.mockResolvedValue(closedBase);
    findUniqueReponse.mockResolvedValue({
      id: "r1",
      soumiseLe: new Date("2026-01-10T00:00:00.000Z"),
      modifieLe: new Date("2026-01-11T00:00:00.000Z"),
      items: [
        {
          questionId: "q1",
          optionId: "o1",
          ligneMatriceId: null,
          texteLibre: null,
        },
      ],
    });

    const perso = await getMySurveyPersonalSynthese(actor(), "s1");
    expect(perso.aRepondu).toBe(true);
    expect(perso.questions[0].reponses).toEqual(["Bleu"]);

    await expect(
      getMySurveyCollectiveResults(actor(), "s1")
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: expect.stringMatching(/pas encore autorisés/i),
    });
  });

  it("accès direct collectifs autorisé après flag ADMIN", async () => {
    findUniqueSondage.mockResolvedValue({
      ...closedBase,
      resultatsVisiblesAdherents: true,
      reponses: [
        {
          id: "r1",
          items: [
            {
              id: "i1",
              reponseId: "r1",
              questionId: "q1",
              optionId: "o1",
              ligneMatriceId: null,
              texteLibre: null,
            },
          ],
        },
      ],
    });
    countAdherent.mockResolvedValue(10);

    const out = await getMySurveyCollectiveResults(actor(), "s1");
    expect(out.totalReponses).toBe(1);
    expect(out.questions[0].choix?.[0]).toMatchObject({
      optionId: "o1",
      count: 1,
    });
    expect(JSON.stringify(out)).not.toMatch(/corrige/i);
  });

  it("flag true mais sondage encore ouvert → refus", async () => {
    findUniqueSondage.mockResolvedValue({
      ...closedBase,
      status: "Ouvert",
      dateFin: new Date(Date.now() + 86400000),
      resultatsVisiblesAdherents: true,
      reponses: [],
    });
    await expect(
      getMySurveyCollectiveResults(actor(), "s1")
    ).rejects.toBeInstanceOf(ServiceError);
  });
});
