import { beforeEach, describe, expect, it, vi } from "vitest";
import { TypeNotification } from "@prisma/client";

const { findMany, findUnique, count, auth } = vi.hoisted(() => ({
  findMany: vi.fn(),
  findUnique: vi.fn(),
  count: vi.fn(),
  auth: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    notification: { findMany, findUnique, count },
  },
}));

vi.mock("@/auth", () => ({ auth }));

import {
  getAdminNotificationsPage,
  getAdminNotificationDetails,
} from "@/actions/notifications/admin-read";

describe("getAdminNotificationsPage", () => {
  beforeEach(() => {
    findMany.mockReset();
    count.mockReset();
    auth.mockReset();
  });

  it("refuse un utilisateur non-ADMIN", async () => {
    auth.mockResolvedValue({ user: { id: "u1", role: "MEMBRE" } });
    const result = await getAdminNotificationsPage({ page: 1 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Non autorisé");
    }
    expect(findMany).not.toHaveBeenCalled();
  });

  it("pagine page 1 et page 2 avec skip/take", async () => {
    auth.mockResolvedValue({ user: { id: "admin", role: "ADMIN" } });
    count.mockResolvedValue(45);
    findMany.mockResolvedValue([]);

    await getAdminNotificationsPage({ page: 1, pageSize: 20 });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 20 })
    );

    await getAdminNotificationsPage({ page: 2, pageSize: 20 });
    expect(findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ skip: 20, take: 20 })
    );
  });

  it("retourne total et totalPages avec les mêmes filtres que count", async () => {
    auth.mockResolvedValue({ user: { id: "admin", role: "ADMIN" } });
    count.mockResolvedValue(25);
    findMany.mockResolvedValue([
      {
        id: "n1",
        type: TypeNotification.Systeme,
        titre: "Hello",
        lue: false,
        createdAt: new Date("2026-09-01T10:00:00.000Z"),
        userId: "u1",
        User: { id: "u1", name: "Alice", email: "a@amaki.fr" },
      },
    ]);

    const result = await getAdminNotificationsPage({
      page: 1,
      pageSize: 20,
      type: TypeNotification.Systeme,
      lue: false,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.total).toBe(25);
      expect(result.totalPages).toBe(2);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
    }

    const countWhere = count.mock.calls[0][0].where;
    const findWhere = findMany.mock.calls[0][0].where;
    expect(countWhere).toEqual(findWhere);
    expect(countWhere).toMatchObject({
      type: TypeNotification.Systeme,
      lue: false,
    });
  });

  it("trie par createdAt desc puis id desc", async () => {
    auth.mockResolvedValue({ user: { id: "admin", role: "ADMIN" } });
    count.mockResolvedValue(0);
    findMany.mockResolvedValue([]);

    await getAdminNotificationsPage({ page: 1 });
    expect(findMany.mock.calls[0][0].orderBy).toEqual([
      { createdAt: "desc" },
      { id: "desc" },
    ]);
  });

  it("recherche sur titre, name et email uniquement (pas le message)", async () => {
    auth.mockResolvedValue({ user: { id: "admin", role: "ADMIN" } });
    count.mockResolvedValue(0);
    findMany.mockResolvedValue([]);

    await getAdminNotificationsPage({ page: 1, search: "hubert" });
    const where = findMany.mock.calls[0][0].where;
    expect(where.OR).toEqual([
      { titre: { contains: "hubert", mode: "insensitive" } },
      { User: { name: { contains: "hubert", mode: "insensitive" } } },
      { User: { email: { contains: "hubert", mode: "insensitive" } } },
    ]);
    expect(JSON.stringify(where)).not.toContain('"message"');
  });

  it("ignore une recherche d'un seul caractère côté serveur", async () => {
    auth.mockResolvedValue({ user: { id: "admin", role: "ADMIN" } });
    count.mockResolvedValue(0);
    findMany.mockResolvedValue([]);

    await getAdminNotificationsPage({ page: 1, search: "z" });
    expect(findMany.mock.calls[0][0].where.OR).toBeUndefined();
  });

  it("applique la recherche à partir de 2 caractères", async () => {
    auth.mockResolvedValue({ user: { id: "admin", role: "ADMIN" } });
    count.mockResolvedValue(0);
    findMany.mockResolvedValue([]);

    await getAdminNotificationsPage({ page: 1, search: "al" });
    expect(findMany.mock.calls[0][0].where.OR).toBeDefined();
    expect(findMany.mock.calls[0][0].where.OR[0]).toEqual({
      titre: { contains: "al", mode: "insensitive" },
    });
  });

  it("filtre type et lue", async () => {
    auth.mockResolvedValue({ user: { id: "admin", role: "ADMIN" } });
    count.mockResolvedValue(0);
    findMany.mockResolvedValue([]);

    await getAdminNotificationsPage({
      page: 1,
      type: TypeNotification.Cotisation,
      lue: true,
    });
    expect(findMany.mock.calls[0][0].where).toMatchObject({
      type: TypeNotification.Cotisation,
      lue: true,
    });
  });

  it("ne sélectionne pas le message dans le payload de liste", async () => {
    auth.mockResolvedValue({ user: { id: "admin", role: "ADMIN" } });
    count.mockResolvedValue(1);
    findMany.mockResolvedValue([
      {
        id: "n1",
        type: TypeNotification.Systeme,
        titre: "Titre",
        lue: true,
        createdAt: new Date("2026-09-01T10:00:00.000Z"),
        userId: "u1",
        User: { id: "u1", name: "Bob", email: "b@amaki.fr" },
      },
    ]);

    const result = await getAdminNotificationsPage({ page: 1 });
    expect(findMany.mock.calls[0][0].select.message).toBeUndefined();
    expect(findMany.mock.calls[0][0].select).toMatchObject({
      id: true,
      type: true,
      titre: true,
      lue: true,
      createdAt: true,
      userId: true,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.notifications[0]).not.toHaveProperty("message");
      expect(result.notifications[0].titre).toBe("Titre");
    }
  });
});

describe("getAdminNotificationDetails", () => {
  beforeEach(() => {
    findUnique.mockReset();
    auth.mockReset();
  });

  it("refuse un non-ADMIN", async () => {
    auth.mockResolvedValue({ user: { id: "u1", role: "PRESID" } });
    const result = await getAdminNotificationDetails("n1");
    expect(result.success).toBe(false);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("retourne le message complet pour un ADMIN", async () => {
    auth.mockResolvedValue({ user: { id: "admin", role: "ADMIN" } });
    findUnique.mockResolvedValue({
      id: "n1",
      type: TypeNotification.Systeme,
      titre: "Titre",
      message: "Ligne 1\nLigne 2",
      lien: "/x",
      lue: false,
      createdAt: new Date("2026-09-01T10:00:00.000Z"),
      userId: "u1",
      User: { id: "u1", name: "Alice", email: "a@amaki.fr" },
    });

    const result = await getAdminNotificationDetails("n1");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.notification.message).toBe("Ligne 1\nLigne 2");
      expect(result.notification.titre).toBe("Titre");
      expect(result.notification.User?.email).toBe("a@amaki.fr");
    }
  });

  it("retourne introuvable pour un ID invalide ou absent", async () => {
    auth.mockResolvedValue({ user: { id: "admin", role: "ADMIN" } });

    const empty = await getAdminNotificationDetails("   ");
    expect(empty.success).toBe(false);
    if (!empty.success) {
      expect(empty.error).toBe("Notification introuvable");
    }

    findUnique.mockResolvedValue(null);
    const missing = await getAdminNotificationDetails("does-not-exist");
    expect(missing.success).toBe(false);
    if (!missing.success) {
      expect(missing.error).toBe("Notification introuvable");
    }
  });
});
