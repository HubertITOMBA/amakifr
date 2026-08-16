import { resolveApiActorFromWebSession } from "@/lib/api/auth-web";
import { apiSuccess, apiError } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import { getMe } from "@/lib/services/user/get-me";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/me — profil minimal de l'utilisateur authentifié.
 * Auth temporaire : session Web NextAuth (pas Bearer).
 */
export async function GET() {
  try {
    const actor = await resolveApiActorFromWebSession();
    if (!actor) {
      return apiError("UNAUTHENTICATED", "Non authentifié", 401);
    }

    const me = await getMe(actor);
    return apiSuccess(me);
  } catch (error) {
    return handleApiError(error);
  }
}
