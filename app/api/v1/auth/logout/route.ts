import type { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import { ServiceError } from "@/lib/service-error";
import { MobileLogoutBodySchema } from "@/lib/api/validation/mobile-auth-body";
import { logoutMobileSession } from "@/lib/services/auth/logout-mobile-session";
import { extractBearerToken } from "@/lib/api/auth-bearer";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/auth/logout — révocation refresh + blacklist access jti.
 *
 * Body : `{ refreshToken? }` (refresh-only OK).
 * Authorization :
 * - absent → OK (logout via refreshToken seul)
 * - Bearer syntaxiquement valide → transmis au service
 * - présent mais malformé / mauvais scheme / Bearer vide → 401 (fail closed)
 */
export async function POST(request: NextRequest) {
  try {
    let json: unknown = {};
    try {
      const text = await request.text();
      if (text.trim()) {
        json = JSON.parse(text);
      }
    } catch {
      throw new ServiceError("VALIDATION_ERROR", "Body JSON invalide");
    }

    const parsed = MobileLogoutBodySchema.safeParse(json);
    if (!parsed.success) {
      throw new ServiceError(
        "VALIDATION_ERROR",
        parsed.error.errors[0]?.message ?? "Données invalides"
      );
    }

    // Absent → null ; Bearer malformé → ServiceError (pas d'ignore silencieux)
    const accessToken = extractBearerToken(
      request.headers.get("authorization")
    );

    const result = await logoutMobileSession({
      refreshToken: parsed.data.refreshToken ?? null,
      accessToken,
    });

    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}
