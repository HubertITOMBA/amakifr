import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContext } from "@/lib/auth-context";

const { findMany, count } = vi.hoisted(() => ({
  findMany: vi.fn(),
  count: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    notification: {
      findMany,
      count,
    },
  },
}));

import { getMyNotifications } from "@/lib/services/notifications/get-my-notifications";
import { getMyUnreadNotificationCount } from "@/lib/services/notifications/get-my-unread-count";

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

const sampleRow = {
  id: "n-1",
  userId: "user-1",
  type: "Systeme" as const,
  titre: "Bienvenue",
  message: "Hello",
  lien: "/profil",
  lue: false,
  createdAt: new Date("2024-06-01T12:00:00.000Z"),
};

describe("getMyNotifications", () => {
  beforeEach(() => {
    findMany.mockReset();
    count.mockReset();
  });

  it("lance UNAUTHENTICATED si actor.userId est absent", async () => {
    await expect(getMyNotifications(actor({ userId: "" }))).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
    });
    expect(findMany).not.toHaveBeenCalled();
  });

  it("retourne une liste vide", async () => {
    findMany.mockResolvedValue([]);
    const result = await getMyNotifications(actor());
    expect(result).toEqual([]);
    expect(findMany).toHaveBeenCalled();
  });

  it("filtre toujours sur actor.userId (pas d'userId client)", async () => {
    findMany.mockResolvedValue([sampleRow]);
    await getMyNotifications(actor({ userId: "user-own" }), {
      limit: 10,
      lue: false,
      type: "Systeme",
    });

    const arg = findMany.mock.calls[0][0];
    expect(arg.where.userId).toBe("user-own");
    expect(arg.where.lue).toBe(false);
    expect(arg.where.type).toBe("Systeme");
    expect(arg.take).toBe(10);
    expect(arg.skip).toBe(0);
    expect(arg.orderBy).toEqual({ createdAt: "desc" });
  });

  it("mappe vers NotificationDto avec dates ISO", async () => {
    findMany.mockResolvedValue([sampleRow]);
    const result = await getMyNotifications(actor());
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: "n-1",
      userId: "user-1",
      type: "Systeme",
      titre: "Bienvenue",
      message: "Hello",
      lien: "/profil",
      lue: false,
      createdAt: "2024-06-01T12:00:00.000Z",
    });
    expect(result[0]).not.toHaveProperty("password");
  });

  it("n'expose pas de champ sensible", async () => {
    findMany.mockResolvedValue([
      {
        ...sampleRow,
        // champs parasites éventuels côté mock — non mappés
        password: "secret",
        token: "tok",
      },
    ]);
    const result = await getMyNotifications(actor());
    expect(Object.keys(result[0]).sort()).toEqual(
      ["createdAt", "id", "lien", "lue", "message", "titre", "type", "userId"].sort()
    );
  });

  it("lance INTERNAL_ERROR si Prisma échoue", async () => {
    findMany.mockRejectedValue(new Error("db down"));
    await expect(getMyNotifications(actor())).rejects.toMatchObject({
      code: "INTERNAL_ERROR",
      message: "Erreur lors de la récupération des notifications",
    });
  });

  it("defaults limit 50 / offset 0", async () => {
    findMany.mockResolvedValue([]);
    await getMyNotifications(actor());
    const arg = findMany.mock.calls[0][0];
    expect(arg.take).toBe(50);
    expect(arg.skip).toBe(0);
  });
});

describe("getMyUnreadNotificationCount", () => {
  beforeEach(() => {
    findMany.mockReset();
    count.mockReset();
  });

  it("lance UNAUTHENTICATED si actor.userId est absent", async () => {
    await expect(
      getMyUnreadNotificationCount(actor({ userId: "   " }))
    ).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    expect(count).not.toHaveBeenCalled();
  });

  it("compte les non lues de actor.userId uniquement", async () => {
    count.mockResolvedValue(3);
    const n = await getMyUnreadNotificationCount(actor({ userId: "user-own" }));
    expect(n).toBe(3);
    expect(count).toHaveBeenCalledWith({
      where: {
        userId: "user-own",
        lue: false,
      },
    });
  });

  it("retourne 0 si aucune non lue", async () => {
    count.mockResolvedValue(0);
    await expect(getMyUnreadNotificationCount(actor())).resolves.toBe(0);
  });

  it("lance INTERNAL_ERROR si Prisma échoue", async () => {
    count.mockRejectedValue(new Error("db down"));
    await expect(getMyUnreadNotificationCount(actor())).rejects.toMatchObject({
      code: "INTERNAL_ERROR",
      message: "Erreur lors du comptage des notifications",
    });
  });
});
