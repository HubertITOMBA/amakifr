import type { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import { ServiceError } from "@/lib/service-error";
import { MobileLoginBodySchema } from "@/lib/api/validation/mobile-auth-body";
import { authenticateCredentials } from "@/lib/services/auth/authenticate-credentials";
import { createMobileSession } from "@/lib/services/auth/create-mobile-session";
import { checkRateLimit } from "@/lib/rate-limit";
import { normalizeEmail } from "@/lib/utils";
import { getClientIp } from "@/lib/api/client-ip";
import {
  MOBILE_LOGIN_RATE_MAX,
  MOBILE_LOGIN_RATE_WINDOW_MS,
} from "@/lib/auth-mobile/constants";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/auth/login — authentification mobile (credentials → tokens).
 * Ne touche pas NextAuth / cookies Web.
 * Rate-limit : IP + email normalisé (jamais le password).
 */
export async function POST(request: NextRequest) {
  try {
    let json: unknown;
    try {
      json = await request.json();
    } catch {
      throw new ServiceError("VALIDATION_ERROR", "Body JSON invalide");
    }

    const parsed = MobileLoginBodySchema.safeParse(json);
    if (!parsed.success) {
      throw new ServiceError(
        "VALIDATION_ERROR",
        parsed.error.errors[0]?.message ?? "Données invalides"
      );
    }

    const { email, password } = parsed.data;
    const normalizedEmail = normalizeEmail(email);
    const ip = getClientIp(request);

    const rate = await checkRateLimit(
      `mobile-login:${ip}:${normalizedEmail}`,
      {
        maxRequests: MOBILE_LOGIN_RATE_MAX,
        windowMs: MOBILE_LOGIN_RATE_WINDOW_MS,
      }
    );
    if (!rate.allowed) {
      throw new ServiceError(
        "RATE_LIMITED",
        "Trop de tentatives de connexion. Réessayez plus tard."
      );
    }

    const user = await authenticateCredentials(email, password);
    const session = await createMobileSession(user);
    return apiSuccess(session);
  } catch (error) {
    return handleApiError(error);
  }
}
