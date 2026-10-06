import { beforeEach, describe, expect, it, vi } from "vitest";

const getUserByEmail = vi.fn();
const generateVerificationToken = vi.fn();
const sendTwoFactorTokenEmail = vi.fn();

vi.mock("@/actions/auth", () => ({
  getUserByEmail: (...args: unknown[]) => getUserByEmail(...args),
}));

vi.mock("@/lib/token", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/token")>();
  return {
    ...actual,
    generateVerificationToken: (...args: unknown[]) =>
      generateVerificationToken(...args),
  };
});

vi.mock("@/lib/mail", () => ({
  sendTwoFactorTokenEmail: (...args: unknown[]) =>
    sendTwoFactorTokenEmail(...args),
}));

import {
  RESEND_VERIFICATION_PUBLIC_OK,
  resendVerificationCode,
} from "@/actions/auth/resend-verification-code";

const PUBLIC_OK = { ...RESEND_VERIFICATION_PUBLIC_OK };

describe("resendVerificationCode — anti-énumération", () => {
  beforeEach(() => {
    getUserByEmail.mockReset();
    generateVerificationToken.mockReset();
    sendTwoFactorTokenEmail.mockReset();
  });

  it("refuse un email invalide", async () => {
    const result = await resendVerificationCode({ email: "pas-un-email" });
    expect(result).toHaveProperty("error");
    expect(sendTwoFactorTokenEmail).not.toHaveBeenCalled();
  });

  it("toutes les réponses valides sont strictement identiques", async () => {
    // absent
    getUserByEmail.mockResolvedValue(null);
    const absent = await resendVerificationCode({
      email: "absent@example.com",
    });

    // déjà confirmé
    getUserByEmail.mockResolvedValue({
      id: "u1",
      email: "ok@example.com",
      emailVerified: new Date(),
      status: "Inactif",
    });
    const confirmed = await resendVerificationCode({
      email: "ok@example.com",
    });

    // cooldown
    getUserByEmail.mockResolvedValue({
      id: "u1",
      email: "nouveau@example.com",
      emailVerified: null,
    });
    generateVerificationToken.mockResolvedValue({ status: "cooldown" });
    const cooldown = await resendVerificationCode({
      email: "nouveau@example.com",
    });

    // succès
    generateVerificationToken.mockResolvedValue({
      status: "created",
      token: {
        id: "t1",
        email: "nouveau@example.com",
        token: "654321",
        expires: new Date(Date.now() + 300_000),
        createdAt: new Date(),
        failedAttempts: 0,
        lockedAt: null,
      },
    });
    sendTwoFactorTokenEmail.mockResolvedValue(true);
    const success = await resendVerificationCode({
      email: "nouveau@example.com",
    });

    // provider KO
    generateVerificationToken.mockResolvedValue({
      status: "created",
      token: {
        id: "fresh-id",
        email: "nouveau@example.com",
        token: "999999",
        expires: new Date(Date.now() + 300_000),
        createdAt: new Date(),
        failedAttempts: 0,
        lockedAt: null,
      },
    });
    sendTwoFactorTokenEmail.mockResolvedValue(false);
    const providerKo = await resendVerificationCode({
      email: "nouveau@example.com",
    });

    expect(absent).toEqual(PUBLIC_OK);
    expect(confirmed).toEqual(PUBLIC_OK);
    expect(cooldown).toEqual(PUBLIC_OK);
    expect(success).toEqual(PUBLIC_OK);
    expect(providerKo).toEqual(PUBLIC_OK);

    for (const r of [absent, confirmed, cooldown, success, providerKo]) {
      expect(r).toEqual(PUBLIC_OK);
      expect("retryAfter" in r && r.retryAfter).toBe(60);
      expect(JSON.stringify(r)).not.toMatch(/@/);
      expect(JSON.stringify(r)).not.toMatch(/\b\d{6}\b/);
      expect(JSON.stringify(r)).not.toMatch(/token/i);
    }
  });

  it("provider KO conserve le token (pas de suppression) et appelle generate en mode resend", async () => {
    getUserByEmail.mockResolvedValue({
      id: "u1",
      email: "nouveau@example.com",
      emailVerified: null,
    });
    generateVerificationToken.mockResolvedValue({
      status: "created",
      token: {
        id: "fresh-id",
        email: "nouveau@example.com",
        token: "999999",
        expires: new Date(Date.now() + 300_000),
        createdAt: new Date(),
        failedAttempts: 0,
        lockedAt: null,
      },
    });
    sendTwoFactorTokenEmail.mockResolvedValue(false);

    const first = await resendVerificationCode({
      email: "nouveau@example.com",
    });
    expect(first).toEqual(PUBLIC_OK);
    expect(generateVerificationToken).toHaveBeenCalledWith(
      "nouveau@example.com",
      "resend",
    );

    // Second appel : cooldown atomique → pas de nouvel envoi
    generateVerificationToken.mockResolvedValue({ status: "cooldown" });
    sendTwoFactorTokenEmail.mockClear();
    generateVerificationToken.mockClear();
    generateVerificationToken.mockResolvedValue({ status: "cooldown" });

    const second = await resendVerificationCode({
      email: "nouveau@example.com",
    });
    expect(second).toEqual(PUBLIC_OK);
    expect(sendTwoFactorTokenEmail).not.toHaveBeenCalled();
  });

  it("deux renvois concurrents : un seul envoi utile si le second voit cooldown", async () => {
    getUserByEmail.mockResolvedValue({
      id: "u1",
      email: "nouveau@example.com",
      emailVerified: null,
    });

    let call = 0;
    generateVerificationToken.mockImplementation(async () => {
      call += 1;
      if (call === 1) {
        return {
          status: "created",
          token: {
            id: "t1",
            email: "nouveau@example.com",
            token: "111111",
            expires: new Date(Date.now() + 300_000),
            createdAt: new Date(),
            failedAttempts: 0,
            lockedAt: null,
          },
        };
      }
      return { status: "cooldown" };
    });
    sendTwoFactorTokenEmail.mockResolvedValue(true);

    const [a, b] = await Promise.all([
      resendVerificationCode({ email: "nouveau@example.com" }),
      resendVerificationCode({ email: "nouveau@example.com" }),
    ]);

    expect(a).toEqual(PUBLIC_OK);
    expect(b).toEqual(PUBLIC_OK);
    expect(sendTwoFactorTokenEmail).toHaveBeenCalledTimes(1);
  });

  it("ne modifie pas emailVerified ni status", async () => {
    getUserByEmail.mockResolvedValue({
      id: "u1",
      email: "nouveau@example.com",
      emailVerified: null,
      status: "Inactif",
    });
    generateVerificationToken.mockResolvedValue({
      status: "created",
      token: {
        id: "t1",
        email: "nouveau@example.com",
        token: "123456",
        expires: new Date(Date.now() + 300_000),
        createdAt: new Date(),
        failedAttempts: 0,
        lockedAt: null,
      },
    });
    sendTwoFactorTokenEmail.mockResolvedValue(true);

    await resendVerificationCode({ email: "nouveau@example.com" });
    expect(getUserByEmail).toHaveBeenCalled();
  });
});
