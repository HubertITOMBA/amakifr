import type { NextRequest } from "next/server";
import { resolveApiActor } from "@/lib/api/auth-resolve";
import { apiSuccess, apiError } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import { ServiceError } from "@/lib/service-error";
import { sendMyMessage } from "@/lib/services/chat/send-my-message";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/v1/me/chat/conversations/[id]/messages
 * Body: { content, replyToId? } — sender = actor
 */
export async function POST(request: NextRequest, context: Ctx) {
  try {
    const actor = await resolveApiActor(request);
    if (!actor) return apiError("UNAUTHENTICATED", "Non authentifié", 401);

    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    for (const key of [
      "userId",
      "senderId",
      "expediteurId",
      "adherentId",
      "isAdmin",
    ]) {
      if (key in body) {
        throw new ServiceError(
          "VALIDATION_ERROR",
          `Champ ${key} non autorisé`
        );
      }
    }

    const { id } = await context.params;
    const result = await sendMyMessage(actor, id, {
      content: typeof body.content === "string" ? body.content : "",
      replyToId:
        typeof body.replyToId === "string" ? body.replyToId : undefined,
    });
    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}
