import { beforeEach, describe, expect, it, vi } from "vitest";
import { ServiceError } from "@/lib/service-error";
import type { AuthContext } from "@/lib/auth-context";

const { resolveApiActorMock, getMyActiveSurveys, getMySurveysSummary, getMySurvey, submitMySurveyAnswers } =
  vi.hoisted(() => ({
    resolveApiActorMock: vi.fn(),
    getMyActiveSurveys: vi.fn(),
    getMySurveysSummary: vi.fn(),
    getMySurvey: vi.fn(),
    submitMySurveyAnswers: vi.fn(),
  }));

vi.mock("@/lib/api/auth-resolve", () => ({
  resolveApiActor: resolveApiActorMock,
}));
vi.mock("@/lib/services/sondages/get-my-surveys", () => ({
  getMyActiveSurveys,
  getMySurveysSummary,
  getMySurvey,
}));
vi.mock("@/lib/services/sondages/submit-my-survey-answers", () => ({
  submitMySurveyAnswers,
}));

import { GET } from "@/app/api/v1/me/sondages/route";
import { GET as GET_ONE } from "@/app/api/v1/me/sondages/[id]/route";
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

function getReq(url: string) {
  return {
    nextUrl: new URL(url),
    headers: { get: () => null },
  } as any;
}

describe("GET /api/v1/me/sondages", () => {
  beforeEach(() => {
    resolveApiActorMock.mockReset();
    getMyActiveSurveys.mockReset();
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
});

describe("POST reponses", () => {
  beforeEach(() => {
    resolveApiActorMock.mockReset();
    submitMySurveyAnswers.mockReset();
  });

  it("refuse adherentId body", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    const res = await POST(
      {
        nextUrl: new URL("http://localhost/api/v1/me/sondages/s1/reponses"),
        json: async () => ({ adherentId: "x", items: [] }),
      } as any,
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
      {
        nextUrl: new URL("http://localhost/api/v1/me/sondages/s1/reponses"),
        json: async () => ({
          items: [{ questionId: "q1", optionId: "o1" }],
          mode: "partial",
        }),
      } as any,
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
      {
        nextUrl: new URL("http://localhost/api/v1/me/sondages/s1/reponses"),
        json: async () => ({ items: [] }),
      } as any,
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
