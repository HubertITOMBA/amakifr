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
  userId: "user-1",
  nomOriginal: "statuts.pdf",
  type: "PDF" as const,
  categorie: "Administratif",
  taille: 2048,
  mimeType: "application/pdf",
  description: "Statuts",
  createdAt: new Date("2025-06-15T10:00:00.000Z"),
  estPublic: false,
  statutValidation: "EnAttente" as const,
  DeletionRequests: [],
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

  it("A — EnAttente privé → canDelete=true", async () => {
    findManyDocument.mockResolvedValue([sampleRow]);
    const result = await getMyDocuments(actor());

    expect(result[0]).toMatchObject({
      id: "doc-1",
      estPublic: false,
      statutValidation: "EnAttente",
      canDelete: true,
      canRequestDelete: false,
      deletionRequestStatus: null,
    });
    expect(result[0]).not.toHaveProperty("userId");
    expect(result[0]).not.toHaveProperty("chemin");
  });

  it("C — Valide+Public → canDelete=false, canRequestDelete=true", async () => {
    findManyDocument.mockResolvedValue([
      {
        ...sampleRow,
        statutValidation: "Valide",
        estPublic: true,
        DeletionRequests: [],
      },
    ]);
    const result = await getMyDocuments(actor());
    expect(result[0].canDelete).toBe(false);
    expect(result[0].canRequestDelete).toBe(true);
  });

  it("demande EnAttente → canRequestDelete=false + status", async () => {
    findManyDocument.mockResolvedValue([
      {
        ...sampleRow,
        statutValidation: "Valide",
        estPublic: true,
        DeletionRequests: [{ statut: "EnAttente" }],
      },
    ]);
    const result = await getMyDocuments(actor());
    expect(result[0].canRequestDelete).toBe(false);
    expect(result[0].deletionRequestStatus).toBe("EnAttente");
  });

  it("enveloppe une erreur Prisma en INTERNAL_ERROR", async () => {
    findManyDocument.mockRejectedValue(new Error("db down"));
    await expect(getMyDocuments(actor())).rejects.toMatchObject({
      code: "INTERNAL_ERROR",
    });
  });
});
