import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContext } from "@/lib/auth-context";

const { updateMany, deleteMany } = vi.hoisted(() => ({
  updateMany: vi.fn(),
  deleteMany: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    notification: {
      updateMany,
      deleteMany,
    },
  },
}));

import { markMyNotificationAsRead } from "@/lib/services/notifications/mark-my-notification-as-read";
import { markAllMyNotificationsAsRead } from "@/lib/services/notifications/mark-all-my-notifications-as-read";
import { deleteMyNotification } from "@/lib/services/notifications/delete-my-notification";

function actor(overrides: Partial<AuthContext> = {}): AuthContext {
  return {
    userId: "user-a",
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

describe("markMyNotificationAsRead", () => {
  beforeEach(() => {
    updateMany.mockReset();
    deleteMany.mockReset();
  });

  it("lance UNAUTHENTICATED si actor.userId est absent", async () => {
    await expect(
      markMyNotificationAsRead(actor({ userId: "" }), "notif-1")
    ).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("marque comme lue avec where id + actor.userId", async () => {
    updateMany.mockResolvedValue({ count: 1 });
    await markMyNotificationAsRead(actor(), "notif-1");
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "notif-1", userId: "user-a" },
      data: { lue: true },
    });
  });

  it("est idempotent si déjà lue (count > 0)", async () => {
    updateMany.mockResolvedValue({ count: 1 });
    await expect(
      markMyNotificationAsRead(actor(), "notif-already-read")
    ).resolves.toBeUndefined();
  });

  it("NOT_FOUND si count === 0 (inexistante ou autre user) — anti-IDOR", async () => {
    updateMany.mockResolvedValue({ count: 0 });
    await expect(
      markMyNotificationAsRead(actor({ userId: "user-a" }), "notif-b")
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Notification non trouvée",
    });
    const arg = updateMany.mock.calls[0][0];
    expect(arg.where.userId).toBe("user-a");
    expect(arg.where.userId).not.toBe("user-b");
    expect(arg.where.id).toBe("notif-b");
  });

  it("NOT_FOUND si notificationId vide", async () => {
    await expect(
      markMyNotificationAsRead(actor(), "  ")
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("lance INTERNAL_ERROR si Prisma échoue", async () => {
    updateMany.mockRejectedValue(new Error("db down"));
    await expect(
      markMyNotificationAsRead(actor(), "notif-1")
    ).rejects.toMatchObject({
      code: "INTERNAL_ERROR",
      message: "Erreur lors du marquage de la notification",
    });
  });
});

describe("markAllMyNotificationsAsRead", () => {
  beforeEach(() => {
    updateMany.mockReset();
    deleteMany.mockReset();
  });

  it("lance UNAUTHENTICATED si actor.userId est absent", async () => {
    await expect(
      markAllMyNotificationsAsRead(actor({ userId: "   " }))
    ).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("updateMany filtre actor.userId et lue:false uniquement", async () => {
    updateMany.mockResolvedValue({ count: 4 });
    const n = await markAllMyNotificationsAsRead(actor({ userId: "user-own" }));
    expect(n).toBe(4);
    expect(updateMany).toHaveBeenCalledWith({
      where: { userId: "user-own", lue: false },
      data: { lue: true },
    });
  });

  it("succès avec count 0 (rien à marquer)", async () => {
    updateMany.mockResolvedValue({ count: 0 });
    await expect(markAllMyNotificationsAsRead(actor())).resolves.toBe(0);
  });

  it("lance INTERNAL_ERROR si Prisma échoue", async () => {
    updateMany.mockRejectedValue(new Error("db down"));
    await expect(markAllMyNotificationsAsRead(actor())).rejects.toMatchObject({
      code: "INTERNAL_ERROR",
      message: "Erreur lors du marquage des notifications",
    });
  });
});

describe("deleteMyNotification", () => {
  beforeEach(() => {
    updateMany.mockReset();
    deleteMany.mockReset();
  });

  it("lance UNAUTHENTICATED si actor.userId est absent", async () => {
    await expect(
      deleteMyNotification(actor({ userId: "" }), "notif-1")
    ).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    expect(deleteMany).not.toHaveBeenCalled();
  });

  it("deleteMany limité à id + actor.userId", async () => {
    deleteMany.mockResolvedValue({ count: 1 });
    await deleteMyNotification(actor(), "notif-1");
    expect(deleteMany).toHaveBeenCalledWith({
      where: { id: "notif-1", userId: "user-a" },
    });
  });

  it("NOT_FOUND anti-IDOR si count === 0 (autre user ou inconnue)", async () => {
    deleteMany.mockResolvedValue({ count: 0 });
    await expect(
      deleteMyNotification(actor({ userId: "user-a" }), "notif-foreign")
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Notification non trouvée",
    });
    const arg = deleteMany.mock.calls[0][0];
    expect(arg.where).toEqual({ id: "notif-foreign", userId: "user-a" });
    expect(arg.where.userId).toBe("user-a");
    expect(arg.where).not.toHaveProperty("userId", "user-b");
  });

  it("lance INTERNAL_ERROR si Prisma échoue", async () => {
    deleteMany.mockRejectedValue(new Error("db down"));
    await expect(
      deleteMyNotification(actor(), "notif-1")
    ).rejects.toMatchObject({
      code: "INTERNAL_ERROR",
      message: "Erreur lors de la suppression de la notification",
    });
  });
});
