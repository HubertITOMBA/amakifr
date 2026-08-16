import { SignJWT, jwtVerify, errors as JoseErrors } from "jose";
import { randomUUID } from "crypto";
import { ServiceError } from "@/lib/service-error";
import { getMobileAccessTokenSecret } from "@/lib/auth-mobile/config";
import {
  MOBILE_ACCESS_TOKEN_TTL_SECONDS,
  MOBILE_ACCESS_TOKEN_TYPE,
} from "@/lib/auth-mobile/constants";

export type MobileAccessTokenClaims = {
  sub: string;
  jti: string;
  iat: number;
  exp: number;
  type: typeof MOBILE_ACCESS_TOKEN_TYPE;
};

export type IssuedAccessToken = {
  token: string;
  jti: string;
  expiresAt: Date;
};

function secretKey(): Uint8Array {
  return new TextEncoder().encode(getMobileAccessTokenSecret());
}

/**
 * Émet un access token JWT court (15 min).
 * Claims : sub, jti, iat, exp, type=access. Aucun secret métier.
 *
 * @param userId - Identifiant User (sub)
 */
export async function issueAccessToken(userId: string): Promise<IssuedAccessToken> {
  if (!userId?.trim()) {
    throw new ServiceError("INTERNAL_ERROR", "userId requis pour access token");
  }

  const jti = randomUUID();
  const expiresAt = new Date(Date.now() + MOBILE_ACCESS_TOKEN_TTL_SECONDS * 1000);

  const token = await new SignJWT({ type: MOBILE_ACCESS_TOKEN_TYPE })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setJti(jti)
    .setIssuedAt()
    .setExpirationTime(`${MOBILE_ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(secretKey());

  return { token, jti, expiresAt };
}

/**
 * Vérifie et décode un access token mobile.
 *
 * @param token - JWT Bearer
 * @returns Claims normalisées
 * @throws {ServiceError} UNAUTHENTICATED si invalide / expiré / mauvais type
 */
export async function verifyAccessToken(
  token: string
): Promise<MobileAccessTokenClaims> {
  if (!token?.trim()) {
    throw new ServiceError("UNAUTHENTICATED", "Token d'accès invalide");
  }

  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      algorithms: ["HS256"],
    });

    const sub = typeof payload.sub === "string" ? payload.sub.trim() : "";
    const jti = typeof payload.jti === "string" ? payload.jti.trim() : "";
    const type = payload.type;
    const iat = payload.iat;
    const exp = payload.exp;

    if (!sub || !jti) {
      throw new ServiceError("UNAUTHENTICATED", "Token d'accès invalide");
    }
    if (type !== MOBILE_ACCESS_TOKEN_TYPE) {
      throw new ServiceError("UNAUTHENTICATED", "Token d'accès invalide");
    }
    if (typeof iat !== "number" || typeof exp !== "number") {
      throw new ServiceError("UNAUTHENTICATED", "Token d'accès invalide");
    }

    return { sub, jti, iat, exp, type: MOBILE_ACCESS_TOKEN_TYPE };
  } catch (error) {
    if (error instanceof ServiceError) {
      throw error;
    }
    if (error instanceof JoseErrors.JWTExpired) {
      throw new ServiceError("UNAUTHENTICATED", "Token d'accès expiré");
    }
    throw new ServiceError("UNAUTHENTICATED", "Token d'accès invalide");
  }
}
