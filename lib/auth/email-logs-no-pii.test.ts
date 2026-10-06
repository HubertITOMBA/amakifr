import { beforeEach, describe, expect, it, vi } from "vitest";

const sendMock = vi.fn();

vi.mock("@/lib/email/providers", () => ({
  getEmailProvider: vi.fn(async () => ({
    send: (...args: unknown[]) => sendMock(...args),
  })),
}));

vi.mock("@/lib/brand-logo-server", () => ({
  readBrandLogoDataUrl: () => null,
  resolveBrandLogoPath: () => null,
}));

import { sendEmail } from "@/lib/mail";
import { ResendProvider } from "@/lib/email/providers/resend-provider";

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

describe("logs email sans PII", () => {
  beforeEach(() => {
    sendMock.mockReset();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("sendEmail n'écrit jamais adresse ni code à 6 chiffres dans les logs", async () => {
    sendMock.mockResolvedValue({
      success: false,
      error: {
        code: "EAUTH",
        message: "fail for victim@example.com code 482913",
      },
    });

    await sendEmail(
      {
        from: "webmaster@amaki.fr",
        to: "victim@example.com",
        subject: "Confirmez votre inscription AMAKI",
        html: "<p>482913</p>",
      },
      false,
    );

    const all = [
      ...(console.log as ReturnType<typeof vi.fn>).mock.calls,
      ...(console.warn as ReturnType<typeof vi.fn>).mock.calls,
      ...(console.error as ReturnType<typeof vi.fn>).mock.calls,
    ]
      .map(serializeLogArgs)
      .join("\n");

    expect(all).not.toMatch(/victim@example\.com/i);
    expect(all).not.toMatch(/\b482913\b/);
    expect(all).not.toMatch(/Confirmez votre inscription/i);
  });

  it("ResendProvider journalise uniquement une catégorie bornée", async () => {
    const provider = Object.create(ResendProvider.prototype) as ResendProvider;
    // Injecter un client Resend faux
    ;(provider as unknown as { resend: { emails: { send: ReturnType<typeof vi.fn> } } }).resend = {
      emails: {
        send: vi.fn(async () => ({
          error: {
            name: "validation_error",
            message: "leak victim@example.com 123456",
          },
        })),
      },
    };

    await provider.send({
      from: "webmaster@amaki.fr",
      to: "victim@example.com",
      subject: "Secret subject",
      html: "123456",
    });

    const all = (console.error as ReturnType<typeof vi.fn>).mock.calls
      .map(serializeLogArgs)
      .join("\n");

    expect(all).toMatch(/provider_error/);
    expect(all).not.toMatch(/victim@example\.com/i);
    expect(all).not.toMatch(/\b123456\b/);
    expect(all).not.toMatch(/Secret subject/);
  });
});
