import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { normalizeEmail } from "@/lib/utils";
import { ServiceError } from "@/lib/service-error";
import {
  PASSWORD_RESET_MAX_FAILED_ATTEMPTS,
  PASSWORD_RESET_PASSWORD_MIN_LENGTH,
  PASSWORD_RESET_TX_MAX_ATTEMPTS,
} from "@/lib/auth/password-reset-constants";
import {
  hashPasswordResetCode,
  passwordResetHashesEqual,
} from "@/lib/auth/password-reset-hmac";
import { PASSWORD_RESET_CONFIRM_GENERIC_ERROR } from "@/lib/auth/password-reset-messages";
import { PASSWORD_RESET_RL_OP_CONFIRM } from "@/lib/auth/password-reset-constants";
import { enforcePasswordResetRateLimits } from "@/lib/auth/password-reset-rate-limit";
import { revokeRedisSessionsBestEffort } from "@/lib/services/auth/revoke-sessions-after-password-change";

function isConcurrencyError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2034" || error.code === "P2002")
  );
}

export type ConfirmPasswordResetInput = {
  email: string;
  code: string;
  password: string;
  confirmPassword: string;
  /** IP pour rate-limit PG (défaut unknown). */
  clientIp?: string;
};

export type ConfirmPasswordResetResult = {
  success: true;
  message: string;
};

type PrevalidateOk = {
  kind: "ok";
  challengeId: string;
  codeHash: string;
};

type PrevalidateFail = { kind: "fail"; challengeId: string | null };

/**
 * Prévalidation non mutante — jamais une autorisation.
 * La transaction Serializable finale reste l'autorité.
 */
async function prevalidateActiveChallenge(
  normalizedEmail: string,
  providedHash: string
): Promise<PrevalidateOk | PrevalidateFail> {
  const challenge = await db.passwordResetToken.findUnique({
    where: { email: normalizedEmail },
  });

  if (!challenge || challenge.status !== "ACTIVE") {
    return { kind: "fail", challengeId: challenge?.id ?? null };
  }

  const now = new Date();
  if (challenge.lockedAt != null || challenge.expires <= now) {
    return { kind: "fail", challengeId: challenge.id };
  }

  if (!passwordResetHashesEqual(providedHash, challenge.codeHash)) {
    return { kind: "fail", challengeId: challenge.id };
  }

  return {
    kind: "ok",
    challengeId: challenge.id,
    codeHash: challenge.codeHash,
  };
}

/**
 * Incrément court des échecs (sans bcrypt).
 */
async function recordFailedAttempt(challengeId: string): Promise<void> {
  for (let attempt = 1; attempt <= PASSWORD_RESET_TX_MAX_ATTEMPTS; attempt++) {
    try {
      await db.$transaction(
        async (tx) => {
          const challenge = await tx.passwordResetToken.findUnique({
            where: { id: challengeId },
          });
          if (!challenge || challenge.status !== "ACTIVE") {
            return;
          }
          if (challenge.lockedAt != null) {
            return;
          }
          const now = new Date();
          const nextAttempts = Math.min(
            challenge.failedAttempts + 1,
            PASSWORD_RESET_MAX_FAILED_ATTEMPTS
          );
          const shouldLock =
            nextAttempts >= PASSWORD_RESET_MAX_FAILED_ATTEMPTS;
          await tx.passwordResetToken.update({
            where: { id: challenge.id },
            data: {
              failedAttempts: nextAttempts,
              lockedAt: shouldLock ? now : challenge.lockedAt,
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );
      return;
    } catch (error) {
      if (isConcurrencyError(error) && attempt < PASSWORD_RESET_TX_MAX_ATTEMPTS) {
        continue;
      }
      console.error("[password-reset] record_fail_attempt_error", {
        category: "db",
        attempt,
      });
      return;
    }
  }
}

/**
 * Confirme la réinitialisation.
 *
 * Ordre anti-DoS bcrypt :
 * 1. rate-limit PG
 * 2. validation MDP (cheap)
 * 3. prévalidation HMAC (read-only)
 * 4. si invalide → incrément court, PAS de bcrypt
 * 5. si OK → bcrypt hors TX
 * 6. TX Serializable : relecture + revalidation + update + delete challenge/sessions
 */
export async function confirmPasswordResetChallenge(
  input: ConfirmPasswordResetInput
): Promise<ConfirmPasswordResetResult> {
  const normalizedEmail = normalizeEmail(input.email);
  const code = input.code.trim();
  const password = input.password;
  const confirmPassword = input.confirmPassword;
  const clientIp = input.clientIp?.trim() || "unknown";

  // 1. Rate-limit avant tout travail coûteux
  const rl = await enforcePasswordResetRateLimits(
    PASSWORD_RESET_RL_OP_CONFIRM,
    clientIp,
    normalizedEmail || input.email
  );
  if (!rl.allowed) {
    throw new ServiceError(
      "UNAUTHENTICATED",
      PASSWORD_RESET_CONFIRM_GENERIC_ERROR
    );
  }

  if (password.length < PASSWORD_RESET_PASSWORD_MIN_LENGTH) {
    throw new ServiceError(
      "VALIDATION_ERROR",
      `Le mot de passe doit contenir au moins ${PASSWORD_RESET_PASSWORD_MIN_LENGTH} caractères`
    );
  }

  if (password !== confirmPassword) {
    throw new ServiceError(
      "VALIDATION_ERROR",
      "Les mots de passe ne correspondent pas"
    );
  }

  if (!normalizedEmail || !/^\d{8}$/.test(code)) {
    throw new ServiceError(
      "UNAUTHENTICATED",
      PASSWORD_RESET_CONFIRM_GENERIC_ERROR
    );
  }

  const providedHash = hashPasswordResetCode(code);

  // 2. Prévalidation non mutante (pas d'autorisation)
  const pre = await prevalidateActiveChallenge(normalizedEmail, providedHash);

  if (pre.kind === "fail") {
    if (pre.challengeId) {
      await recordFailedAttempt(pre.challengeId);
    }
    // Pas de bcrypt
    throw new ServiceError(
      "UNAUTHENTICATED",
      PASSWORD_RESET_CONFIRM_GENERIC_ERROR
    );
  }

  // 3. bcrypt uniquement si le code semble valide
  const hashedPassword = await bcrypt.hash(password, 10);

  // 4. Transaction finale — autorité
  for (let attempt = 1; attempt <= PASSWORD_RESET_TX_MAX_ATTEMPTS; attempt++) {
    try {
      const outcome = await db.$transaction(
        async (tx) => {
          const challenge = await tx.passwordResetToken.findUnique({
            where: { email: normalizedEmail },
          });

          if (!challenge || challenge.status !== "ACTIVE") {
            return { kind: "reject" as const };
          }

          // Challenge modifié entre prévalidation et TX
          if (challenge.id !== pre.challengeId) {
            return { kind: "reject" as const };
          }

          const now = new Date();
          if (challenge.lockedAt != null || challenge.expires <= now) {
            return { kind: "reject" as const };
          }

          if (
            !passwordResetHashesEqual(providedHash, challenge.codeHash) ||
            !passwordResetHashesEqual(pre.codeHash, challenge.codeHash)
          ) {
            const nextAttempts = Math.min(
              challenge.failedAttempts + 1,
              PASSWORD_RESET_MAX_FAILED_ATTEMPTS
            );
            const shouldLock =
              nextAttempts >= PASSWORD_RESET_MAX_FAILED_ATTEMPTS;
            await tx.passwordResetToken.update({
              where: { id: challenge.id },
              data: {
                failedAttempts: nextAttempts,
                lockedAt: shouldLock ? now : challenge.lockedAt,
              },
            });
            return { kind: "reject" as const };
          }

          const user = await tx.user.findFirst({
            where: {
              email: {
                equals: normalizedEmail,
                mode: "insensitive",
              },
            },
            select: { id: true },
          });

          if (!user) {
            await tx.passwordResetToken.delete({
              where: { id: challenge.id },
            });
            return { kind: "reject" as const };
          }

          await tx.user.update({
            where: { id: user.id },
            data: { password: hashedPassword },
          });

          await tx.passwordResetToken.delete({
            where: { id: challenge.id },
          });

          await tx.session.deleteMany({ where: { userId: user.id } });
          await tx.mobileRefreshSession.deleteMany({
            where: { userId: user.id },
          });

          return { kind: "ok" as const, userId: user.id };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );

      if (outcome.kind === "reject") {
        throw new ServiceError(
          "UNAUTHENTICATED",
          PASSWORD_RESET_CONFIRM_GENERIC_ERROR
        );
      }

      await revokeRedisSessionsBestEffort(outcome.userId);

      return {
        success: true,
        message:
          "Votre mot de passe a été mis à jour. Vous pouvez vous connecter.",
      };
    } catch (error) {
      if (error instanceof ServiceError) {
        throw error;
      }
      if (isConcurrencyError(error) && attempt < PASSWORD_RESET_TX_MAX_ATTEMPTS) {
        continue;
      }
      console.error("[password-reset] confirm_failed", {
        category: "concurrency_or_db",
        attempt,
      });
      throw new ServiceError(
        "UNAUTHENTICATED",
        PASSWORD_RESET_CONFIRM_GENERIC_ERROR
      );
    }
  }

  throw new ServiceError(
    "UNAUTHENTICATED",
    PASSWORD_RESET_CONFIRM_GENERIC_ERROR
  );
}
