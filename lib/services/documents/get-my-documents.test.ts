import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContext } from "@/lib/auth-context";

const { findManyDocument, countDocument } = vi.hoisted(() => ({
  findManyDocument: vi.fn(),
  countDocument: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    document: {
      findMany: findManyDocument,
      count: countDocument,
    },
  },
}));

import { getMyDocuments } from "@/lib/services/documents/get-my-documents";

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
    channel: "web",
    ...overrides,
  };
}

function row(
  id: string,
  createdAt: string,
  userId = "user-1"
) {
  return {
    id,
    userId,
    nomOriginal: `${id}.pdf`,
    type: "PDF" as const,
    categorie: null,
    taille: 100,
    mimeType: "application/pdf",
    description: null,
    createdAt: new Date(createdAt),
    estPublic: false,
    statutValidation: "EnAttente" as const,
    DeletionRequests: [],
  };
}

describe("getMyDocuments (pagination)", () => {
  beforeEach(() => {
    findManyDocument.mockReset();
    countDocument.mockReset();
  });

  it("lance UNAUTHENTICATED si actor.userId est absent", async () => {
    await expect(getMyDocuments(actor({ userId: "" }))).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
    });
    expect(findManyDocument).not.toHaveBeenCalled();
  });

  it("filtre exclusivement sur actor.userId (anti-IDOR)", async () => {
    countDocument.mockResolvedValue(0);
    findManyDocument.mockResolvedValue([]);
    await getMyDocuments(actor({ userId: "user-own" }));

    expect(findManyDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-own" },
        orderBy: { createdAt: "desc" },
        take: 20,
        skip: 0,
      })
    );
    const arg = findManyDocument.mock.calls[0][0];
    expect(arg.where).not.toHaveProperty("adherentId");
  });

  it("première page — défaut limit=20 offset=0", async () => {
    countDocument.mockResolvedValue(1);
    findManyDocument.mockResolvedValue([
      row("doc-1", "2025-06-15T10:00:00.000Z"),
    ]);
    const page = await getMyDocuments(actor());
    expect(page).toMatchObject({
      total: 1,
      limit: 20,
      offset: 0,
    });
    expect(page.items).toHaveLength(1);
    expect(page.items[0].canDelete).toBe(true);
    expect(page.items[0]).not.toHaveProperty("chemin");
  });

  it("page suivante — offset appliqué", async () => {
    countDocument.mockResolvedValue(25);
    findManyDocument.mockResolvedValue([
      row("doc-21", "2025-01-01T00:00:00.000Z"),
    ]);
    const page = await getMyDocuments(actor(), { limit: 20, offset: 20 });
    expect(findManyDocument).toHaveBeenCalledWith(
      expect.objectContaining({ take: 20, skip: 20 })
    );
    expect(page.offset).toBe(20);
    expect(page.total).toBe(25);
  });

  it("refuse limite > 50", async () => {
    await expect(
      getMyDocuments(actor(), { limit: 51, offset: 0 })
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(findManyDocument).not.toHaveBeenCalled();
  });

  it("tri récent → ancien (orderBy createdAt desc)", async () => {
    countDocument.mockResolvedValue(2);
    findManyDocument.mockResolvedValue([
      row("newer", "2026-08-21T10:00:00.000Z"),
      row("older", "2026-01-01T10:00:00.000Z"),
    ]);
    const page = await getMyDocuments(actor());
    expect(findManyDocument.mock.calls[0][0].orderBy).toEqual({
      createdAt: "desc",
    });
    expect(page.items[0].id).toBe("newer");
    expect(page.items[1].id).toBe("older");
  });

  it("aucun document autre adhérent dans le where", async () => {
    countDocument.mockResolvedValue(0);
    findManyDocument.mockResolvedValue([]);
    await getMyDocuments(actor({ userId: "user-A" }));
    expect(findManyDocument.mock.calls[0][0].where).toEqual({
      userId: "user-A",
    });
  });

  it("pas de doublon entre pages (offsets disjoints)", async () => {
    countDocument.mockResolvedValue(3);
    findManyDocument
      .mockResolvedValueOnce([
        row("a", "2026-03-01T00:00:00.000Z"),
        row("b", "2026-02-01T00:00:00.000Z"),
      ])
      .mockResolvedValueOnce([row("c", "2026-01-01T00:00:00.000Z")]);

    const p1 = await getMyDocuments(actor(), { limit: 2, offset: 0 });
    const p2 = await getMyDocuments(actor(), { limit: 2, offset: 2 });
    const ids = [...p1.items, ...p2.items].map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("Valide+Public → canDelete=false, canRequestDelete=true", async () => {
    countDocument.mockResolvedValue(1);
    findManyDocument.mockResolvedValue([
      {
        ...row("doc-1", "2025-06-15T10:00:00.000Z"),
        statutValidation: "Valide",
        estPublic: true,
        DeletionRequests: [],
      },
    ]);
    const page = await getMyDocuments(actor());
    expect(page.items[0].canDelete).toBe(false);
    expect(page.items[0].canRequestDelete).toBe(true);
  });

  it("count + findMany en parallèle (2 requêtes, pas de N+1)", async () => {
    countDocument.mockResolvedValue(0);
    findManyDocument.mockResolvedValue([]);
    await getMyDocuments(actor());
    expect(countDocument).toHaveBeenCalledTimes(1);
    expect(findManyDocument).toHaveBeenCalledTimes(1);
    const select = findManyDocument.mock.calls[0][0].select;
    expect(select.DeletionRequests).toBeDefined();
    expect(select).not.toHaveProperty("chemin");
  });

  it("enveloppe une erreur Prisma en INTERNAL_ERROR", async () => {
    countDocument.mockRejectedValue(new Error("db down"));
    await expect(getMyDocuments(actor())).rejects.toMatchObject({
      code: "INTERNAL_ERROR",
    });
  });
});
