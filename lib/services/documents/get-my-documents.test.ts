import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContext } from "@/lib/auth-context";

const { findManyDocument } = vi.hoisted(() => ({
  findManyDocument: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    document: {
      findMany: findManyDocument,
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

const sampleRow = {
  id: "doc-1",
  nomOriginal: "statuts.pdf",
  type: "PDF" as const,
  categorie: "Administratif",
  chemin: "/ressources/documents/Administratif/123.pdf",
  taille: 2048,
  mimeType: "application/pdf",
  description: "Statuts",
  createdAt: new Date("2025-06-15T10:00:00.000Z"),
};

describe("getMyDocuments", () => {
  beforeEach(() => {
    findManyDocument.mockReset();
  });

  it("lance UNAUTHENTICATED si actor.userId est absent", async () => {
    await expect(getMyDocuments(actor({ userId: "" }))).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
    });
    expect(findManyDocument).not.toHaveBeenCalled();
  });

  it("filtre exclusivement sur actor.userId (anti-IDOR)", async () => {
    findManyDocument.mockResolvedValue([]);
    await getMyDocuments(actor({ userId: "user-own" }));

    expect(findManyDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-own" },
        orderBy: { createdAt: "desc" },
      })
    );
    const arg = findManyDocument.mock.calls[0][0];
    expect(arg.where).not.toHaveProperty("adherentId");
  });

  it("retourne une liste vide sans erreur", async () => {
    findManyDocument.mockResolvedValue([]);
    await expect(getMyDocuments(actor())).resolves.toEqual([]);
  });

  it("mappe les DTO (dates ISO, sans userId)", async () => {
    findManyDocument.mockResolvedValue([sampleRow]);
    const result = await getMyDocuments(actor());

    expect(result).toEqual([
      {
        id: "doc-1",
        nomOriginal: "statuts.pdf",
        type: "PDF",
        categorie: "Administratif",
        chemin: "/ressources/documents/Administratif/123.pdf",
        taille: 2048,
        mimeType: "application/pdf",
        description: "Statuts",
        createdAt: "2025-06-15T10:00:00.000Z",
      },
    ]);
    expect(result[0]).not.toHaveProperty("userId");
    expect(result[0]).not.toHaveProperty("adherentId");
    expect(result[0]).not.toHaveProperty("nom");
  });

  it("enveloppe une erreur Prisma en INTERNAL_ERROR", async () => {
    findManyDocument.mockRejectedValue(new Error("db down"));
    await expect(getMyDocuments(actor())).rejects.toMatchObject({
      code: "INTERNAL_ERROR",
    });
  });
});
