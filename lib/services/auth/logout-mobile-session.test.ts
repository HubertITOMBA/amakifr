import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  findUnique,
  update,
  verifyAccessToken,
  blacklistAccessTokenJti,
} = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
  verifyAccessToken: vi.fn(),
  blacklistAccessTokenJti: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    mobileRefreshSession: { findUnique, update },
  },
}));

vi.mock("@/lib/auth-mobile/access-token", () => ({
  verifyAccessToken,
}));

vi.mock("@/lib/auth-mobile/access-token-blacklist", () => ({
  blacklistAccessTokenJti,
}));

import { logoutMobileSession } from "@/lib/services/auth/logout-mobile-session";
import { hashRefreshToken } from "@/lib/auth-mobile/refresh-token";

describe("logoutMobileSession", () => {
  beforeEach(() => {
    findUnique.mockReset();
    update.mockReset();
    verifyAccessToken.mockReset();
    blacklistAccessTokenJti.mockReset();
  });

  it("VALIDATION si aucun token", async () => {
    await expect(logoutMobileSession({})).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });

  it("succès révocation refresh", async () => {
    findUnique.mockResolvedValue({ id: "s1", revokedAt: null });
    update.mockResolvedValue({});
    const result = await logoutMobileSession({ refreshToken: "tok" });
    expect(result.revoked).toBe(true);
    expect(findUnique).toHaveBeenCalledWith({
      where: { refreshTokenHash: hashRefreshToken("tok") },
      select: { id: true, revokedAt: true },
    });
  });

  it("idempotence déjà révoqué", async () => {
    findUnique.mockResolvedValue({ id: "s1", revokedAt: new Date() });
    const result = await logoutMobileSession({ refreshToken: "tok" });
    expect(result.revoked).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });

  it("refresh inconnu → idempotent", async () => {
    findUnique.mockResolvedValue(null);
    const result = await logoutMobileSession({ refreshToken: "unknown" });
    expect(result.revoked).toBe(false);
  });

  it("blacklist jti si access fourni", async () => {
    findUnique.mockResolvedValue(null);
    verifyAccessToken.mockResolvedValue({
      sub: "u1",
      jti: "jti-1",
      iat: 1,
      exp: Math.floor(Date.now() / 1000) + 600,
      type: "access",
    });
    blacklistAccessTokenJti.mockResolvedValue(true);

    await logoutMobileSession({
      refreshToken: "tok",
      accessToken: "access.jwt",
    });

    expect(blacklistAccessTokenJti).toHaveBeenCalledWith(
      "jti-1",
      expect.any(Number)
    );
  });
});
