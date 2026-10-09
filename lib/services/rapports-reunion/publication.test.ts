import { beforeEach, describe, expect, it, vi } from "vitest";

const { findUnique, update } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    rapportReunion: { findUnique, update },
  },
}));

import {
  publishRapportReunion,
  unpublishRapportReunion,
} from "@/lib/services/rapports-reunion/publication";

beforeEach(() => {
  findUnique.mockReset();
  update.mockReset();
});

describe("publishRapportReunion", () => {
  it("NOT_FOUND si absent", async () => {
    findUnique.mockResolvedValue(null);
    await expect(
      publishRapportReunion("x", "user-1")
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("renseigne publishedAt et statut PUBLISHED", async () => {
    findUnique.mockResolvedValue({
      id: "r1",
      statut: "DRAFT",
      publishedAt: null,
      publishedBy: null,
    });
    const publishedAt = new Date("2026-10-08T12:00:00.000Z");
    update.mockResolvedValue({
      id: "r1",
      statut: "PUBLISHED",
      publishedAt,
    });
    const result = await publishRapportReunion("r1", "user-admin");
    expect(result.statut).toBe("PUBLISHED");
    expect(result.publishedAt).toEqual(publishedAt);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          statut: "PUBLISHED",
          publishedBy: "user-admin",
        }),
      })
    );
  });

  it("déjà PUBLISHED → no-op (conserve publishedAt / publishedBy)", async () => {
    const publishedAt = new Date("2026-01-15T10:00:00.000Z");
    findUnique.mockResolvedValue({
      id: "r1",
      statut: "PUBLISHED",
      publishedAt,
      publishedBy: "user-original",
    });

    const result = await publishRapportReunion("r1", "user-admin");

    expect(result).toEqual({
      id: "r1",
      statut: "PUBLISHED",
      publishedAt,
    });
    expect(update).not.toHaveBeenCalled();
  });
});

describe("unpublishRapportReunion", () => {
  it("remet publishedAt à null", async () => {
    findUnique.mockResolvedValue({ id: "r1", statut: "PUBLISHED" });
    update.mockResolvedValue({ id: "r1", statut: "DRAFT" });
    const result = await unpublishRapportReunion("r1", "user-admin");
    expect(result.statut).toBe("DRAFT");
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          statut: "DRAFT",
          publishedAt: null,
          publishedBy: null,
        }),
      })
    );
  });

  it("déjà DRAFT → no-op (pas d’update)", async () => {
    findUnique.mockResolvedValue({ id: "r1", statut: "DRAFT" });

    const result = await unpublishRapportReunion("r1", "user-admin");

    expect(result).toEqual({ id: "r1", statut: "DRAFT" });
    expect(update).not.toHaveBeenCalled();
  });
});
