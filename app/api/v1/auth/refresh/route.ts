import type { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import { ServiceError } from "@/lib/service-error";
import { MobileRefreshBodySchema } from "@/lib/api/validation/mobile-auth-body";
import { rotateMobileRefreshSession } from "@/lib/services/auth/rotate-mobile-refresh-session";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/auth/refresh — rotation refresh + nouvel access.
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

    const session = await rotateMobileRefreshSession(parsed.data.refreshToken);
    return apiSuccess(session);
  } catch (error) {
    return handleApiError(error);
  }
}
