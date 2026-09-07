import type { NextRequest } from "next/server";
import { resolveApiActor } from "@/lib/api/auth-resolve";
import { apiSuccess, apiError } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import { rejectMeIdorSearchParams } from "@/lib/api/reject-me-idor";
import { getMyElectionResults } from "@/lib/services/elections/get-my-election-results";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/v1/me/elections/[id]/results
 * Uniquement si Cloturee.
 */
export async function GET(request: NextRequest, context: Ctx) {
  try {
    const actor = await resolveApiActor(request);
    if (!actor) return apiError("UNAUTHENTICATED", "Non authentifié", 401);
    rejectMeIdorSearchParams(request.nextUrl.searchParams);
    const { id } = await context.params;
    const data = await getMyElectionResults(actor, id);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}
