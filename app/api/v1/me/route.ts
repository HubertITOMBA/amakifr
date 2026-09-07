import type { NextRequest } from "next/server";
import { resolveApiActor } from "@/lib/api/auth-resolve";
import { apiSuccess, apiError } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import { rejectMeIdorSearchParams } from "@/lib/api/reject-me-idor";
import { getMe } from "@/lib/services/user/get-me";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/me — profil minimal de l'utilisateur authentifié.
 * Auth : Bearer mobile OU session Web NextAuth (composite, no-downgrade).
 */
export async function GET(request: NextRequest) {
  try {
    const actor = await resolveApiActor(request);
    if (!actor) {
      return apiError("UNAUTHENTICATED", "Non authentifié", 401);
    }
    rejectMeIdorSearchParams(request.nextUrl.searchParams);

    const me = await getMe(actor);
    return apiSuccess(me);
  } catch (error) {
    return handleApiError(error);
  }
}
