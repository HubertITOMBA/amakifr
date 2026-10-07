import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { normalizeEmail } from "@/lib/utils";
import {
  PASSWORD_RESET_COOLDOWN_MS,
  PASSWORD_RESET_TTL_MS,
  PASSWORD_RESET_TX_MAX_ATTEMPTS,
} from "@/lib/auth/password-reset-constants";
import {
  generatePasswordResetCode,
  hashPasswordResetCode,
  passwordResetHashesEqual,
} from "@/lib/auth/password-reset-hmac";
import {
  buildPasswordResetRequestPublic,
  type PasswordResetRequestPublic,
} from "@/lib/auth/password-reset-messages";
import { sendPasswordResetCodeEmail } from "@/lib/mail";
import { PASSWORD_RESET_RL_OP_REQUEST } from "@/lib/auth/password-reset-constants";
import { enforcePasswordResetRateLimits } from "@/lib/auth/password-reset-rate-limit";

function isConcurrencyError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2034" || error.code === "P2002")
  );
}

function cooldownRemainingSeconds(lastRequestAt: Date): number {
  const ageMs = Date.now() - lastRequestAt.getTime();
  if (ageMs < 0) return Math.ceil(PASSWORD_RESET_COOLDOWN_MS / 1000);
  const left = PASSWORD_RESET_COOLDOWN_MS - ageMs;
  return left > 0 ? Math.ceil(left / 1000) : 0;
}

type PreparedChallenge = {
  email: string;
  plaintextCode: string;
  codeHash: string;
  expires: Date;
  /** true si un challenge ACTIVE utilisable existait (pending dédié seulement) */
  hadActiveChallenge: boolean;
};

/**
 * Prépare un challenge.
 * - Si ACTIVE utilisable : écrit uniquement pendingCodeHash/pendingExpires/lastRequestAt
 *   (ne touche pas codeHash, expires, createdAt, failedAttempts, lockedAt, status).
 * - Sinon : upsert PENDING avec codeHash (non consommable tant que status ≠ ACTIVE).
 */
async function prepareChallenge(
  normalizedEmail: string
): Promise<
  | { kind: "cooldown"; retryAfter: number }
  | { kind: "prepared"; challenge: PreparedChallenge }
> {
  for (let attempt = 1; attempt <= PASSWORD_RESET_TX_MAX_ATTEMPTS; attempt++) {
    try {
      return await db.$transaction(
        async (tx) => {
          const existing = await tx.passwordResetToken.findUnique({
            where: { email: normalizedEmail },
          });

          if (existing) {
            const remaining = cooldownRemainingSeconds(existing.lastRequestAt);
            if (remaining > 0) {
              return { kind: "cooldown" as const, retryAfter: remaining };
            }
          }

          const plaintextCode = generatePasswordResetCode();
          const codeHash = hashPasswordResetCode(plaintextCode);
          const now = new Date();
          const expires = new Date(now.getTime() + PASSWORD_RESET_TTL_MS);
          const hadActiveChallenge =
            !!existing &&
            existing.status === "ACTIVE" &&
            existing.expires > now &&
            existing.lockedAt == null;

          if (existing) {
            if (hadActiveChallenge) {
              await tx.passwordResetToken.update({
                where: { email: normalizedEmail },
                data: {
                  pendingCodeHash: codeHash,
                  pendingExpires: expires,
                  lastRequestAt: now,
                },
              });
            } else {
              await tx.passwordResetToken.update({
                where: { email: normalizedEmail },
                data: {
                  codeHash,
                  pendingCodeHash: null,
                  pendingExpires: null,
                  status: "PENDING",
                  createdAt: now,
                  lastRequestAt: now,
                  expires,
                  failedAttempts: 0,
                  lockedAt: null,
                },
              });
            }
          } else {
            await tx.passwordResetToken.create({
              data: {
                email: normalizedEmail,
                codeHash,
                pendingCodeHash: null,
                pendingExpires: null,
                status: "PENDING",
                createdAt: now,
                lastRequestAt: now,
                expires,
                failedAttempts: 0,
                lockedAt: null,
              },
            });
          }

          return {
            kind: "prepared" as const,
            challenge: {
              email: normalizedEmail,
              plaintextCode,
              codeHash,
              expires,
              hadActiveChallenge,
            },
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );
    } catch (error) {
      if (isConcurrencyError(error) && attempt < PASSWORD_RESET_TX_MAX_ATTEMPTS) {
        continue;
      }
      console.error("[password-reset] prepare_challenge_failed", {
        category: "concurrency_or_db",
        attempt,
      });
      throw error;
    }
  }

  throw new Error("prepareChallenge: exhausted retries");
}

/**
 * Activation atomique après succès provider.
 * PENDING → ACTIVE, ou pending* → codeHash ACTIVE.
 */
async function activateChallenge(
  email: string,
  codeHash: string,
  expires: Date,
  hadActiveChallenge: boolean
): Promise<void> {
  for (let attempt = 1; attempt <= PASSWORD_RESET_TX_MAX_ATTEMPTS; attempt++) {
    try {
      await db.$transaction(
        async (tx) => {
          const row = await tx.passwordResetToken.findUnique({
            where: { email },
          });
          if (!row) {
            return;
          }

          if (hadActiveChallenge) {
            if (
              row.pendingCodeHash == null ||
              !passwordResetHashesEqual(row.pendingCodeHash, codeHash)
            ) {
              return;
            }
            await tx.passwordResetToken.update({
              where: { email },
              data: {
                codeHash,
                expires,
                pendingCodeHash: null,
                pendingExpires: null,
                status: "ACTIVE",
                failedAttempts: 0,
                lockedAt: null,
                createdAt: new Date(),
              },
            });
          } else {
            await tx.passwordResetToken.update({
              where: { email },
              data: {
                status: "ACTIVE",
                codeHash,
                expires,
                pendingCodeHash: null,
                pendingExpires: null,
                failedAttempts: 0,
                lockedAt: null,
              },
            });
          }
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );
      return;
    } catch (error) {
      if (isConcurrencyError(error) && attempt < PASSWORD_RESET_TX_MAX_ATTEMPTS) {
        continue;
      }
      console.error("[password-reset] activate_challenge_failed", {
        category: "concurrency_or_db",
        attempt,
      });
      throw error;
    }
  }
}

/**
 * Échec provider :
 * - ACTIVE + pending → clear pending* uniquement (ACTIVE intact)
 * - PENDING seul → DELETE de la ligne (code non livré, non consommable)
 */
async function clearPendingOnProviderFailure(
  email: string,
  hadActiveChallenge: boolean
): Promise<void> {
  try {
    if (hadActiveChallenge) {
      await db.passwordResetToken.update({
        where: { email },
        data: { pendingCodeHash: null, pendingExpires: null },
      });
    } else {
      await db.passwordResetToken.deleteMany({
        where: { email, status: "PENDING" },
      });
    }
  } catch {
    console.error("[password-reset] clear_pending_failed", {
      category: "db",
    });
  }
}

export type RequestPasswordResetOptions = {
  /** IP client (politique proxy). Défaut "unknown". */
  clientIp?: string;
};

/**
 * Demande de réinitialisation — réponse publique toujours identique.
 *
 * @param emailRaw - Email brut
 * @param options - IP pour rate-limit PostgreSQL
 */
export async function requestPasswordResetChallenge(
  emailRaw: string,
  options: RequestPasswordResetOptions = {}
): Promise<PasswordResetRequestPublic> {
  const normalizedEmail = normalizeEmail(emailRaw);
  const publicOk = () => buildPasswordResetRequestPublic();
  const clientIp = options.clientIp?.trim() || "unknown";

  if (!normalizedEmail) {
    return publicOk();
  }

  // Rate-limit PG (aussi si compte absent) — réponse publique inchangée
  try {
    const rl = await enforcePasswordResetRateLimits(
      PASSWORD_RESET_RL_OP_REQUEST,
      clientIp,
      normalizedEmail
    );
    if (!rl.allowed) {
      return publicOk();
    }
  } catch {
    console.error("[password-reset] rate_limit_unexpected", {
      category: "rate_limit",
    });
    return publicOk();
  }

  let user: { id: string; email: string | null } | null = null;
  try {
    user = await db.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, email: true },
    });
    if (!user) {
      user = await db.user.findFirst({
        where: {
          email: { equals: normalizedEmail, mode: "insensitive" },
        },
        select: { id: true, email: true },
      });
    }
  } catch {
    console.error("[password-reset] user_lookup_failed", {
      category: "db",
    });
    return publicOk();
  }

  if (!user?.email) {
    return publicOk();
  }

  let prepared: Awaited<ReturnType<typeof prepareChallenge>>;
  try {
    prepared = await prepareChallenge(normalizedEmail);
  } catch {
    return publicOk();
  }

  if (prepared.kind === "cooldown") {
    return buildPasswordResetRequestPublic(prepared.retryAfter);
  }

  const { challenge } = prepared;
  // plaintextCode uniquement en mémoire jusqu'à l'appel email
  try {
    await sendPasswordResetCodeEmail(
      challenge.email,
      challenge.plaintextCode
    );
  } catch {
    console.error("[password-reset] provider_send_failed", {
      category: "email_provider",
    });
    await clearPendingOnProviderFailure(
      challenge.email,
      challenge.hadActiveChallenge
    );
    return publicOk();
  }

  try {
    await activateChallenge(
      challenge.email,
      challenge.codeHash,
      challenge.expires,
      challenge.hadActiveChallenge
    );
  } catch {
    // Email parti mais activation KO : PENDING reste non consommable ;
    // si ACTIVE+pending, pending reste jusqu'à retry d'activation / nouvelle demande.
    console.error("[password-reset] activate_after_send_failed", {
      category: "db",
    });
  }

  return publicOk();
}
