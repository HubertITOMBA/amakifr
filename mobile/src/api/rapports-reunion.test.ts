import { beforeEach, describe, expect, it, vi } from "vitest";

const { authenticatedFetch } = vi.hoisted(() => ({
  authenticatedFetch: vi.fn(),
}));

vi.mock("@/auth/session", () => ({
  authenticatedFetch,
}));

import { getPublishedRapport } from "@/api/rapports-reunion";
import { ApiClientError } from "@/api/types";

describe("getPublishedRapport", () => {
  beforeEach(() => {
    authenticatedFetch.mockReset();
  });

  it("appelle le détail avec Bearer via authenticatedFetch (pas de userId)", async () => {
    authenticatedFetch.mockResolvedValue({
      id: "rapp-1",
      titre: "CR",
      reunionMensuelleId: "m1",
      dateReunion: "2026-03-14T00:00:00.000Z",
      authorDisplayName: "Secrétaire",
      publishedAt: "2026-03-15T00:00:00.000Z",
      updatedAt: "2026-03-15T00:00:00.000Z",
      contenuHtml: "<p>OK</p>",
    });

    const detail = await getPublishedRapport("rapp-1");

    expect(detail.id).toBe("rapp-1");
    expect(authenticatedFetch).toHaveBeenCalledTimes(1);
    expect(authenticatedFetch).toHaveBeenCalledWith(
      "/api/v1/me/rapports-reunion/rapp-1"
    );
    const path = authenticatedFetch.mock.calls[0][0] as string;
    expect(path).not.toMatch(/userId|adherentId/i);
  });

  it("propage 404 ApiClientError", async () => {
    authenticatedFetch.mockRejectedValue(
      new ApiClientError(404, "NOT_FOUND", "Rapport non trouvé")
    );
    await expect(getPublishedRapport("missing")).rejects.toMatchObject({
      status: 404,
      code: "NOT_FOUND",
    });
  });

  it("encode l’ID dans le path", async () => {
    authenticatedFetch.mockResolvedValue({
      id: "a/b",
      titre: "CR",
      reunionMensuelleId: null,
      dateReunion: null,
      authorDisplayName: "",
      publishedAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      contenuHtml: "",
    });
    await getPublishedRapport("a/b");
    expect(authenticatedFetch).toHaveBeenCalledWith(
      "/api/v1/me/rapports-reunion/a%2Fb"
    );
  });
});
