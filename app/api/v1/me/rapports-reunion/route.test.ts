import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { resolveApiActor, listPublished } = vi.hoisted(() => ({
  resolveApiActor: vi.fn(),
  listPublished: vi.fn(),
}));

vi.mock("@/lib/api/auth-resolve", () => ({
  resolveApiActor,
}));

vi.mock("@/lib/services/rapports-reunion/published-rapports", () => ({
  listPublishedRapportsForAdherent: listPublished,
}));

import { GET } from "@/app/api/v1/me/rapports-reunion/route";

beforeEach(() => {
  resolveApiActor.mockReset();
  listPublished.mockReset();
});

describe("GET /api/v1/me/rapports-reunion", () => {
  it("401 sans acteur", async () => {
    resolveApiActor.mockResolvedValue(null);
    const res = await GET(
      new NextRequest("http://localhost/api/v1/me/rapports-reunion")
    );
    expect(res.status).toBe(401);
  });

  it("refuse userId/adherentId query", async () => {
    resolveApiActor.mockResolvedValue({
      userId: "u1",
      role: "MEMBRE",
      status: "Actif",
      adminRoles: [],
      channel: "mobile",
    });
    const res = await GET(
      new NextRequest(
        "http://localhost/api/v1/me/rapports-reunion?userId=other"
      )
    );
    expect(res.status).toBe(400);
  });

  it("Bearer valide → liste sans HTML", async () => {
    resolveApiActor.mockResolvedValue({
      userId: "u1",
      role: "MEMBRE",
      status: "Actif",
      adminRoles: [],
      channel: "mobile",
    });
    listPublished.mockResolvedValue({
      items: [
        {
          id: "r1",
          titre: "CR",
          reunionMensuelleId: null,
          dateReunion: null,
          authorDisplayName: "A",
          publishedAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      total: 1,
      limit: 20,
      offset: 0,
    });
    const res = await GET(
      new NextRequest("http://localhost/api/v1/me/rapports-reunion")
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.items[0]).not.toHaveProperty("contenuHtml");
  });

  it("limit > 50 → 400 VALIDATION_ERROR", async () => {
    const { ServiceError } = await import("@/lib/service-error");
    resolveApiActor.mockResolvedValue({
      userId: "u1",
      role: "MEMBRE",
      status: "Actif",
      adminRoles: [],
      channel: "mobile",
    });
    listPublished.mockRejectedValue(
      new ServiceError("VALIDATION_ERROR", "Number must be less than or equal to 50")
    );
    const res = await GET(
      new NextRequest(
        "http://localhost/api/v1/me/rapports-reunion?limit=51"
      )
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("limit non numérique → 400 VALIDATION_ERROR", async () => {
    resolveApiActor.mockResolvedValue({
      userId: "u1",
      role: "MEMBRE",
      status: "Actif",
      adminRoles: [],
      channel: "mobile",
    });
    const res = await GET(
      new NextRequest(
        "http://localhost/api/v1/me/rapports-reunion?limit=abc"
      )
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(listPublished).not.toHaveBeenCalled();
  });

  it("offset négatif → 400 VALIDATION_ERROR", async () => {
    const { ServiceError } = await import("@/lib/service-error");
    resolveApiActor.mockResolvedValue({
      userId: "u1",
      role: "MEMBRE",
      status: "Actif",
      adminRoles: [],
      channel: "mobile",
    });
    listPublished.mockRejectedValue(
      new ServiceError("VALIDATION_ERROR", "Number must be greater than or equal to 0")
    );
    const res = await GET(
      new NextRequest(
        "http://localhost/api/v1/me/rapports-reunion?offset=-1"
      )
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("pagination valide transmise inchangée", async () => {
    resolveApiActor.mockResolvedValue({
      userId: "u1",
      role: "MEMBRE",
      status: "Actif",
      adminRoles: [],
      channel: "mobile",
    });
    listPublished.mockResolvedValue({
      items: [],
      total: 0,
      limit: 10,
      offset: 5,
    });
    const res = await GET(
      new NextRequest(
        "http://localhost/api/v1/me/rapports-reunion?limit=10&offset=5"
      )
    );
    expect(res.status).toBe(200);
    expect(listPublished).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "u1" }),
      { limit: 10, offset: 5 }
    );
  });
});
