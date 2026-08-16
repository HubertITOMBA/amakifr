import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContext } from "@/lib/auth-context";

const { findUnique } = vi.hoisted(() => ({
  findUnique: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findUnique,
    },
  },
}));

import { getMe } from "@/lib/services/user/get-me";

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

describe("getMe", () => {
  beforeEach(() => {
    findUnique.mockReset();
  });

  it("lance UNAUTHENTICATED si actor.userId est absent", async () => {
    await expect(getMe(actor({ userId: "" }))).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
    });
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("lance NOT_FOUND si l'utilisateur est introuvable", async () => {
    findUnique.mockResolvedValue(null);
    await expect(getMe(actor())).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(findUnique).toHaveBeenCalled();
  });

  it("retourne un MeDto sans adherent", async () => {
    findUnique.mockResolvedValue({
      id: "user-1",
      name: "Ada",
      email: "a@example.com",
      image: null,
      role: "MEMBRE",
      status: "Actif",
      lastLogin: null,
      createdAt: new Date("2024-01-01T10:00:00.000Z"),
      updatedAt: new Date("2024-02-01T10:00:00.000Z"),
      adherent: null,
      accounts: [],
    });

    const me = await getMe(actor());
    expect(me.id).toBe("user-1");
    expect(me.adherent).toBeNull();
    expect(me.adherentId).toBeNull();
    expect(me.createdAt).toBe("2024-01-01T10:00:00.000Z");
    expect(me.updatedAt).toBe("2024-02-01T10:00:00.000Z");
  });

  it("mappe adherent + Adresse avec dates ISO", async () => {
    findUnique.mockResolvedValue({
      id: "user-1",
      name: "Ada",
      email: "a@example.com",
      image: null,
      role: "MEMBRE",
      status: "Actif",
      lastLogin: new Date("2024-03-01T12:00:00.000Z"),
      createdAt: new Date("2024-01-01T10:00:00.000Z"),
      updatedAt: new Date("2024-02-01T10:00:00.000Z"),
      adherent: {
        id: "adh-1",
        civility: "Madame",
        firstname: "Ada",
        lastname: "Lovelace",
        departement_id: null,
        sous_departement_id: null,
        created_at: new Date("2024-01-02T00:00:00.000Z"),
        updated_at: new Date("2024-01-03T00:00:00.000Z"),
        Adresse: [
          {
            id: "addr-1",
            streetnum: "1",
            street1: "Rue A",
            street2: null,
            codepost: "75001",
            city: "Paris",
            country: "FR",
            createdAt: new Date("2024-01-04T00:00:00.000Z"),
            updatedAt: new Date("2024-01-05T00:00:00.000Z"),
          },
        ],
      },
      accounts: [],
    });

    const me = await getMe(actor());
    expect(me.adherentId).toBe("adh-1");
    expect(me.adherent?.id).toBe("adh-1");
    expect(me.adherent?.firstname).toBe("Ada");
    expect(me.adherent?.created_at).toBe("2024-01-02T00:00:00.000Z");
    expect(me.adherent?.addresses).toHaveLength(1);
    expect(me.adherent?.addresses[0]).toMatchObject({
      id: "addr-1",
      city: "Paris",
      createdAt: "2024-01-04T00:00:00.000Z",
      updatedAt: "2024-01-05T00:00:00.000Z",
    });
    expect(me.lastLogin).toBe("2024-03-01T12:00:00.000Z");
  });

  it("expose les comptes OAuth sans providerAccountId", async () => {
    findUnique.mockResolvedValue({
      id: "user-1",
      name: "Ada",
      email: "a@example.com",
      image: null,
      role: "MEMBRE",
      status: "Actif",
      lastLogin: null,
      createdAt: new Date("2024-01-01T10:00:00.000Z"),
      updatedAt: new Date("2024-02-01T10:00:00.000Z"),
      adherent: null,
      accounts: [
        {
          id: "acc-1",
          type: "oauth",
          provider: "google",
          providerAccountId: "SHOULD-NOT-APPEAR",
        },
      ],
    });

    const me = await getMe(actor());
    expect(me.accounts).toEqual([{ id: "acc-1", type: "oauth", provider: "google" }]);
    expect(me.accounts[0]).not.toHaveProperty("providerAccountId");
  });

  it("lance INTERNAL_ERROR si Prisma échoue", async () => {
    findUnique.mockRejectedValue(new Error("DB down"));
    await expect(getMe(actor())).rejects.toMatchObject({
      code: "INTERNAL_ERROR",
    });
  });

  it("appelle findUnique avec actor.userId", async () => {
    findUnique.mockResolvedValue({
      id: "user-42",
      name: null,
      email: null,
      image: null,
      role: "MEMBRE",
      status: "Actif",
      lastLogin: null,
      createdAt: new Date("2024-01-01T00:00:00.000Z"),
      updatedAt: new Date("2024-01-01T00:00:00.000Z"),
      adherent: null,
      accounts: [],
    });

    await getMe(actor({ userId: "user-42" }));
    expect(findUnique).toHaveBeenCalledTimes(1);
    expect(findUnique.mock.calls[0][0]).toMatchObject({
      where: { id: "user-42" },
    });
  });

  it("n'expose pas password, hash, tokens ni secrets dans le résultat", async () => {
    findUnique.mockResolvedValue({
      id: "user-1",
      name: "Ada",
      email: "a@example.com",
      image: null,
      role: "MEMBRE",
      status: "Actif",
      lastLogin: null,
      createdAt: new Date("2024-01-01T00:00:00.000Z"),
      updatedAt: new Date("2024-01-01T00:00:00.000Z"),
      password: "hashed-secret",
      adherent: null,
      accounts: [
        {
          id: "acc-1",
          type: "oauth",
          provider: "google",
          providerAccountId: "secret-oauth-id",
          refresh_token: "refresh-secret",
          access_token: "access-secret",
        },
      ],
    });

    const me = await getMe(actor());
    const json = JSON.stringify(me);
    expect(me).not.toHaveProperty("password");
    expect(json).not.toContain("hashed-secret");
    expect(json).not.toContain("secret-oauth-id");
    expect(json).not.toContain("refresh-secret");
    expect(json).not.toContain("access-secret");
    expect(json).not.toContain("providerAccountId");
    expect(Object.keys(me).sort()).toEqual(
      [
        "accounts",
        "adherent",
        "adherentId",
        "createdAt",
        "email",
        "id",
        "image",
        "lastLogin",
        "name",
        "role",
        "status",
        "updatedAt",
      ].sort()
    );
  });
});
