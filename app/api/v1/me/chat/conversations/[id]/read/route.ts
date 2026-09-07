import type { NextRequest } from "next/server";
import { resolveApiActor } from "@/lib/api/auth-resolve";
import { apiSuccess, apiError } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import { rejectMeIdorSearchParams } from "@/lib/api/reject-me-idor";
import { markMyConversationRead } from "@/lib/services/chat/mark-my-conversation-read";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/v1/me/chat/conversations/[id]/read
 */
export async function POST(request: NextRequest, context: Ctx) {
  try {
    const actor = await resolveApiActor(request);
    if (!actor) return apiError("UNAUTHENTICATED", "Non authentifié", 401);
    rejectMeIdorSearchParams(request.nextUrl.searchParams);
    const { id } = await context.params;
    const result = await markMyConversationRead(actor, id);
    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}
