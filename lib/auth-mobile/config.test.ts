import { afterEach, describe, expect, it, vi } from "vitest";

describe("getMobileAccessTokenSecret", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("absent → INTERNAL_ERROR", async () => {
    vi.stubEnv("MOBILE_ACCESS_TOKEN_SECRET", undefined as unknown as string);
    delete process.env.MOBILE_ACCESS_TOKEN_SECRET;
    vi.resetModules();
    const { getMobileAccessTokenSecret } = await import(
      "@/lib/auth-mobile/config"
    );
    expect(() => getMobileAccessTokenSecret()).toThrow(
      expect.objectContaining({ code: "INTERNAL_ERROR" })
    );
  });

  it("vide → INTERNAL_ERROR", async () => {
    vi.stubEnv("MOBILE_ACCESS_TOKEN_SECRET", "   ");
    vi.resetModules();
    const { getMobileAccessTokenSecret } = await import(
      "@/lib/auth-mobile/config"
    );
    expect(() => getMobileAccessTokenSecret()).toThrow(
      expect.objectContaining({ code: "INTERNAL_ERROR" })
    );
  });

  it("trop court (< 32 octets) → INTERNAL_ERROR", async () => {
    vi.stubEnv("MOBILE_ACCESS_TOKEN_SECRET", "short-secret-only-20b");
    vi.resetModules();
    const { getMobileAccessTokenSecret } = await import(
      "@/lib/auth-mobile/config"
    );
    expect(() => getMobileAccessTokenSecret()).toThrow(
      expect.objectContaining({ code: "INTERNAL_ERROR" })
    );
  });

  it("suffisamment long (≥ 32 octets) → OK", async () => {
    const secret = "x".repeat(32);
    vi.stubEnv("MOBILE_ACCESS_TOKEN_SECRET", secret);
    vi.resetModules();
    const { getMobileAccessTokenSecret } = await import(
      "@/lib/auth-mobile/config"
    );
    expect(getMobileAccessTokenSecret()).toBe(secret);
  });
});
