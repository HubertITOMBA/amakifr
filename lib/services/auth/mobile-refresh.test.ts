import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  findUnique,
  update,
  create,
  updateMany,
  transaction,
  issueAccessToken,
} = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
  create: vi.fn(),
  updateMany: vi.fn(),
  transaction: vi.fn(),
  issueAccessToken: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    mobileRefreshSession: { findUnique, update, create, updateMany },
    $transaction: transaction,
  },
}));

vi.mock("@/lib/auth-mobile/access-token", () => ({
  issueAccessToken,
}));

import {
  generateRefreshToken,
  hashRefreshToken,
} from "@/lib/auth-mobile/refresh-token";
import { rotateMobileRefreshSession } from "@/lib/services/auth/rotate-mobile-refresh-session";
import { createMobileSession } from "@/lib/services/auth/create-mobile-session";

function activeSession(overrides: Record<string, unknown> = {}) {
  return {
    id: "old-sess",
    userId: "u1",
    revokedAt: null,
    expiresAt: new Date("2030-01-01"),
    user: {
      id: "u1",
      name: "Ada",
      email: "ada@example.com",
      role: "MEMBRE",
      status: "Actif",
      emailVerified: new Date(),
    },
    ...overrides,
  };
}

describe("refresh-token helpers", () => {
  it("génération opaque haute entropie", () => {
    const a = generateRefreshToken();
    const b = generateRefreshToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThan(40);
  });

  it("hash stable et différent du brut", () => {
    const token = generateRefreshToken();
    const h1 = hashRefreshToken(token);
    const h2 = hashRefreshToken(token);
    expect(h1).toBe(h2);
    expect(h1).not.toBe(token);
    expect(h1).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("createMobileSession", () => {
  beforeEach(() => {
    create.mockReset();
    issueAccessToken.mockReset();
  });

  it("crée session avec hash (pas le brut)", async () => {
    issueAccessToken.mockResolvedValue({
      token: "access.jwt",
      jti: "jti-1",
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
    });
    create.mockResolvedValue({ id: "sess-1" });

    const result = await createMobileSession({
      id: "user-1",
      name: "Ada",
      email: "a@example.com",
      role: "MEMBRE",
      status: "Actif",
    });

    expect(result.accessToken).toBe("access.jwt");
    expect(result.refreshToken).toBeTruthy();
    expect(create).toHaveBeenCalled();
    const data = create.mock.calls[0][0].data;
    expect(data.refreshTokenHash).toBe(hashRefreshToken(result.refreshToken));
    expect(data.refreshTokenHash).not.toBe(result.refreshToken);
    expect(data.userId).toBe("user-1");
    expect(data.rotatedFromId).toBeNull();
  });
});

describe("rotateMobileRefreshSession", () => {
  beforeEach(() => {
    findUnique.mockReset();
    update.mockReset();
    create.mockReset();
    updateMany.mockReset();
    transaction.mockReset();
    issueAccessToken.mockReset();
  });

  it("inconnu → UNAUTHENTICATED", async () => {
    findUnique.mockResolvedValue(null);
    await expect(rotateMobileRefreshSession("tok")).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
    });
  });

  it("expiré → UNAUTHENTICATED", async () => {
    findUnique.mockResolvedValue(
      activeSession({
        id: "s1",
        expiresAt: new Date("2020-01-01"),
        user: {
          id: "u1",
          name: "A",
          email: "a@b.com",
          role: "MEMBRE",
          status: "Actif",
          emailVerified: new Date(),
        },
      })
    );
    await expect(rotateMobileRefreshSession("tok")).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
      message: "Session expirée",
    });
  });

  it("révoqué au lookup → reuse + updateMany hors tx", async () => {
    findUnique.mockResolvedValue(
      activeSession({
        id: "s1",
        revokedAt: new Date(),
        user: {
          id: "u1",
          name: "A",
          email: "a@b.com",
          role: "MEMBRE",
          status: "Actif",
          emailVerified: new Date(),
        },
      })
    );
    updateMany.mockResolvedValue({ count: 2 });
    await expect(rotateMobileRefreshSession("tok")).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
    });
    expect(updateMany).toHaveBeenCalledWith({
      where: { userId: "u1", revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(transaction).not.toHaveBeenCalled();
  });

  it("succès — updateMany conditionnel count=1 puis create", async () => {
    const oldId = "old-sess";
    findUnique.mockResolvedValue(activeSession({ id: oldId }));

    const txUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
    const txCreate = vi.fn().mockResolvedValue({ id: "new-sess" });

    transaction.mockImplementation(async (fn: any) => {
      return fn({
        mobileRefreshSession: {
          updateMany: txUpdateMany,
          create: txCreate,
        },
      });
    });

    issueAccessToken.mockResolvedValue({
      token: "new.access",
      jti: "jti-2",
      expiresAt: new Date("2030-01-01T00:15:00.000Z"),
    });

    const result = await rotateMobileRefreshSession("old-refresh-token");

    expect(transaction).toHaveBeenCalled();
    expect(txUpdateMany).toHaveBeenCalledWith({
      where: { id: oldId, revokedAt: null },
      data: expect.objectContaining({
        revokedAt: expect.any(Date),
        lastUsedAt: expect.any(Date),
      }),
    });
    expect(txCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        rotatedFromId: oldId,
        userId: "u1",
      }),
    });
    const createdHash = txCreate.mock.calls[0][0].data.refreshTokenHash;
    expect(createdHash).toBe(hashRefreshToken(result.refreshToken));
    expect(createdHash).not.toBe(result.refreshToken);
    expect(result.accessToken).toBe("new.access");
  });

  it("concurrence : un seul descendant — 2e consommation count=0", async () => {
    const oldId = "old-sess";
    findUnique.mockResolvedValue(activeSession({ id: oldId }));

    // A : count=1 → create ; B : count=0 → revoke all, pas de create
    const txUpdateManyA = vi
      .fn()
      .mockResolvedValueOnce({ count: 1 });
    const txCreateA = vi.fn().mockResolvedValue({ id: "new-sess-a" });

    transaction.mockImplementationOnce(async (fn: any) => {
      return fn({
        mobileRefreshSession: {
          updateMany: txUpdateManyA,
          create: txCreateA,
        },
      });
    });

    issueAccessToken.mockResolvedValue({
      token: "access-a",
      jti: "jti-a",
      expiresAt: new Date("2030-01-01T00:15:00.000Z"),
    });

    const first = await rotateMobileRefreshSession("same-refresh");
    expect(first.refreshToken).toBeTruthy();
    expect(txCreateA).toHaveBeenCalledTimes(1);
    expect(txUpdateManyA).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: oldId, revokedAt: null },
      })
    );

    // Seconde rotation concurrente/tardive du même token
    findUnique.mockResolvedValue(activeSession({ id: oldId })); // lookup peut encore voir null en race

    const txUpdateManyB = vi
      .fn()
      .mockResolvedValueOnce({ count: 0 }) // consommation échoue
      .mockResolvedValueOnce({ count: 3 }); // révocation globale
    const txCreateB = vi.fn();

    transaction.mockImplementationOnce(async (fn: any) => {
      return fn({
        mobileRefreshSession: {
          updateMany: txUpdateManyB,
          create: txCreateB,
        },
      });
    });

    await expect(rotateMobileRefreshSession("same-refresh")).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
      message: "Session invalide",
    });

    expect(txCreateB).not.toHaveBeenCalled();
    expect(txUpdateManyB).toHaveBeenNthCalledWith(1, {
      where: { id: oldId, revokedAt: null },
      data: expect.objectContaining({ revokedAt: expect.any(Date) }),
    });
    expect(txUpdateManyB).toHaveBeenNthCalledWith(2, {
      where: { userId: "u1", revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });
});
