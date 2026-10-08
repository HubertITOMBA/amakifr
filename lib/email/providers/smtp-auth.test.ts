import { afterEach, describe, expect, it, vi } from "vitest";
import {
  SmtpAuthConfigError,
  normalizeOptionalSmtpCredential,
  resolveSmtpAuth,
} from "@/lib/email/providers/smtp-auth";
import {
  buildSmtpConfigFromEnv,
  __resetEmailProviderForTests,
} from "@/lib/email/providers/index";
import {
  SMTPProvider,
  buildNodemailerTransportOptions,
} from "@/lib/email/providers/smtp-provider";

const TEST_USER = "test-only-smtp-user";
const TEST_PASS = "test-only-smtp-pass";
const TEST_HOST = "127.0.0.1";
const TEST_PORT = "1025";
const TEST_FROM = "noreply@localhost.test-only";

vi.mock("nodemailer", () => ({
  default: {
    createTransport: vi.fn(() => ({
      sendMail: vi.fn().mockResolvedValue({ messageId: "test-only" }),
    })),
  },
}));

import nodemailer from "nodemailer";

describe("normalizeOptionalSmtpCredential", () => {
  it("traite null/undefined/vides/espaces comme absents", () => {
    expect(normalizeOptionalSmtpCredential(undefined)).toBeUndefined();
    expect(normalizeOptionalSmtpCredential(null)).toBeUndefined();
    expect(normalizeOptionalSmtpCredential("")).toBeUndefined();
    expect(normalizeOptionalSmtpCredential("   ")).toBeUndefined();
    expect(normalizeOptionalSmtpCredential("\t\n")).toBeUndefined();
  });

  it("conserve une valeur test-only non vide (trim)", () => {
    expect(normalizeOptionalSmtpCredential(`  ${TEST_USER}  `)).toBe(TEST_USER);
  });
});

describe("resolveSmtpAuth", () => {
  it("auth complète → paire exacte", () => {
    expect(resolveSmtpAuth(TEST_USER, TEST_PASS)).toEqual({
      user: TEST_USER,
      pass: TEST_PASS,
    });
  });

  it("aucune auth → undefined", () => {
    expect(resolveSmtpAuth(undefined, undefined)).toBeUndefined();
    expect(resolveSmtpAuth("", "")).toBeUndefined();
    expect(resolveSmtpAuth("  ", "\t")).toBeUndefined();
  });

  it("user seul → refus catégoriel sans secret", () => {
    expect(() => resolveSmtpAuth(TEST_USER, undefined)).toThrow(
      SmtpAuthConfigError
    );
    expect(() => resolveSmtpAuth(TEST_USER, "")).toThrow(/SMTP_AUTH_CONFIG_ERROR/);
    try {
      resolveSmtpAuth(TEST_USER, "   ");
      expect.unreachable();
    } catch (e) {
      const msg = String(e);
      expect(msg).toMatch(/SMTP_AUTH_CONFIG_ERROR/);
      expect(msg).not.toContain(TEST_USER);
      expect(msg).not.toContain(TEST_PASS);
    }
  });

  it("pass seul → refus catégoriel sans secret", () => {
    try {
      resolveSmtpAuth(undefined, TEST_PASS);
      expect.unreachable();
    } catch (e) {
      const msg = String(e);
      expect(msg).toMatch(/SMTP_AUTH_CONFIG_ERROR/);
      expect(msg).not.toContain(TEST_PASS);
      expect(msg).not.toContain(TEST_USER);
    }
  });
});

describe("buildNodemailerTransportOptions / SMTPProvider", () => {
  afterEach(() => {
    vi.mocked(nodemailer.createTransport).mockClear();
  });

  it("auth complète → bloc auth exact", () => {
    const options = buildNodemailerTransportOptions({
      host: TEST_HOST,
      port: 1025,
      secure: false,
      from: TEST_FROM,
      auth: { user: TEST_USER, pass: TEST_PASS },
    });
    expect(options).toEqual({
      host: TEST_HOST,
      port: 1025,
      secure: false,
      auth: { user: TEST_USER, pass: TEST_PASS },
    });
    expect(Object.prototype.hasOwnProperty.call(options, "auth")).toBe(true);
  });

  it("aucune auth → propriété auth absente", () => {
    const options = buildNodemailerTransportOptions({
      host: TEST_HOST,
      port: 1025,
      secure: false,
      from: TEST_FROM,
    });
    expect(options).toEqual({
      host: TEST_HOST,
      port: 1025,
      secure: false,
    });
    expect(Object.prototype.hasOwnProperty.call(options, "auth")).toBe(false);
    expect("auth" in options).toBe(false);
  });

  it("SMTPProvider crée le transport avec les mêmes options", () => {
    new SMTPProvider({
      host: TEST_HOST,
      port: 1025,
      secure: false,
      from: TEST_FROM,
    });
    expect(nodemailer.createTransport).toHaveBeenCalledWith({
      host: TEST_HOST,
      port: 1025,
      secure: false,
    });
    const arg = vi.mocked(nodemailer.createTransport).mock.calls[0][0] as object;
    expect(Object.prototype.hasOwnProperty.call(arg, "auth")).toBe(false);

    vi.mocked(nodemailer.createTransport).mockClear();
    new SMTPProvider({
      host: TEST_HOST,
      port: 587,
      secure: false,
      from: TEST_FROM,
      auth: { user: TEST_USER, pass: TEST_PASS },
    });
    expect(nodemailer.createTransport).toHaveBeenCalledWith({
      host: TEST_HOST,
      port: 587,
      secure: false,
      auth: { user: TEST_USER, pass: TEST_PASS },
    });
  });

  it("échec send → log catégoriel sans secret / destinataire", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(nodemailer.createTransport).mockReturnValueOnce({
      sendMail: vi.fn().mockRejectedValue(
        new Error(`auth failed for ${TEST_USER} / ${TEST_PASS}`)
      ),
    } as never);

    const provider = new SMTPProvider({
      host: TEST_HOST,
      port: 1025,
      secure: false,
      from: TEST_FROM,
      auth: { user: TEST_USER, pass: TEST_PASS },
    });
    const result = await provider.send({
      from: TEST_FROM,
      to: "victim@example.invalid",
      subject: "test-only",
      html: "<p>secret-body-test-only</p>",
    });
    expect(result.success).toBe(false);
    expect(errSpy).toHaveBeenCalledWith("SMTP_ERROR", {
      category: "transport_error",
    });
    for (const call of errSpy.mock.calls) {
      const flat = call.map(String).join(" ");
      expect(flat).not.toContain(TEST_USER);
      expect(flat).not.toContain(TEST_PASS);
      expect(flat).not.toContain("victim@example.invalid");
      expect(flat).not.toContain("secret-body-test-only");
    }
    errSpy.mockRestore();
  });
});

describe("buildSmtpConfigFromEnv", () => {
  afterEach(() => {
    __resetEmailProviderForTests();
  });

  it("auth complète → config.auth exact", () => {
    const config = buildSmtpConfigFromEnv({
      SMTP_HOST: TEST_HOST,
      SMTP_PORT: TEST_PORT,
      SMTP_FROM: TEST_FROM,
      SMTP_USER: TEST_USER,
      SMTP_PASS: TEST_PASS,
    });
    expect(config.auth).toEqual({ user: TEST_USER, pass: TEST_PASS });
  });

  it("aucune auth → config sans propriété auth", () => {
    const config = buildSmtpConfigFromEnv({
      SMTP_HOST: TEST_HOST,
      SMTP_PORT: TEST_PORT,
      SMTP_FROM: TEST_FROM,
      SMTP_USER: "",
      SMTP_PASS: "  ",
    });
    expect(Object.prototype.hasOwnProperty.call(config, "auth")).toBe(false);
  });

  it("user seul → erreur sans secret dans le message", () => {
    expect(() =>
      buildSmtpConfigFromEnv({
        SMTP_HOST: TEST_HOST,
        SMTP_PORT: TEST_PORT,
        SMTP_FROM: TEST_FROM,
        SMTP_USER: TEST_USER,
      })
    ).toThrow(SmtpAuthConfigError);

    try {
      buildSmtpConfigFromEnv({
        SMTP_HOST: TEST_HOST,
        SMTP_PORT: TEST_PORT,
        SMTP_FROM: TEST_FROM,
        SMTP_USER: TEST_USER,
      });
    } catch (e) {
      const msg = String(e);
      expect(msg).not.toContain(TEST_USER);
    }
  });

  it("HOST/PORT/FROM restent obligatoires", () => {
    expect(() =>
      buildSmtpConfigFromEnv({
        SMTP_PORT: TEST_PORT,
        SMTP_FROM: TEST_FROM,
      })
    ).toThrow(/SMTP_HOST, SMTP_PORT et SMTP_FROM/);
  });
});
