import { beforeEach, describe, expect, it, vi } from "vitest";

const getUserByEmail = vi.fn();
const generateVerificationToken = vi.fn();
const sendTwoFactorTokenEmail = vi.fn();
const transaction = vi.fn();

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

vi.mock("@/lib/db", () => ({
  db: {
    $transaction: (...args: unknown[]) => transaction(...args),
  },
}));

import { resendVerificationCode } from "@/actions/auth/resend-verification-code";
import { newVerification } from "@/actions/auth/new-verification";

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

describe("logs vérification / renvoi sans PII", () => {
  beforeEach(() => {
    getUserByEmail.mockReset();
    generateVerificationToken.mockReset();
    sendTwoFactorTokenEmail.mockReset();
    transaction.mockReset();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("resend provider KO : aucun email/code dans console.*", async () => {
    getUserByEmail.mockResolvedValue({
      id: "u1",
      email: "victim@example.com",
      emailVerified: null,
    });
    generateVerificationToken.mockResolvedValue({
      status: "created",
      token: {
        id: "t1",
        email: "victim@example.com",
        token: "482913",
        expires: new Date(),
        createdAt: new Date(),
        failedAttempts: 0,
        lockedAt: null,
      },
    });
    sendTwoFactorTokenEmail.mockResolvedValue(false);

    await resendVerificationCode({ email: "victim@example.com" });

    const all = [
      ...(console.log as ReturnType<typeof vi.fn>).mock.calls,
      ...(console.warn as ReturnType<typeof vi.fn>).mock.calls,
      ...(console.error as ReturnType<typeof vi.fn>).mock.calls,
    ]
      .map(serializeLogArgs)
      .join("\n");

    expect(all).not.toMatch(/victim@example\.com/i);
    expect(all).not.toMatch(/\b482913\b/);
  });

  it("newVerification exception : aucun email/code dans console.*", async () => {
    transaction.mockRejectedValue(
      new Error("boom for victim@example.com code 482913"),
    );

    await newVerification({
      email: "victim@example.com",
      code: "482913",
    });

    const all = [
      ...(console.log as ReturnType<typeof vi.fn>).mock.calls,
      ...(console.warn as ReturnType<typeof vi.fn>).mock.calls,
      ...(console.error as ReturnType<typeof vi.fn>).mock.calls,
    ]
      .map(serializeLogArgs)
      .join("\n");

    expect(all).not.toMatch(/victim@example\.com/i);
    expect(all).not.toMatch(/\b482913\b/);
  });
});
