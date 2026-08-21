import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContext } from "@/lib/auth-context";

const {
  findUniqueAdherent,
  createDocument,
  mkdir,
  writeFile,
  validateFileContent,
  validateFileSize,
} = vi.hoisted(() => ({
  findUniqueAdherent: vi.fn(),
  createDocument: vi.fn(),
  mkdir: vi.fn(),
  writeFile: vi.fn(),
  validateFileContent: vi.fn(),
  validateFileSize: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    adherent: { findUnique: findUniqueAdherent },
    document: { create: createDocument },
  },
}));

vi.mock("fs/promises", () => ({
  mkdir,
  writeFile,
}));

vi.mock("@/lib/file-validation", () => ({
  validateFileContent,
  validateFileSize,
}));

import {
  MY_DOCUMENT_MAX_BYTES,
  uploadMyDocument,
} from "@/lib/services/documents/upload-my-document";

function actor(): AuthContext {
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
  };
}

function fakeFile(opts: {
  name: string;
  type: string;
  size: number;
}): File {
  const blob = new File(["x".repeat(Math.min(opts.size, 8))], opts.name, {
    type: opts.type,
  });
  Object.defineProperty(blob, "size", { value: opts.size });
  return blob;
}

describe("uploadMyDocument", () => {
  beforeEach(() => {
    findUniqueAdherent.mockReset();
    createDocument.mockReset();
    mkdir.mockReset();
    writeFile.mockReset();
    validateFileContent.mockReset();
    validateFileSize.mockReset();
    findUniqueAdherent.mockResolvedValue({ id: "adh-A" });
    validateFileContent.mockResolvedValue({ valid: true });
    validateFileSize.mockReturnValue({ valid: true });
    mkdir.mockResolvedValue(undefined);
    writeFile.mockResolvedValue(undefined);
    createDocument.mockResolvedValue({
      id: "d1",
      userId: "user-A",
      nomOriginal: "a.pdf",
      type: "PDF",
      categorie: null,
      taille: 10,
      mimeType: "application/pdf",
      description: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      estPublic: false,
      statutValidation: "EnAttente",
    });
  });

  it("A — upload → EnAttente privé canDelete", async () => {
    const dto = await uploadMyDocument(actor(), {
      file: fakeFile({ name: "a.pdf", type: "application/pdf", size: 10 }),
      description: "x",
    });
    expect(dto.id).toBe("d1");
    expect(dto.estPublic).toBe(false);
    expect(dto.statutValidation).toBe("EnAttente");
    expect(dto.canDelete).toBe(true);
    expect(dto.canRequestDelete).toBe(false);
    expect(createDocument.mock.calls[0][0].data.chemin).toMatch(
      /^private\/documents\//
    );
    expect(createDocument.mock.calls[0][0].data.estPublic).toBe(false);
    expect(createDocument.mock.calls[0][0].data.statutValidation).toBe(
      "EnAttente"
    );
  });

  it("accepte image", async () => {
    createDocument.mockResolvedValue({
      id: "d2",
      userId: "user-A",
      nomOriginal: "p.jpg",
      type: "Image",
      categorie: null,
      taille: 20,
      mimeType: "image/jpeg",
      description: null,
      createdAt: new Date(),
      estPublic: false,
      statutValidation: "EnAttente",
    });
    const dto = await uploadMyDocument(actor(), {
      file: fakeFile({ name: "p.jpg", type: "image/jpeg", size: 20 }),
    });
    expect(dto.type).toBe("Image");
  });

  it("refuse vidéo Phase 1", async () => {
    await expect(
      uploadMyDocument(actor(), {
        file: fakeFile({ name: "v.mp4", type: "video/mp4", size: 100 }),
      })
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(createDocument).not.toHaveBeenCalled();
  });

  it("refuse MIME invalide", async () => {
    await expect(
      uploadMyDocument(actor(), {
        file: fakeFile({
          name: "a.doc",
          type: "application/msword",
          size: 10,
        }),
      })
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("refuse taille > max", async () => {
    await expect(
      uploadMyDocument(actor(), {
        file: fakeFile({
          name: "a.pdf",
          type: "application/pdf",
          size: MY_DOCUMENT_MAX_BYTES + 1,
        }),
      })
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });
});
