import { beforeEach, describe, expect, it, vi } from "vitest";
import { ServiceError } from "@/lib/service-error";
import type { AuthContext } from "@/lib/auth-context";

const {
  resolveApiActorMock,
  getMe: getMeMock,
  getMyNotifications,
  getMyUnreadNotificationCount,
  getMyCotisationsMensuelles,
  getMyDocuments,
} = vi.hoisted(() => ({
  resolveApiActorMock: vi.fn(),
  getMe: vi.fn(),
  getMyNotifications: vi.fn(),
  getMyUnreadNotificationCount: vi.fn(),
  getMyCotisationsMensuelles: vi.fn(),
  getMyDocuments: vi.fn(),
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
vi.mock("@/lib/services/documents/get-my-documents", () => ({
  getMyDocuments,
}));

import { GET as getMeRoute } from "@/app/api/v1/me/route";
import { GET as getNotificationsRoute } from "@/app/api/v1/me/notifications/route";
import { GET as getUnreadRoute } from "@/app/api/v1/me/notifications/unread-count/route";
import { GET as getCotisationsRoute } from "@/app/api/v1/me/cotisations-mensuelles/route";
import { GET as getDocumentsRoute } from "@/app/api/v1/me/documents/route";

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
