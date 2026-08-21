import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContext } from "@/lib/auth-context";
import path from "path";

const { findUniqueDocument, deleteDocument } = vi.hoisted(() => ({
  findUniqueDocument: vi.fn(),
  deleteDocument: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    document: {
      findUnique: findUniqueDocument,
      delete: deleteDocument,
    },
  },
}));

vi.mock("fs/promises", () => ({
  unlink: vi.fn().mockResolvedValue(undefined),
}));

import { deleteMyDocument } from "@/lib/services/documents/delete-my-document";
import { resolveDocumentAbsolutePath } from "@/lib/services/documents/resolve-document-path";

function actor(overrides: Partial<AuthContext> = {}): AuthContext {
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
    ...overrides,
  };
}

describe("resolveDocumentAbsolutePath", () => {
  it("résout private/documents", () => {
    const abs = resolveDocumentAbsolutePath("private/documents/123.pdf");
    expect(abs).toBe(
      path.join(process.cwd(), "storage", "documents", "123.pdf")
    );
  });

  it("refuse traversal", () => {
    expect(() =>
      resolveDocumentAbsolutePath("private/documents/../secret.pdf")
    ).toThrow();
  });

  it("résout legacy public avec catégorie", () => {
    const abs = resolveDocumentAbsolutePath(
      "/ressources/documents/Photos/1.jpg"
    );
    expect(abs).toBe(
      path.join(
        process.cwd(),
        "public",
        "ressources",
        "documents",
        "Photos",
        "1.jpg"
      )
    );
  });
});

describe("deleteMyDocument", () => {
  beforeEach(() => {
    findUniqueDocument.mockReset();
    deleteDocument.mockReset();
  });

  it("UNAUTHENTICATED sans userId", async () => {
    await expect(
      deleteMyDocument(actor({ userId: "" }), "d1")
    ).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
    });
  });

  it("G — FORBIDDEN si document d'un autre user", async () => {
    findUniqueDocument.mockResolvedValue({
      id: "d1",
      userId: "user-B",
      chemin: "private/documents/1.pdf",
      estPublic: false,
      statutValidation: "EnAttente",
    });
    await expect(deleteMyDocument(actor(), "d1")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(deleteDocument).not.toHaveBeenCalled();
  });

  it("B — Valide non public → suppression owner OK", async () => {
    findUniqueDocument.mockResolvedValue({
      id: "d1",
      userId: "user-A",
      chemin: "private/documents/1.pdf",
      estPublic: false,
      statutValidation: "Valide",
    });
    deleteDocument.mockResolvedValue({});
    await expect(deleteMyDocument(actor(), "d1")).resolves.toEqual({ id: "d1" });
  });

  it("I — Rejeté → suppression owner OK", async () => {
    findUniqueDocument.mockResolvedValue({
      id: "d1",
      userId: "user-A",
      chemin: "private/documents/1.pdf",
      estPublic: false,
      statutValidation: "Rejete",
    });
    deleteDocument.mockResolvedValue({});
    await expect(deleteMyDocument(actor(), "d1")).resolves.toEqual({ id: "d1" });
  });

  it("D — Valide+Public → FORBIDDEN (DELETE direct)", async () => {
    findUniqueDocument.mockResolvedValue({
      id: "d1",
      userId: "user-A",
      chemin: "private/documents/1.pdf",
      estPublic: true,
      statutValidation: "Valide",
    });
    await expect(deleteMyDocument(actor(), "d1")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(deleteDocument).not.toHaveBeenCalled();
  });

  it("supprime si EnAttente owner", async () => {
    findUniqueDocument.mockResolvedValue({
      id: "d1",
      userId: "user-A",
      chemin: "private/documents/1.pdf",
      estPublic: false,
      statutValidation: "EnAttente",
    });
    deleteDocument.mockResolvedValue({});
    await expect(deleteMyDocument(actor(), "d1")).resolves.toEqual({ id: "d1" });
    expect(deleteDocument).toHaveBeenCalledWith({ where: { id: "d1" } });
  });
});
