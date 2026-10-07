import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const findUnique = vi.fn();
const create = vi.fn();
const update = vi.fn();
const transaction = vi.fn();
const randomIntMock = vi.fn(() => 42);

vi.mock("node:crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:crypto")>();
  return {
    ...actual,
    randomInt: (...args: unknown[]) => randomIntMock(...args),
  };
});

vi.mock("@/lib/db", () => ({
  db: {
    $transaction: (...args: unknown[]) => transaction(...args),
    verificationToken: {
      findUnique: (...args: unknown[]) => findUnique(...args),
      create: (...args: unknown[]) => create(...args),
      update: (...args: unknown[]) => update(...args),
    },
    passwordResetToken: {
      findFirst: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock("@/actions/auth", () => ({
  getPasswordResetTokenByEmail: vi.fn(async () => null),
}));

import {
  PASSWORD_RESET_TOKEN_TTL_MS,
  VERIFICATION_RESEND_COOLDOWN_MS,
  VERIFICATION_TOKEN_TTL_MS,
  generateVerificationToken,
  verificationCodesEqual,
} from "@/lib/token";

describe("verification token", () => {
  beforeEach(() => {
    findUnique.mockReset();
    create.mockReset();
    update.mockReset();
    transaction.mockReset();
    randomIntMock.mockReset();
    randomIntMock.mockReturnValue(42);

    transaction.mockImplementation(
      async (
        fn: (tx: {
          verificationToken: {
            findUnique: typeof findUnique;
            create: typeof create;
            update: typeof update;
          };
        }) => unknown,
      ) =>
        fn({
          verificationToken: {
            findUnique,
            create,
            update,
          },
        }),
    );
  });

  it("conserve la durée réelle de 5 minutes (300000 ms) pour la vérification", () => {
    expect(VERIFICATION_TOKEN_TTL_MS).toBe(5 * 60 * 1000);
    expect(VERIFICATION_TOKEN_TTL_MS).toBe(300_000);
  });

  it("PASSWORD_RESET_TOKEN_TTL_MS est distinct (10 min) de la vérification email", () => {
    expect(PASSWORD_RESET_TOKEN_TTL_MS).toBe(10 * 60 * 1000);
    expect(PASSWORD_RESET_TOKEN_TTL_MS).not.toBe(VERIFICATION_TOKEN_TTL_MS);
  });

  it("cooldown resend = 60 secondes", () => {
    expect(VERIFICATION_RESEND_COOLDOWN_MS).toBe(60_000);
  });

  it("génère un code à 6 chiffres via randomInt et reset compteur/lock", async () => {
    randomIntMock.mockReturnValue(7);
    findUnique.mockResolvedValue({
      id: "old-id",
      email: "user@example.com",
      token: "000000",
      createdAt: new Date(Date.now() - 120_000),
      failedAttempts: 2,
      lockedAt: new Date(),
    });
    update.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => ({
        id: "old-id",
        email: "user@example.com",
        ...data,
      }),
    );

    const before = Date.now();
    const result = await generateVerificationToken("user@example.com", "initial");
    const after = Date.now();

    expect(result.status).toBe("created");
    if (result.status !== "created") return;

    expect(randomIntMock).toHaveBeenCalledWith(0, 1_000_000);
    expect(result.token.token).toBe("000007");
    expect(result.token.token).toMatch(/^\d{6}$/);
    expect(update).toHaveBeenCalled();
    const updateData = update.mock.calls[0][0].data;
    expect(updateData.failedAttempts).toBe(0);
    expect(updateData.lockedAt).toBeNull();
    expect(updateData.createdAt).toBeInstanceOf(Date);
    const expires = result.token.expires.getTime();
    expect(expires).toBeGreaterThanOrEqual(
      before + VERIFICATION_TOKEN_TTL_MS - 50,
    );
    expect(expires).toBeLessThanOrEqual(
      after + VERIFICATION_TOKEN_TTL_MS + 50,
    );
  });

  it("mode resend refuse pendant le cooldown basé sur createdAt", async () => {
    findUnique.mockResolvedValue({
      id: "t1",
      email: "user@example.com",
      token: "111111",
      createdAt: new Date(Date.now() - 10_000),
      failedAttempts: 0,
      lockedAt: null,
    });

    const result = await generateVerificationToken("user@example.com", "resend");
    expect(result).toEqual({ status: "cooldown" });
    expect(create).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("mode resend régénère après cooldown et reset lock", async () => {
    findUnique.mockResolvedValue({
      id: "t1",
      email: "user@example.com",
      token: "111111",
      createdAt: new Date(Date.now() - 90_000),
      failedAttempts: 3,
      lockedAt: new Date(),
    });
    update.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => ({
        id: "t1",
        email: "user@example.com",
        ...data,
      }),
    );

    const result = await generateVerificationToken("user@example.com", "resend");
    expect(result.status).toBe("created");
    expect(update.mock.calls[0][0].data.failedAttempts).toBe(0);
    expect(update.mock.calls[0][0].data.lockedAt).toBeNull();
  });

  it("reprend de façon bornée sur P2034 puis réussit", async () => {
    const p2034 = new Prisma.PrismaClientKnownRequestError("conflict", {
      code: "P2034",
      clientVersion: "test",
    });
    let calls = 0;
    transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
      calls += 1;
      if (calls === 1) throw p2034;
      findUnique.mockResolvedValue(null);
      create.mockResolvedValue({
        id: "new",
        email: "user@example.com",
        token: "000042",
        expires: new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS),
        createdAt: new Date(),
        failedAttempts: 0,
        lockedAt: null,
      });
      return fn({
        verificationToken: { findUnique, create, update },
      });
    });

    const result = await generateVerificationToken("user@example.com", "initial");
    expect(result.status).toBe("created");
    expect(calls).toBe(2);
  });

  it("verificationCodesEqual compare correctement", () => {
    expect(verificationCodesEqual("123456", "123456")).toBe(true);
    expect(verificationCodesEqual("123456", "123457")).toBe(false);
    expect(verificationCodesEqual("12345", "123456")).toBe(false);
  });
});
