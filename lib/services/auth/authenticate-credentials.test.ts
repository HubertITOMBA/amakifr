import { beforeEach, describe, expect, it, vi } from "vitest";

const { findUnique, findFirst, compare } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  findFirst: vi.fn(),
  compare: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    user: { findUnique, findFirst },
  },
}));

vi.mock("bcryptjs", () => ({
  default: { compare },
}));

import { authenticateCredentials } from "@/lib/services/auth/authenticate-credentials";

const baseUser = {
  id: "user-1",
  name: "Ada",
  email: "ada@example.com",
  password: "$2a$10$hash",
  emailVerified: new Date("2024-01-01"),
  role: "MEMBRE",
  status: "Actif",
};

describe("authenticateCredentials", () => {
  beforeEach(() => {
    findUnique.mockReset();
    findFirst.mockReset();
    compare.mockReset();
  });

  it("email invalide (vide) → VALIDATION_ERROR", async () => {
    await expect(authenticateCredentials("", "x")).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });

  it("user inconnu → UNAUTHENTICATED Identifiants invalides", async () => {
    findUnique.mockResolvedValue(null);
    findFirst.mockResolvedValue(null);
    compare.mockResolvedValue(false);
    await expect(
      authenticateCredentials("unknown@example.com", "secret")
    ).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
      message: "Identifiants invalides",
    });
  });

  it("mauvais password → même message public", async () => {
    findUnique.mockResolvedValue(baseUser);
    compare.mockResolvedValue(false);
    await expect(
      authenticateCredentials("ada@example.com", "wrong")
    ).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
      message: "Identifiants invalides",
    });
  });

  it("même erreur publique user inconnu / mauvais password", async () => {
    findUnique.mockResolvedValue(null);
    findFirst.mockResolvedValue(null);
    compare.mockResolvedValue(false);
    let unknownMsg = "";
    try {
      await authenticateCredentials("x@y.com", "p");
    } catch (e: any) {
      unknownMsg = e.message;
    }

    findUnique.mockResolvedValue(baseUser);
    compare.mockResolvedValue(false);
    let badPwdMsg = "";
    try {
      await authenticateCredentials("ada@example.com", "p");
    } catch (e: any) {
      badPwdMsg = e.message;
    }

    expect(unknownMsg).toBe(badPwdMsg);
    expect(unknownMsg).toBe("Identifiants invalides");
  });

  it("email non vérifié → FORBIDDEN", async () => {
    findUnique.mockResolvedValue({ ...baseUser, emailVerified: null });
    compare.mockResolvedValue(true);
    await expect(
      authenticateCredentials("ada@example.com", "ok")
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("Inactif → FORBIDDEN", async () => {
    findUnique.mockResolvedValue({ ...baseUser, status: "Inactif" });
    compare.mockResolvedValue(true);
    await expect(
      authenticateCredentials("ada@example.com", "ok")
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("succès sans password retourné", async () => {
    findUnique.mockResolvedValue(baseUser);
    compare.mockResolvedValue(true);
    const result = await authenticateCredentials("Ada@Example.com", "ok");
    expect(result).toEqual({
      id: "user-1",
      name: "Ada",
      email: "ada@example.com",
      role: "MEMBRE",
      status: "Actif",
    });
    expect(result).not.toHaveProperty("password");
    expect(JSON.stringify(result)).not.toContain("password");
  });

  it("role/status corrects (role uppercase)", async () => {
    findUnique.mockResolvedValue({ ...baseUser, role: "admin" });
    compare.mockResolvedValue(true);
    const result = await authenticateCredentials("ada@example.com", "ok");
    expect(result.role).toBe("ADMIN");
    expect(result.status).toBe("Actif");
  });
});
