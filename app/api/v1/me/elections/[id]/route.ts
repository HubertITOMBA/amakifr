import type { NextRequest } from "next/server";
import { resolveApiActor } from "@/lib/api/auth-resolve";
import { apiSuccess, apiError } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import { rejectMeIdorSearchParams } from "@/lib/api/reject-me-idor";
import { getMyElection } from "@/lib/services/elections/get-my-elections";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/v1/me/elections/[id]
 */
export async function GET(request: NextRequest, context: Ctx) {
  try {
    const actor = await resolveApiActor(request);
    if (!actor) return apiError("UNAUTHENTICATED", "Non authentifié", 401);
    rejectMeIdorSearchParams(request.nextUrl.searchParams);
    const { id } = await context.params;
    const data = await getMyElection(actor, id);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}
