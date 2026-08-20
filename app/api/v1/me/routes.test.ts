import { beforeEach, describe, expect, it, vi } from "vitest";
import { ServiceError } from "@/lib/service-error";
import type { AuthContext } from "@/lib/auth-context";

const {
  resolveApiActorMock,
  getMe: getMeMock,
  getMyNotifications,
  getMyUnreadNotificationCount,
  getMyCotisationsMensuelles,
  getMyCotisationYear,
  getMyDocuments,
  getMyPasseport,
  generateMyPasseport,
  getMyPasseportPdf,
  getMyTaches,
  createMyTacheCommentaire,
  getMyReunions,
  updateMyReunionParticipation,
  getMyReunionYear,
  proposeMyselfAsReunionHost,
  withdrawMyReunionHostProposal,
} = vi.hoisted(() => ({
  resolveApiActorMock: vi.fn(),
  getMe: vi.fn(),
  getMyNotifications: vi.fn(),
  getMyUnreadNotificationCount: vi.fn(),
  getMyCotisationsMensuelles: vi.fn(),
  getMyCotisationYear: vi.fn(),
  getMyDocuments: vi.fn(),
  getMyPasseport: vi.fn(),
  generateMyPasseport: vi.fn(),
  getMyPasseportPdf: vi.fn(),
  getMyTaches: vi.fn(),
  createMyTacheCommentaire: vi.fn(),
  getMyReunions: vi.fn(),
  updateMyReunionParticipation: vi.fn(),
  getMyReunionYear: vi.fn(),
  proposeMyselfAsReunionHost: vi.fn(),
  withdrawMyReunionHostProposal: vi.fn(),
}));

vi.mock("@/lib/api/auth-resolve", () => ({
  resolveApiActor: resolveApiActorMock,
}));
vi.mock("@/lib/services/user/get-me", () => ({ getMe: getMeMock }));
vi.mock("@/lib/services/notifications/get-my-notifications", () => ({
  getMyNotifications,
}));
vi.mock("@/lib/services/notifications/get-my-unread-count", () => ({
  getMyUnreadNotificationCount,
}));
vi.mock("@/lib/services/cotisations/get-my-cotisations-mensuelles", () => ({
  getMyCotisationsMensuelles,
}));
vi.mock("@/lib/services/cotisations/get-my-cotisation-year", () => ({
  getMyCotisationYear,
}));
vi.mock("@/lib/services/documents/get-my-documents", () => ({
  getMyDocuments,
}));
vi.mock("@/lib/services/passeport/get-my-passeport", () => ({
  getMyPasseport,
}));
vi.mock("@/lib/services/passeport/generate-my-passeport", () => ({
  generateMyPasseport,
}));
vi.mock("@/lib/services/passeport/get-my-passeport-pdf", () => ({
  getMyPasseportPdf,
}));
vi.mock("@/lib/services/taches/get-my-taches", () => ({
  getMyTaches,
}));
vi.mock("@/lib/services/taches/create-my-tache-commentaire", () => ({
  createMyTacheCommentaire,
}));
vi.mock("@/lib/services/reunions/get-my-reunions", () => ({
  getMyReunions,
}));
vi.mock("@/lib/services/reunions/update-my-reunion-participation", () => ({
  updateMyReunionParticipation,
}));
vi.mock("@/lib/services/reunions/get-my-reunion-year", () => ({
  getMyReunionYear,
}));
vi.mock("@/lib/services/reunions/propose-myself-as-reunion-host", () => ({
  proposeMyselfAsReunionHost,
}));
vi.mock("@/lib/services/reunions/withdraw-my-reunion-host-proposal", () => ({
  withdrawMyReunionHostProposal,
}));

import { GET as getMeRoute } from "@/app/api/v1/me/route";
import { GET as getNotificationsRoute } from "@/app/api/v1/me/notifications/route";
import { GET as getUnreadRoute } from "@/app/api/v1/me/notifications/unread-count/route";
import { GET as getCotisationsRoute } from "@/app/api/v1/me/cotisations-mensuelles/route";
import { GET as getCotisationYearRoute } from "@/app/api/v1/me/cotisations/year/route";
import { GET as getDocumentsRoute } from "@/app/api/v1/me/documents/route";
import { GET as getPasseportRoute } from "@/app/api/v1/me/passeport/route";
import { POST as postPasseportGenerateRoute } from "@/app/api/v1/me/passeport/generate/route";
import { GET as getPasseportPdfRoute } from "@/app/api/v1/me/passeport/pdf/route";
import { GET as getTachesRoute } from "@/app/api/v1/me/taches/route";
import { POST as postTacheCommentaireRoute } from "@/app/api/v1/me/taches/[id]/commentaires/route";
import { GET as getReunionsRoute } from "@/app/api/v1/me/reunions/route";
import { PATCH as patchReunionParticipationRoute } from "@/app/api/v1/me/reunions/[id]/participation/route";
import { GET as getReunionYearRoute } from "@/app/api/v1/me/reunions/year/route";
import { POST as postHostProposalRoute } from "@/app/api/v1/me/reunions/host-proposals/route";
import { DELETE as deleteHostProposalRoute } from "@/app/api/v1/me/reunions/[id]/host-proposal/route";

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

function req(url: string, headers?: Record<string, string>) {
  const nextUrl = new URL(url);
  return {
    nextUrl,
    headers: {
      get: (name: string) => headers?.[name.toLowerCase()] ?? null,
    },
  } as any;
}

function postReq(
  url: string,
  body: unknown,
  headers?: Record<string, string>
) {
  const nextUrl = new URL(url);
  return {
    nextUrl,
    method: "POST",
    headers: {
      get: (name: string) => headers?.[name.toLowerCase()] ?? null,
    },
    json: async () => body,
  } as any;
}

function patchReq(
  url: string,
  body: unknown,
  headers?: Record<string, string>
) {
  const nextUrl = new URL(url);
  return {
    nextUrl,
    method: "PATCH",
    headers: {
      get: (name: string) => headers?.[name.toLowerCase()] ?? null,
    },
    json: async () => body,
  } as any;
}

function deleteReq(
  url: string,
  body?: unknown,
  headers?: Record<string, string>
) {
  const nextUrl = new URL(url);
  const hasBody = body !== undefined;
  return {
    nextUrl,
    method: "DELETE",
    headers: {
      get: (name: string) => {
        const key = name.toLowerCase();
        if (key === "content-type" && hasBody) {
          return headers?.[key] ?? "application/json";
        }
        return headers?.[key] ?? null;
      },
    },
    json: async () => body,
  } as any;
}

describe("GET /api/v1/me", () => {
  beforeEach(() => {
    resolveApiActorMock.mockReset();
    getMeMock.mockReset();
  });

  it("401 si non authentifié", async () => {
    resolveApiActorMock.mockResolvedValue(null);
    const res = await getMeRoute(req("http://localhost/api/v1/me"));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe("UNAUTHENTICATED");
  });

  it("200 + data si succès (Web)", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    getMeMock.mockResolvedValue({ id: "user-1", email: "a@example.com" });
    const res = await getMeRoute(req("http://localhost/api/v1/me"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      success: true,
      data: { id: "user-1", email: "a@example.com" },
    });
    expect(getMeMock).toHaveBeenCalledWith(actor());
  });

  it("200 avec actor mobile Bearer", async () => {
    const mobile = actor({ channel: "mobile", sessionId: "jti-1" });
    resolveApiActorMock.mockResolvedValue(mobile);
    getMeMock.mockResolvedValue({ id: "user-1" });
    const res = await getMeRoute(
      req("http://localhost/api/v1/me", { authorization: "Bearer tok" })
    );
    expect(res.status).toBe(200);
    expect(getMeMock).toHaveBeenCalledWith(mobile);
  });

  it("401 Bearer invalide (ServiceError, no downgrade)", async () => {
    resolveApiActorMock.mockRejectedValue(
      new ServiceError("UNAUTHENTICATED", "Non authentifié")
    );
    const res = await getMeRoute(
      req("http://localhost/api/v1/me", { authorization: "Bearer INVALID" })
    );
    expect(res.status).toBe(401);
    expect(getMeMock).not.toHaveBeenCalled();
  });

  it("mappe ServiceError NOT_FOUND", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    getMeMock.mockRejectedValue(new ServiceError("NOT_FOUND", "Utilisateur introuvable"));
    const res = await getMeRoute(req("http://localhost/api/v1/me"));
    expect(res.status).toBe(404);
  });

  it("500 générique si erreur inconnue", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    getMeMock.mockRejectedValue(new Error("boom prisma"));
    const res = await getMeRoute(req("http://localhost/api/v1/me"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.message).toBe("Erreur interne du serveur");
    expect(JSON.stringify(body)).not.toContain("prisma");
  });
});

describe("GET /api/v1/me/notifications", () => {
  beforeEach(() => {
    resolveApiActorMock.mockReset();
    getMyNotifications.mockReset();
  });

  it("passe les query params validés au service", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    getMyNotifications.mockResolvedValue([]);
    const res = await getNotificationsRoute(
      req("http://localhost/api/v1/me/notifications?lue=false&limit=10&offset=0&type=Systeme")
    );
    expect(res.status).toBe(200);
    expect(getMyNotifications).toHaveBeenCalledWith(actor(), {
      lue: false,
      limit: 10,
      offset: 0,
      type: "Systeme",
    });
  });

  it("400 si limit invalide", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    const res = await getNotificationsRoute(
      req("http://localhost/api/v1/me/notifications?limit=999999")
    );
    expect(res.status).toBe(400);
    expect(getMyNotifications).not.toHaveBeenCalled();
  });

  it("400 si userId query (anti-IDOR)", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    const res = await getNotificationsRoute(
      req("http://localhost/api/v1/me/notifications?userId=other")
    );
    expect(res.status).toBe(400);
    expect(getMyNotifications).not.toHaveBeenCalled();
  });
});

describe("GET /api/v1/me/notifications/unread-count", () => {
  beforeEach(() => {
    resolveApiActorMock.mockReset();
    getMyUnreadNotificationCount.mockReset();
  });

  it("succès", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    getMyUnreadNotificationCount.mockResolvedValue(3);
    const res = await getUnreadRoute(req("http://localhost/api/v1/me/notifications/unread-count"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, data: { count: 3 } });
  });

  it("erreur ServiceError", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    getMyUnreadNotificationCount.mockRejectedValue(
      new ServiceError("UNAUTHENTICATED", "Non autorisé")
    );
    const res = await getUnreadRoute(req("http://localhost/api/v1/me/notifications/unread-count"));
    expect(res.status).toBe(401);
  });
});

describe("GET /api/v1/me/cotisations-mensuelles", () => {
  beforeEach(() => {
    resolveApiActorMock.mockReset();
    getMyCotisationsMensuelles.mockReset();
  });

  it("succès avec montants/dates string", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    getMyCotisationsMensuelles.mockResolvedValue([
      {
        id: "cm-1",
        montantAttendu: "25.5",
        dateEcheance: "2024-06-15T00:00:00.000Z",
      },
    ]);
    const res = await getCotisationsRoute(
      req("http://localhost/api/v1/me/cotisations-mensuelles")
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data[0].montantAttendu).toBe("25.5");
    expect(typeof body.data[0].dateEcheance).toBe("string");
    expect(getMyCotisationsMensuelles).toHaveBeenCalledWith(actor());
  });

  it("liste vide", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    getMyCotisationsMensuelles.mockResolvedValue([]);
    const res = await getCotisationsRoute(
      req("http://localhost/api/v1/me/cotisations-mensuelles")
    );
    const body = await res.json();
    expect(body.data).toEqual([]);
  });

  it("refuse adherentId query", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    const res = await getCotisationsRoute(
      req("http://localhost/api/v1/me/cotisations-mensuelles?adherentId=x")
    );
    expect(res.status).toBe(400);
    expect(getMyCotisationsMensuelles).not.toHaveBeenCalled();
  });
});

describe("GET /api/v1/me/cotisations/year", () => {
  beforeEach(() => {
    resolveApiActorMock.mockReset();
    getMyCotisationYear.mockReset();
  });

  it("401 si non authentifié", async () => {
    resolveApiActorMock.mockResolvedValue(null);
    const res = await getCotisationYearRoute(
      req("http://localhost/api/v1/me/cotisations/year?annee=2026")
    );
    expect(res.status).toBe(401);
  });

  it("200 succès", async () => {
    const a = actor();
    resolveApiActorMock.mockResolvedValue(a);
    getMyCotisationYear.mockResolvedValue({
      annee: 2026,
      summary: {
        detteBrute: "0",
        avoirDisponible: "0",
        resteNet: "0",
        totalPayeAnnee: "0",
      },
      cotisations: [],
      assistances: [],
      dettes: [],
      paiements: [],
    });
    const res = await getCotisationYearRoute(
      req("http://localhost/api/v1/me/cotisations/year?annee=2026")
    );
    expect(res.status).toBe(200);
    expect(getMyCotisationYear).toHaveBeenCalledWith(a, 2026);
  });

  it("400 si année absente", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    const res = await getCotisationYearRoute(
      req("http://localhost/api/v1/me/cotisations/year")
    );
    expect(res.status).toBe(400);
    expect(getMyCotisationYear).not.toHaveBeenCalled();
  });

  it("400 si userId query", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    const res = await getCotisationYearRoute(
      req("http://localhost/api/v1/me/cotisations/year?annee=2026&userId=x")
    );
    expect(res.status).toBe(400);
  });

  it("400 si adherentId query", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    const res = await getCotisationYearRoute(
      req("http://localhost/api/v1/me/cotisations/year?annee=2026&adherentId=x")
    );
    expect(res.status).toBe(400);
  });

  it("400 si memberId query", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    const res = await getCotisationYearRoute(
      req("http://localhost/api/v1/me/cotisations/year?annee=2026&memberId=x")
    );
    expect(res.status).toBe(400);
  });
});

describe("GET /api/v1/me/documents", () => {
  beforeEach(() => {
    resolveApiActorMock.mockReset();
    getMyDocuments.mockReset();
  });

  it("401 si non authentifié", async () => {
    resolveApiActorMock.mockResolvedValue(null);
    const res = await getDocumentsRoute(req("http://localhost/api/v1/me/documents"));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe("UNAUTHENTICATED");
    expect(getMyDocuments).not.toHaveBeenCalled();
  });

  it("succès avec dates ISO", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    getMyDocuments.mockResolvedValue([
      {
        id: "doc-1",
        nomOriginal: "statuts.pdf",
        type: "PDF",
        createdAt: "2025-06-15T10:00:00.000Z",
      },
    ]);
    const res = await getDocumentsRoute(req("http://localhost/api/v1/me/documents"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data[0].nomOriginal).toBe("statuts.pdf");
    expect(typeof body.data[0].createdAt).toBe("string");
    expect(getMyDocuments).toHaveBeenCalledWith(actor());
  });

  it("liste vide", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    getMyDocuments.mockResolvedValue([]);
    const res = await getDocumentsRoute(req("http://localhost/api/v1/me/documents"));
    const body = await res.json();
    expect(body.data).toEqual([]);
  });

  it("refuse userId query", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    const res = await getDocumentsRoute(
      req("http://localhost/api/v1/me/documents?userId=other")
    );
    expect(res.status).toBe(400);
    expect(getMyDocuments).not.toHaveBeenCalled();
  });

  it("refuse adherentId query", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    const res = await getDocumentsRoute(
      req("http://localhost/api/v1/me/documents?adherentId=x")
    );
    expect(res.status).toBe(400);
    expect(getMyDocuments).not.toHaveBeenCalled();
  });
});

describe("GET /api/v1/me/passeport", () => {
  beforeEach(() => {
    resolveApiActorMock.mockReset();
    getMyPasseport.mockReset();
  });

  it("401 si non authentifié", async () => {
    resolveApiActorMock.mockResolvedValue(null);
    const res = await getPasseportRoute(
      req("http://localhost/api/v1/me/passeport")
    );
    expect(res.status).toBe(401);
    expect(getMyPasseport).not.toHaveBeenCalled();
  });

  it("succès metadata", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    getMyPasseport.mockResolvedValue({
      numeroPasseport: "AMAKI-2026-ABC123",
      dateGenerationPasseport: "2026-08-18T10:00:00.000Z",
      disponible: true,
      peutGenerer: false,
    });
    const res = await getPasseportRoute(
      req("http://localhost/api/v1/me/passeport")
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.numeroPasseport).toBe("AMAKI-2026-ABC123");
    expect(getMyPasseport).toHaveBeenCalledWith(actor());
  });

  it("refuse userId query", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    const res = await getPasseportRoute(
      req("http://localhost/api/v1/me/passeport?userId=other")
    );
    expect(res.status).toBe(400);
    expect(getMyPasseport).not.toHaveBeenCalled();
  });

  it("refuse adherentId query", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    const res = await getPasseportRoute(
      req("http://localhost/api/v1/me/passeport?adherentId=x")
    );
    expect(res.status).toBe(400);
    expect(getMyPasseport).not.toHaveBeenCalled();
  });
});

describe("POST /api/v1/me/passeport/generate", () => {
  beforeEach(() => {
    resolveApiActorMock.mockReset();
    generateMyPasseport.mockReset();
  });

  function postReq(url: string, body?: unknown) {
    const nextUrl = new URL(url);
    return {
      nextUrl,
      headers: { get: () => null },
      text: async () => (body !== undefined ? JSON.stringify(body) : ""),
    } as any;
  }

  it("401 si non authentifié", async () => {
    resolveApiActorMock.mockResolvedValue(null);
    const res = await postPasseportGenerateRoute(
      postReq("http://localhost/api/v1/me/passeport/generate")
    );
    expect(res.status).toBe(401);
    expect(generateMyPasseport).not.toHaveBeenCalled();
  });

  it("succès génération", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    generateMyPasseport.mockResolvedValue({
      numeroPasseport: "AMAKI-2026-NEW",
      dateGenerationPasseport: "2026-08-18T12:00:00.000Z",
      disponible: true,
      peutGenerer: false,
    });
    const res = await postPasseportGenerateRoute(
      postReq("http://localhost/api/v1/me/passeport/generate")
    );
    expect(res.status).toBe(200);
    expect(generateMyPasseport).toHaveBeenCalledWith(actor());
  });

  it("refuse userId dans le body", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    const res = await postPasseportGenerateRoute(
      postReq("http://localhost/api/v1/me/passeport/generate", {
        userId: "other",
      })
    );
    expect(res.status).toBe(400);
    expect(generateMyPasseport).not.toHaveBeenCalled();
  });

  it("refuse adherentId dans le body", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    const res = await postPasseportGenerateRoute(
      postReq("http://localhost/api/v1/me/passeport/generate", {
        adherentId: "x",
      })
    );
    expect(res.status).toBe(400);
    expect(generateMyPasseport).not.toHaveBeenCalled();
  });
});

describe("GET /api/v1/me/passeport/pdf", () => {
  beforeEach(() => {
    resolveApiActorMock.mockReset();
    getMyPasseportPdf.mockReset();
  });

  it("401 si non authentifié", async () => {
    resolveApiActorMock.mockResolvedValue(null);
    const res = await getPasseportPdfRoute(
      req("http://localhost/api/v1/me/passeport/pdf")
    );
    expect(res.status).toBe(401);
    expect(getMyPasseportPdf).not.toHaveBeenCalled();
  });

  it("retourne application/pdf avec Cache-Control private, no-store", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    getMyPasseportPdf.mockResolvedValue({
      buffer: Buffer.from("%PDF-1.4 test"),
      numeroPasseport: "AMAKI-2026-ABC123",
      filename: "Passeport-AMAKI-AMAKI-2026-ABC123.pdf",
    });
    const res = await getPasseportPdfRoute(
      req("http://localhost/api/v1/me/passeport/pdf")
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    expect(res.headers.get("Content-Disposition")).toContain("inline");
    expect(res.headers.get("Content-Disposition")).toContain(
      "Passeport-AMAKI-AMAKI-2026-ABC123.pdf"
    );
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.toString()).toContain("%PDF");
    expect(getMyPasseportPdf).toHaveBeenCalledWith(actor());
  });

  it("refuse userId query", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    const res = await getPasseportPdfRoute(
      req("http://localhost/api/v1/me/passeport/pdf?userId=other")
    );
    expect(res.status).toBe(400);
    expect(getMyPasseportPdf).not.toHaveBeenCalled();
  });

  it("pas de redirect Web", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    getMyPasseportPdf.mockResolvedValue({
      buffer: Buffer.from("%PDF"),
      numeroPasseport: "AMAKI-2026-X",
      filename: "Passeport-AMAKI-AMAKI-2026-X.pdf",
    });
    const res = await getPasseportPdfRoute(
      req("http://localhost/api/v1/me/passeport/pdf")
    );
    expect(res.status).toBeLessThan(400);
    expect(res.headers.get("location")).toBeNull();
  });
});

/* ── Tâches ─────────────────────────────────────────────── */

describe("GET /api/v1/me/taches", () => {
  beforeEach(() => {
    resolveApiActorMock.mockReset();
    getMyTaches.mockReset();
  });

  it("401 si non authentifié", async () => {
    resolveApiActorMock.mockResolvedValue(null);
    const res = await getTachesRoute(
      req("http://localhost/api/v1/me/taches")
    );
    expect(res.status).toBe(401);
  });

  it("200 succès", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    getMyTaches.mockResolvedValue([]);
    const res = await getTachesRoute(
      req("http://localhost/api/v1/me/taches")
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data).toEqual([]);
  });

  it("400 si userId query", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    const res = await getTachesRoute(
      req("http://localhost/api/v1/me/taches?userId=x")
    );
    expect(res.status).toBe(400);
  });

  it("400 si adherentId query", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    const res = await getTachesRoute(
      req("http://localhost/api/v1/me/taches?adherentId=x")
    );
    expect(res.status).toBe(400);
  });
});

describe("POST /api/v1/me/taches/[id]/commentaires", () => {
  beforeEach(() => {
    resolveApiActorMock.mockReset();
    createMyTacheCommentaire.mockReset();
  });

  const routeParams = Promise.resolve({ id: "sp-1" });

  it("401 si non authentifié", async () => {
    resolveApiActorMock.mockResolvedValue(null);
    const res = await postTacheCommentaireRoute(
      postReq("http://localhost/api/v1/me/taches/sp-1/commentaires", {
        contenu: "test",
      }),
      { params: routeParams }
    );
    expect(res.status).toBe(401);
  });

  it("201 succès", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    createMyTacheCommentaire.mockResolvedValue({ id: "com-new" });
    const res = await postTacheCommentaireRoute(
      postReq("http://localhost/api/v1/me/taches/sp-1/commentaires", {
        contenu: "Mon commentaire",
      }),
      { params: routeParams }
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.id).toBe("com-new");
  });

  it("400 si userId dans body", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    const res = await postTacheCommentaireRoute(
      postReq("http://localhost/api/v1/me/taches/sp-1/commentaires", {
        contenu: "test",
        userId: "attaque",
      }),
      { params: routeParams }
    );
    expect(res.status).toBe(400);
  });

  it("400 si adherentId dans body", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    const res = await postTacheCommentaireRoute(
      postReq("http://localhost/api/v1/me/taches/sp-1/commentaires", {
        contenu: "test",
        adherentId: "attaque",
      }),
      { params: routeParams }
    );
    expect(res.status).toBe(400);
  });

  it("400 si auteurId dans body", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    const res = await postTacheCommentaireRoute(
      postReq("http://localhost/api/v1/me/taches/sp-1/commentaires", {
        contenu: "test",
        auteurId: "attaque",
      }),
      { params: routeParams }
    );
    expect(res.status).toBe(400);
  });

  it("400 si userId query", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    const res = await postTacheCommentaireRoute(
      postReq(
        "http://localhost/api/v1/me/taches/sp-1/commentaires?userId=x",
        { contenu: "test" }
      ),
      { params: routeParams }
    );
    expect(res.status).toBe(400);
  });

  it("passe actor du Bearer au service", async () => {
    const a = actor({ userId: "user-bearer" });
    resolveApiActorMock.mockResolvedValue(a);
    createMyTacheCommentaire.mockResolvedValue({ id: "c" });
    await postTacheCommentaireRoute(
      postReq("http://localhost/api/v1/me/taches/sp-1/commentaires", {
        contenu: "ok",
      }),
      { params: routeParams }
    );
    expect(createMyTacheCommentaire).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-bearer" }),
      "sp-1",
      expect.any(Object)
    );
  });

  it("400 si body est null", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    const res = await postTacheCommentaireRoute(
      postReq("http://localhost/api/v1/me/taches/sp-1/commentaires", null),
      { params: routeParams }
    );
    expect(res.status).toBe(400);
  });

  it("400 si body est un array", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    const res = await postTacheCommentaireRoute(
      postReq("http://localhost/api/v1/me/taches/sp-1/commentaires", [
        { contenu: "test" },
      ]),
      { params: routeParams }
    );
    expect(res.status).toBe(400);
  });

  it("400 si body est une string JSON", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    const res = await postTacheCommentaireRoute(
      postReq(
        "http://localhost/api/v1/me/taches/sp-1/commentaires",
        '{"contenu":"test"}'
      ),
      { params: routeParams }
    );
    expect(res.status).toBe(400);
  });
});

/* ── Réunions ───────────────────────────────────────────── */

describe("GET /api/v1/me/reunions", () => {
  beforeEach(() => {
    resolveApiActorMock.mockReset();
    getMyReunions.mockReset();
  });

  it("401 si non authentifié", async () => {
    resolveApiActorMock.mockResolvedValue(null);
    const res = await getReunionsRoute(
      req("http://localhost/api/v1/me/reunions")
    );
    expect(res.status).toBe(401);
  });

  it("200 succès vide", async () => {
    const a = actor();
    resolveApiActorMock.mockResolvedValue(a);
    getMyReunions.mockResolvedValue([]);
    const res = await getReunionsRoute(
      req("http://localhost/api/v1/me/reunions")
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data).toEqual([]);
    expect(getMyReunions).toHaveBeenCalledWith(a);
  });

  it("200 succès avec données", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    getMyReunions.mockResolvedValue([
      {
        id: "r1",
        titre: "Réunion de mars 2026",
        annee: 2026,
        mois: 3,
        dateReunion: null,
        statut: "EnAttente",
        typeLieu: "Domicile",
        lieuLabel: "Chez Alice",
        lieuAdresse: null,
        isHost: false,
        hostName: "Alice",
        hostTelephones: null,
        participationStatus: null,
        canUpdateParticipation: false,
        commentaires: null,
      },
    ]);
    const res = await getReunionsRoute(
      req("http://localhost/api/v1/me/reunions")
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toHaveLength(1);
  });

  it("400 si userId query", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    const res = await getReunionsRoute(
      req("http://localhost/api/v1/me/reunions?userId=x")
    );
    expect(res.status).toBe(400);
    expect(getMyReunions).not.toHaveBeenCalled();
  });

  it("400 si adherentId query", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    const res = await getReunionsRoute(
      req("http://localhost/api/v1/me/reunions?adherentId=x")
    );
    expect(res.status).toBe(400);
    expect(getMyReunions).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/v1/me/reunions/[id]/participation", () => {
  beforeEach(() => {
    resolveApiActorMock.mockReset();
    updateMyReunionParticipation.mockReset();
  });

  it("401 si non authentifié", async () => {
    resolveApiActorMock.mockResolvedValue(null);
    const res = await patchReunionParticipationRoute(
      patchReq("http://localhost/api/v1/me/reunions/r1/participation", {
        statut: "Present",
      }),
      { params: Promise.resolve({ id: "r1" }) }
    );
    expect(res.status).toBe(401);
  });

  it("200 succès", async () => {
    const a = actor();
    resolveApiActorMock.mockResolvedValue(a);
    updateMyReunionParticipation.mockResolvedValue({ statut: "Present" });
    const res = await patchReunionParticipationRoute(
      patchReq("http://localhost/api/v1/me/reunions/r1/participation", {
        statut: "Present",
      }),
      { params: Promise.resolve({ id: "r1" }) }
    );
    expect(res.status).toBe(200);
    expect(updateMyReunionParticipation).toHaveBeenCalledWith(a, "r1", {
      statut: "Present",
    });
  });

  it("400 si userId query", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    const res = await patchReunionParticipationRoute(
      patchReq(
        "http://localhost/api/v1/me/reunions/r1/participation?userId=x",
        { statut: "Present" }
      ),
      { params: Promise.resolve({ id: "r1" }) }
    );
    expect(res.status).toBe(400);
    expect(updateMyReunionParticipation).not.toHaveBeenCalled();
  });

  it("400 si adherentId dans body", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    const res = await patchReunionParticipationRoute(
      patchReq("http://localhost/api/v1/me/reunions/r1/participation", {
        statut: "Present",
        adherentId: "adh-injected",
      }),
      { params: Promise.resolve({ id: "r1" }) }
    );
    expect(res.status).toBe(400);
    expect(updateMyReunionParticipation).not.toHaveBeenCalled();
  });

  it("400 si participantId dans body", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    const res = await patchReunionParticipationRoute(
      patchReq("http://localhost/api/v1/me/reunions/r1/participation", {
        statut: "Present",
        participantId: "p-injected",
      }),
      { params: Promise.resolve({ id: "r1" }) }
    );
    expect(res.status).toBe(400);
    expect(updateMyReunionParticipation).not.toHaveBeenCalled();
  });
});

describe("GET /api/v1/me/reunions/year", () => {
  beforeEach(() => {
    resolveApiActorMock.mockReset();
    getMyReunionYear.mockReset();
  });

  it("401 si non authentifié", async () => {
    resolveApiActorMock.mockResolvedValue(null);
    const res = await getReunionYearRoute(
      req("http://localhost/api/v1/me/reunions/year?annee=2026")
    );
    expect(res.status).toBe(401);
  });

  it("200 succès", async () => {
    const a = actor();
    resolveApiActorMock.mockResolvedValue(a);
    getMyReunionYear.mockResolvedValue({
      annee: 2026,
      alreadyHostThisYear: false,
      months: [],
    });
    const res = await getReunionYearRoute(
      req("http://localhost/api/v1/me/reunions/year?annee=2026")
    );
    expect(res.status).toBe(200);
    expect(getMyReunionYear).toHaveBeenCalledWith(a, 2026);
  });

  it("400 si adherentId query", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    const res = await getReunionYearRoute(
      req("http://localhost/api/v1/me/reunions/year?annee=2026&adherentId=x")
    );
    expect(res.status).toBe(400);
    expect(getMyReunionYear).not.toHaveBeenCalled();
  });
});

describe("POST /api/v1/me/reunions/host-proposals", () => {
  beforeEach(() => {
    resolveApiActorMock.mockReset();
    proposeMyselfAsReunionHost.mockReset();
  });

  it("401 si non authentifié", async () => {
    resolveApiActorMock.mockResolvedValue(null);
    const res = await postHostProposalRoute(
      postReq("http://localhost/api/v1/me/reunions/host-proposals", {
        annee: 2026,
        mois: 10,
      })
    );
    expect(res.status).toBe(401);
  });

  it("201 succès", async () => {
    const a = actor();
    resolveApiActorMock.mockResolvedValue(a);
    proposeMyselfAsReunionHost.mockResolvedValue({
      id: "r1",
      annee: 2026,
      mois: 10,
      statut: "EnAttente",
      hostName: "Ada",
    });
    const res = await postHostProposalRoute(
      postReq("http://localhost/api/v1/me/reunions/host-proposals", {
        annee: 2026,
        mois: 10,
      })
    );
    expect(res.status).toBe(201);
    expect(proposeMyselfAsReunionHost).toHaveBeenCalledWith(a, {
      annee: 2026,
      mois: 10,
    });
  });

  it("400 si adherentHoteId body", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    const res = await postHostProposalRoute(
      postReq("http://localhost/api/v1/me/reunions/host-proposals", {
        annee: 2026,
        mois: 10,
        adherentHoteId: "adh-x",
      })
    );
    expect(res.status).toBe(400);
    expect(proposeMyselfAsReunionHost).not.toHaveBeenCalled();
  });

  it("400 si force body", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    const res = await postHostProposalRoute(
      postReq("http://localhost/api/v1/me/reunions/host-proposals", {
        annee: 2026,
        mois: 10,
        force: true,
      })
    );
    expect(res.status).toBe(400);
  });

  it("409 si CONFLICT métier", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    const { ServiceError } = await import("@/lib/service-error");
    proposeMyselfAsReunionHost.mockRejectedValue(
      new ServiceError("CONFLICT", "Mois déjà pris")
    );
    const res = await postHostProposalRoute(
      postReq("http://localhost/api/v1/me/reunions/host-proposals", {
        annee: 2026,
        mois: 10,
      })
    );
    expect(res.status).toBe(409);
  });
});

describe("DELETE /api/v1/me/reunions/[id]/host-proposal", () => {
  beforeEach(() => {
    resolveApiActorMock.mockReset();
    withdrawMyReunionHostProposal.mockReset();
  });

  it("401 si non authentifié", async () => {
    resolveApiActorMock.mockResolvedValue(null);
    const res = await deleteHostProposalRoute(
      deleteReq("http://localhost/api/v1/me/reunions/r1/host-proposal"),
      { params: Promise.resolve({ id: "r1" }) }
    );
    expect(res.status).toBe(401);
  });

  it("200 succès", async () => {
    const a = actor();
    resolveApiActorMock.mockResolvedValue(a);
    withdrawMyReunionHostProposal.mockResolvedValue({
      id: "r1",
      annee: 2026,
      mois: 10,
      statut: "EnAttente",
    });
    const res = await deleteHostProposalRoute(
      deleteReq("http://localhost/api/v1/me/reunions/r1/host-proposal"),
      { params: Promise.resolve({ id: "r1" }) }
    );
    expect(res.status).toBe(200);
    expect(withdrawMyReunionHostProposal).toHaveBeenCalledWith(a, "r1");
  });

  it("400 si userId query", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    const res = await deleteHostProposalRoute(
      deleteReq(
        "http://localhost/api/v1/me/reunions/r1/host-proposal?userId=x"
      ),
      { params: Promise.resolve({ id: "r1" }) }
    );
    expect(res.status).toBe(400);
    expect(withdrawMyReunionHostProposal).not.toHaveBeenCalled();
  });

  it("400 si adherentId body", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    const res = await deleteHostProposalRoute(
      deleteReq("http://localhost/api/v1/me/reunions/r1/host-proposal", {
        adherentId: "adh-injected",
      }),
      { params: Promise.resolve({ id: "r1" }) }
    );
    expect(res.status).toBe(400);
    expect(withdrawMyReunionHostProposal).not.toHaveBeenCalled();
  });

  it("400 si hostId body", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    const res = await deleteHostProposalRoute(
      deleteReq("http://localhost/api/v1/me/reunions/r1/host-proposal", {
        hostId: "h-injected",
      }),
      { params: Promise.resolve({ id: "r1" }) }
    );
    expect(res.status).toBe(400);
  });

  it("403 si pas hôte", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    withdrawMyReunionHostProposal.mockRejectedValue(
      new ServiceError("FORBIDDEN", "Seul l'hôte de la réunion peut se désister.")
    );
    const res = await deleteHostProposalRoute(
      deleteReq("http://localhost/api/v1/me/reunions/r1/host-proposal"),
      { params: Promise.resolve({ id: "r1" }) }
    );
    expect(res.status).toBe(403);
  });

  it("404 si réunion inconnue", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    withdrawMyReunionHostProposal.mockRejectedValue(
      new ServiceError("NOT_FOUND", "Réunion non trouvée")
    );
    const res = await deleteHostProposalRoute(
      deleteReq("http://localhost/api/v1/me/reunions/unknown/host-proposal"),
      { params: Promise.resolve({ id: "unknown" }) }
    );
    expect(res.status).toBe(404);
  });
});
