import { beforeEach, describe, expect, it, vi } from "vitest";
import { ServiceError } from "@/lib/service-error";
import type { AuthContext } from "@/lib/auth-context";

const {
  resolveApiActorFromWebSession,
  getMe,
  getMyNotifications,
  getMyUnreadNotificationCount,
  getMyCotisationsMensuelles,
} = vi.hoisted(() => ({
  resolveApiActorFromWebSession: vi.fn(),
  getMe: vi.fn(),
  getMyNotifications: vi.fn(),
  getMyUnreadNotificationCount: vi.fn(),
  getMyCotisationsMensuelles: vi.fn(),
}));

vi.mock("@/lib/api/auth-web", () => ({ resolveApiActorFromWebSession }));
vi.mock("@/lib/services/user/get-me", () => ({ getMe }));
vi.mock("@/lib/services/notifications/get-my-notifications", () => ({
  getMyNotifications,
}));
vi.mock("@/lib/services/notifications/get-my-unread-count", () => ({
  getMyUnreadNotificationCount,
}));
vi.mock("@/lib/services/cotisations/get-my-cotisations-mensuelles", () => ({
  getMyCotisationsMensuelles,
}));

import { GET as getMeRoute } from "@/app/api/v1/me/route";
import { GET as getNotificationsRoute } from "@/app/api/v1/me/notifications/route";
import { GET as getUnreadRoute } from "@/app/api/v1/me/notifications/unread-count/route";
import { GET as getCotisationsRoute } from "@/app/api/v1/me/cotisations-mensuelles/route";

function actor(): AuthContext {
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
  };
}

function req(url: string) {
  const nextUrl = new URL(url);
  return { nextUrl } as any;
}

describe("GET /api/v1/me", () => {
  beforeEach(() => {
    resolveApiActorFromWebSession.mockReset();
    getMe.mockReset();
  });

  it("401 si non authentifié", async () => {
    resolveApiActorFromWebSession.mockResolvedValue(null);
    const res = await getMeRoute();
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe("UNAUTHENTICATED");
  });

  it("200 + data si succès", async () => {
    resolveApiActorFromWebSession.mockResolvedValue(actor());
    getMe.mockResolvedValue({ id: "user-1", email: "a@example.com" });
    const res = await getMeRoute();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      success: true,
      data: { id: "user-1", email: "a@example.com" },
    });
    expect(getMe).toHaveBeenCalledWith(actor());
  });

  it("mappe ServiceError NOT_FOUND", async () => {
    resolveApiActorFromWebSession.mockResolvedValue(actor());
    getMe.mockRejectedValue(new ServiceError("NOT_FOUND", "Utilisateur introuvable"));
    const res = await getMeRoute();
    expect(res.status).toBe(404);
  });

  it("500 générique si erreur inconnue", async () => {
    resolveApiActorFromWebSession.mockResolvedValue(actor());
    getMe.mockRejectedValue(new Error("boom prisma"));
    const res = await getMeRoute();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.message).toBe("Erreur interne du serveur");
    expect(JSON.stringify(body)).not.toContain("prisma");
  });
});

describe("GET /api/v1/me/notifications", () => {
  beforeEach(() => {
    resolveApiActorFromWebSession.mockReset();
    getMyNotifications.mockReset();
  });

  it("passe les query params validés au service", async () => {
    resolveApiActorFromWebSession.mockResolvedValue(actor());
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
    resolveApiActorFromWebSession.mockResolvedValue(actor());
    const res = await getNotificationsRoute(
      req("http://localhost/api/v1/me/notifications?limit=999999")
    );
    expect(res.status).toBe(400);
    expect(getMyNotifications).not.toHaveBeenCalled();
  });

  it("400 si userId query (anti-IDOR)", async () => {
    resolveApiActorFromWebSession.mockResolvedValue(actor());
    const res = await getNotificationsRoute(
      req("http://localhost/api/v1/me/notifications?userId=other")
    );
    expect(res.status).toBe(400);
    expect(getMyNotifications).not.toHaveBeenCalled();
  });
});

describe("GET /api/v1/me/notifications/unread-count", () => {
  beforeEach(() => {
    resolveApiActorFromWebSession.mockReset();
    getMyUnreadNotificationCount.mockReset();
  });

  it("succès", async () => {
    resolveApiActorFromWebSession.mockResolvedValue(actor());
    getMyUnreadNotificationCount.mockResolvedValue(3);
    const res = await getUnreadRoute();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, data: { count: 3 } });
  });

  it("erreur ServiceError", async () => {
    resolveApiActorFromWebSession.mockResolvedValue(actor());
    getMyUnreadNotificationCount.mockRejectedValue(
      new ServiceError("UNAUTHENTICATED", "Non autorisé")
    );
    const res = await getUnreadRoute();
    expect(res.status).toBe(401);
  });
});

describe("GET /api/v1/me/cotisations-mensuelles", () => {
  beforeEach(() => {
    resolveApiActorFromWebSession.mockReset();
    getMyCotisationsMensuelles.mockReset();
  });

  it("succès avec montants/dates string", async () => {
    resolveApiActorFromWebSession.mockResolvedValue(actor());
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
    resolveApiActorFromWebSession.mockResolvedValue(actor());
    getMyCotisationsMensuelles.mockResolvedValue([]);
    const res = await getCotisationsRoute(
      req("http://localhost/api/v1/me/cotisations-mensuelles")
    );
    const body = await res.json();
    expect(body.data).toEqual([]);
  });

  it("refuse adherentId query", async () => {
    resolveApiActorFromWebSession.mockResolvedValue(actor());
    const res = await getCotisationsRoute(
      req("http://localhost/api/v1/me/cotisations-mensuelles?adherentId=x")
    );
    expect(res.status).toBe(400);
    expect(getMyCotisationsMensuelles).not.toHaveBeenCalled();
  });
});
