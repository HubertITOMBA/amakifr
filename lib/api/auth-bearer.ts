import type { AuthContext } from "@/lib/auth-context";
import { ServiceError } from "@/lib/service-error";
import { db } from "@/lib/db";
import { verifyAccessToken } from "@/lib/auth-mobile/access-token";
import { isTokenBlacklisted } from "@/lib/session-tracker";

export type BearerResolveResult =
  | { kind: "no_bearer" }
  | { kind: "actor"; actor: AuthContext };

/**
 * Extrait le token Bearer depuis l'en-tête Authorization.
 *
 * @returns null si header absent ; string token si Bearer valide en forme
 * @throws {ServiceError} UNAUTHENTICATED si scheme incorrect ou token vide
 */
export function extractBearerToken(authorizationHeader: string | null): string | null {
  if (authorizationHeader == null || authorizationHeader === "") {
    return null;
  }

  const parts = authorizationHeader.trim().split(/\s+/);
  if (parts.length < 2) {
    throw new ServiceError("UNAUTHENTICATED", "Non authentifié");
  }

  const [scheme, ...rest] = parts;
  if (scheme.toLowerCase() !== "bearer") {
    throw new ServiceError("UNAUTHENTICATED", "Non authentifié");
  }

  const token = rest.join(" ").trim();
  if (!token) {
    throw new ServiceError("UNAUTHENTICATED", "Non authentifié");
  }

  return token;
}

/**
 * Résout un AuthContext depuis Authorization: Bearer <access JWT>.
 *
 * Processus strict :
 * 1–4. header / scheme / token
 * 5–8. JWT (signature, type access, sub, jti)
 * 9. blacklist Redis
 * 10–12. User DB (status, emailVerified)
 * 13. AuthContext channel=mobile ; adminRoles/adherentId non résolus
 *
 * @param request - Request HTTP
 * @returns no_bearer si Authorization absent ; sinon actor
 * @throws {ServiceError} UNAUTHENTICATED | FORBIDDEN
 */
export async function resolveApiActorFromBearer(
  request: Request
): Promise<BearerResolveResult> {
  const authorization = request.headers.get("authorization");
  const token = extractBearerToken(authorization);

  if (token == null) {
    return { kind: "no_bearer" };
  }

  const claims = await verifyAccessToken(token);

  const blacklisted = await isTokenBlacklisted(claims.jti);
  if (blacklisted) {
    throw new ServiceError("UNAUTHENTICATED", "Non authentifié");
  }

  const user = await db.user.findUnique({
    where: { id: claims.sub },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      emailVerified: true,
    },
  });

  if (!user) {
    throw new ServiceError("UNAUTHENTICATED", "Non authentifié");
  }

  if (user.status === "Inactif") {
    throw new ServiceError(
      "FORBIDDEN",
      "Votre compte est désactivé. Veuillez contacter le bureau de l'association pour plus d'informations."
    );
  }

  if (!user.emailVerified) {
    throw new ServiceError(
      "FORBIDDEN",
      "Votre email n'est pas vérifié. Veuillez vérifier votre email avant de vous connecter."
    );
  }

  const role = String(user.role).trim().toUpperCase();
  if (!role) {
    throw new ServiceError("UNAUTHENTICATED", "Non authentifié");
  }

  const status = String(user.status).trim();
  if (!status) {
    throw new ServiceError("UNAUTHENTICATED", "Non authentifié");
  }

  const actor: AuthContext = {
    userId: user.id,
    role,
    status,
    email: user.email ?? null,
    name: user.name ?? null,
    sessionId: claims.jti,
    adminRoles: [],
    adherentId: null,
    channel: "mobile",
  };

  return { kind: "actor", actor };
}
