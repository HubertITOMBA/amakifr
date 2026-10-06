import { beforeEach, describe, expect, it, vi } from "vitest";

const getUserByEmail = vi.fn();
const generateVerificationToken = vi.fn();
const sendTwoFactorTokenEmail = vi.fn();

vi.mock("@/actions/auth/index", () => ({
  getUserByEmail: (...args: unknown[]) => getUserByEmail(...args),
}));

vi.mock("@/lib/token", () => ({
  generateVerificationToken: (...args: unknown[]) =>
    generateVerificationToken(...args),
  VERIFICATION_TOKEN_TTL_MS: 300_000,
  VERIFICATION_RESEND_COOLDOWN_MS: 60_000,
  PASSWORD_RESET_TOKEN_TTL_MS: 300_000,
}));

vi.mock("@/lib/mail", () => ({
  sendTwoFactorTokenEmail: (...args: unknown[]) =>
    sendTwoFactorTokenEmail(...args),
}));

vi.mock("@/auth", () => ({
  signIn: vi.fn(),
}));

vi.mock("next-auth", () => ({
  AuthError: class AuthError extends Error {
    type?: string;
    constructor(message?: string) {
      super(message);
      this.name = "AuthError";
    }
  },
}));

import { login } from "@/actions/auth/login";

function serializeLogArgs(args: unknown[]): string {
  return args
    .map((a) => {
      try {
        return typeof a === "string" ? a : JSON.stringify(a);
      } catch {
        return String(a);
      }
    })
    .join(" ");
}

const unverifiedUser = {
  id: "u1",
  email: "membre@example.com",
  password: "hashed",
  emailVerified: null,
  status: "Actif",
};

describe("login — compte non confirmé (resend)", () => {
  beforeEach(() => {
    getUserByEmail.mockReset();
    generateVerificationToken.mockReset();
    sendTwoFactorTokenEmail.mockReset();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it('appelle generateVerificationToken(email, "resend")', async () => {
    getUserByEmail.mockResolvedValue(unverifiedUser);
    generateVerificationToken.mockResolvedValue({
      status: "created",
      token: {
        id: "t1",
        email: "membre@example.com",
        token: "123456",
        expires: new Date(),
        createdAt: new Date(),
        failedAttempts: 0,
        lockedAt: null,
      },
    });
    sendTwoFactorTokenEmail.mockResolvedValue(true);

    await login(
      { email: "membre@example.com", password: "secret1" },
      null,
    );

    expect(generateVerificationToken).toHaveBeenCalledWith(
      "membre@example.com",
      "resend",
    );
    expect(generateVerificationToken).not.toHaveBeenCalledWith(
      expect.anything(),
      "initial",
    );
  });

  it("génération créée → un seul envoi", async () => {
    getUserByEmail.mockResolvedValue(unverifiedUser);
    generateVerificationToken.mockResolvedValue({
      status: "created",
      token: {
        id: "t1",
        email: "membre@example.com",
        token: "123456",
        expires: new Date(),
        createdAt: new Date(),
        failedAttempts: 0,
        lockedAt: null,
      },
    });
    sendTwoFactorTokenEmail.mockResolvedValue(true);

    const result = await login(
      { email: "membre@example.com", password: "secret1" },
      null,
    );

    expect(sendTwoFactorTokenEmail).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      twoFactor: true,
      success: "Code OTP envoyé !",
    });
    expect(result).not.toHaveProperty("deliveryFailed");
  });

  it("cooldown → aucun envoi, pas de faux succès d'envoi", async () => {
    getUserByEmail.mockResolvedValue(unverifiedUser);
    generateVerificationToken.mockResolvedValue({ status: "cooldown" });

    const result = await login(
      { email: "membre@example.com", password: "secret1" },
      null,
    );

    expect(sendTwoFactorTokenEmail).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toMatch(/envoyé/i);
    expect(result).toMatchObject({
      verificationRequired: true,
      twoFactor: true,
    });
    expect(result).not.toHaveProperty("deliveryFailed");
  });

  it("provider KO → deliveryFailed, sans faux message de succès", async () => {
    getUserByEmail.mockResolvedValue(unverifiedUser);
    generateVerificationToken.mockResolvedValue({
      status: "created",
      token: {
        id: "t1",
        email: "membre@example.com",
        token: "999999",
        expires: new Date(),
        createdAt: new Date(),
        failedAttempts: 0,
        lockedAt: null,
      },
    });
    sendTwoFactorTokenEmail.mockResolvedValue(false);

    const result = await login(
      { email: "membre@example.com", password: "secret1" },
      null,
    );

    expect(result).toMatchObject({
      verificationRequired: true,
      deliveryFailed: true,
    });
    expect(result).not.toHaveProperty("success");
    expect(JSON.stringify(result)).not.toMatch(/Code OTP envoyé/i);
    expect(JSON.stringify(result)).not.toMatch(/succès/i);
  });

  it("aucune donnée sensible dans le retour ni les logs", async () => {
    getUserByEmail.mockResolvedValue(unverifiedUser);
    generateVerificationToken.mockResolvedValue({
      status: "created",
      token: {
        id: "t1",
        email: "membre@example.com",
        token: "482913",
        expires: new Date(),
        createdAt: new Date(),
        failedAttempts: 0,
        lockedAt: null,
      },
    });
    sendTwoFactorTokenEmail.mockResolvedValue(false);

    const result = await login(
      { email: "membre@example.com", password: "secret1" },
      null,
    );

    const payload = JSON.stringify(result);
    expect(payload).not.toMatch(/membre@example\.com/i);
    expect(payload).not.toMatch(/\b482913\b/);
    expect(payload).not.toMatch(/token/i);

    const all = [
      ...(console.log as ReturnType<typeof vi.fn>).mock.calls,
      ...(console.warn as ReturnType<typeof vi.fn>).mock.calls,
      ...(console.error as ReturnType<typeof vi.fn>).mock.calls,
    ]
      .map(serializeLogArgs)
      .join("\n");

    expect(all).not.toMatch(/membre@example\.com/i);
    expect(all).not.toMatch(/\b482913\b/);
  });

  it("exception DB/provider → deliveryFailed, log catégoriel, aucun faux succès", async () => {
    getUserByEmail.mockResolvedValue(unverifiedUser);
    generateVerificationToken.mockRejectedValue(
      new Error("boom for membre@example.com code 482913"),
    );

    const result = await login(
      { email: "membre@example.com", password: "secret1" },
      null,
    );

    expect(result).toMatchObject({
      verificationRequired: true,
      deliveryFailed: true,
    });
    expect(result).not.toHaveProperty("success");
    expect(sendTwoFactorTokenEmail).not.toHaveBeenCalled();

    const all = [
      ...(console.log as ReturnType<typeof vi.fn>).mock.calls,
      ...(console.warn as ReturnType<typeof vi.fn>).mock.calls,
      ...(console.error as ReturnType<typeof vi.fn>).mock.calls,
    ]
      .map(serializeLogArgs)
      .join("\n");

    expect(all).toMatch(/verification_exception/);
    expect(all).not.toMatch(/membre@example\.com/i);
    expect(all).not.toMatch(/\b482913\b/);
    expect(all).not.toMatch(/boom/i);
  });
});
