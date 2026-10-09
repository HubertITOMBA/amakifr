import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContext } from "@/lib/auth-context";

const {
  findUniqueAdherent,
  countRapports,
  findManyRapports,
  findFirstRapport,
} = vi.hoisted(() => ({
  findUniqueAdherent: vi.fn(),
  countRapports: vi.fn(),
  findManyRapports: vi.fn(),
  findFirstRapport: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    adherent: { findUnique: findUniqueAdherent },
    rapportReunion: {
      count: countRapports,
      findMany: findManyRapports,
      findFirst: findFirstRapport,
    },
  },
}));

import {
  getPublishedRapportForAdherent,
  listPublishedRapportsForAdherent,
  parsePublishedRapportsPageOptions,
} from "@/lib/services/rapports-reunion/published-rapports";

function actor(overrides: Partial<AuthContext> = {}): AuthContext {
  return {
    userId: "user-1",
    role: "MEMBRE",
    status: "Actif",
    email: "a@example.com",
    name: "Ada",
    sessionId: null,
    adminRoles: [],
    adherentId: null,
    channel: "mobile",
    ...overrides,
  };
}

beforeEach(() => {
  findUniqueAdherent.mockReset();
  countRapports.mockReset();
  findManyRapports.mockReset();
  findFirstRapport.mockReset();
});

describe("parsePublishedRapportsPageOptions", () => {
  it("limit > 50 → VALIDATION_ERROR", () => {
    expect(() => parsePublishedRapportsPageOptions({ limit: 51 })).toThrow(
      expect.objectContaining({ code: "VALIDATION_ERROR" })
    );
  });

  it("limit non numérique (NaN) → VALIDATION_ERROR", () => {
    expect(() =>
      parsePublishedRapportsPageOptions({ limit: Number.NaN })
    ).toThrow(expect.objectContaining({ code: "VALIDATION_ERROR" }));
  });

  it("offset négatif → VALIDATION_ERROR", () => {
    expect(() => parsePublishedRapportsPageOptions({ offset: -1 })).toThrow(
      expect.objectContaining({ code: "VALIDATION_ERROR" })
    );
  });

  it("valeurs valides inchangées (défauts + bornes)", () => {
    expect(parsePublishedRapportsPageOptions({})).toEqual({
      limit: 20,
      offset: 0,
    });
    expect(parsePublishedRapportsPageOptions({ limit: 50, offset: 10 })).toEqual(
      {
        limit: 50,
        offset: 10,
      }
    );
  });
});

describe("listPublishedRapportsForAdherent", () => {
  it("limit > 50 → VALIDATION_ERROR sans requête DB", async () => {
    findUniqueAdherent.mockResolvedValue({ id: "adh-1" });
    await expect(
      listPublishedRapportsForAdherent(actor(), { limit: 51 })
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(countRapports).not.toHaveBeenCalled();
    expect(findManyRapports).not.toHaveBeenCalled();
  });

  it("UNAUTHENTICATED si userId vide", async () => {
    await expect(
      listPublishedRapportsForAdherent(actor({ userId: "" }))
    ).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  });

  it("FORBIDDEN si compte Inactif", async () => {
    await expect(
      listPublishedRapportsForAdherent(actor({ status: "Inactif" }))
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("NOT_FOUND si pas d’adhérent", async () => {
    findUniqueAdherent.mockResolvedValue(null);
    await expect(
      listPublishedRapportsForAdherent(actor())
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("liste PUBLISHED sans contenu HTML", async () => {
    findUniqueAdherent.mockResolvedValue({ id: "adh-1" });
    countRapports.mockResolvedValue(1);
    findManyRapports.mockResolvedValue([
      {
        id: "r1",
        titre: "CR mars",
        reunionMensuelleId: "m1",
        dateReunion: new Date("2026-03-14T00:00:00.000Z"),
        publishedAt: new Date("2026-03-15T00:00:00.000Z"),
        updatedAt: new Date("2026-03-15T00:00:00.000Z"),
        CreatedBy: { name: "Secrétaire" },
      },
    ]);

    const page = await listPublishedRapportsForAdherent(actor(), {
      limit: 10,
      offset: 0,
    });
    expect(page.total).toBe(1);
    expect(page.items[0]).toMatchObject({
      id: "r1",
      titre: "CR mars",
      authorDisplayName: "Secrétaire",
    });
    expect(page.items[0]).not.toHaveProperty("contenuHtml");
    expect(page.items[0]).not.toHaveProperty("contenu");
    expect(findManyRapports).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { statut: "PUBLISHED" },
      })
    );
  });
});

describe("getPublishedRapportForAdherent", () => {
  it("DRAFT ou absent → NOT_FOUND non révélateur", async () => {
    findUniqueAdherent.mockResolvedValue({ id: "adh-1" });
    findFirstRapport.mockResolvedValue(null);
    await expect(
      getPublishedRapportForAdherent(actor(), "draft-or-unknown")
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Rapport non trouvé",
    });
    expect(findFirstRapport).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "draft-or-unknown", statut: "PUBLISHED" },
      })
    );
  });

  it("PUBLISHED → détail avec contenuHtml", async () => {
    findUniqueAdherent.mockResolvedValue({ id: "adh-1" });
    findFirstRapport.mockResolvedValue({
      id: "r1",
      titre: "CR",
      reunionMensuelleId: null,
      dateReunion: new Date("2026-03-14T00:00:00.000Z"),
      publishedAt: new Date("2026-03-15T00:00:00.000Z"),
      updatedAt: new Date("2026-03-15T00:00:00.000Z"),
      contenu: "<p>OK</p>",
      CreatedBy: { name: "A" },
    });
    const detail = await getPublishedRapportForAdherent(actor(), "r1");
    expect(detail.contenuHtml).toBe("<p>OK</p>");
  });
});
