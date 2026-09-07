import { beforeEach, describe, expect, it, vi } from "vitest";
import { ServiceError } from "@/lib/service-error";

const {
  resolveApiActorMock,
  getMyEvents,
  getMyEventsSummary,
  getMyEvent,
  registerMyEvent,
  withdrawMyEvent,
} = vi.hoisted(() => ({
  resolveApiActorMock: vi.fn(),
  getMyEvents: vi.fn(),
  getMyEventsSummary: vi.fn(),
  getMyEvent: vi.fn(),
  registerMyEvent: vi.fn(),
  withdrawMyEvent: vi.fn(),
}));

vi.mock("@/lib/api/auth-resolve", () => ({
  resolveApiActor: resolveApiActorMock,
}));
vi.mock("@/lib/services/evenements/get-my-events", () => ({
  getMyEvents,
  getMyEventsSummary,
  getMyEvent,
}));
vi.mock("@/lib/services/evenements/register-my-event", () => ({
  registerMyEvent,
  withdrawMyEvent,
}));

import { GET as listGet } from "@/app/api/v1/me/evenements/route";
import { GET as detailGet } from "@/app/api/v1/me/evenements/[id]/route";
import {
  POST as registerPost,
  DELETE as withdrawDelete,
} from "@/app/api/v1/me/evenements/[id]/inscription/route";

function req(url: string, init?: RequestInit) {
  return {
    nextUrl: new URL(url),
    json: async () =>
      init?.body ? JSON.parse(String(init.body)) : {},
  } as any;
}

const actor = () => ({ userId: "u1" });

describe("GET /api/v1/me/evenements", () => {
  beforeEach(() => {
    resolveApiActorMock.mockReset();
    getMyEvents.mockReset();
    getMyEventsSummary.mockReset();
  });

  it("401", async () => {
    resolveApiActorMock.mockResolvedValue(null);
    expect(
      (await listGet(req("http://localhost/api/v1/me/evenements"))).status
    ).toBe(401);
  });

  it("refuse userId", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    const res = await listGet(
      req("http://localhost/api/v1/me/evenements?userId=x")
    );
    expect(res.status).toBe(400);
  });

  it("summary=1", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    getMyEventsSummary.mockResolvedValue({ upcomingCount: 2, nextEvent: null });
    const res = await listGet(
      req("http://localhost/api/v1/me/evenements?summary=1")
    );
    expect(res.status).toBe(200);
    expect((await res.json()).data.upcomingCount).toBe(2);
  });

  it("scope past", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    getMyEvents.mockResolvedValue({
      items: [],
      total: 0,
      limit: 20,
      offset: 0,
    });
    const res = await listGet(
      req("http://localhost/api/v1/me/evenements?scope=past&limit=10")
    );
    expect(res.status).toBe(200);
    expect(getMyEvents).toHaveBeenCalledWith(actor(), {
      scope: "past",
      limit: 10,
      offset: undefined,
    });
  });
});

describe("GET détail / inscription", () => {
  beforeEach(() => {
    resolveApiActorMock.mockReset();
    getMyEvent.mockReset();
    registerMyEvent.mockReset();
    withdrawMyEvent.mockReset();
  });

  it("détail OK", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    getMyEvent.mockResolvedValue({ id: "e1", titre: "AG" });
    const res = await detailGet(
      req("http://localhost/api/v1/me/evenements/e1"),
      { params: Promise.resolve({ id: "e1" }) }
    );
    expect(res.status).toBe(200);
  });

  it("POST refuse adherentId body", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    const res = await registerPost(
      {
        nextUrl: new URL("http://localhost/api/v1/me/evenements/e1/inscription"),
        json: async () => ({ adherentId: "x", nombrePersonnes: 1 }),
      } as any,
      { params: Promise.resolve({ id: "e1" }) }
    );
    expect(res.status).toBe(400);
    expect(registerMyEvent).not.toHaveBeenCalled();
  });

  it("DELETE succès", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    withdrawMyEvent.mockResolvedValue({ withdrawn: true });
    const res = await withdrawDelete(
      req("http://localhost/api/v1/me/evenements/e1/inscription"),
      { params: Promise.resolve({ id: "e1" }) }
    );
    expect(res.status).toBe(200);
  });

  it("POST erreur métier", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    registerMyEvent.mockRejectedValue(
      new ServiceError("FORBIDDEN", "Pas assez de places disponibles")
    );
    const res = await registerPost(
      {
        nextUrl: new URL("http://localhost/api/v1/me/evenements/e1/inscription"),
        json: async () => ({ nombrePersonnes: 1 }),
      } as any,
      { params: Promise.resolve({ id: "e1" }) }
    );
    expect(res.status).toBe(403);
  });
});
