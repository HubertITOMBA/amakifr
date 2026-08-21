import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContext } from "@/lib/auth-context";

const {
  findUniqueDocument,
  findFirstRequest,
  createRequest,
} = vi.hoisted(() => ({
  findUniqueDocument: vi.fn(),
  findFirstRequest: vi.fn(),
  createRequest: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    document: { findUnique: findUniqueDocument },
    documentDeletionRequest: {
      findFirst: findFirstRequest,
      create: createRequest,
    },
  },
}));

import { requestMyDocumentDeletion } from "@/lib/services/documents/request-my-document-deletion";

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

describe("requestMyDocumentDeletion", () => {
  beforeEach(() => {
    findUniqueDocument.mockReset();
    findFirstRequest.mockReset();
    createRequest.mockReset();
  });

  it("E — crée une demande si Valide+Public", async () => {
    findUniqueDocument.mockResolvedValue({
      id: "d1",
      userId: "user-A",
      estPublic: true,
      statutValidation: "Valide",
    });
    findFirstRequest.mockResolvedValue(null);
    createRequest.mockResolvedValue({ id: "req-1", statut: "EnAttente" });

    await expect(requestMyDocumentDeletion(actor(), "d1")).resolves.toEqual({
      id: "req-1",
      statut: "EnAttente",
    });
    expect(createRequest).toHaveBeenCalled();
  });

  it("refuse si encore supprimable directement", async () => {
    findUniqueDocument.mockResolvedValue({
      id: "d1",
      userId: "user-A",
      estPublic: false,
      statutValidation: "EnAttente",
    });
    await expect(requestMyDocumentDeletion(actor(), "d1")).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
    expect(createRequest).not.toHaveBeenCalled();
  });

  it("F — seconde demande active → CONFLICT", async () => {
    findUniqueDocument.mockResolvedValue({
      id: "d1",
      userId: "user-A",
      estPublic: true,
      statutValidation: "Valide",
    });
    findFirstRequest.mockResolvedValue({ id: "req-old", statut: "EnAttente" });
    await expect(requestMyDocumentDeletion(actor(), "d1")).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(createRequest).not.toHaveBeenCalled();
  });

  it("G — autre adhérent → FORBIDDEN", async () => {
    findUniqueDocument.mockResolvedValue({
      id: "d1",
      userId: "user-B",
      estPublic: true,
      statutValidation: "Valide",
    });
    await expect(requestMyDocumentDeletion(actor(), "d1")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});
