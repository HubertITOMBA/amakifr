import { describe, expect, it, vi } from "vitest";
import {
  classifyLegacyBooleanSendResult,
  classifyResendSendResult,
  classifySmtpSendResult,
  sendRappelDetteEmailResend,
  sendRappelDetteEmailSmtp,
  type ResendTransport,
  type SmtpTransport,
} from "@/lib/services/cotisations/rappel-dette/rappel-dette-email-provider-adapter";

const TO = "adherent@example.com";
const REQ = {
  from: "noreply@amaki.fr",
  to: TO,
  subject: "test",
  html: "<p>x</p>",
};

describe("classifySmtpSendResult", () => {
  it("Accepted si destinataire attendu dans accepted seul", () => {
    expect(
      classifySmtpSendResult(TO, {
        accepted: [TO],
        rejected: [],
        pending: [],
        messageId: "<1>",
      })
    ).toEqual({ kind: "Accepted" });
  });

  it("DefinitelyNotAccepted si destinataire dans rejected", () => {
    expect(
      classifySmtpSendResult(TO, {
        accepted: [],
        rejected: [TO],
        pending: [],
      })
    ).toEqual({
      kind: "DefinitelyNotAccepted",
      technicalCode: "SMTP_RCPT_REJECTED",
    });
  });

  it("Unknown si contradiction accepted∩rejected", () => {
    expect(
      classifySmtpSendResult(TO, {
        accepted: [TO],
        rejected: [TO],
        pending: [],
      })
    ).toEqual({ kind: "Unknown", technicalCode: "SMTP_INFO_CONTRADICTION" });
  });

  it("Unknown si pending / incomplet / mauvais destinataire", () => {
    expect(
      classifySmtpSendResult(TO, {
        accepted: [],
        rejected: [],
        pending: [TO],
      })
    ).toEqual({ kind: "Unknown", technicalCode: "SMTP_RCPT_PENDING" });
    expect(
      classifySmtpSendResult(TO, {
        accepted: ["autre@example.com"],
        rejected: [],
        pending: [],
      })
    ).toEqual({ kind: "Unknown", technicalCode: "SMTP_INFO_INCOMPLETE" });
    expect(classifySmtpSendResult(TO, null)).toEqual({
      kind: "Unknown",
      technicalCode: "SMTP_INFO_INCOMPLETE",
    });
  });

  it("erreurs SMTP : DNA auth/enveloppe, Unknown timeout", () => {
    expect(classifySmtpSendResult(TO, null, { code: "EAUTH" })).toEqual({
      kind: "DefinitelyNotAccepted",
      technicalCode: "SMTP_AUTH",
    });
    expect(classifySmtpSendResult(TO, null, { code: "EENVELOPE" })).toEqual({
      kind: "DefinitelyNotAccepted",
      technicalCode: "SMTP_ENVELOPE",
    });
    expect(classifySmtpSendResult(TO, null, { code: "ETIMEDOUT" })).toEqual({
      kind: "Unknown",
      technicalCode: "SMTP_TIMEOUT",
    });
  });

  it("responseCode:535 seul (sans error.code) → Unknown, pas DNA", () => {
    expect(classifySmtpSendResult(TO, null, { responseCode: 535 })).toEqual({
      kind: "Unknown",
      technicalCode: "SMTP_TRANSPORT",
    });
    expect(
      classifySmtpSendResult(TO, null, {
        responseCode: 535,
        response: "535 Authentication failed",
      })
    ).toEqual({
      kind: "Unknown",
      technicalCode: "SMTP_TRANSPORT",
    });
  });
});

describe("classifyResendSendResult", () => {
  it("Accepted avec data.id et error null", () => {
    expect(
      classifyResendSendResult({ data: { id: "re_abc" }, error: null })
    ).toEqual({ kind: "Accepted" });
  });

  it("DNA validation / auth", () => {
    expect(
      classifyResendSendResult({
        data: null,
        error: { name: "validation_error", message: "x" },
      })
    ).toEqual({
      kind: "DefinitelyNotAccepted",
      technicalCode: "RESEND_VALIDATION",
    });
    expect(
      classifyResendSendResult({
        data: null,
        error: { name: "missing_api_key", message: "x" },
      })
    ).toEqual({
      kind: "DefinitelyNotAccepted",
      technicalCode: "RESEND_AUTH",
    });
  });

  it("Unknown rate limit / serveur / contradiction / incomplet", () => {
    expect(
      classifyResendSendResult({
        data: null,
        error: { name: "rate_limit_exceeded", message: "x" },
      })
    ).toEqual({ kind: "Unknown", technicalCode: "RESEND_RATE_LIMIT" });
    expect(
      classifyResendSendResult({
        data: { id: "re_1" },
        error: { name: "validation_error", message: "x" },
      })
    ).toEqual({
      kind: "Unknown",
      technicalCode: "RESEND_RESPONSE_CONTRADICTION",
    });
    expect(classifyResendSendResult({ data: {}, error: null })).toEqual({
      kind: "Unknown",
      technicalCode: "RESEND_RESPONSE_INCOMPLETE",
    });
    expect(classifyResendSendResult(null, new Error("boom"))).toEqual({
      kind: "Unknown",
      technicalCode: "RESEND_EXCEPTION",
    });
  });
});

describe("sendRappelDetteEmailSmtp (transport injecté)", () => {
  it("n’appelle aucun réseau réel — mock sendMail", async () => {
    const sendMail = vi.fn(async () => ({
      accepted: [TO],
      rejected: [],
      pending: [],
    }));
    const transport: SmtpTransport = { sendMail };
    const outcome = await sendRappelDetteEmailSmtp(transport, REQ);
    expect(outcome).toEqual({ kind: "Accepted" });
    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(sendMail.mock.calls[0][0].to).toBe(TO);
  });

  it("timeout throw → Unknown", async () => {
    const transport: SmtpTransport = {
      sendMail: async () => {
        const err = new Error("timeout");
        (err as { code?: string }).code = "ETIMEDOUT";
        throw err;
      },
    };
    await expect(sendRappelDetteEmailSmtp(transport, REQ)).resolves.toEqual({
      kind: "Unknown",
      technicalCode: "SMTP_TIMEOUT",
    });
  });
});

describe("sendRappelDetteEmailResend (transport injecté)", () => {
  it("Accepted via mock Resend", async () => {
    const send = vi.fn(async () => ({
      data: { id: "re_1" },
      error: null,
    }));
    const transport: ResendTransport = { emails: { send } };
    await expect(sendRappelDetteEmailResend(transport, REQ)).resolves.toEqual({
      kind: "Accepted",
    });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("exception → Unknown", async () => {
    const transport: ResendTransport = {
      emails: {
        send: async () => {
          throw new Error("network");
        },
      },
    };
    await expect(sendRappelDetteEmailResend(transport, REQ)).resolves.toEqual({
      kind: "Unknown",
      technicalCode: "RESEND_EXCEPTION",
    });
  });
});

describe("classifyLegacyBooleanSendResult", () => {
  it("ne convertit jamais success:false en DefinitelyNotAccepted", () => {
    expect(classifyLegacyBooleanSendResult({ success: false })).toEqual({
      kind: "Unknown",
      technicalCode: "LEGACY_BOOLEAN_FAILURE",
    });
    expect(classifyLegacyBooleanSendResult({ success: true })).toEqual({
      kind: "Unknown",
      technicalCode: "LEGACY_BOOLEAN_INSUFFICIENT",
    });
  });
});
