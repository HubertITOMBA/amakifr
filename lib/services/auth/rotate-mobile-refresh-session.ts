import { db } from "@/lib/db";
import { ServiceError } from "@/lib/service-error";
import { issueAccessToken } from "@/lib/auth-mobile/access-token";
import {
  generateRefreshToken,
  hashRefreshToken,
} from "@/lib/auth-mobile/refresh-token";
import { MOBILE_REFRESH_TOKEN_TTL_MS } from "@/lib/auth-mobile/constants";
import type { MobileAuthSessionDto } from "@/lib/services/auth/types";

/**
 * Révoque toutes les sessions refresh actives d'un utilisateur (reuse detection).
 * Hors transaction — utilisé quand le refresh était déjà révoqué au lookup.
 *
 * @param userId - Identifiant User
 */
async function revokeAllActiveSessionsForUser(userId: string): Promise<void> {
  const now = new Date();
  await db.mobileRefreshSession.updateMany({
    where: {
      userId,
      revokedAt: null,
    },
    data: { revokedAt: now },
  });
}

type RotationTxResult =
  | { kind: "rotated" }
  | { kind: "reuse" };

/**
 * Rotation atomique d'une session refresh mobile.
 *
 * Consommation unique garantie par `updateMany` conditionnel
 * (`id` + `revokedAt: null`) dans la transaction :
 * - count === 1 → créer le descendant
 * - count === 0 → reuse / course concurrente : révoquer toutes les sessions
 *   actives du user **dans la même transaction** (commit avant throw),
 *   puis UNAUTHENTICATED hors transaction.
 *
 * Pourquoi la révocation reuse est DANS la transaction :
 * un throw avant commit annulerait aussi les updateMany de révocation.
 * On commit donc le fail-closed (révocation globale), puis on lève
 * ServiceError après le succès de `$transaction`.
 *
 * @param refreshToken - Refresh opaque brut
 * @returns Nouvelle paire de tokens + user
 */
export async function rotateMobileRefreshSession(
  refreshToken: string
): Promise<MobileAuthSessionDto> {
  if (!refreshToken?.trim()) {
    throw new ServiceError("VALIDATION_ERROR", "refreshToken requis");
  }

  const tokenHash = hashRefreshToken(refreshToken);
  const now = new Date();

  try {
    const existing = await db.mobileRefreshSession.findUnique({
      where: { refreshTokenHash: tokenHash },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            status: true,
            emailVerified: true,
          },
        },
      },
    });

    if (!existing) {
      throw new ServiceError("UNAUTHENTICATED", "Session invalide");
    }

    // Reuse detection : token déjà révoqué présenté à nouveau (lookup)
    if (existing.revokedAt != null) {
      console.warn(
        "[rotateMobileRefreshSession] Reuse détecté — révocation sessions user",
        { userId: existing.userId, sessionId: existing.id }
      );
      await revokeAllActiveSessionsForUser(existing.userId);
      throw new ServiceError("UNAUTHENTICATED", "Session invalide");
    }

    if (existing.expiresAt <= now) {
      throw new ServiceError("UNAUTHENTICATED", "Session expirée");
    }

    const user = existing.user;
    if (!user?.email) {
      throw new ServiceError("UNAUTHENTICATED", "Session invalide");
    }

    if (user.status === "Inactif") {
      await db.mobileRefreshSession.update({
        where: { id: existing.id },
        data: { revokedAt: now },
      });
      throw new ServiceError(
        "FORBIDDEN",
        "Votre compte est désactivé. Veuillez contacter le bureau de l'association pour plus d'informations."
      );
    }

    if (!user.emailVerified) {
      await db.mobileRefreshSession.update({
        where: { id: existing.id },
        data: { revokedAt: now },
      });
      throw new ServiceError(
        "FORBIDDEN",
        "Votre email n'est pas vérifié. Veuillez vérifier votre email avant de vous connecter."
      );
    }

    const newRefreshToken = generateRefreshToken();
    const newRefreshHash = hashRefreshToken(newRefreshToken);
    const refreshExpiresAt = new Date(Date.now() + MOBILE_REFRESH_TOKEN_TTL_MS);

    const txResult: RotationTxResult = await db.$transaction(async (tx) => {
      const consumed = await tx.mobileRefreshSession.updateMany({
        where: {
          id: existing.id,
          revokedAt: null,
        },
        data: {
          revokedAt: now,
          lastUsedAt: now,
        },
      });

      if (consumed.count !== 1) {
        // Course concurrente : déjà consommé entre lookup et ici.
        // Révoquer toutes les sessions actives DANS cette transaction
        // pour que le commit persiste le fail-closed (pas de rollback).
        await tx.mobileRefreshSession.updateMany({
          where: {
            userId: existing.userId,
            revokedAt: null,
          },
          data: { revokedAt: now },
        });
        return { kind: "reuse" };
      }

      await tx.mobileRefreshSession.create({
        data: {
          userId: user.id,
          refreshTokenHash: newRefreshHash,
          expiresAt: refreshExpiresAt,
          lastUsedAt: null,
          revokedAt: null,
          rotatedFromId: existing.id,
        },
      });

      return { kind: "rotated" };
    });

    if (txResult.kind === "reuse") {
      console.warn(
        "[rotateMobileRefreshSession] Consommation concurrente (count=0) — reuse",
        { userId: existing.userId, sessionId: existing.id }
      );
      throw new ServiceError("UNAUTHENTICATED", "Session invalide");
    }

    const access = await issueAccessToken(user.id);

    return {
      accessToken: access.token,
      refreshToken: newRefreshToken,
      accessTokenExpiresAt: access.expiresAt.toISOString(),
      refreshTokenExpiresAt: refreshExpiresAt.toISOString(),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: String(user.role).trim().toUpperCase(),
        status: user.status,
      },
    };
  } catch (error) {
    if (error instanceof ServiceError) {
      throw error;
    }
    console.error("[rotateMobileRefreshSession] Erreur:", error);
    throw new ServiceError(
      "INTERNAL_ERROR",
      "Erreur lors du renouvellement de session"
    );
  }
}
