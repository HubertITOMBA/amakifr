import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const findUniqueToken = vi.fn();
const updateToken = vi.fn();
const deleteToken = vi.fn();
const findUniqueUser = vi.fn();
const updateUser = vi.fn();
const transaction = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    $transaction: (...args: unknown[]) => transaction(...args),
  },
}));

import {
  EMAIL_VERIFICATION_GENERIC_ERROR,
  newVerification,
} from "@/actions/auth/new-verification";

function mockTx() {
  transaction.mockImplementation(
    async (
      fn: (tx: {
        verificationToken: {
          findUnique: typeof findUniqueToken;
          update: typeof updateToken;
          delete: typeof deleteToken;
        };
        user: {
          findUnique: typeof findUniqueUser;
          update: typeof updateUser;
        };
      }) => unknown,
    ) =>
      fn({
        verificationToken: {
          findUnique: findUniqueToken,
          update: updateToken,
          delete: deleteToken,
        },
        user: {
          findUnique: findUniqueUser,
          update: updateUser,
        },
      }),
  );
}

describe("newVerification", () => {
  beforeEach(() => {
    findUniqueToken.mockReset();
    updateToken.mockReset();
    deleteToken.mockReset();
    findUniqueUser.mockReset();
    updateUser.mockReset();
    transaction.mockReset();
    mockTx();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("refuse un email ou un code invalide avec le message générique", async () => {
    const badEmail = await newVerification({
      email: "pas-un-email",
      code: "123456",
    });
    const badCode = await newVerification({
      email: "ok@example.com",
      code: "12ab56",
    });
    expect(badEmail).toEqual({ error: EMAIL_VERIFICATION_GENERIC_ERROR });
    expect(badCode).toEqual({ error: EMAIL_VERIFICATION_GENERIC_ERROR });
    expect(transaction).not.toHaveBeenCalled();
  });

  it("lookup lié à l'email (findUnique email)", async () => {
    findUniqueToken.mockResolvedValue(null);
    await newVerification({ email: "User@Example.com", code: "123456" });
    expect(findUniqueToken).toHaveBeenCalledWith({
      where: { email: "user@example.com" },
    });
  });

  it("1re erreur → failedAttempts=1", async () => {
    findUniqueToken.mockResolvedValue({
      id: "t1",
      email: "user@example.com",
      token: "654321",
      expires: new Date(Date.now() + 60_000),
      failedAttempts: 0,
      lockedAt: null,
    });
    updateToken.mockResolvedValue({});

    const result = await newVerification({
      email: "user@example.com",
      code: "000000",
    });
    expect(result).toEqual({ error: EMAIL_VERIFICATION_GENERIC_ERROR });
    expect(updateToken).toHaveBeenCalledWith({
      where: { email: "user@example.com" },
      data: { failedAttempts: 1, lockedAt: null },
    });
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("2e erreur → failedAttempts=2", async () => {
    findUniqueToken.mockResolvedValue({
      id: "t1",
      email: "user@example.com",
      token: "654321",
      expires: new Date(Date.now() + 60_000),
      failedAttempts: 1,
      lockedAt: null,
    });
    updateToken.mockResolvedValue({});

    await newVerification({ email: "user@example.com", code: "000000" });
    expect(updateToken.mock.calls[0][0].data.failedAttempts).toBe(2);
    expect(updateToken.mock.calls[0][0].data.lockedAt).toBeNull();
  });

  it("3e erreur → failedAttempts=3 + lockedAt", async () => {
    findUniqueToken.mockResolvedValue({
      id: "t1",
      email: "user@example.com",
      token: "654321",
      expires: new Date(Date.now() + 60_000),
      failedAttempts: 2,
      lockedAt: null,
    });
    updateToken.mockResolvedValue({});

    await newVerification({ email: "user@example.com", code: "000000" });
    expect(updateToken.mock.calls[0][0].data.failedAttempts).toBe(3);
    expect(updateToken.mock.calls[0][0].data.lockedAt).toBeInstanceOf(Date);
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("bon code avant plafond → emailVerified + suppression token, status intact", async () => {
    findUniqueToken.mockResolvedValue({
      id: "t1",
      email: "user@example.com",
      token: "654321",
      expires: new Date(Date.now() + 60_000),
      failedAttempts: 2,
      lockedAt: null,
    });
    findUniqueUser.mockResolvedValue({
      id: "u1",
      email: "user@example.com",
      status: "Inactif",
      emailVerified: null,
    });
    updateUser.mockResolvedValue({});
    deleteToken.mockResolvedValue({});

    const result = await newVerification({
      email: "user@example.com",
      code: "654321",
    });
    expect(result).toEqual({ success: "Email vérifié !" });
    expect(updateUser).toHaveBeenCalledWith({
      where: { email: "user@example.com" },
      data: { emailVerified: expect.any(Date) },
    });
    const userUpdateData = updateUser.mock.calls[0][0].data;
    expect(userUpdateData).not.toHaveProperty("status");
    expect(deleteToken).toHaveBeenCalledWith({ where: { id: "t1" } });
  });

  it("bon code après plafond / verrou → refus générique, aucune activation", async () => {
    findUniqueToken.mockResolvedValue({
      id: "t1",
      email: "user@example.com",
      token: "654321",
      expires: new Date(Date.now() + 60_000),
      failedAttempts: 3,
      lockedAt: new Date(),
    });

    const result = await newVerification({
      email: "user@example.com",
      code: "654321",
    });
    expect(result).toEqual({ error: EMAIL_VERIFICATION_GENERIC_ERROR });
    expect(updateUser).not.toHaveBeenCalled();
    expect(deleteToken).not.toHaveBeenCalled();
  });

  it("token expiré / absent / utilisateur absent → même refus", async () => {
    findUniqueToken.mockResolvedValue({
      id: "t1",
      email: "user@example.com",
      token: "654321",
      expires: new Date(Date.now() - 1_000),
      failedAttempts: 0,
      lockedAt: null,
    });
    const expired = await newVerification({
      email: "user@example.com",
      code: "654321",
    });

    findUniqueToken.mockResolvedValue(null);
    const absent = await newVerification({
      email: "user@example.com",
      code: "654321",
    });

    findUniqueToken.mockResolvedValue({
      id: "t1",
      email: "user@example.com",
      token: "654321",
      expires: new Date(Date.now() + 60_000),
      failedAttempts: 0,
      lockedAt: null,
    });
    findUniqueUser.mockResolvedValue(null);
    const noUser = await newVerification({
      email: "user@example.com",
      code: "654321",
    });

    expect(expired).toEqual({ error: EMAIL_VERIFICATION_GENERIC_ERROR });
    expect(absent).toEqual({ error: EMAIL_VERIFICATION_GENERIC_ERROR });
    expect(noUser).toEqual({ error: EMAIL_VERIFICATION_GENERIC_ERROR });
  });

  it("utilise une transaction Serializable", async () => {
    findUniqueToken.mockResolvedValue(null);
    await newVerification({ email: "user@example.com", code: "123456" });
    expect(transaction).toHaveBeenCalled();
    const opts = transaction.mock.calls[0][1];
    expect(opts.isolationLevel).toBe(
      Prisma.TransactionIsolationLevel.Serializable,
    );
  });

  it("réponses d'échec strictement identiques", async () => {
    findUniqueToken.mockResolvedValue(null);
    const a = await newVerification({
      email: "a@example.com",
      code: "111111",
    });
    findUniqueToken.mockResolvedValue({
      id: "t1",
      email: "b@example.com",
      token: "222222",
      expires: new Date(Date.now() - 1),
      failedAttempts: 0,
      lockedAt: null,
    });
    const b = await newVerification({
      email: "b@example.com",
      code: "222222",
    });
    expect(a).toEqual(b);
    expect(JSON.stringify(a)).not.toMatch(/@/);
    expect(JSON.stringify(a)).not.toMatch(/\b\d{6}\b/);
  });
});
