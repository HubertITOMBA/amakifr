import type { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import { ServiceError } from "@/lib/service-error";
import { PasswordResetConfirmBodySchema } from "@/lib/api/validation/password-reset-body";
import { confirmPasswordResetChallenge } from "@/lib/services/auth/password-reset-confirm";
import { getPasswordResetClientIp } from "@/lib/auth/password-reset-client-ip";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/auth/password-reset/confirm
 * Rate-limit PG + anti-bcrypt DoS dans le service métier.
 */
export async function POST(request: NextRequest) {
  try {
    let json: unknown;
    try {
      json = await request.json();
    } catch {
      throw new ServiceError("VALIDATION_ERROR", "Body JSON invalide");
    }

    const parsed = PasswordResetConfirmBodySchema.safeParse(json);
    if (!parsed.success) {
      throw new ServiceError(
        "VALIDATION_ERROR",
        parsed.error.errors[0]?.message ?? "Données invalides"
      );
    }

    const clientIp = getPasswordResetClientIp(request);
    const result = await confirmPasswordResetChallenge({
      ...parsed.data,
      clientIp,
    });
    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}
