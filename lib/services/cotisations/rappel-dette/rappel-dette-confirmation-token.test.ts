import { describe, expect, it } from "vitest";
import {
  RAPPEL_DETTE_CONFIRMATION_HMAC_SECRET_ENV,
  RAPPEL_DETTE_CONFIRMATION_TOKEN_USAGE,
  RAPPEL_DETTE_CONFIRMATION_TOKEN_VERSION,
  RAPPEL_DETTE_PREPARE_TTL_MS,
  signRappelDetteConfirmationToken,
  verifyRappelDetteConfirmationToken,
} from "@/lib/services/cotisations/rappel-dette/rappel-dette-confirmation-token";

const SECRET = "test-hmac-secret-lot3-prepare-only";
const ACTOR = "admin-user-1";
const NOW = new Date("2026-10-30T12:00:00.000Z");

function signOk(overrides?: Partial<Parameters<typeof signRappelDetteConfirmationToken>[0]>) {
  const r = signRappelDetteConfirmationToken({
    actorUserId: ACTOR,
    adherentId: "adh-1",
    fingerprint: "a".repeat(64),
    clientConfirmationId: "11111111-1111-4111-8111-111111111111",
    issuedAt: NOW,
    secret: SECRET,
    ...overrides,
  });
  expect(r.ok).toBe(true);
  if (!r.ok) throw new Error("sign failed");
  return r;
}

describe("rappel-dette-confirmation-token", () => {
  it("signe et vérifie un jeton valide (TTL 10 min)", () => {
    const signed = signOk();
    expect(signed.claims.expiresAt - signed.claims.issuedAt).toBe(
      RAPPEL_DETTE_PREPARE_TTL_MS
    );
    expect(signed.claims.v).toBe(RAPPEL_DETTE_CONFIRMATION_TOKEN_VERSION);
    expect(signed.claims.usage).toBe(RAPPEL_DETTE_CONFIRMATION_TOKEN_USAGE);
    expect(signed.claims).not.toHaveProperty("email");
    expect(signed.claims).not.toHaveProperty("recipientEmail");
    expect(signed.claims).not.toHaveProperty("secret");
    expect(JSON.stringify(signed.claims)).not.toMatch(/@example\.|apiKey|SMTP_PASS/i);

    const v = verifyRappelDetteConfirmationToken({
      token: signed.token,
      actorUserId: ACTOR,
      now: NOW,
      secret: SECRET,
    });
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.claims.adherentId).toBe("adh-1");
      expect(v.claims.fingerprint).toBe("a".repeat(64));
    }
  });

  it("refuse secret absent (pas de fallback)", () => {
    const prev = process.env[RAPPEL_DETTE_CONFIRMATION_HMAC_SECRET_ENV];
    delete process.env[RAPPEL_DETTE_CONFIRMATION_HMAC_SECRET_ENV];
    const signed = signRappelDetteConfirmationToken({
      actorUserId: ACTOR,
      adherentId: "adh-1",
      fingerprint: "fp",
      clientConfirmationId: "conf-1",
      issuedAt: NOW,
      secret: "",
    });
    expect(signed.ok).toBe(false);
    if (!signed.ok) {
      expect(signed.code).toBe("CONFIRMATION_SECRET_MISSING");
    }
    if (prev === undefined) {
      delete process.env[RAPPEL_DETTE_CONFIRMATION_HMAC_SECRET_ENV];
    } else {
      process.env[RAPPEL_DETTE_CONFIRMATION_HMAC_SECRET_ENV] = prev;
    }
  });

  it("refuse jeton altéré (signature)", () => {
    const signed = signOk();
    const parts = signed.token.split(".");
    const tampered = `${parts[0]}.${parts[1]}.${parts[2]!.replace(/A/g, "B")}`;
    const v = verifyRappelDetteConfirmationToken({
      token: tampered,
      actorUserId: ACTOR,
      now: NOW,
      secret: SECRET,
    });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.code).toBe("CONFIRMATION_TOKEN_INVALID");
  });

  it("refuse mauvais acteur", () => {
    const signed = signOk();
    const v = verifyRappelDetteConfirmationToken({
      token: signed.token,
      actorUserId: "other-admin",
      now: NOW,
      secret: SECRET,
    });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.code).toBe("CONFIRMATION_TOKEN_ACTOR_MISMATCH");
  });

  it("refuse expiration", () => {
    const signed = signOk();
    const v = verifyRappelDetteConfirmationToken({
      token: signed.token,
      actorUserId: ACTOR,
      now: new Date(NOW.getTime() + RAPPEL_DETTE_PREPARE_TTL_MS + 1),
      secret: SECRET,
    });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.code).toBe("CONFIRMATION_TOKEN_EXPIRED");
  });

  it("refuse émission future", () => {
    const signed = signOk();
    const v = verifyRappelDetteConfirmationToken({
      token: signed.token,
      actorUserId: ACTOR,
      now: new Date(NOW.getTime() - 60_000),
      secret: SECRET,
    });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.code).toBe("CONFIRMATION_TOKEN_NOT_YET_VALID");
  });

  it("refuse mauvaise version / usage / durée (HMAC valide mais claims KO)", async () => {
    const { createHmac } = await import("node:crypto");
    const b64url = (buf: Buffer) =>
      buf
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/g, "");

    const forge = (claims: Record<string, unknown>) => {
      const body = JSON.stringify(claims);
      const sig = createHmac("sha256", SECRET).update(body, "utf8").digest();
      return `rdc1.${b64url(Buffer.from(body, "utf8"))}.${b64url(sig)}`;
    };

    const base = {
      v: RAPPEL_DETTE_CONFIRMATION_TOKEN_VERSION,
      usage: RAPPEL_DETTE_CONFIRMATION_TOKEN_USAGE,
      actorUserId: ACTOR,
      adherentId: "adh-1",
      fingerprint: "a".repeat(64),
      templateVersion: "email-rappel-dette-v2",
      clientConfirmationId: "11111111-1111-4111-8111-111111111111",
      issuedAt: NOW.getTime(),
      expiresAt: NOW.getTime() + RAPPEL_DETTE_PREPARE_TTL_MS,
    };

    const badVersion = verifyRappelDetteConfirmationToken({
      token: forge({ ...base, v: 99 }),
      actorUserId: ACTOR,
      now: NOW,
      secret: SECRET,
    });
    expect(badVersion.ok).toBe(false);
    if (!badVersion.ok) {
      expect(badVersion.code).toBe("CONFIRMATION_TOKEN_VERSION_INVALID");
    }

    const badUsage = verifyRappelDetteConfirmationToken({
      token: forge({ ...base, usage: "other_usage" }),
      actorUserId: ACTOR,
      now: NOW,
      secret: SECRET,
    });
    expect(badUsage.ok).toBe(false);
    if (!badUsage.ok) {
      expect(badUsage.code).toBe("CONFIRMATION_TOKEN_USAGE_INVALID");
    }

    const badDuration = verifyRappelDetteConfirmationToken({
      token: forge({
        ...base,
        expiresAt: NOW.getTime() + RAPPEL_DETTE_PREPARE_TTL_MS + 1000,
      }),
      actorUserId: ACTOR,
      now: NOW,
      secret: SECRET,
    });
    expect(badDuration.ok).toBe(false);
    if (!badDuration.ok) {
      expect(badDuration.code).toBe("CONFIRMATION_TOKEN_DURATION_INVALID");
    }
  });

  it("refuse encodage invalide ou segments malformés (sans exception, sans claims)", () => {
    const cases = [
      "",
      "not-a-token",
      "rdc1",
      "rdc1.only-two",
      "rdc2.aaa.bbb",
      "rdc1.!!!invalid!!!.bbb",
      "rdc1.aaa.!!!invalid!!!",
      "rdc1..sig",
      "rdc1.payload.",
      "rdc1.payload.sig.extra",
    ];

    for (const token of cases) {
      let threw: unknown = null;
      let v: ReturnType<typeof verifyRappelDetteConfirmationToken> | undefined;
      try {
        v = verifyRappelDetteConfirmationToken({
          token,
          actorUserId: ACTOR,
          now: NOW,
          secret: SECRET,
        });
      } catch (e) {
        threw = e;
      }
      expect(threw).toBeNull();
      expect(v).toBeDefined();
      expect(v!.ok).toBe(false);
      if (!v!.ok) {
        expect(v.code).toBe("CONFIRMATION_TOKEN_INVALID");
        expect(v).not.toHaveProperty("claims");
      }
    }
  });

  it("refuse signature décodée de mauvaise longueur (sans exception, sans claims)", () => {
    const signed = signOk();
    const parts = signed.token.split(".");
    expect(parts).toHaveLength(3);

    const b64url = (buf: Buffer) =>
      buf
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/g, "");

    // HMAC-SHA256 = 32 octets ; signatures trop courte / trop longue
    const shortSig = b64url(Buffer.alloc(16, 0xab));
    const longSig = b64url(Buffer.alloc(64, 0xcd));

    for (const sigPart of [shortSig, longSig]) {
      const token = `${parts[0]}.${parts[1]}.${sigPart}`;
      let threw: unknown = null;
      let v: ReturnType<typeof verifyRappelDetteConfirmationToken> | undefined;
      try {
        v = verifyRappelDetteConfirmationToken({
          token,
          actorUserId: ACTOR,
          now: NOW,
          secret: SECRET,
        });
      } catch (e) {
        threw = e;
      }
      expect(threw).toBeNull();
      expect(v).toBeDefined();
      expect(v!.ok).toBe(false);
      if (!v!.ok) {
        expect(v.code).toBe("CONFIRMATION_TOKEN_INVALID");
        expect(v).not.toHaveProperty("claims");
      }
    }
  });
});
