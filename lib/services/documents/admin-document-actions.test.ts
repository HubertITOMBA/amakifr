import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  findUniqueDocument,
  updateDocument,
  deleteDocument,
  updateManyRequests,
} = vi.hoisted(() => ({
  findUniqueDocument: vi.fn(),
  updateDocument: vi.fn(),
  deleteDocument: vi.fn(),
  updateManyRequests: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    document: {
      findUnique: findUniqueDocument,
      update: updateDocument,
      delete: deleteDocument,
    },
    documentDeletionRequest: {
      updateMany: updateManyRequests,
    },
  },
}));

vi.mock("fs/promises", () => ({
  unlink: vi.fn().mockResolvedValue(undefined),
}));

import {
  adminDeleteDocumentDb,
  adminRejectDocumentDb,
  adminSetDocumentPublicDb,
  adminValidateDocumentDb,
} from "@/lib/services/documents/admin-document-actions";

describe("admin document actions", () => {
  beforeEach(() => {
    findUniqueDocument.mockReset();
    updateDocument.mockReset();
    deleteDocument.mockReset();
    updateManyRequests.mockReset();
  });

  it("valide un document", async () => {
    findUniqueDocument.mockResolvedValue({ id: "d1" });
    updateDocument.mockResolvedValue({
      id: "d1",
      statutValidation: "Valide",
    });
    const r = await adminValidateDocumentDb("admin-1", "d1");
    expect(r.statutValidation).toBe("Valide");
    expect(updateDocument.mock.calls[0][0].data.validatedBy).toBe("admin-1");
  });

  it("rejette et force privé", async () => {
    findUniqueDocument.mockResolvedValue({ id: "d1" });
    updateDocument.mockResolvedValue({
      id: "d1",
      statutValidation: "Rejete",
    });
    await adminRejectDocumentDb("admin-1", "d1", "motif");
    expect(updateDocument.mock.calls[0][0].data).toMatchObject({
      statutValidation: "Rejete",
      estPublic: false,
      rejectionReason: "motif",
    });
  });

  it("rend public", async () => {
    findUniqueDocument.mockResolvedValue({ id: "d1" });
    updateDocument.mockResolvedValue({
      id: "d1",
      estPublic: true,
      statutValidation: "Valide",
    });
    const r = await adminSetDocumentPublicDb("d1", true);
    expect(r.estPublic).toBe(true);
  });

  it("H — admin delete clôture demandes + delete", async () => {
    findUniqueDocument.mockResolvedValue({
      id: "d1",
      chemin: "private/documents/1.pdf",
    });
    updateManyRequests.mockResolvedValue({ count: 1 });
    deleteDocument.mockResolvedValue({});
    await expect(adminDeleteDocumentDb("admin-1", "d1")).resolves.toEqual({
      id: "d1",
    });
    expect(updateManyRequests).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { documentId: "d1", statut: "EnAttente" },
        data: expect.objectContaining({
          statut: "Traitee",
          resolvedBy: "admin-1",
        }),
      })
    );
    expect(deleteDocument).toHaveBeenCalled();
  });
});
