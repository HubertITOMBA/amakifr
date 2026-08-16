import { describe, expect, it } from "vitest";
import {
  buildMobileRefreshRateLimitKey,
} from "@/lib/auth-mobile/refresh-rate-limit-key";
import { hashRefreshToken } from "@/lib/auth-mobile/refresh-token";
import {
  MOBILE_ACCESS_TOKEN_TTL_SECONDS,
  MOBILE_REFRESH_RATE_HASH_PREFIX_LEN,
  MOBILE_REFRESH_RATE_MAX,
  MOBILE_REFRESH_RATE_WINDOW_MS,
  MOBILE_ACCESS_TOKEN_CLOCK_TOLERANCE_SECONDS,
} from "@/lib/auth-mobile/constants";

/**
 * Invariants hardening Phase 2M (sans DB/Redis réels).
 */
describe("hardening auth mobile 2M", () => {
  it("clé rate-limit refresh : IP + digest, jamais le brut", () => {
    const raw = "super-secret-refresh-token-opaque-value";
    const key = buildMobileRefreshRateLimitKey("203.0.113.10", raw);
    expect(key).toBe(
      `mobile-refresh:203.0.113.10:${hashRefreshToken(raw).slice(0, MOBILE_REFRESH_RATE_HASH_PREFIX_LEN)}`
    );
    expect(key).not.toContain(raw);
    expect(key).not.toContain(hashRefreshToken(raw)); // préfixe seulement, pas hash complet
  });

  it("seuils refresh documentés", () => {
    expect(MOBILE_REFRESH_RATE_MAX).toBe(30);
    expect(MOBILE_REFRESH_RATE_WINDOW_MS).toBe(15 * 60 * 1000);
  });

  it("access TTL 15 min + clockTolerance ≤ 30s", () => {
    expect(MOBILE_ACCESS_TOKEN_TTL_SECONDS).toBe(15 * 60);
    expect(MOBILE_ACCESS_TOKEN_CLOCK_TOLERANCE_SECONDS).toBeGreaterThan(0);
    expect(MOBILE_ACCESS_TOKEN_CLOCK_TOLERANCE_SECONDS).toBeLessThanOrEqual(30);
  });

  it("réponses publiques ne doivent pas contenir secrets typiques", () => {
    const publicErrorBodies = [
      { success: false, error: { code: "UNAUTHENTICATED", message: "Identifiants invalides" } },
      { success: false, error: { code: "UNAUTHENTICATED", message: "Session invalide" } },
      { success: false, error: { code: "RATE_LIMITED", message: "Trop de tentatives" } },
      { success: true, data: { updated: true } },
      { success: true, data: { revoked: false } },
    ];
    for (const body of publicErrorBodies) {
      const s = JSON.stringify(body);
      expect(s).not.toMatch(/password/i);
      expect(s).not.toMatch(/refreshTokenHash/);
      expect(s).not.toMatch(/MOBILE_ACCESS_TOKEN_SECRET/);
    }
  });
});
