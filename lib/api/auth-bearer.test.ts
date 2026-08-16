import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  findUnique,
  verifyAccessToken,
  isTokenBlacklisted,
  resolveWeb,
} = vi.hoisted(() => ({
  findUnique: vi.fn(),
  verifyAccessToken: vi.fn(),
  isTokenBlacklisted: vi.fn(),
  resolveWeb: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: { user: { findUnique } },
}));

vi.mock("@/lib/auth-mobile/access-token", () => ({
  verifyAccessToken,
}));

vi.mock("@/lib/session-tracker", () => ({
  isTokenBlacklisted,
}));

vi.mock("@/lib/api/auth-web", () => ({
  resolveApiActorFromWebSession: resolveWeb,
}));

import {
  extractBearerToken,
  resolveApiActorFromBearer,
} from "@/lib/api/auth-bearer";
import { resolveApiActor } from "@/lib/api/auth-resolve";
import { ServiceError } from "@/lib/service-error";

describe("extractBearerToken", () => {
  it("Authorization absent → null", () => {
    expect(extractBearerToken(null)).toBeNull();
    expect(extractBearerToken("")).toBeNull();
  });

  it("mauvais scheme → UNAUTHENTICATED", () => {
    expect(() => extractBearerToken("Basic abc")).toThrow(ServiceError);
  });

  it("Bearer vide → UNAUTHENTICATED", () => {
    expect(() => extractBearerToken("Bearer ")).toThrow(ServiceError);
    expect(() => extractBearerToken("Bearer")).toThrow(ServiceError);
  });

  it("Bearer valide → token", () => {
    expect(extractBearerToken("Bearer tok123")).toBe("tok123");
  });
});

describe("resolveApiActorFromBearer", () => {
  beforeEach(() => {
    findUnique.mockReset();
    verifyAccessToken.mockReset();
    isTokenBlacklisted.mockReset();
  });

  it("no_bearer si Authorization absent", async () => {
    const req = new Request("http://localhost/api/v1/me");
    const result = await resolveApiActorFromBearer(req);
    expect(result).toEqual({ kind: "no_bearer" });
  });

  it("JWT invalide → throw", async () => {
    verifyAccessToken.mockRejectedValue(
      new ServiceError("UNAUTHENTICATED", "Token d'accès invalide")
    );
    const req = new Request("http://localhost", {
      headers: { Authorization: "Bearer bad" },
    });
    await expect(resolveApiActorFromBearer(req)).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
    });
  });

  it("blacklist → UNAUTHENTICATED", async () => {
    verifyAccessToken.mockResolvedValue({
      sub: "u1",
      jti: "jti-1",
      iat: 1,
      exp: 9999999999,
      type: "access",
    });
    isTokenBlacklisted.mockResolvedValue(true);
    const req = new Request("http://localhost", {
      headers: { Authorization: "Bearer tok" },
    });
    await expect(resolveApiActorFromBearer(req)).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
    });
  });

  it("User inexistant → UNAUTHENTICATED", async () => {
    verifyAccessToken.mockResolvedValue({
      sub: "u1",
      jti: "jti-1",
      iat: 1,
      exp: 9999999999,
      type: "access",
    });
    isTokenBlacklisted.mockResolvedValue(false);
    findUnique.mockResolvedValue(null);
    const req = new Request("http://localhost", {
      headers: { Authorization: "Bearer tok" },
    });
    await expect(resolveApiActorFromBearer(req)).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
    });
  });

  it("Inactif → FORBIDDEN", async () => {
    verifyAccessToken.mockResolvedValue({
      sub: "u1",
      jti: "jti-1",
      iat: 1,
      exp: 9999999999,
      type: "access",
    });
    isTokenBlacklisted.mockResolvedValue(false);
    findUnique.mockResolvedValue({
      id: "u1",
      name: "A",
      email: "a@b.com",
      role: "MEMBRE",
      status: "Inactif",
      emailVerified: new Date(),
    });
    const req = new Request("http://localhost", {
      headers: { Authorization: "Bearer tok" },
    });
    await expect(resolveApiActorFromBearer(req)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("succès — role/status DB, channel mobile", async () => {
    verifyAccessToken.mockResolvedValue({
      sub: "u1",
      jti: "jti-abc",
      iat: 1,
      exp: 9999999999,
      type: "access",
    });
    isTokenBlacklisted.mockResolvedValue(false);
    findUnique.mockResolvedValue({
      id: "u1",
      name: "Ada",
      email: "ada@example.com",
      role: "admin",
      status: "Actif",
      emailVerified: new Date(),
    });
    const req = new Request("http://localhost", {
      headers: { Authorization: "Bearer tok" },
    });
    const result = await resolveApiActorFromBearer(req);
    expect(result.kind).toBe("actor");
    if (result.kind === "actor") {
      expect(result.actor).toMatchObject({
        userId: "u1",
        role: "ADMIN",
        status: "Actif",
        sessionId: "jti-abc",
        channel: "mobile",
        adminRoles: [],
        adherentId: null,
      });
    }
  });
});

describe("resolveApiActor — no downgrade", () => {
  beforeEach(() => {
    findUnique.mockReset();
    verifyAccessToken.mockReset();
    isTokenBlacklisted.mockReset();
    resolveWeb.mockReset();
  });

  it("Bearer INVALID + session Web valide → 401, Web non appelé", async () => {
    verifyAccessToken.mockRejectedValue(
      new ServiceError("UNAUTHENTICATED", "Token d'accès invalide")
    );
    resolveWeb.mockResolvedValue({
      userId: "web-user",
      role: "MEMBRE",
      status: "Actif",
      channel: "web",
      adminRoles: [],
      adherentId: null,
    });

    const req = new Request("http://localhost/api/v1/me", {
      headers: { Authorization: "Bearer INVALID" },
    });

    await expect(resolveApiActor(req)).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
    });
    expect(resolveWeb).not.toHaveBeenCalled();
  });

  it("sans Authorization → Web", async () => {
    resolveWeb.mockResolvedValue({
      userId: "web-user",
      role: "MEMBRE",
      status: "Actif",
      channel: "web",
      adminRoles: [],
      adherentId: null,
    });
    const req = new Request("http://localhost/api/v1/me");
    const actor = await resolveApiActor(req);
    expect(actor?.userId).toBe("web-user");
    expect(resolveWeb).toHaveBeenCalled();
  });
});
