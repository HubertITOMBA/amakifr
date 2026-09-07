import type { NextRequest } from "next/server";
import { resolveApiActor } from "@/lib/api/auth-resolve";
import { apiSuccess, apiError } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import { ServiceError } from "@/lib/service-error";
import { getMyConversation } from "@/lib/services/chat/get-my-conversation";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/v1/me/chat/conversations/[id]?page=&limit=
 */
export async function GET(request: NextRequest, context: Ctx) {
  try {
    const actor = await resolveApiActor(request);
    if (!actor) return apiError("UNAUTHENTICATED", "Non authentifié", 401);

    for (const key of ["userId", "adherentId", "senderId"]) {
      if (request.nextUrl.searchParams.has(key)) {
        throw new ServiceError(
          "VALIDATION_ERROR",
          `Paramètre ${key} non autorisé`
        );
      }
    }

    const { id } = await context.params;
    const page = request.nextUrl.searchParams.get("page");
    const limit = request.nextUrl.searchParams.get("limit");
    const data = await getMyConversation(actor, id, {
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}
