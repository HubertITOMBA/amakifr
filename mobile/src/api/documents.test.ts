import { beforeEach, describe, expect, it, vi } from "vitest";

const { authenticatedFetch } = vi.hoisted(() => ({
  authenticatedFetch: vi.fn(),
}));

vi.mock("@/auth/session", () => ({
  authenticatedFetch,
  authenticatedBinaryFetch: vi.fn(),
}));

vi.mock("expo/fetch", () => ({ fetch: vi.fn() }));
vi.mock("expo-file-system", () => ({
  File: class {
    uri = "file://x";
    write() {}
  },
  Paths: { cache: "/cache" },
}));
vi.mock("expo-sharing", () => ({
  isAvailableAsync: vi.fn(async () => false),
  shareAsync: vi.fn(),
}));
vi.mock("@/api/react-native-form-data-file", () => ({
  appendJustificatifToFormData: vi.fn(async () => undefined),
  buildReactNativeFilePart: (x: unknown) => x,
}));

import {
  deleteMyDocument,
  getMyDocuments,
  requestMyDocumentDeletion,
  uploadMyDocument,
} from "@/api/documents";

describe("documents API client", () => {
  beforeEach(() => {
    authenticatedFetch.mockReset();
  });

  it("getMyDocuments GET path exact, sans id client", async () => {
    authenticatedFetch.mockResolvedValue([]);
    await getMyDocuments();
    expect(authenticatedFetch).toHaveBeenCalledWith("/api/v1/me/documents");
    const path = authenticatedFetch.mock.calls[0][0] as string;
    expect(path).not.toContain("userId");
    expect(path).not.toContain("adherentId");
  });

  it("deleteMyDocument DELETE sans id client", async () => {
    authenticatedFetch.mockResolvedValue({ id: "d1" });
    await deleteMyDocument("d1");
    expect(authenticatedFetch).toHaveBeenCalledWith(
      "/api/v1/me/documents/d1",
      expect.objectContaining({ method: "DELETE" })
    );
  });

  it("requestMyDocumentDeletion POST", async () => {
    authenticatedFetch.mockResolvedValue({ id: "r1", statut: "EnAttente" });
    await requestMyDocumentDeletion("d1", "motif");
    expect(authenticatedFetch).toHaveBeenCalledWith(
      "/api/v1/me/documents/d1/deletion-request",
      expect.objectContaining({
        method: "POST",
        body: { motif: "motif" },
      })
    );
  });

  it("uploadMyDocument POST multipart", async () => {
    authenticatedFetch.mockResolvedValue({ id: "d1" });
    await uploadMyDocument({
      uri: "file:///tmp/a.pdf",
      name: "a.pdf",
      mimeType: "application/pdf",
      description: "test",
    });
    expect(authenticatedFetch).toHaveBeenCalledWith(
      "/api/v1/me/documents",
      expect.objectContaining({ method: "POST" })
    );
  });
});
