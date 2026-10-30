import { describe, expect, it, vi } from "vitest";
import { buildSelectedRappelDetteServerTransport } from "@/lib/services/cotisations/rappel-dette/rappel-dette-server-transports";

describe("buildSelectedRappelDetteServerTransport", () => {
  it("SMTP : construit sans verify() ni connexion", () => {
    const verify = vi.fn();
    const sendMail = vi.fn();
    const createSmtpTransport = vi.fn(() => ({
      sendMail,
      verify,
    }));

    const r = buildSelectedRappelDetteServerTransport(
      {
        EMAIL_PROVIDER: "smtp",
        SMTP_HOST: "127.0.0.1",
        SMTP_PORT: "1025",
        SMTP_FROM: "noreply@amaki.fr",
      },
      { createSmtpTransport }
    );

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.provider.kind).toBe("smtp");
    expect(r.smtpTransport).toBeDefined();
    expect(r.resendTransport).toBeUndefined();
    expect(createSmtpTransport).toHaveBeenCalledTimes(1);
    expect(verify).not.toHaveBeenCalled();
    expect(sendMail).not.toHaveBeenCalled();
  });

  it("Resend : construit sans appel réseau", () => {
    const send = vi.fn();
    const createResendTransport = vi.fn(() => ({
      emails: { send },
    }));

    const r = buildSelectedRappelDetteServerTransport(
      {
        EMAIL_PROVIDER: "resend",
        RESEND_API_KEY: "re_test_key",
        EMAIL_FROM: "noreply@amaki.fr",
      },
      { createResendTransport }
    );

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.provider.kind).toBe("resend");
    expect(r.resendTransport).toBeDefined();
    expect(r.smtpTransport).toBeUndefined();
    expect(createResendTransport).toHaveBeenCalledWith("re_test_key");
    expect(send).not.toHaveBeenCalled();
  });

  it("config invalide → refus sans factory", () => {
    const createSmtpTransport = vi.fn();
    const r = buildSelectedRappelDetteServerTransport(
      {
        EMAIL_PROVIDER: "smtp",
        SMTP_HOST: "",
        SMTP_PORT: "587",
        SMTP_FROM: "",
      },
      { createSmtpTransport }
    );
    expect(r.ok).toBe(false);
    expect(createSmtpTransport).not.toHaveBeenCalled();
  });
});
