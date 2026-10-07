import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { normalizeEmail } from "@/lib/utils";
import { hashPasswordResetRateLimitKey } from "@/lib/auth/password-reset-hmac";
import {
  PASSWORD_RESET_RL_CLEANUP_BATCH,
  PASSWORD_RESET_RL_COMBO_MAX,
  PASSWORD_RESET_RL_COMBO_WINDOW_MS,
  PASSWORD_RESET_RL_EMAIL_MAX,
  PASSWORD_RESET_RL_EMAIL_WINDOW_MS,
  PASSWORD_RESET_RL_IP_MAX,
  PASSWORD_RESET_RL_IP_WINDOW_MS,
  PASSWORD_RESET_TX_MAX_ATTEMPTS,
  type PasswordResetRateLimitOperation,
} from "@/lib/auth/password-reset-constants";

export type PasswordResetRateLimitResult =
  | { allowed: true }
  | { allowed: false; reason: "limited" | "db_error" };

type Scope = "IP" | "EMAIL" | "COMBINATION";

function isConcurrencyError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2034" || error.code === "P2002")
  );
}

/**
 * Incrément atomique d'une fenêtre rate-limit (INSERT … ON CONFLICT).
 * Jamais d'email/IP en clair — keyHash uniquement.
 *
 * @returns attempts après incrément
 */
async function incrWindowAtomic(
  keyHash: string,
  scope: Scope,
  max: number,
  windowMs: number
): Promise<"ok" | "limited"> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + windowMs);
  const id = randomUUID();

  for (let attempt = 1; attempt <= PASSWORD_RESET_TX_MAX_ATTEMPTS; attempt++) {
    try {
      const rows = await db.$queryRaw<Array<{ attempts: number }>>`
        INSERT INTO "password_reset_rate_limits" (
          "id", "keyHash", "scope", "windowStartedAt", "attempts", "expiresAt", "createdAt", "updatedAt"
        )
        VALUES (
          ${id},
          ${keyHash},
          ${scope}::"PasswordResetRateLimitScope",
          ${now},
          1,
          ${expiresAt},
          ${now},
          ${now}
        )
        ON CONFLICT ("keyHash") DO UPDATE SET
          "attempts" = CASE
            WHEN "password_reset_rate_limits"."expiresAt" <= ${now}
              THEN 1
            ELSE "password_reset_rate_limits"."attempts" + 1
          END,
          "windowStartedAt" = CASE
            WHEN "password_reset_rate_limits"."expiresAt" <= ${now}
              THEN ${now}
            ELSE "password_reset_rate_limits"."windowStartedAt"
          END,
          "expiresAt" = CASE
            WHEN "password_reset_rate_limits"."expiresAt" <= ${now}
              THEN ${expiresAt}
            ELSE "password_reset_rate_limits"."expiresAt"
          END,
          "updatedAt" = ${now}
        RETURNING "attempts"
      `;

      const attempts = rows[0]?.attempts ?? max + 1;
      return attempts <= max ? "ok" : "limited";
    } catch (error) {
      if (isConcurrencyError(error) && attempt < PASSWORD_RESET_TX_MAX_ATTEMPTS) {
        continue;
      }
      throw error;
    }
  }

  throw new Error("incrWindowAtomic: exhausted retries");
}

/**
 * Nettoyage opportuniste borné (pas de job obligatoire).
 * N'affiche jamais de PII.
 */
export async function cleanupExpiredPasswordResetRateLimits(): Promise<number> {
  try {
    const deleted = await db.$executeRaw`
      DELETE FROM "password_reset_rate_limits"
      WHERE "id" IN (
        SELECT "id" FROM "password_reset_rate_limits"
        WHERE "expiresAt" < NOW()
        ORDER BY "expiresAt" ASC
        LIMIT ${PASSWORD_RESET_RL_CLEANUP_BATCH}
      )
    `;
    return typeof deleted === "number" ? deleted : 0;
  } catch {
    console.error("[password-reset] rate_limit_cleanup_failed", {
      category: "db",
    });
    return 0;
  }
}

/**
 * Rate-limit PostgreSQL pour password-reset.
 * Trois scopes (IP / EMAIL / COMBINATION) × opération (REQUEST | CONFIRM).
 * keyHash HMAC inclut l'opération — quotas indépendants request/confirm.
 * Compte aussi lorsque le compte n'existe pas.
 * Fail-closed sur erreur DB.
 *
 * @param operation - PASSWORD_RESET_REQUEST ou PASSWORD_RESET_CONFIRM
 * @param ip - IP déjà résolue (politique TRUST_PROXY / X-Real-IP)
 * @param emailRaw - Email brut (normalisé ici pour la clé HMAC uniquement)
 */
export async function enforcePasswordResetRateLimits(
  operation: PasswordResetRateLimitOperation,
  ip: string,
  emailRaw: string
): Promise<PasswordResetRateLimitResult> {
  const email = normalizeEmail(emailRaw);
  const safeIp = ip.trim() || "unknown";

  try {
    const ipKey = hashPasswordResetRateLimitKey(operation, "ip", safeIp);
    const emailKey = hashPasswordResetRateLimitKey(
      operation,
      "email",
      email || "empty"
    );
    const comboKey = hashPasswordResetRateLimitKey(
      operation,
      "combo",
      `${safeIp}|${email || "empty"}`
    );

    const ipRes = await incrWindowAtomic(
      ipKey,
      "IP",
      PASSWORD_RESET_RL_IP_MAX,
      PASSWORD_RESET_RL_IP_WINDOW_MS
    );
    if (ipRes === "limited") {
      void cleanupExpiredPasswordResetRateLimits();
      return { allowed: false, reason: "limited" };
    }

    const emailRes = await incrWindowAtomic(
      emailKey,
      "EMAIL",
      PASSWORD_RESET_RL_EMAIL_MAX,
      PASSWORD_RESET_RL_EMAIL_WINDOW_MS
    );
    if (emailRes === "limited") {
      void cleanupExpiredPasswordResetRateLimits();
      return { allowed: false, reason: "limited" };
    }

    const comboRes = await incrWindowAtomic(
      comboKey,
      "COMBINATION",
      PASSWORD_RESET_RL_COMBO_MAX,
      PASSWORD_RESET_RL_COMBO_WINDOW_MS
    );
    if (comboRes === "limited") {
      void cleanupExpiredPasswordResetRateLimits();
      return { allowed: false, reason: "limited" };
    }

    void cleanupExpiredPasswordResetRateLimits();
    return { allowed: true };
  } catch {
    console.error("[password-reset] rate_limit_db_error", {
      category: "db",
    });
    return { allowed: false, reason: "db_error" };
  }
}
