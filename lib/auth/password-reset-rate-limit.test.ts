import { beforeEach, describe, expect, it, vi } from "vitest";

const { queryRaw, executeRaw } = vi.hoisted(() => ({
  queryRaw: vi.fn(),
  executeRaw: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    $queryRaw: queryRaw,
    $executeRaw: executeRaw,
  },
}));

const hashedKeys: string[] = [];

vi.mock("@/lib/auth/password-reset-hmac", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/auth/password-reset-hmac")>();
  let n = 0;
  return {
    ...actual,
    // Hash opaque (comme en prod) — jamais l'IP/email en clair dans keyHash
    hashPasswordResetRateLimitKey: (
      operation: string,
      kind: string,
      _material: string
    ) => {
      const key = `opaque-${operation}-${kind}-${++n}`;
      hashedKeys.push(key);
      return key;
    },
  };
});

import { enforcePasswordResetRateLimits } from "@/lib/auth/password-reset-rate-limit";
import {
  PASSWORD_RESET_RL_COMBO_MAX,
  PASSWORD_RESET_RL_EMAIL_MAX,
  PASSWORD_RESET_RL_IP_MAX,
  PASSWORD_RESET_RL_OP_CONFIRM,
  PASSWORD_RESET_RL_OP_REQUEST,
} from "@/lib/auth/password-reset-constants";

describe("enforcePasswordResetRateLimits (PostgreSQL)", () => {
  beforeEach(() => {
    vi.stubEnv(
      "PASSWORD_RESET_HMAC_SECRET",
      "test-password-reset-hmac-secret-32b!!"
    );
    queryRaw.mockReset();
    executeRaw.mockReset();
    executeRaw.mockResolvedValue(0);
    hashedKeys.length = 0;
  });

  it("autorise sous les plafonds — clés HMAC sans email/IP en clair dans SQL args", async () => {
    queryRaw.mockResolvedValue([{ attempts: 1 }]);
    const res = await enforcePasswordResetRateLimits(
      PASSWORD_RESET_RL_OP_REQUEST,
      "1.2.3.4",
      "A@B.com"
    );
    expect(res).toEqual({ allowed: true });
    expect(queryRaw).toHaveBeenCalledTimes(3);
    const serialized = JSON.stringify(queryRaw.mock.calls);
    expect(serialized).not.toMatch(/A@B\.com/);
    expect(serialized).not.toMatch(/1\.2\.3\.4/);
    expect(serialized).toMatch(/opaque-PASSWORD_RESET_REQUEST-ip-/);
    expect(serialized).toMatch(/opaque-PASSWORD_RESET_REQUEST-email-/);
    expect(serialized).toMatch(/opaque-PASSWORD_RESET_REQUEST-combo-/);
  });

  it("sépare request et confirm (domaines HMAC distincts)", async () => {
    queryRaw.mockResolvedValue([{ attempts: 1 }]);
    await enforcePasswordResetRateLimits(
      PASSWORD_RESET_RL_OP_REQUEST,
      "1.1.1.1",
      "a@b.com"
    );
    const requestKeys = [...hashedKeys];
    hashedKeys.length = 0;
    await enforcePasswordResetRateLimits(
      PASSWORD_RESET_RL_OP_CONFIRM,
      "1.1.1.1",
      "a@b.com"
    );
    const confirmKeys = [...hashedKeys];
    expect(requestKeys.some((k) => k.includes("PASSWORD_RESET_REQUEST"))).toBe(
      true
    );
    expect(confirmKeys.some((k) => k.includes("PASSWORD_RESET_CONFIRM"))).toBe(
      true
    );
    // Aucune clé partagée entre opérations
    for (const k of requestKeys) {
      expect(confirmKeys).not.toContain(k);
    }
  });

  it("indépendance : request saturée n'empêche pas confirm (clés distinctes)", async () => {
    // REQUEST IP saturée
    queryRaw.mockResolvedValueOnce([
      { attempts: PASSWORD_RESET_RL_IP_MAX + 1 },
    ]);
    expect(
      await enforcePasswordResetRateLimits(
        PASSWORD_RESET_RL_OP_REQUEST,
        "9.9.9.9",
        "x@y.fr"
      )
    ).toEqual({ allowed: false, reason: "limited" });

    // CONFIRM sur même IP/email — compteurs indépendants
    queryRaw.mockReset();
    queryRaw.mockResolvedValue([{ attempts: 1 }]);
    expect(
      await enforcePasswordResetRateLimits(
        PASSWORD_RESET_RL_OP_CONFIRM,
        "9.9.9.9",
        "x@y.fr"
      )
    ).toEqual({ allowed: true });
    expect(queryRaw).toHaveBeenCalledTimes(3);
  });

  it("off-by-one exact IP : max autorisé, max+1 refusé", async () => {
    queryRaw
      .mockResolvedValueOnce([{ attempts: PASSWORD_RESET_RL_IP_MAX }])
      .mockResolvedValueOnce([{ attempts: 1 }])
      .mockResolvedValueOnce([{ attempts: 1 }]);
    expect(
      await enforcePasswordResetRateLimits(
        PASSWORD_RESET_RL_OP_REQUEST,
        "1.1.1.1",
        "a@b.com"
      )
    ).toEqual({ allowed: true });

    queryRaw.mockReset();
    queryRaw.mockResolvedValueOnce([
      { attempts: PASSWORD_RESET_RL_IP_MAX + 1 },
    ]);
    expect(
      await enforcePasswordResetRateLimits(
        PASSWORD_RESET_RL_OP_REQUEST,
        "1.1.1.1",
        "a@b.com"
      )
    ).toEqual({ allowed: false, reason: "limited" });
  });

  it("off-by-one exact EMAIL et COMBINATION", async () => {
    queryRaw
      .mockResolvedValueOnce([{ attempts: 1 }])
      .mockResolvedValueOnce([{ attempts: PASSWORD_RESET_RL_EMAIL_MAX }])
      .mockResolvedValueOnce([{ attempts: 1 }]);
    expect(
      await enforcePasswordResetRateLimits(
        PASSWORD_RESET_RL_OP_CONFIRM,
        "1.1.1.1",
        "a@b.com"
      )
    ).toEqual({ allowed: true });

    queryRaw.mockReset();
    queryRaw
      .mockResolvedValueOnce([{ attempts: 1 }])
      .mockResolvedValueOnce([{ attempts: PASSWORD_RESET_RL_EMAIL_MAX + 1 }]);
    expect(
      await enforcePasswordResetRateLimits(
        PASSWORD_RESET_RL_OP_CONFIRM,
        "1.1.1.1",
        "a@b.com"
      )
    ).toEqual({ allowed: false, reason: "limited" });

    queryRaw.mockReset();
    queryRaw
      .mockResolvedValueOnce([{ attempts: 1 }])
      .mockResolvedValueOnce([{ attempts: 1 }])
      .mockResolvedValueOnce([{ attempts: PASSWORD_RESET_RL_COMBO_MAX }]);
    expect(
      await enforcePasswordResetRateLimits(
        PASSWORD_RESET_RL_OP_CONFIRM,
        "1.1.1.1",
        "a@b.com"
      )
    ).toEqual({ allowed: true });

    queryRaw.mockReset();
    queryRaw
      .mockResolvedValueOnce([{ attempts: 1 }])
      .mockResolvedValueOnce([{ attempts: 1 }])
      .mockResolvedValueOnce([{ attempts: PASSWORD_RESET_RL_COMBO_MAX + 1 }]);
    expect(
      await enforcePasswordResetRateLimits(
        PASSWORD_RESET_RL_OP_CONFIRM,
        "1.1.1.1",
        "a@b.com"
      )
    ).toEqual({ allowed: false, reason: "limited" });
  });

  it("limites concurrentes par opération (request et confirm en parallèle)", async () => {
    queryRaw.mockResolvedValue([{ attempts: 1 }]);
    const [a, b] = await Promise.all([
      enforcePasswordResetRateLimits(
        PASSWORD_RESET_RL_OP_REQUEST,
        "2.2.2.2",
        "p@q.fr"
      ),
      enforcePasswordResetRateLimits(
        PASSWORD_RESET_RL_OP_CONFIRM,
        "2.2.2.2",
        "p@q.fr"
      ),
    ]);
    expect(a).toEqual({ allowed: true });
    expect(b).toEqual({ allowed: true });
    expect(queryRaw).toHaveBeenCalledTimes(6);
    expect(hashedKeys.filter((k) => k.includes("REQUEST")).length).toBe(3);
    expect(hashedKeys.filter((k) => k.includes("CONFIRM")).length).toBe(3);
  });

  it("compte aussi pour un email sans compte (mêmes clés op)", async () => {
    queryRaw.mockResolvedValue([{ attempts: 2 }]);
    const a = await enforcePasswordResetRateLimits(
      PASSWORD_RESET_RL_OP_REQUEST,
      "9.9.9.9",
      "nobody@x.fr"
    );
    const b = await enforcePasswordResetRateLimits(
      PASSWORD_RESET_RL_OP_REQUEST,
      "9.9.9.9",
      "nobody@x.fr"
    );
    expect(a.allowed).toBe(true);
    expect(b.allowed).toBe(true);
    expect(queryRaw).toHaveBeenCalledTimes(6);
  });

  it("fail-closed sur erreur DB", async () => {
    queryRaw.mockRejectedValue(new Error("db down"));
    const res = await enforcePasswordResetRateLimits(
      PASSWORD_RESET_RL_OP_REQUEST,
      "1.1.1.1",
      "a@b.com"
    );
    expect(res).toEqual({ allowed: false, reason: "db_error" });
  });

  it("requête SQL atomique ON CONFLICT / expiresAt", async () => {
    queryRaw.mockResolvedValue([{ attempts: 1 }]);
    await enforcePasswordResetRateLimits(
      PASSWORD_RESET_RL_OP_REQUEST,
      "1.1.1.1",
      "a@b.com"
    );
    const sqlObj = queryRaw.mock.calls[0]?.[0] as {
      strings?: readonly string[];
    };
    const sqlText = Array.isArray(sqlObj?.strings)
      ? sqlObj.strings.join("?")
      : JSON.stringify(queryRaw.mock.calls[0]);
    expect(sqlText).toMatch(/ON CONFLICT/);
    expect(sqlText).toMatch(/expiresAt/);
  });
});
