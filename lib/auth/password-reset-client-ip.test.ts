import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isPlausibleIp,
  isPasswordResetTrustProxyEnabled,
  normalizeIpLiteral,
  resolvePasswordResetClientIpFromHeaders,
} from "@/lib/auth/password-reset-client-ip";

describe("password-reset-client-ip", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("sans TRUST_PROXY ignore tous les headers IP (anti-spoof client)", () => {
    vi.stubEnv("TRUST_PROXY", "false");
    vi.stubEnv("NODE_ENV", "production");
    expect(isPasswordResetTrustProxyEnabled()).toBe(false);
    const ip = resolvePasswordResetClientIpFromHeaders((name) => {
      if (name === "x-real-ip") return "1.2.3.4";
      if (name === "x-forwarded-for") return "9.9.9.9, 1.2.3.4";
      return null;
    });
    expect(ip).toBe("unknown");
  });

  it("TRUST_PROXY absent (undefined) ignore headers", () => {
    vi.stubEnv("TRUST_PROXY", "");
    const ip = resolvePasswordResetClientIpFromHeaders(() => "203.0.113.1");
    expect(ip).toBe("unknown");
  });

  it("accès proxy de confiance : TRUST_PROXY=true + X-Real-IP Nginx", () => {
    vi.stubEnv("TRUST_PROXY", "true");
    const ip = resolvePasswordResetClientIpFromHeaders((name) => {
      if (name === "x-real-ip") return "203.0.113.50";
      if (name === "x-forwarded-for") return "8.8.8.8, 203.0.113.50";
      return null;
    });
    expect(ip).toBe("203.0.113.50");
  });

  it("header client falsifié X-Real-IP ignoré sans TRUST_PROXY", () => {
    vi.stubEnv("TRUST_PROXY", "false");
    expect(
      resolvePasswordResetClientIpFromHeaders((name) =>
        name === "x-real-ip" ? "198.51.100.1" : null
      )
    ).toBe("unknown");
  });

  it("liste XFF falsifiée : premier hop spoofé ignoré ; dernier hop seulement", () => {
    vi.stubEnv("TRUST_PROXY", "true");
    const ip = resolvePasswordResetClientIpFromHeaders((name) => {
      if (name === "x-real-ip") return null;
      if (name === "x-forwarded-for") return "spoofed.client, 203.0.113.9";
      return null;
    });
    expect(ip).toBe("203.0.113.9");
  });

  it("liste XFF entièrement falsifiée → unknown", () => {
    vi.stubEnv("TRUST_PROXY", "true");
    const ip = resolvePasswordResetClientIpFromHeaders((name) => {
      if (name === "x-forwarded-for") return "not-an-ip, also-bad";
      return null;
    });
    expect(ip).toBe("unknown");
  });

  it("IPv4 et IPv6 stricts ; refuse port / espaces", () => {
    expect(isPlausibleIp("1.2.3.4")).toBe(true);
    expect(isPlausibleIp("203.0.113.50")).toBe(true);
    expect(isPlausibleIp("::1")).toBe(true);
    expect(isPlausibleIp("2001:db8::1")).toBe(true);
    expect(isPlausibleIp("[2001:db8::1]")).toBe(true);
    expect(normalizeIpLiteral("[2001:db8::1]")).toBe("2001:db8::1");
    expect(isPlausibleIp("bad host")).toBe(false);
    expect(isPlausibleIp("")).toBe(false);
    expect(isPlausibleIp("1.2.3.4:8080")).toBe(false);
    expect(isPlausibleIp("999.999.999.999")).toBe(false);
  });

  it("TRUST_PROXY=true normalise IPv6 entre crochets", () => {
    vi.stubEnv("TRUST_PROXY", "true");
    const ip = resolvePasswordResetClientIpFromHeaders((name) => {
      if (name === "x-real-ip") return "[2001:db8::10]";
      return null;
    });
    expect(ip).toBe("2001:db8::10");
  });
});
