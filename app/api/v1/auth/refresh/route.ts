import type { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import { ServiceError } from "@/lib/service-error";
import { MobileRefreshBodySchema } from "@/lib/api/validation/mobile-auth-body";
import { rotateMobileRefreshSession } from "@/lib/services/auth/rotate-mobile-refresh-session";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/api/client-ip";
import { buildMobileRefreshRateLimitKey } from "@/lib/auth-mobile/refresh-rate-limit-key";
import {
  MOBILE_REFRESH_RATE_MAX,
  MOBILE_REFRESH_RATE_WINDOW_MS,
} from "@/lib/auth-mobile/constants";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/auth/refresh — rotation refresh + nouvel access.
 * Rate-limit : IP + préfixe SHA-256 du refresh (jamais le brut).
 */
export async function POST(request: NextRequest) {
  try {
    let json: unknown;
    try {
      json = await request.json();
    } catch {
      throw new ServiceError("VALIDATION_ERROR", "Body JSON invalide");
    }

    const parsed = MobileRefreshBodySchema.safeParse(json);
    if (!parsed.success) {
      throw new ServiceError(
        "VALIDATION_ERROR",
        parsed.error.errors[0]?.message ?? "Données invalides"
      );
    }

    const refreshToken = parsed.data.refreshToken;
    const ip = getClientIp(request);
    const rateKey = buildMobileRefreshRateLimitKey(ip, refreshToken);

    const rate = await checkRateLimit(rateKey, {
      maxRequests: MOBILE_REFRESH_RATE_MAX,
      windowMs: MOBILE_REFRESH_RATE_WINDOW_MS,
    });
    if (!rate.allowed) {
      throw new ServiceError(
        "RATE_LIMITED",
        "Trop de tentatives de renouvellement. Réessayez plus tard."
      );
    }

    const session = await rotateMobileRefreshSession(refreshToken);
    return apiSuccess(session);
  } catch (error) {
    return handleApiError(error);
  }
}
