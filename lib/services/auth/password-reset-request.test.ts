import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import { PASSWORD_RESET_HMAC_DOMAIN } from "@/lib/auth/password-reset-constants";
import { PASSWORD_RESET_REQUEST_MESSAGE } from "@/lib/auth/password-reset-messages";

const {
  findUniqueUser,
  findFirstUser,
  createChallenge,
  updateChallenge,
  deleteManyChallenge,
  transaction,
  sendEmail,
  randomIntMock,
  enforceRl,
} = vi.hoisted(() => ({
  findUniqueUser: vi.fn(),
  findFirstUser: vi.fn(),
  createChallenge: vi.fn(),
  updateChallenge: vi.fn(),
  deleteManyChallenge: vi.fn(),
  transaction: vi.fn(),
  sendEmail: vi.fn(),
  randomIntMock: vi.fn(() => 12345678),
  enforceRl: vi.fn(),
}));

vi.mock("node:crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:crypto")>();
  return { ...actual, randomInt: (...a: unknown[]) => randomIntMock(...a) };
});

vi.mock("@/lib/db", () => ({
  db: {
    user: { findUnique: findUniqueUser, findFirst: findFirstUser },
    passwordResetToken: {
      create: createChallenge,
      update: updateChallenge,
      deleteMany: deleteManyChallenge,
    },
    $transaction: transaction,
  },
}));

vi.mock("@/lib/mail", () => ({ sendPasswordResetCodeEmail: sendEmail }));
vi.mock("@/lib/auth/password-reset-rate-limit", () => ({
  enforcePasswordResetRateLimits: enforceRl,
}));
// Rate-limit PG mocké — couvre aussi compte absent

import { requestPasswordResetChallenge } from "@/lib/services/auth/password-reset-request";

const SECRET = "test-password-reset-hmac-secret-32b!!";
function expectedHash(code: string) {
  return createHmac("sha256", SECRET)
    .update(PASSWORD_RESET_HMAC_DOMAIN + code, "utf8")
    .digest("hex");
}

describe("requestPasswordResetChallenge", () => {
  beforeEach(() => {
    vi.stubEnv("PASSWORD_RESET_HMAC_SECRET", SECRET);
    findUniqueUser.mockReset();
    findFirstUser.mockReset();
    createChallenge.mockReset();
    updateChallenge.mockReset();
    deleteManyChallenge.mockReset();
    transaction.mockReset();
    sendEmail.mockReset();
    randomIntMock.mockReset();
    randomIntMock.mockReturnValue(12345678);
    enforceRl.mockReset();
    enforceRl.mockResolvedValue({ allowed: true });
  });

  it("réponses identiques absent/existant ; normalisation", async () => {
    findUniqueUser.mockResolvedValue(null);
    findFirstUser.mockResolvedValue(null);
    const absent = await requestPasswordResetChallenge("X@Y.com", {
      clientIp: "9.9.9.9",
    });
    expect(absent.message).toBe(PASSWORD_RESET_REQUEST_MESSAGE);
    expect(sendEmail).not.toHaveBeenCalled();

    findUniqueUser.mockResolvedValue({ id: "u1", email: "x@y.com" });
    transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
      fn({
        passwordResetToken: {
          findUnique: vi.fn().mockResolvedValue(null),
          create: createChallenge.mockResolvedValue({}),
          update: updateChallenge,
        },
      })
    );
    // prepare + activate
    sendEmail.mockResolvedValue(undefined);

    const present = await requestPasswordResetChallenge("  X@Y.com ", {
      clientIp: "9.9.9.9",
    });
    expect(present).toEqual(absent);
    expect(createChallenge.mock.calls[0][0].data.email).toBe("x@y.com");
    expect(createChallenge.mock.calls[0][0].data.codeHash).toBe(
      expectedHash("12345678")
    );
    expect(createChallenge.mock.calls[0][0].data.status).toBe("PENDING");
  });

  it("rate-limit fail-closed : pas d'envoi, même réponse", async () => {
    enforceRl.mockResolvedValue({ allowed: false, reason: "limited" });
    findUniqueUser.mockResolvedValue({ id: "u1", email: "a@b.com" });
    const res = await requestPasswordResetChallenge("a@b.com", {
      clientIp: "1.1.1.1",
    });
    expect(res.accepted).toBe(true);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("ACTIVE : prepare n'altère pas createdAt/expires/failedAttempts/lockedAt", async () => {
    findUniqueUser.mockResolvedValue({ id: "u1", email: "a@b.com" });
    const active = {
      id: "c1",
      email: "a@b.com",
      codeHash: "old-hash",
      pendingCodeHash: null,
      pendingExpires: null,
      status: "ACTIVE",
      createdAt: new Date("2026-01-01T00:00:00Z"),
      lastRequestAt: new Date(Date.now() - 120_000),
      expires: new Date(Date.now() + 600_000),
      failedAttempts: 2,
      lockedAt: null,
    };
    transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
      fn({
        passwordResetToken: {
          findUnique: vi.fn().mockResolvedValue(active),
          create: createChallenge,
          update: updateChallenge.mockResolvedValue({}),
        },
      })
    );
    sendEmail.mockRejectedValue(new Error("SMTP"));

    await requestPasswordResetChallenge("a@b.com", { clientIp: "1.1.1.1" });

    const prepareUpdate = updateChallenge.mock.calls[0][0].data;
    expect(prepareUpdate).toEqual({
      pendingCodeHash: expectedHash("12345678"),
      pendingExpires: expect.any(Date),
      lastRequestAt: expect.any(Date),
    });
    expect(prepareUpdate).not.toHaveProperty("createdAt");
    expect(prepareUpdate).not.toHaveProperty("expires");
    expect(prepareUpdate).not.toHaveProperty("failedAttempts");
    expect(prepareUpdate).not.toHaveProperty("lockedAt");
    expect(prepareUpdate).not.toHaveProperty("codeHash");
    // clear pending after KO
    expect(updateChallenge.mock.calls.some((c) => c[0].data?.pendingCodeHash === null)).toBe(
      true
    );
  });

  it("provider KO sur PENDING seul : deleteMany", async () => {
    findUniqueUser.mockResolvedValue({ id: "u1", email: "a@b.com" });
    transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
      fn({
        passwordResetToken: {
          findUnique: vi.fn().mockResolvedValue(null),
          create: createChallenge.mockResolvedValue({}),
          update: updateChallenge,
        },
      })
    );
    sendEmail.mockRejectedValue(new Error("SMTP"));
    deleteManyChallenge.mockResolvedValue({ count: 1 });

    const res = await requestPasswordResetChallenge("a@b.com");
    expect(res.message).toBe(PASSWORD_RESET_REQUEST_MESSAGE);
    expect(deleteManyChallenge).toHaveBeenCalledWith({
      where: { email: "a@b.com", status: "PENDING" },
    });
  });
});
