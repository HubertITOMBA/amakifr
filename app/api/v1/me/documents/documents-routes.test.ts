import { beforeEach, describe, expect, it, vi } from "vitest";
import { ServiceError } from "@/lib/service-error";
import type { AuthContext } from "@/lib/auth-context";

const {
  resolveApiActorMock,
  getMyDocuments,
  uploadMyDocument,
  deleteMyDocument,
  getMyDocumentFile,
  requestMyDocumentDeletion,
} = vi.hoisted(() => ({
  resolveApiActorMock: vi.fn(),
  getMyDocuments: vi.fn(),
  uploadMyDocument: vi.fn(),
  deleteMyDocument: vi.fn(),
  getMyDocumentFile: vi.fn(),
  requestMyDocumentDeletion: vi.fn(),
}));

vi.mock("@/lib/api/auth-resolve", () => ({
  resolveApiActor: resolveApiActorMock,
}));
vi.mock("@/lib/services/documents/get-my-documents", () => ({
  getMyDocuments,
}));
vi.mock("@/lib/services/documents/upload-my-document", () => ({
  uploadMyDocument,
}));
vi.mock("@/lib/services/documents/delete-my-document", () => ({
  deleteMyDocument,
}));
vi.mock("@/lib/services/documents/get-my-document-file", () => ({
  getMyDocumentFile,
}));
vi.mock("@/lib/services/documents/request-my-document-deletion", () => ({
  requestMyDocumentDeletion,
}));

import { GET, POST } from "@/app/api/v1/me/documents/route";
import { DELETE } from "@/app/api/v1/me/documents/[id]/route";
import { GET as GET_FILE } from "@/app/api/v1/me/documents/[id]/file/route";
import { POST as POST_DELETION } from "@/app/api/v1/me/documents/[id]/deletion-request/route";

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

function getReq(url: string) {
  const nextUrl = new URL(url);
  return {
    nextUrl,
    headers: { get: () => null },
  } as any;
}

function multipartReq(
  fields: Record<string, string>,
  file?: { name: string; type: string; size: number },
  extraKeys: string[] = []
) {
  const map = new Map<string, FormDataEntryValue>();
  for (const [k, v] of Object.entries(fields)) {
    map.set(k, v);
  }
  for (const k of extraKeys) {
    map.set(k, "injected");
  }
  if (file) {
    const blob = new File(["x"], file.name, { type: file.type });
    Object.defineProperty(blob, "size", { value: file.size });
    map.set("file", blob);
  }
  return {
    nextUrl: new URL("http://localhost/api/v1/me/documents"),
    headers: {
      get: (h: string) =>
        h.toLowerCase() === "content-type"
          ? "multipart/form-data; boundary=----x"
          : null,
    },
    formData: async () => ({
      get: (k: string) => map.get(k) ?? null,
      has: (k: string) => map.has(k),
    }),
  } as any;
}

describe("GET /api/v1/me/documents", () => {
  beforeEach(() => {
    resolveApiActorMock.mockReset();
    getMyDocuments.mockReset();
  });

  it("401 si non auth", async () => {
    resolveApiActorMock.mockResolvedValue(null);
    const res = await GET(getReq("http://localhost/api/v1/me/documents"));
    expect(res.status).toBe(401);
  });

  it("refuse userId/adherentId query", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    const res = await GET(
      getReq("http://localhost/api/v1/me/documents?userId=x")
    );
    expect(res.status).toBe(400);
    expect(getMyDocuments).not.toHaveBeenCalled();
  });

  it("retourne la page self", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    getMyDocuments.mockResolvedValue({
      items: [{ id: "d1" }],
      total: 1,
      limit: 20,
      offset: 0,
    });
    const res = await GET(getReq("http://localhost/api/v1/me/documents"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toEqual({
      items: [{ id: "d1" }],
      total: 1,
      limit: 20,
      offset: 0,
    });
    expect(getMyDocuments).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-A" }),
      expect.objectContaining({})
    );
  });

  it("passe limit/offset à getMyDocuments", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    getMyDocuments.mockResolvedValue({
      items: [],
      total: 0,
      limit: 10,
      offset: 20,
    });
    await GET(
      getReq("http://localhost/api/v1/me/documents?limit=10&offset=20")
    );
    expect(getMyDocuments).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ limit: 10, offset: 20 })
    );
  });
});

describe("POST /api/v1/me/documents", () => {
  beforeEach(() => {
    resolveApiActorMock.mockReset();
    uploadMyDocument.mockReset();
  });

  it("refuse adherentId injecté", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    const res = await POST(
      multipartReq({ description: "x" }, undefined, ["adherentId"])
    );
    expect(res.status).toBe(400);
    expect(uploadMyDocument).not.toHaveBeenCalled();
  });

  it("refuse estPublic injecté", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    const res = await POST(
      multipartReq({}, { name: "a.pdf", type: "application/pdf", size: 10 }, [
        "estPublic",
      ])
    );
    expect(res.status).toBe(400);
  });

  it("upload OK délègue au service", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    uploadMyDocument.mockResolvedValue({ id: "d1", canDelete: true });
    const res = await POST(
      multipartReq(
        { description: "Statuts" },
        { name: "a.pdf", type: "application/pdf", size: 12 }
      )
    );
    expect(res.status).toBe(201);
    expect(uploadMyDocument).toHaveBeenCalled();
  });
});

describe("DELETE /api/v1/me/documents/[id]", () => {
  beforeEach(() => {
    resolveApiActorMock.mockReset();
    deleteMyDocument.mockReset();
  });

  it("FORBIDDEN si service refuse (doc B)", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    deleteMyDocument.mockRejectedValue(
      new ServiceError("FORBIDDEN", "Accès refusé")
    );
    const res = await DELETE(getReq("http://localhost/api/v1/me/documents/dB"), {
      params: Promise.resolve({ id: "dB" }),
    });
    expect(res.status).toBe(403);
  });

  it("supprime doc owner", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    deleteMyDocument.mockResolvedValue({ id: "dA" });
    const res = await DELETE(getReq("http://localhost/api/v1/me/documents/dA"), {
      params: Promise.resolve({ id: "dA" }),
    });
    expect(res.status).toBe(200);
  });
});

describe("GET /api/v1/me/documents/[id]/file", () => {
  beforeEach(() => {
    resolveApiActorMock.mockReset();
    getMyDocumentFile.mockReset();
  });

  it("A ne lit pas le fichier de B", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    getMyDocumentFile.mockRejectedValue(
      new ServiceError("FORBIDDEN", "Accès refusé")
    );
    const res = await GET_FILE(
      getReq("http://localhost/api/v1/me/documents/dB/file"),
      { params: Promise.resolve({ id: "dB" }) }
    );
    expect(res.status).toBe(403);
  });

  it("sert le fichier owner", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    getMyDocumentFile.mockResolvedValue({
      bytes: Buffer.from("%PDF"),
      contentType: "application/pdf",
      downloadName: "a.pdf",
    });
    const res = await GET_FILE(
      getReq("http://localhost/api/v1/me/documents/dA/file"),
      { params: Promise.resolve({ id: "dA" }) }
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
  });
});

describe("POST /api/v1/me/documents/[id]/deletion-request", () => {
  beforeEach(() => {
    resolveApiActorMock.mockReset();
    requestMyDocumentDeletion.mockReset();
  });

  it("401 si non auth", async () => {
    resolveApiActorMock.mockResolvedValue(null);
    const res = await POST_DELETION(
      {
        ...getReq("http://localhost/api/v1/me/documents/d1/deletion-request"),
        json: async () => ({}),
      } as any,
      { params: Promise.resolve({ id: "d1" }) }
    );
    expect(res.status).toBe(401);
  });

  it("refuse userId query", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    const res = await POST_DELETION(
      getReq(
        "http://localhost/api/v1/me/documents/d1/deletion-request?userId=x"
      ),
      { params: Promise.resolve({ id: "d1" }) }
    );
    expect(res.status).toBe(400);
    expect(requestMyDocumentDeletion).not.toHaveBeenCalled();
  });

  it("crée la demande", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    requestMyDocumentDeletion.mockResolvedValue({
      id: "r1",
      statut: "EnAttente",
    });
    const res = await POST_DELETION(
      {
        nextUrl: new URL(
          "http://localhost/api/v1/me/documents/d1/deletion-request"
        ),
        headers: {
          get: (h: string) =>
            h.toLowerCase() === "content-type" ? "application/json" : null,
        },
        json: async () => ({ motif: "test" }),
      } as any,
      { params: Promise.resolve({ id: "d1" }) }
    );
    expect(res.status).toBe(201);
  });
});
