import type { NextRequest } from "next/server";
import { resolveApiActor } from "@/lib/api/auth-resolve";
import { apiSuccess, apiError } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import { rejectMeIdorSearchParams } from "@/lib/api/reject-me-idor";
import {
  getMyProfileSection,
  parseProfileSection,
} from "@/lib/services/user/get-my-profile-section";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/me/profile?section=summary|account|identity|coordonnees|contact
 * Sections lazy du profil mobile (sans graphe complet / RGPD).
 */
export async function GET(request: NextRequest) {
  try {
    const actor = await resolveApiActor(request);
    if (!actor) {
      return apiError("UNAUTHENTICATED", "Non authentifié", 401);
    }
    rejectMeIdorSearchParams(request.nextUrl.searchParams);

    const section = parseProfileSection(
      request.nextUrl.searchParams.get("section")
    );
    const data = await getMyProfileSection(actor, section);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}
