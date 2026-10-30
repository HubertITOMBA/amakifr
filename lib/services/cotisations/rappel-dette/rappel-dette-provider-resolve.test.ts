import { describe, expect, it } from "vitest";
import {
  resolveRappelDetteProviderKind,
  validateRappelDetteProviderConfig,
} from "@/lib/services/cotisations/rappel-dette/rappel-dette-provider-resolve";

describe("rappel-dette-provider-resolve", () => {
  it("résout resend par défaut", () => {
    expect(resolveRappelDetteProviderKind({})).toBe("resend");
    expect(resolveRappelDetteProviderKind({ EMAIL_PROVIDER: "smtp" })).toBe(
      "smtp"
    );
    expect(resolveRappelDetteProviderKind({ EMAIL_PROVIDER: "x" })).toBeNull();
  });

  it("refuse Resend sans clé (sans réseau)", () => {
    const r = validateRappelDetteProviderConfig({
      EMAIL_PROVIDER: "resend",
      RESEND_API_KEY: "",
    });
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("expected fail");
    expect(r.code).toBe("PROVIDER_CONFIG_INVALID");
  });

  it("accepte Resend avec clé", () => {
    const r = validateRappelDetteProviderConfig({
      EMAIL_PROVIDER: "resend",
      RESEND_API_KEY: "re_test",
      EMAIL_FROM: "noreply@amaki.fr",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("expected ok");
    expect(r.provider).toEqual({
      kind: "resend",
      from: "noreply@amaki.fr",
    });
  });

  it("refuse SMTP incomplet", () => {
    const r = validateRappelDetteProviderConfig({
      EMAIL_PROVIDER: "smtp",
      SMTP_HOST: "localhost",
      SMTP_PORT: "587",
      SMTP_FROM: "",
    });
    expect(r.ok).toBe(false);
  });

  it("accepte SMTP complet", () => {
    const r = validateRappelDetteProviderConfig({
      EMAIL_PROVIDER: "smtp",
      SMTP_HOST: "localhost",
      SMTP_PORT: "587",
      SMTP_FROM: "noreply@amaki.fr",
      SMTP_USER: "u",
      SMTP_PASS: "p",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("expected ok");
    expect(r.provider.kind).toBe("smtp");
  });
});
