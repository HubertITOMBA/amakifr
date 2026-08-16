import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { normalizeEmail } from "@/lib/utils";
import { ServiceError } from "@/lib/service-error";
import type { AuthenticatedUserDto } from "@/lib/services/auth/types";

const INVALID_CREDENTIALS = "Identifiants invalides";

/**
 * Authentifie un utilisateur par email + mot de passe (credentials).
 *
 * Aligné sur les règles Web (auth.config.ts + actions/auth/login.ts) :
 * - normalisation email
 * - bcrypt compare
 * - status Inactif → refusé
 * - email non vérifié → refusé (Web déclenche OTP ; mobile refuse sans inventer d'OTP)
 *
 * Non-énumération : email inconnu / mauvais password → même message public.
 *
 * Indépendant de NextAuth, cookies, Request/Response.
 *
 * @param email - Email brut
 * @param password - Mot de passe brut
 * @returns AuthenticatedUserDto (sans password)
 * @throws {ServiceError} VALIDATION_ERROR | UNAUTHENTICATED | FORBIDDEN | INTERNAL_ERROR
 */
export async function authenticateCredentials(
  email: string,
  password: string
): Promise<AuthenticatedUserDto> {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail || !password) {
    throw new ServiceError("VALIDATION_ERROR", "Email et mot de passe requis");
  }

  try {
    let user = await db.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        name: true,
        email: true,
        password: true,
        emailVerified: true,
        role: true,
        status: true,
      },
    });

    if (!user) {
      user = await db.user.findFirst({
        where: {
          email: {
            equals: normalizedEmail,
            mode: "insensitive",
          },
        },
        select: {
          id: true,
          name: true,
          email: true,
          password: true,
          emailVerified: true,
          role: true,
          status: true,
        },
      });
    }

    if (!user || !user.password || !user.email) {
      // Timing approximatif : bcrypt même si user absent (hash factice valide)
      await bcrypt.compare(
        password,
        "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy"
      );
      throw new ServiceError("UNAUTHENTICATED", INVALID_CREDENTIALS);
    }

    const passwordsMatch = await bcrypt.compare(password, user.password);
    if (!passwordsMatch) {
      throw new ServiceError("UNAUTHENTICATED", INVALID_CREDENTIALS);
    }

    if (user.status === "Inactif") {
      throw new ServiceError(
        "FORBIDDEN",
        "Votre compte est désactivé. Veuillez contacter le bureau de l'association pour plus d'informations."
      );
    }

    if (!user.emailVerified) {
      // Web : flux OTP / twoFactor — mobile refuse sans OTP dans cette phase
      throw new ServiceError(
        "FORBIDDEN",
        "Votre email n'est pas vérifié. Veuillez vérifier votre email avant de vous connecter."
      );
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: String(user.role).trim().toUpperCase(),
      status: user.status,
    };
  } catch (error) {
    if (error instanceof ServiceError) {
      throw error;
    }
    console.error("[authenticateCredentials] Erreur:", error);
    throw new ServiceError(
      "INTERNAL_ERROR",
      "Erreur lors de l'authentification"
    );
  }
}
