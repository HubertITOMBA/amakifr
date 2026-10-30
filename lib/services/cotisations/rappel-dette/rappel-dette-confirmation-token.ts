/**
 * Jeton HMAC de préparation Lot 3 — intégrité prepare↔confirm.
 *
 * v2 : claim `gelsRevision` (chaîne décimale) — indépendant de l’empreinte financière.
 * v1 / usage v1 : **refusés** (ancienne version).
 *
 * Garantit l’intégrité des claims (pas la confidentialité ni l’usage unique).
 * Aucun email / secret applicatif dans le jeton ni dans les logs bornés.
 * Secret : `RAPPEL_DETTE_CONFIRMATION_HMAC_SECRET` uniquement — **aucun** fallback.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { parseGelsRevisionDecimal } from "@/lib/services/cotisations/rappel-dette/rappel-dette-gel-resolve";

/** TTL préparation (10 min) — distinct de `RAPPEL_DETTE_RESERVED_TTL_MS`. */
export const RAPPEL_DETTE_PREPARE_TTL_MS = 10 * 60 * 1000;

/** Version courante du jeton (gelsRevision obligatoire). */
export const RAPPEL_DETTE_CONFIRMATION_TOKEN_VERSION = 2 as const;

/** Ancienne version — refusée à la vérification. */
export const RAPPEL_DETTE_CONFIRMATION_TOKEN_VERSION_V1 = 1 as const;

export const RAPPEL_DETTE_CONFIRMATION_TOKEN_USAGE =
  "rappel_dette_prepare_v2" as const;

/** Usage v1 — refusé. */
export const RAPPEL_DETTE_CONFIRMATION_TOKEN_USAGE_V1 =
  "rappel_dette_prepare_v1" as const;

/**
 * Template figé dans le jeton — aligné sur
 * `RAPPEL_DETTE_ORCHESTRATE_TEMPLATE_V2` (pas d’import orchestrateur ici).
 */
export const RAPPEL_DETTE_CONFIRMATION_TEMPLATE_V2 =
  "email-rappel-dette-v2" as const;

/** Nom d’env serveur exclusif — pas de repli hardcodé. */
export const RAPPEL_DETTE_CONFIRMATION_HMAC_SECRET_ENV =
  "RAPPEL_DETTE_CONFIRMATION_HMAC_SECRET" as const;

export type RappelDetteConfirmationTokenClaims = {
  v: typeof RAPPEL_DETTE_CONFIRMATION_TOKEN_VERSION;
  usage: typeof RAPPEL_DETTE_CONFIRMATION_TOKEN_USAGE;
  actorUserId: string;
  adherentId: string;
  fingerprint: string;
  /** Révision gels — chaîne décimale (pas de Number). */
  gelsRevision: string;
  templateVersion: typeof RAPPEL_DETTE_CONFIRMATION_TEMPLATE_V2;
  clientConfirmationId: string;
  issuedAt: number;
  expiresAt: number;
};

export type SignConfirmationTokenInput = {
  actorUserId: string;
  adherentId: string;
  fingerprint: string;
  /** Révision gels sérialisée (décimal). */
  gelsRevision: string;
  clientConfirmationId: string;
  issuedAt: Date;
  /** Secret serveur injecté (tests) ; sinon lu depuis env. */
  secret?: string;
};

export type SignConfirmationTokenSuccess = {
  ok: true;
  token: string;
  claims: RappelDetteConfirmationTokenClaims;
};

export type SignConfirmationTokenFailure = {
  ok: false;
  code: "CONFIRMATION_SECRET_MISSING" | "VALIDATION_ERROR";
  message: string;
};

export type VerifyConfirmationTokenInput = {
  token: string;
  actorUserId: string;
  now?: Date;
  secret?: string;
};

export type VerifyConfirmationTokenSuccess = {
  ok: true;
  claims: RappelDetteConfirmationTokenClaims;
};

export type VerifyConfirmationTokenFailure = {
  ok: false;
  code:
    | "CONFIRMATION_SECRET_MISSING"
    | "CONFIRMATION_TOKEN_INVALID"
    | "CONFIRMATION_TOKEN_EXPIRED"
    | "CONFIRMATION_TOKEN_NOT_YET_VALID"
    | "CONFIRMATION_TOKEN_DURATION_INVALID"
    | "CONFIRMATION_TOKEN_ACTOR_MISMATCH"
    | "CONFIRMATION_TOKEN_USAGE_INVALID"
    | "CONFIRMATION_TOKEN_VERSION_INVALID";
  message: string;
};

/**
 * Lit le secret HMAC depuis l’environnement (ou injection tests).
 * Absence / vide → null (refus borné côté appelant).
 *
 * @param override - Injection tests uniquement
 */
export function readRappelDetteConfirmationHmacSecret(
  override?: string | null
): string | null {
  if (typeof override === "string") {
    const t = override.trim();
    return t.length > 0 ? t : null;
  }
  const fromEnv = String(
    process.env[RAPPEL_DETTE_CONFIRMATION_HMAC_SECRET_ENV] ?? ""
  ).trim();
  return fromEnv.length > 0 ? fromEnv : null;
}

function b64urlEncode(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function b64urlDecode(s: string): Buffer | null {
  if (!/^[A-Za-z0-9_-]+$/.test(s) || s.length === 0) return null;
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  try {
    return Buffer.from(b64, "base64");
  } catch {
    return null;
  }
}

/**
 * Sérialisation canonique des claims (ordre de clés fixe).
 * Pas d’email ni de secret.
 */
function serializeClaims(claims: RappelDetteConfirmationTokenClaims): string {
  return JSON.stringify({
    v: claims.v,
    usage: claims.usage,
    actorUserId: claims.actorUserId,
    adherentId: claims.adherentId,
    fingerprint: claims.fingerprint,
    gelsRevision: claims.gelsRevision,
    templateVersion: claims.templateVersion,
    clientConfirmationId: claims.clientConfirmationId,
    issuedAt: claims.issuedAt,
    expiresAt: claims.expiresAt,
  });
}

function hmacSha256(secret: string, body: string): Buffer {
  return createHmac("sha256", secret).update(body, "utf8").digest();
}

function safeEqualBuffers(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Signe un jeton de préparation v2 (HMAC-SHA256).
 *
 * @param input - Claims métier + horodatage d’émission
 */
export function signRappelDetteConfirmationToken(
  input: SignConfirmationTokenInput
): SignConfirmationTokenSuccess | SignConfirmationTokenFailure {
  const secret = readRappelDetteConfirmationHmacSecret(input.secret);
  if (!secret) {
    return {
      ok: false,
      code: "CONFIRMATION_SECRET_MISSING",
      message:
        "Secret de confirmation serveur indisponible — configuration requise.",
    };
  }

  const actorUserId = String(input.actorUserId ?? "").trim();
  const adherentId = String(input.adherentId ?? "").trim();
  const fingerprint = String(input.fingerprint ?? "").trim();
  const clientConfirmationId = String(input.clientConfirmationId ?? "").trim();
  const gelsRevisionRaw = String(input.gelsRevision ?? "").trim();

  if (!actorUserId || !adherentId || !fingerprint || !clientConfirmationId) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      message: "Claims de confirmation incomplets",
    };
  }
  if (fingerprint.length > 128 || clientConfirmationId.length > 64) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      message: "Claims de confirmation invalides",
    };
  }
  if (parseGelsRevisionDecimal(gelsRevisionRaw) === null) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      message: "Révision gels invalide",
    };
  }

  const issuedAt = input.issuedAt.getTime();
  if (!Number.isFinite(issuedAt)) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      message: "Horodatage d’émission invalide",
    };
  }

  const claims: RappelDetteConfirmationTokenClaims = {
    v: RAPPEL_DETTE_CONFIRMATION_TOKEN_VERSION,
    usage: RAPPEL_DETTE_CONFIRMATION_TOKEN_USAGE,
    actorUserId,
    adherentId,
    fingerprint,
    gelsRevision: gelsRevisionRaw,
    templateVersion: RAPPEL_DETTE_CONFIRMATION_TEMPLATE_V2,
    clientConfirmationId,
    issuedAt,
    expiresAt: issuedAt + RAPPEL_DETTE_PREPARE_TTL_MS,
  };

  const body = serializeClaims(claims);
  const sig = hmacSha256(secret, body);
  const token = `rdc1.${b64urlEncode(Buffer.from(body, "utf8"))}.${b64urlEncode(sig)}`;

  return { ok: true, token, claims };
}

/**
 * Vérifie signature et claims (acteur courant, TTL, durée exacte, v2).
 *
 * @param input - Jeton + actorUserId session
 */
export function verifyRappelDetteConfirmationToken(
  input: VerifyConfirmationTokenInput
): VerifyConfirmationTokenSuccess | VerifyConfirmationTokenFailure {
  const secret = readRappelDetteConfirmationHmacSecret(input.secret);
  if (!secret) {
    return {
      ok: false,
      code: "CONFIRMATION_SECRET_MISSING",
      message:
        "Secret de confirmation serveur indisponible — configuration requise.",
    };
  }

  const raw = String(input.token ?? "").trim();
  const parts = raw.split(".");
  if (parts.length !== 3 || parts[0] !== "rdc1") {
    return {
      ok: false,
      code: "CONFIRMATION_TOKEN_INVALID",
      message: "Jeton de confirmation invalide",
    };
  }

  const payloadBuf = b64urlDecode(parts[1]!);
  const sigBuf = b64urlDecode(parts[2]!);
  if (!payloadBuf || !sigBuf || sigBuf.length === 0) {
    return {
      ok: false,
      code: "CONFIRMATION_TOKEN_INVALID",
      message: "Jeton de confirmation invalide",
    };
  }

  const body = payloadBuf.toString("utf8");
  const expectedSig = hmacSha256(secret, body);
  if (!safeEqualBuffers(sigBuf, expectedSig)) {
    return {
      ok: false,
      code: "CONFIRMATION_TOKEN_INVALID",
      message: "Jeton de confirmation invalide",
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return {
      ok: false,
      code: "CONFIRMATION_TOKEN_INVALID",
      message: "Jeton de confirmation invalide",
    };
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return {
      ok: false,
      code: "CONFIRMATION_TOKEN_INVALID",
      message: "Jeton de confirmation invalide",
    };
  }

  const o = parsed as Record<string, unknown>;

  if (
    "email" in o ||
    "recipientEmail" in o ||
    "secret" in o ||
    "HMAC" in o ||
    "apiKey" in o
  ) {
    return {
      ok: false,
      code: "CONFIRMATION_TOKEN_INVALID",
      message: "Jeton de confirmation invalide",
    };
  }

  if (o.v === RAPPEL_DETTE_CONFIRMATION_TOKEN_VERSION_V1) {
    return {
      ok: false,
      code: "CONFIRMATION_TOKEN_VERSION_INVALID",
      message: "Version de jeton non supportée",
    };
  }
  if (o.v !== RAPPEL_DETTE_CONFIRMATION_TOKEN_VERSION) {
    return {
      ok: false,
      code: "CONFIRMATION_TOKEN_VERSION_INVALID",
      message: "Version de jeton non supportée",
    };
  }
  if (o.usage === RAPPEL_DETTE_CONFIRMATION_TOKEN_USAGE_V1) {
    return {
      ok: false,
      code: "CONFIRMATION_TOKEN_USAGE_INVALID",
      message: "Usage de jeton invalide",
    };
  }
  if (o.usage !== RAPPEL_DETTE_CONFIRMATION_TOKEN_USAGE) {
    return {
      ok: false,
      code: "CONFIRMATION_TOKEN_USAGE_INVALID",
      message: "Usage de jeton invalide",
    };
  }
  if (o.templateVersion !== RAPPEL_DETTE_CONFIRMATION_TEMPLATE_V2) {
    return {
      ok: false,
      code: "CONFIRMATION_TOKEN_INVALID",
      message: "Template de jeton invalide",
    };
  }

  const actorUserId = String(o.actorUserId ?? "").trim();
  const adherentId = String(o.adherentId ?? "").trim();
  const fingerprint = String(o.fingerprint ?? "").trim();
  const clientConfirmationId = String(o.clientConfirmationId ?? "").trim();
  const gelsRevisionRaw = String(o.gelsRevision ?? "").trim();
  const issuedAt = Number(o.issuedAt);
  const expiresAt = Number(o.expiresAt);

  if (
    !actorUserId ||
    !adherentId ||
    !fingerprint ||
    !clientConfirmationId ||
    !Number.isFinite(issuedAt) ||
    !Number.isFinite(expiresAt)
  ) {
    return {
      ok: false,
      code: "CONFIRMATION_TOKEN_INVALID",
      message: "Jeton de confirmation invalide",
    };
  }

  if (parseGelsRevisionDecimal(gelsRevisionRaw) === null) {
    return {
      ok: false,
      code: "CONFIRMATION_TOKEN_INVALID",
      message: "Jeton de confirmation invalide",
    };
  }

  const sessionActor = String(input.actorUserId ?? "").trim();
  if (!sessionActor || sessionActor !== actorUserId) {
    return {
      ok: false,
      code: "CONFIRMATION_TOKEN_ACTOR_MISMATCH",
      message: "Jeton de confirmation non lié à l’acteur courant",
    };
  }

  if (expiresAt - issuedAt !== RAPPEL_DETTE_PREPARE_TTL_MS) {
    return {
      ok: false,
      code: "CONFIRMATION_TOKEN_DURATION_INVALID",
      message: "Durée de validité du jeton incohérente",
    };
  }

  const nowMs = (input.now ?? new Date()).getTime();
  if (!Number.isFinite(nowMs)) {
    return {
      ok: false,
      code: "CONFIRMATION_TOKEN_INVALID",
      message: "Jeton de confirmation invalide",
    };
  }

  if (issuedAt > nowMs) {
    return {
      ok: false,
      code: "CONFIRMATION_TOKEN_NOT_YET_VALID",
      message: "Jeton de confirmation pas encore valide",
    };
  }

  if (expiresAt <= nowMs) {
    return {
      ok: false,
      code: "CONFIRMATION_TOKEN_EXPIRED",
      message: "Préparation expirée — nouvelle confirmation requise",
    };
  }

  const claims: RappelDetteConfirmationTokenClaims = {
    v: RAPPEL_DETTE_CONFIRMATION_TOKEN_VERSION,
    usage: RAPPEL_DETTE_CONFIRMATION_TOKEN_USAGE,
    actorUserId,
    adherentId,
    fingerprint,
    gelsRevision: gelsRevisionRaw,
    templateVersion: RAPPEL_DETTE_CONFIRMATION_TEMPLATE_V2,
    clientConfirmationId,
    issuedAt,
    expiresAt,
  };

  if (serializeClaims(claims) !== body) {
    return {
      ok: false,
      code: "CONFIRMATION_TOKEN_INVALID",
      message: "Jeton de confirmation invalide",
    };
  }

  return { ok: true, claims };
}
