import type { NextRequest } from "next/server";
import { resolveApiActor } from "@/lib/api/auth-resolve";
import { apiSuccess, apiError } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import { rejectMeIdorSearchParams } from "@/lib/api/reject-me-idor";
import {
  getMyElections,
  getMyElectionsSummary,
} from "@/lib/services/elections/get-my-elections";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/me/elections
 * ?summary=1 → compteur à voter
 * ?limit=&offset=
 */
export async function GET(request: NextRequest) {
  try {
    const actor = await resolveApiActor(request);
    if (!actor) return apiError("UNAUTHENTICATED", "Non authentifié", 401);
    rejectMeIdorSearchParams(request.nextUrl.searchParams);

    if (request.nextUrl.searchParams.get("summary") === "1") {
      const data = await getMyElectionsSummary(actor);
      return apiSuccess(data);
    }

    const limitRaw = request.nextUrl.searchParams.get("limit");
    const offsetRaw = request.nextUrl.searchParams.get("offset");
    const limit = limitRaw ? Number(limitRaw) : undefined;
    const offset = offsetRaw ? Number(offsetRaw) : undefined;
    const data = await getMyElections(actor, { limit, offset });
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}
