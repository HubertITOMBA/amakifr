import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("access-token", () => {
  beforeEach(() => {
    vi.stubEnv("MOBILE_ACCESS_TOKEN_SECRET", "test-secret-at-least-32-chars-long!!");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("génération + vérification", async () => {
    const { issueAccessToken, verifyAccessToken } = await import(
      "@/lib/auth-mobile/access-token"
    );
    const issued = await issueAccessToken("user-1");
    expect(issued.token).toBeTruthy();
    expect(issued.jti).toBeTruthy();
    expect(issued.expiresAt.getTime()).toBeGreaterThan(Date.now());

    const claims = await verifyAccessToken(issued.token);
    expect(claims.sub).toBe("user-1");
    expect(claims.jti).toBe(issued.jti);
    expect(claims.type).toBe("access");
    expect(claims.exp).toBeGreaterThan(claims.iat);
  });

  it("mauvais secret → UNAUTHENTICATED", async () => {
    const { issueAccessToken } = await import("@/lib/auth-mobile/access-token");
    const issued = await issueAccessToken("user-1");
    vi.stubEnv("MOBILE_ACCESS_TOKEN_SECRET", "other-secret-at-least-32-chars-xxxx");
    vi.resetModules();
    const { verifyAccessToken } = await import("@/lib/auth-mobile/access-token");
    await expect(verifyAccessToken(issued.token)).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
    });
  });

  it("mauvais type → UNAUTHENTICATED", async () => {
    const { SignJWT } = await import("jose");
    const secret = new TextEncoder().encode(
      "test-secret-at-least-32-chars-long!!"
    );
    const bad = await new SignJWT({ type: "refresh" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("user-1")
      .setJti("jti-1")
      .setIssuedAt()
      .setExpirationTime("15m")
      .sign(secret);

    const { verifyAccessToken } = await import("@/lib/auth-mobile/access-token");
    await expect(verifyAccessToken(bad)).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
    });
  });

  it("sub absent → UNAUTHENTICATED", async () => {
    const { SignJWT } = await import("jose");
    const secret = new TextEncoder().encode(
      "test-secret-at-least-32-chars-long!!"
    );
    const bad = await new SignJWT({ type: "access" })
      .setProtectedHeader({ alg: "HS256" })
      .setJti("jti-1")
      .setIssuedAt()
      .setExpirationTime("15m")
      .sign(secret);

    const { verifyAccessToken } = await import("@/lib/auth-mobile/access-token");
    await expect(verifyAccessToken(bad)).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
    });
  });

  it("jti absent → UNAUTHENTICATED", async () => {
    const { SignJWT } = await import("jose");
    const secret = new TextEncoder().encode(
      "test-secret-at-least-32-chars-long!!"
    );
    const bad = await new SignJWT({ type: "access" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("user-1")
      .setIssuedAt()
      .setExpirationTime("15m")
      .sign(secret);

    const { verifyAccessToken } = await import("@/lib/auth-mobile/access-token");
    await expect(verifyAccessToken(bad)).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
    });
  });

  it("token expiré → UNAUTHENTICATED", async () => {
    const { SignJWT } = await import("jose");
    const secret = new TextEncoder().encode(
      "test-secret-at-least-32-chars-long!!"
    );
    const expired = await new SignJWT({ type: "access" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("user-1")
      .setJti("jti-exp")
      .setIssuedAt(Math.floor(Date.now() / 1000) - 120)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(secret);

    const { verifyAccessToken } = await import("@/lib/auth-mobile/access-token");
    await expect(verifyAccessToken(expired)).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
    });
  });

  it("token altéré → UNAUTHENTICATED", async () => {
    const { issueAccessToken, verifyAccessToken } = await import(
      "@/lib/auth-mobile/access-token"
    );
    const issued = await issueAccessToken("user-1");
    const tampered = issued.token.slice(0, -4) + "xxxx";
    await expect(verifyAccessToken(tampered)).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
    });
  });

  it("secret manquant → INTERNAL_ERROR fail closed", async () => {
    vi.stubEnv("MOBILE_ACCESS_TOKEN_SECRET", "");
    vi.resetModules();
    const { issueAccessToken } = await import("@/lib/auth-mobile/access-token");
    await expect(issueAccessToken("user-1")).rejects.toMatchObject({
      code: "INTERNAL_ERROR",
    });
  });

  it("secret trop court → INTERNAL_ERROR", async () => {
    vi.stubEnv("MOBILE_ACCESS_TOKEN_SECRET", "too-short");
    vi.resetModules();
    const { issueAccessToken } = await import("@/lib/auth-mobile/access-token");
    await expect(issueAccessToken("user-1")).rejects.toMatchObject({
      code: "INTERNAL_ERROR",
    });
  });
});
