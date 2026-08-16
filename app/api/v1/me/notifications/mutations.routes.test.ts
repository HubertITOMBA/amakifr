import { beforeEach, describe, expect, it, vi } from "vitest";
import { ServiceError } from "@/lib/service-error";
import type { AuthContext } from "@/lib/auth-context";

const {
  resolveApiActorMock,
  markMyNotificationAsRead,
  markAllMyNotificationsAsRead,
  deleteMyNotification,
} = vi.hoisted(() => ({
  resolveApiActorMock: vi.fn(),
  markMyNotificationAsRead: vi.fn(),
  markAllMyNotificationsAsRead: vi.fn(),
  deleteMyNotification: vi.fn(),
}));

vi.mock("@/lib/api/auth-resolve", () => ({
  resolveApiActor: resolveApiActorMock,
}));
vi.mock("@/lib/services/notifications/mark-my-notification-as-read", () => ({
  markMyNotificationAsRead,
}));
vi.mock("@/lib/services/notifications/mark-all-my-notifications-as-read", () => ({
  markAllMyNotificationsAsRead,
}));
vi.mock("@/lib/services/notifications/delete-my-notification", () => ({
  deleteMyNotification,
}));

import { PATCH as markOneRead } from "@/app/api/v1/me/notifications/[id]/read/route";
import { POST as markAllRead } from "@/app/api/v1/me/notifications/read-all/route";
import { DELETE as deleteOne } from "@/app/api/v1/me/notifications/[id]/route";

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

function req(url = "http://localhost/api/v1/me/notifications/n1/read") {
  return {
    nextUrl: new URL(url),
    headers: { get: () => null },
  } as any;
}

function ctx(id: string) {
  return { params: { id } };
}

describe("PATCH /api/v1/me/notifications/:id/read", () => {
  beforeEach(() => {
    resolveApiActorMock.mockReset();
    markMyNotificationAsRead.mockReset();
  });

  it("401 si non auth", async () => {
    resolveApiActorMock.mockResolvedValue(null);
    const res = await markOneRead(req(), ctx("n1"));
    expect(res.status).toBe(401);
    expect(markMyNotificationAsRead).not.toHaveBeenCalled();
  });

  it("acteur mobile → service appelé avec actor + id", async () => {
    const mobile = actor({ channel: "mobile", sessionId: "jti-1" });
    resolveApiActorMock.mockResolvedValue(mobile);
    markMyNotificationAsRead.mockResolvedValue(undefined);
    const res = await markOneRead(req(), ctx("notif-42"));
    expect(res.status).toBe(200);
    expect(markMyNotificationAsRead).toHaveBeenCalledWith(mobile, "notif-42");
    expect(await res.json()).toEqual({
      success: true,
      data: { updated: true },
    });
    const call = markMyNotificationAsRead.mock.calls[0];
    expect(call).toHaveLength(2);
    expect(JSON.stringify(call)).not.toContain("userId\":\"other");
  });

  it("NOT_FOUND → 404 (autre user / inexistante)", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    markMyNotificationAsRead.mockRejectedValue(
      new ServiceError("NOT_FOUND", "Notification non trouvée")
    );
    const res = await markOneRead(req(), ctx("foreign"));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.message).toBe("Notification non trouvée");
  });

  it("id vide → 400", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    const res = await markOneRead(req(), ctx("   "));
    expect(res.status).toBe(400);
    expect(markMyNotificationAsRead).not.toHaveBeenCalled();
  });

  it("INTERNAL_ERROR → 500", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    markMyNotificationAsRead.mockRejectedValue(
      new ServiceError("INTERNAL_ERROR", "Erreur lors du marquage")
    );
    const res = await markOneRead(req(), ctx("n1"));
    expect(res.status).toBe(500);
  });
});

describe("POST /api/v1/me/notifications/read-all", () => {
  beforeEach(() => {
    resolveApiActorMock.mockReset();
    markAllMyNotificationsAsRead.mockReset();
  });

  it("401 si non auth", async () => {
    resolveApiActorMock.mockResolvedValue(null);
    const res = await markAllRead(req("http://localhost/api/v1/me/notifications/read-all"));
    expect(res.status).toBe(401);
  });

  it("acteur mobile → service avec actor uniquement, count > 0", async () => {
    const mobile = actor({ channel: "mobile" });
    resolveApiActorMock.mockResolvedValue(mobile);
    markAllMyNotificationsAsRead.mockResolvedValue(5);
    const res = await markAllRead(req());
    expect(res.status).toBe(200);
    expect(markAllMyNotificationsAsRead).toHaveBeenCalledWith(mobile);
    expect(markAllMyNotificationsAsRead.mock.calls[0]).toHaveLength(1);
    expect(await res.json()).toEqual({ success: true, data: { count: 5 } });
  });

  it("count = 0 → succès", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    markAllMyNotificationsAsRead.mockResolvedValue(0);
    const res = await markAllRead(req());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, data: { count: 0 } });
  });

  it("INTERNAL_ERROR → 500", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    markAllMyNotificationsAsRead.mockRejectedValue(
      new ServiceError("INTERNAL_ERROR", "Erreur")
    );
    const res = await markAllRead(req());
    expect(res.status).toBe(500);
  });
});

describe("DELETE /api/v1/me/notifications/:id", () => {
  beforeEach(() => {
    resolveApiActorMock.mockReset();
    deleteMyNotification.mockReset();
  });

  it("401 si non auth", async () => {
    resolveApiActorMock.mockResolvedValue(null);
    const res = await deleteOne(req(), ctx("n1"));
    expect(res.status).toBe(401);
  });

  it("acteur mobile → service actor + id", async () => {
    const mobile = actor({ channel: "mobile" });
    resolveApiActorMock.mockResolvedValue(mobile);
    deleteMyNotification.mockResolvedValue(undefined);
    const res = await deleteOne(req(), ctx("notif-9"));
    expect(res.status).toBe(200);
    expect(deleteMyNotification).toHaveBeenCalledWith(mobile, "notif-9");
    expect(await res.json()).toEqual({
      success: true,
      data: { deleted: true },
    });
  });

  it("autre user / inexistant → 404", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    deleteMyNotification.mockRejectedValue(
      new ServiceError("NOT_FOUND", "Notification non trouvée")
    );
    const res = await deleteOne(req(), ctx("x"));
    expect(res.status).toBe(404);
  });

  it("INTERNAL_ERROR → 500", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    deleteMyNotification.mockRejectedValue(
      new ServiceError("INTERNAL_ERROR", "Erreur")
    );
    const res = await deleteOne(req(), ctx("n1"));
    expect(res.status).toBe(500);
  });

  it("id invalide → 400, service non appelé", async () => {
    resolveApiActorMock.mockResolvedValue(actor());
    const res = await deleteOne(req(), ctx(""));
    expect(res.status).toBe(400);
    expect(deleteMyNotification).not.toHaveBeenCalled();
  });
});
