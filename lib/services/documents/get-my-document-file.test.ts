import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContext } from "@/lib/auth-context";

const { findUniqueDocument, readFile } = vi.hoisted(() => ({
  findUniqueDocument: vi.fn(),
  readFile: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    document: { findUnique: findUniqueDocument },
  },
}));

vi.mock("fs/promises", () => ({
  readFile,
}));

vi.mock("@/lib/services/documents/resolve-document-path", () => ({
  resolveDocumentAbsolutePath: vi.fn(() => "/tmp/doc.pdf"),
}));

import { getMyDocumentFile } from "@/lib/services/documents/get-my-document-file";

function actor(userId = "user-A"): AuthContext {
  return {
    userId,
    role: "MEMBRE",
    status: "Actif",
    email: "a@example.com",
    name: "Ada",
    sessionId: null,
    adminRoles: [],
    adherentId: null,
    channel: "mobile",
  };
}

describe("getMyDocumentFile", () => {
  beforeEach(() => {
    findUniqueDocument.mockReset();
    readFile.mockReset();
  });

  it("A lit son fichier", async () => {
    findUniqueDocument.mockResolvedValue({
      id: "dA",
      userId: "user-A",
      chemin: "private/documents/1.pdf",
      mimeType: "application/pdf",
      nomOriginal: "a.pdf",
    });
    readFile.mockResolvedValue(Buffer.from("%PDF"));
    const file = await getMyDocumentFile(actor("user-A"), "dA");
    expect(file.downloadName).toBe("a.pdf");
    expect(file.contentType).toBe("application/pdf");
  });

  it("A ne lit pas le fichier de B (anti-IDOR)", async () => {
    findUniqueDocument.mockResolvedValue({
      id: "dB",
      userId: "user-B",
      chemin: "private/documents/2.pdf",
      mimeType: "application/pdf",
      nomOriginal: "b.pdf",
    });
    await expect(getMyDocumentFile(actor("user-A"), "dB")).rejects.toMatchObject(
      { code: "FORBIDDEN" }
    );
    expect(readFile).not.toHaveBeenCalled();
  });

  it("refuse id traversal", async () => {
    await expect(
      getMyDocumentFile(actor(), "../etc/passwd")
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });
});
