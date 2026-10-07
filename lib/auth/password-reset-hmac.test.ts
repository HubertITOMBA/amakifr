import { afterEach, describe, expect, it, vi } from "vitest";
import { createHmac, randomInt } from "node:crypto";
import {
  PASSWORD_RESET_HMAC_DOMAIN,
  PASSWORD_RESET_RL_HMAC_DOMAIN,
} from "@/lib/auth/password-reset-constants";

vi.mock("node:crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:crypto")>();
  return {
    ...actual,
    randomInt: vi.fn(actual.randomInt),
  };
});

describe("password-reset-hmac", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    vi.mocked(randomInt).mockReset();
  });

  it("refuse un secret manquant / trop court ; isConfigured false", async () => {
    vi.stubEnv("PASSWORD_RESET_HMAC_SECRET", "");
    const mod = await import("@/lib/auth/password-reset-hmac");
    expect(mod.isPasswordResetHmacSecretConfigured()).toBe(false);
    expect(() => mod.getPasswordResetHmacSecret()).toThrow(/Configuration/);

    vi.resetModules();
    vi.stubEnv("PASSWORD_RESET_HMAC_SECRET", "short");
    const mod2 = await import("@/lib/auth/password-reset-hmac");
    expect(mod2.isPasswordResetHmacSecretConfigured()).toBe(false);
  });

  it("génère via randomInt [0, 1e8) sans biais Math.random", async () => {
    vi.stubEnv(
      "PASSWORD_RESET_HMAC_SECRET",
      "test-password-reset-hmac-secret-32b!!"
    );
    vi.mocked(randomInt).mockReturnValue(42);
    const { generatePasswordResetCode } = await import(
      "@/lib/auth/password-reset-hmac"
    );
    expect(generatePasswordResetCode()).toBe("00000042");
    expect(randomInt).toHaveBeenCalledWith(0, 100_000_000);
  });

  it("HMAC avec domaine explicite ; timingSafeEqual ; jamais le code en clair", async () => {
    const secret = "test-password-reset-hmac-secret-32b!!";
    vi.stubEnv("PASSWORD_RESET_HMAC_SECRET", secret);
    const { hashPasswordResetCode, passwordResetHashesEqual, hashPasswordResetRateLimitKey } =
      await import("@/lib/auth/password-reset-hmac");
    const code = "12345678";
    const hash = hashPasswordResetCode(code);
    expect(hash).not.toContain(code);
    expect(hash).toBe(
      createHmac("sha256", secret)
        .update(PASSWORD_RESET_HMAC_DOMAIN + code, "utf8")
        .digest("hex")
    );
    expect(passwordResetHashesEqual(hash, hash)).toBe(true);
    const rlReq = hashPasswordResetRateLimitKey(
      "PASSWORD_RESET_REQUEST",
      "email",
      "a@b.com"
    );
    const rlConf = hashPasswordResetRateLimitKey(
      "PASSWORD_RESET_CONFIRM",
      "email",
      "a@b.com"
    );
    expect(rlReq).toHaveLength(32);
    expect(rlConf).toHaveLength(32);
    expect(rlReq).not.toBe(rlConf);
    expect(rlReq).not.toContain("a@b.com");
    expect(
      createHmac("sha256", secret)
        .update(
          `${PASSWORD_RESET_RL_HMAC_DOMAIN}PASSWORD_RESET_REQUEST:email:a@b.com`,
          "utf8"
        )
        .digest("hex")
        .slice(0, 32)
    ).toBe(rlReq);
  });
});
