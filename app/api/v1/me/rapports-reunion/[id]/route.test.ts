import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ServiceError } from "@/lib/service-error";

const { resolveApiActor, getPublished } = vi.hoisted(() => ({
  resolveApiActor: vi.fn(),
  getPublished: vi.fn(),
}));

vi.mock("@/lib/api/auth-resolve", () => ({
  resolveApiActor,
}));

vi.mock("@/lib/services/rapports-reunion/published-rapports", () => ({
  getPublishedRapportForAdherent: getPublished,
}));

import { GET } from "@/app/api/v1/me/rapports-reunion/[id]/route";

beforeEach(() => {
  resolveApiActor.mockReset();
  getPublished.mockReset();
});

describe("GET /api/v1/me/rapports-reunion/[id]", () => {
  it("brouillon / inconnu → 404", async () => {
    resolveApiActor.mockResolvedValue({
      userId: "u1",
      role: "MEMBRE",
      status: "Actif",
      adminRoles: [],
      channel: "mobile",
    });
    getPublished.mockRejectedValue(
      new ServiceError("NOT_FOUND", "Rapport non trouvé")
    );
    const res = await GET(
      new NextRequest("http://localhost/api/v1/me/rapports-reunion/x"),
      { params: Promise.resolve({ id: "x" }) }
    );
    expect(res.status).toBe(404);
  });

  it("PUBLISHED → détail", async () => {
    resolveApiActor.mockResolvedValue({
      userId: "u1",
      role: "MEMBRE",
      status: "Actif",
      adminRoles: [],
      channel: "mobile",
    });
    getPublished.mockResolvedValue({
      id: "r1",
      titre: "CR",
      reunionMensuelleId: null,
      dateReunion: null,
      authorDisplayName: "A",
      publishedAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      contenuHtml: "<p>x</p>",
    });
    const res = await GET(
      new NextRequest("http://localhost/api/v1/me/rapports-reunion/r1"),
      { params: Promise.resolve({ id: "r1" }) }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.contenuHtml).toBe("<p>x</p>");
  });
});
