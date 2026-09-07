import type { NextRequest } from "next/server";
import { resolveApiActor } from "@/lib/api/auth-resolve";
import { apiSuccess, apiError } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import { markMyConversationRead } from "@/lib/services/chat/mark-my-conversation-read";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/v1/me/chat/conversations/[id]/read
 */
export async function POST(_request: NextRequest, context: Ctx) {
  try {
    const actor = await resolveApiActor(_request);
    if (!actor) return apiError("UNAUTHENTICATED", "Non authentifié", 401);
    const { id } = await context.params;
    const result = await markMyConversationRead(actor, id);
    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}
