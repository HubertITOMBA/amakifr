import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ServiceError } from "@/lib/service-error";
import type { AuthContext } from "@/lib/auth-context";

const {
  resolveApiActorMock,
  getMyActiveSurveys,
  getMyClosedSurveys,
  getMySurveysSummary,
  getMySurvey,
  getMySurveyPersonalSynthese,
  getMySurveyCollectiveResults,
  submitMySurveyAnswers,
} = vi.hoisted(() => ({
  resolveApiActorMock: vi.fn(),
  getMyActiveSurveys: vi.fn(),
  getMyClosedSurveys: vi.fn(),
  getMySurveysSummary: vi.fn(),
  getMySurvey: vi.fn(),
  getMySurveyPersonalSynthese: vi.fn(),
  getMySurveyCollectiveResults: vi.fn(),
  submitMySurveyAnswers: vi.fn(),
}));

vi.mock("@/lib/api/auth-resolve", () => ({
  resolveApiActor: resolveApiActorMock,
}));
vi.mock("@/lib/services/sondages/get-my-surveys", () => ({
  getMyActiveSurveys,
  getMyClosedSurveys,
  getMySurveysSummary,
  getMySurvey,
  getMySurveyPersonalSynthese,
  getMySurveyCollectiveResults,
}));
vi.mock("@/lib/services/sondages/submit-my-survey-answers", () => ({
  submitMySurveyAnswers,
}));

import { GET } from "@/app/api/v1/me/sondages/route";
import { GET as GET_ONE } from "@/app/api/v1/me/sondages/[id]/route";
import { GET as GET_SYNTHESE } from "@/app/api/v1/me/sondages/[id]/synthese/route";
import { GET as GET_RESULTATS } from "@/app/api/v1/me/sondages/[id]/resultats/route";
import { POST } from "@/app/api/v1/me/sondages/[id]/reponses/route";

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

/**
 * Construit une NextRequest typée pour les handlers API me/sondages.
 */
function getReq(url: string, init?: RequestInit): NextRequest {
  return new NextRequest(new URL(url), init);
}

/**
 * NextRequest POST JSON pour /reponses.
 */
function postReq(url: string, body: Record<string, unknown>): NextRequest {
  return getReq(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("GET /api/v1/me/sondages", () => {
  beforeEach(() => {
    resolveApiActorMock.mockReset();
    getMyActiveSurveys.mockReset();
    getMyClosedSurveys.mockReset();
    getMySurveysSummary.mockReset();
  });

  it("401 si non auth", async () => {
    resolveApiActorMock.mockResolvedValue(null);
    const res = await GET(getReq("http://localhost/api/v1/me/sondages"));
    expect(res.status).toBe(401);
  });

  it("refuse userId query", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    const res = await GET(
      getReq("http://localhost/api/v1/me/sondages?userId=x")
    );
    expect(res.status).toBe(400);
  });

  it("summary=1", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    getMySurveysSummary.mockResolvedValue({ aCompleterCount: 2 });
    const res = await GET(
      getReq("http://localhost/api/v1/me/sondages?summary=1")
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.aCompleterCount).toBe(2);
  });

  it("summary=1 après complet → 0", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    getMySurveysSummary.mockResolvedValue({ aCompleterCount: 0 });
    const res = await GET(
      getReq("http://localhost/api/v1/me/sondages?summary=1")
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.aCompleterCount).toBe(0);
  });

  it("défaut → uniquement à compléter (compat 1.1.1)", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    getMyActiveSurveys.mockResolvedValue([
      {
        id: "s-todo",
        estComplet: false,
        modifiable: true,
        sujet: "A",
      },
      {
        id: "s-done",
        estComplet: true,
        modifiable: true,
        sujet: "B",
      },
    ]);
    const res = await GET(getReq("http://localhost/api/v1/me/sondages"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.items.map((i: { id: string }) => i.id)).toEqual([
      "s-todo",
    ]);
    expect(json.data.total).toBe(1);
    expect(json.data.scope).toBeUndefined();
  });

  it("scope=open → tous les ouverts y compris complétés", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    getMyActiveSurveys.mockResolvedValue([
      { id: "s-todo", estComplet: false, modifiable: true },
      { id: "s-done", estComplet: true, modifiable: true },
    ]);
    const res = await GET(
      getReq("http://localhost/api/v1/me/sondages?scope=open")
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.scope).toBe("open");
    expect(json.data.total).toBe(2);
    expect(getMyClosedSurveys).not.toHaveBeenCalled();
  });

  it("scope=closed → archives", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    getMyClosedSurveys.mockResolvedValue([
      { id: "s-old", estComplet: true, modifiable: false },
    ]);
    const res = await GET(
      getReq("http://localhost/api/v1/me/sondages?scope=closed")
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.scope).toBe("closed");
    expect(json.data.items).toHaveLength(1);
    expect(getMyActiveSurveys).not.toHaveBeenCalled();
  });

  it("scope invalide → 400", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    const res = await GET(
      getReq("http://localhost/api/v1/me/sondages?scope=past")
    );
    expect(res.status).toBe(400);
  });
});

describe("POST reponses", () => {
  beforeEach(() => {
    resolveApiActorMock.mockReset();
    submitMySurveyAnswers.mockReset();
  });

  it("refuse adherentId body", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    const res = await POST(
      postReq("http://localhost/api/v1/me/sondages/s1/reponses", {
        adherentId: "x",
        items: [],
      }),
      { params: Promise.resolve({ id: "s1" }) }
    );
    expect(res.status).toBe(400);
    expect(submitMySurveyAnswers).not.toHaveBeenCalled();
  });

  it("soumet partial", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    submitMySurveyAnswers.mockResolvedValue({
      id: "r1",
      estComplet: false,
      requiredTotal: 2,
      requiredAnswered: 1,
    });
    const res = await POST(
      postReq("http://localhost/api/v1/me/sondages/s1/reponses", {
        items: [{ questionId: "q1", optionId: "o1" }],
        mode: "partial",
      }),
      { params: Promise.resolve({ id: "s1" }) }
    );
    expect(res.status).toBe(200);
  });

  it("propager clôture", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    submitMySurveyAnswers.mockRejectedValue(
      new ServiceError("FORBIDDEN", "Ce sondage est maintenant clôturé.")
    );
    const res = await POST(
      postReq("http://localhost/api/v1/me/sondages/s1/reponses", {
        items: [],
      }),
      { params: Promise.resolve({ id: "s1" }) }
    );
    expect(res.status).toBe(403);
  });
});

describe("GET detail", () => {
  it("charge questionnaire", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    getMySurvey.mockResolvedValue({ id: "s1", sujet: "Test" });
    const res = await GET_ONE(
      getReq("http://localhost/api/v1/me/sondages/s1"),
      { params: Promise.resolve({ id: "s1" }) }
    );
    expect(res.status).toBe(200);
  });
});

describe("GET synthese personnelle", () => {
  beforeEach(() => {
    resolveApiActorMock.mockReset();
    getMySurveyPersonalSynthese.mockReset();
  });

  it("refuse avant clôture (accès direct API)", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    getMySurveyPersonalSynthese.mockRejectedValue(
      new ServiceError(
        "FORBIDDEN",
        "La synthèse personnelle n’est pas disponible avant la clôture du sondage."
      )
    );
    const res = await GET_SYNTHESE(
      getReq("http://localhost/api/v1/me/sondages/s1/synthese"),
      { params: Promise.resolve({ id: "s1" }) }
    );
    expect(res.status).toBe(403);
  });

  it("après clôture sans réponse → message", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    getMySurveyPersonalSynthese.mockResolvedValue({
      sondageId: "s1",
      sujet: "Quiz",
      aRepondu: false,
      message: "Vous n’avez pas répondu",
      questions: [],
      soumiseLe: null,
      modifieLe: null,
    });
    const res = await GET_SYNTHESE(
      getReq("http://localhost/api/v1/me/sondages/s1/synthese"),
      { params: Promise.resolve({ id: "s1" }) }
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.aRepondu).toBe(false);
    expect(json.data.message).toMatch(/pas répondu/i);
  });

  it("après clôture avec réponses → synthèse personnelle", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    getMySurveyPersonalSynthese.mockResolvedValue({
      sondageId: "s1",
      sujet: "Quiz",
      aRepondu: true,
      message: null,
      questions: [
        {
          questionId: "q1",
          libelle: "Couleur ?",
          type: "ChoixUnique",
          reponses: ["Bleu"],
        },
      ],
      soumiseLe: "2026-01-01T00:00:00.000Z",
      modifieLe: "2026-01-02T00:00:00.000Z",
    });
    const res = await GET_SYNTHESE(
      getReq("http://localhost/api/v1/me/sondages/s1/synthese"),
      { params: Promise.resolve({ id: "s1" }) }
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.aRepondu).toBe(true);
    expect(json.data.questions[0].reponses).toEqual(["Bleu"]);
  });
});

describe("GET resultats collectifs", () => {
  beforeEach(() => {
    resolveApiActorMock.mockReset();
    getMySurveyCollectiveResults.mockReset();
  });

  it("accès direct refusé si non autorisés", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    getMySurveyCollectiveResults.mockRejectedValue(
      new ServiceError(
        "FORBIDDEN",
        "Les résultats collectifs ne sont pas encore autorisés à la consultation."
      )
    );
    const res = await GET_RESULTATS(
      getReq("http://localhost/api/v1/me/sondages/s1/resultats"),
      { params: Promise.resolve({ id: "s1" }) }
    );
    expect(res.status).toBe(403);
  });

  it("OK après autorisation ADMIN", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    getMySurveyCollectiveResults.mockResolvedValue({
      sondageId: "s1",
      sujet: "Quiz",
      totalReponses: 2,
      totalAdherentsActifs: 10,
      tauxParticipation: 20,
      generatedAt: "2026-02-01T00:00:00.000Z",
      questions: [],
    });
    const res = await GET_RESULTATS(
      getReq("http://localhost/api/v1/me/sondages/s1/resultats"),
      { params: Promise.resolve({ id: "s1" }) }
    );
    expect(res.status).toBe(200);
  });
});
