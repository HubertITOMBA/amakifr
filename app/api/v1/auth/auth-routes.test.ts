import { beforeEach, describe, expect, it, vi } from "vitest";
import { ServiceError } from "@/lib/service-error";

const {
  authenticateCredentials,
  createMobileSession,
  rotateMobileRefreshSession,
  logoutMobileSession,
  checkRateLimit,
} = vi.hoisted(() => ({
  authenticateCredentials: vi.fn(),
  createMobileSession: vi.fn(),
  rotateMobileRefreshSession: vi.fn(),
  logoutMobileSession: vi.fn(),
  checkRateLimit: vi.fn(),
}));

vi.mock("@/lib/services/auth/authenticate-credentials", () => ({
  authenticateCredentials,
}));
vi.mock("@/lib/services/auth/create-mobile-session", () => ({
  createMobileSession,
}));
vi.mock("@/lib/services/auth/rotate-mobile-refresh-session", () => ({
  rotateMobileRefreshSession,
}));
vi.mock("@/lib/services/auth/logout-mobile-session", () => ({
  logoutMobileSession,
}));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit,
}));

import { POST as loginPost } from "@/app/api/v1/auth/login/route";
import { POST as refreshPost } from "@/app/api/v1/auth/refresh/route";
import { POST as logoutPost } from "@/app/api/v1/auth/logout/route";

function jsonReq(url: string, body: unknown, headers?: Record<string, string>) {
  return new Request(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  }) as any;
}

describe("POST /api/v1/auth/login", () => {
  beforeEach(() => {
    authenticateCredentials.mockReset();
    createMobileSession.mockReset();
    checkRateLimit.mockReset();
    checkRateLimit.mockResolvedValue({ allowed: true, remaining: 9, resetTime: Date.now() });
  });

  it("body invalide", async () => {
    const res = await loginPost(jsonReq("http://localhost/api/v1/auth/login", { foo: 1 }));
    expect(res.status).toBe(400);
  });

  it("email invalide", async () => {
    const res = await loginPost(
      jsonReq("http://localhost/api/v1/auth/login", {
        email: "not-an-email",
        password: "x",
      })
    );
    expect(res.status).toBe(400);
    expect(authenticateCredentials).not.toHaveBeenCalled();
  });

  it("auth failure", async () => {
    authenticateCredentials.mockRejectedValue(
      new ServiceError("UNAUTHENTICATED", "Identifiants invalides")
    );
    const res = await loginPost(
      jsonReq("http://localhost/api/v1/auth/login", {
        email: "a@b.com",
        password: "bad",
      })
    );
    expect(res.status).toBe(401);
  });

  it("succès — tokens distincts, expirations, pas de hash/password", async () => {
    authenticateCredentials.mockResolvedValue({
      id: "u1",
      name: "Ada",
      email: "a@b.com",
      role: "MEMBRE",
      status: "Actif",
    });
    createMobileSession.mockResolvedValue({
      accessToken: "access-token-value",
      refreshToken: "refresh-token-value",
      accessTokenExpiresAt: "2030-01-01T00:15:00.000Z",
      refreshTokenExpiresAt: "2030-01-31T00:00:00.000Z",
      user: {
        id: "u1",
        name: "Ada",
        email: "a@b.com",
        role: "MEMBRE",
        status: "Actif",
      },
    });

    const res = await loginPost(
      jsonReq("http://localhost/api/v1/auth/login", {
        email: "a@b.com",
        password: "ok",
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.accessToken).toBeTruthy();
    expect(body.data.refreshToken).toBeTruthy();
    expect(body.data.accessToken).not.toBe(body.data.refreshToken);
    expect(body.data.accessTokenExpiresAt).toBeTruthy();
    expect(body.data.refreshTokenExpiresAt).toBeTruthy();
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain("password");
    expect(serialized).not.toContain("refreshTokenHash");
  });
});

describe("POST /api/v1/auth/refresh", () => {
  beforeEach(() => {
    rotateMobileRefreshSession.mockReset();
    checkRateLimit.mockReset();
    checkRateLimit.mockResolvedValue({
      allowed: true,
      remaining: 29,
      resetTime: Date.now(),
    });
  });

  it("invalide body — pas de rotation", async () => {
    const res = await refreshPost(
      jsonReq("http://localhost/api/v1/auth/refresh", {})
    );
    expect(res.status).toBe(400);
    expect(rotateMobileRefreshSession).not.toHaveBeenCalled();
  });

  it("inconnu", async () => {
    rotateMobileRefreshSession.mockRejectedValue(
      new ServiceError("UNAUTHENTICATED", "Session invalide")
    );
    const res = await refreshPost(
      jsonReq("http://localhost/api/v1/auth/refresh", {
        refreshToken: "unknown",
      })
    );
    expect(res.status).toBe(401);
  });

  it("succès rotation quand rate-limit allowed", async () => {
    rotateMobileRefreshSession.mockResolvedValue({
      accessToken: "a2",
      refreshToken: "r2",
      accessTokenExpiresAt: "2030-01-01T00:15:00.000Z",
      refreshTokenExpiresAt: "2030-02-01T00:00:00.000Z",
      user: {
        id: "u1",
        name: "Ada",
        email: "a@b.com",
        role: "MEMBRE",
        status: "Actif",
      },
    });
    const res = await refreshPost(
      jsonReq("http://localhost/api/v1/auth/refresh", {
        refreshToken: "r1-secret-refresh-token-value",
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.refreshToken).toBe("r2");
    expect(body.data.accessToken).toBe("a2");
    expect(rotateMobileRefreshSession).toHaveBeenCalled();
    expect(checkRateLimit).toHaveBeenCalled();
    const rateKey = checkRateLimit.mock.calls[0][0] as string;
    expect(rateKey).toMatch(/^mobile-refresh:/);
    expect(rateKey).not.toContain("r1-secret-refresh-token-value");
  });

  it("rate-limit denied → 429, rotation NON appelée", async () => {
    checkRateLimit.mockResolvedValue({
      allowed: false,
      remaining: 0,
      resetTime: Date.now() + 1000,
    });
    const res = await refreshPost(
      jsonReq("http://localhost/api/v1/auth/refresh", {
        refreshToken: "r1-secret-refresh-token-value",
      })
    );
    expect(res.status).toBe(429);
    expect(rotateMobileRefreshSession).not.toHaveBeenCalled();
  });
});

describe("POST /api/v1/auth/logout", () => {
  beforeEach(() => {
    logoutMobileSession.mockReset();
  });

  it("succès sans Authorization + refreshToken", async () => {
    logoutMobileSession.mockResolvedValue({ revoked: true });
    const res = await logoutPost(
      jsonReq("http://localhost/api/v1/auth/logout", {
        refreshToken: "r1",
      })
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      success: true,
      data: { revoked: true },
    });
    expect(logoutMobileSession).toHaveBeenCalledWith({
      refreshToken: "r1",
      accessToken: null,
    });
  });

  it("idempotence refresh inconnu", async () => {
    logoutMobileSession.mockResolvedValue({ revoked: false });
    const res = await logoutPost(
      jsonReq("http://localhost/api/v1/auth/logout", {
        refreshToken: "unknown",
      })
    );
    expect(res.status).toBe(200);
  });

  it("Authorization: Basic → 401, service non appelé", async () => {
    const res = await logoutPost(
      jsonReq(
        "http://localhost/api/v1/auth/logout",
        { refreshToken: "r1" },
        { Authorization: "Basic abc" }
      )
    );
    expect(res.status).toBe(401);
    expect(logoutMobileSession).not.toHaveBeenCalled();
  });

  it("Authorization: Bearer vide → 401", async () => {
    const res = await logoutPost(
      jsonReq(
        "http://localhost/api/v1/auth/logout",
        { refreshToken: "r1" },
        { Authorization: "Bearer " }
      )
    );
    expect(res.status).toBe(401);
    expect(logoutMobileSession).not.toHaveBeenCalled();
  });

  it("Bearer malformé + refreshToken valide → 401, service non appelé", async () => {
    const res = await logoutPost(
      jsonReq(
        "http://localhost/api/v1/auth/logout",
        { refreshToken: "valid-refresh" },
        { Authorization: "Bearer" }
      )
    );
    expect(res.status).toBe(401);
    expect(logoutMobileSession).not.toHaveBeenCalled();
  });

  it("Bearer syntaxiquement valide + refreshToken → service appelé", async () => {
    logoutMobileSession.mockResolvedValue({ revoked: true });
    const res = await logoutPost(
      jsonReq(
        "http://localhost/api/v1/auth/logout",
        { refreshToken: "r1" },
        { Authorization: "Bearer access.jwt.token" }
      )
    );
    expect(res.status).toBe(200);
    expect(logoutMobileSession).toHaveBeenCalledWith({
      refreshToken: "r1",
      accessToken: "access.jwt.token",
    });
  });
});
