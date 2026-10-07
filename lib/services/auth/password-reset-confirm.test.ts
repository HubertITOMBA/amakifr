import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import { ServiceError } from "@/lib/service-error";
import { PASSWORD_RESET_HMAC_DOMAIN } from "@/lib/auth/password-reset-constants";
import { PASSWORD_RESET_CONFIRM_GENERIC_ERROR } from "@/lib/auth/password-reset-messages";

const {
  findUniqueChallenge,
  transaction,
  revokeRedis,
  bcryptHash,
  enforceRl,
} = vi.hoisted(() => ({
  findUniqueChallenge: vi.fn(),
  transaction: vi.fn(),
  revokeRedis: vi.fn(),
  bcryptHash: vi.fn(async () => "hashed-password"),
  enforceRl: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    passwordResetToken: { findUnique: findUniqueChallenge },
    $transaction: transaction,
  },
}));

vi.mock("bcryptjs", () => ({
  default: { hash: bcryptHash, compare: vi.fn() },
}));

vi.mock("@/lib/services/auth/revoke-sessions-after-password-change", () => ({
  revokeRedisSessionsBestEffort: revokeRedis,
}));

vi.mock("@/lib/auth/password-reset-rate-limit", () => ({
  enforcePasswordResetRateLimits: enforceRl,
}));

import { confirmPasswordResetChallenge } from "@/lib/services/auth/password-reset-confirm";

const SECRET = "test-password-reset-hmac-secret-32b!!";
const CODE = "87654321";
function hash(code: string) {
  return createHmac("sha256", SECRET)
    .update(PASSWORD_RESET_HMAC_DOMAIN + code, "utf8")
    .digest("hex");
}

function activeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "c1",
    email: "a@b.com",
    codeHash: hash(CODE),
    pendingCodeHash: null,
    status: "ACTIVE",
    expires: new Date(Date.now() + 60_000),
    failedAttempts: 0,
    lockedAt: null,
    ...overrides,
  };
}

describe("confirmPasswordResetChallenge", () => {
  beforeEach(() => {
    vi.stubEnv("PASSWORD_RESET_HMAC_SECRET", SECRET);
    findUniqueChallenge.mockReset();
    transaction.mockReset();
    revokeRedis.mockReset();
    bcryptHash.mockClear();
    enforceRl.mockReset();
    enforceRl.mockResolvedValue({ allowed: true });
  });

  it("rate-limit refuse avant bcrypt", async () => {
    enforceRl.mockResolvedValue({ allowed: false, reason: "limited" });
    await expect(
      confirmPasswordResetChallenge({
        email: "a@b.com",
        code: CODE,
        password: "abcdef",
        confirmPassword: "abcdef",
        clientIp: "1.1.1.1",
      })
    ).rejects.toMatchObject({ message: PASSWORD_RESET_CONFIRM_GENERIC_ERROR });
    expect(bcryptHash).not.toHaveBeenCalled();
    expect(findUniqueChallenge).not.toHaveBeenCalled();
  });

  it("code invalide → bcrypt jamais appelé ; incrément échecs", async () => {
    findUniqueChallenge.mockResolvedValue(activeRow());
    transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
      fn({
        passwordResetToken: {
          findUnique: vi.fn().mockResolvedValue(activeRow()),
          update: vi.fn().mockResolvedValue({}),
        },
      })
    );

    await expect(
      confirmPasswordResetChallenge({
        email: "a@b.com",
        code: "00000000",
        password: "abcdef",
        confirmPassword: "abcdef",
      })
    ).rejects.toBeInstanceOf(ServiceError);

    expect(bcryptHash).not.toHaveBeenCalled();
    expect(transaction).toHaveBeenCalled(); // recordFailedAttempt
  });

  it("PENDING → bcrypt jamais appelé", async () => {
    findUniqueChallenge.mockResolvedValue(activeRow({ status: "PENDING" }));
    await expect(
      confirmPasswordResetChallenge({
        email: "a@b.com",
        code: CODE,
        password: "abcdef",
        confirmPassword: "abcdef",
      })
    ).rejects.toMatchObject({ message: PASSWORD_RESET_CONFIRM_GENERIC_ERROR });
    expect(bcryptHash).not.toHaveBeenCalled();
  });

  it("code valide → bcrypt une fois + révocation sessions DB", async () => {
    findUniqueChallenge.mockResolvedValue(activeRow());
    const deleteChallenge = vi.fn().mockResolvedValue({});
    const updateUser = vi.fn().mockResolvedValue({});
    const deleteSessions = vi.fn().mockResolvedValue({});
    const deleteMobile = vi.fn().mockResolvedValue({});

    transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
      fn({
        passwordResetToken: {
          findUnique: vi.fn().mockResolvedValue(activeRow()),
          update: vi.fn(),
          delete: deleteChallenge,
        },
        user: {
          findFirst: vi.fn().mockResolvedValue({ id: "u1" }),
          update: updateUser,
        },
        session: { deleteMany: deleteSessions },
        mobileRefreshSession: { deleteMany: deleteMobile },
      })
    );
    revokeRedis.mockResolvedValue(undefined);

    const res = await confirmPasswordResetChallenge({
      email: "a@b.com",
      code: CODE,
      password: "abcdef",
      confirmPassword: "abcdef",
    });

    expect(res.success).toBe(true);
    expect(bcryptHash).toHaveBeenCalledTimes(1);
    expect(deleteSessions).toHaveBeenCalled();
    expect(deleteMobile).toHaveBeenCalled();
  });

  it("challenge modifié entre prévalidation et TX → refus", async () => {
    findUniqueChallenge.mockResolvedValue(activeRow());
    transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
      fn({
        passwordResetToken: {
          findUnique: vi.fn().mockResolvedValue(activeRow({ id: "other-id" })),
          update: vi.fn(),
          delete: vi.fn(),
        },
        user: { findFirst: vi.fn(), update: vi.fn() },
        session: { deleteMany: vi.fn() },
        mobileRefreshSession: { deleteMany: vi.fn() },
      })
    );

    await expect(
      confirmPasswordResetChallenge({
        email: "a@b.com",
        code: CODE,
        password: "abcdef",
        confirmPassword: "abcdef",
      })
    ).rejects.toMatchObject({ message: PASSWORD_RESET_CONFIRM_GENERIC_ERROR });
    expect(bcryptHash).toHaveBeenCalledTimes(1);
    expect(revokeRedis).not.toHaveBeenCalled();
  });

  it("double confirmation : second appel refuse (challenge absent)", async () => {
    let finalTx = 0;
    findUniqueChallenge.mockResolvedValue(activeRow());
    transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
      // skip recordFailedAttempt — only final success TX then reject
      finalTx += 1;
      if (finalTx === 1) {
        return fn({
          passwordResetToken: {
            findUnique: vi.fn().mockResolvedValue(activeRow()),
            update: vi.fn(),
            delete: vi.fn().mockResolvedValue({}),
          },
          user: {
            findFirst: vi.fn().mockResolvedValue({ id: "u1" }),
            update: vi.fn().mockResolvedValue({}),
          },
          session: { deleteMany: vi.fn().mockResolvedValue({}) },
          mobileRefreshSession: { deleteMany: vi.fn().mockResolvedValue({}) },
        });
      }
      return fn({
        passwordResetToken: {
          findUnique: vi.fn().mockResolvedValue(null),
          update: vi.fn(),
          delete: vi.fn(),
        },
        user: { findFirst: vi.fn(), update: vi.fn() },
        session: { deleteMany: vi.fn() },
        mobileRefreshSession: { deleteMany: vi.fn() },
      });
    });
    revokeRedis.mockResolvedValue(undefined);

    await confirmPasswordResetChallenge({
      email: "a@b.com",
      code: CODE,
      password: "abcdef",
      confirmPassword: "abcdef",
    });

    findUniqueChallenge.mockResolvedValue(null);
    await expect(
      confirmPasswordResetChallenge({
        email: "a@b.com",
        code: CODE,
        password: "abcdef",
        confirmPassword: "abcdef",
      })
    ).rejects.toMatchObject({ message: PASSWORD_RESET_CONFIRM_GENERIC_ERROR });
  });
});
