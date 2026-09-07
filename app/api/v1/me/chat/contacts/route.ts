import type { NextRequest } from "next/server";
import { resolveApiActor } from "@/lib/api/auth-resolve";
import { apiSuccess, apiError } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import { ServiceError } from "@/lib/service-error";
import { searchMyChatContacts } from "@/lib/services/chat/search-my-chat-contacts";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/me/chat/contacts?q=
 */
export async function GET(request: NextRequest) {
  try {
    const actor = await resolveApiActor(request);
    if (!actor) return apiError("UNAUTHENTICATED", "Non authentifié", 401);

    if (
      request.nextUrl.searchParams.has("userId") ||
      request.nextUrl.searchParams.has("adherentId")
    ) {
      throw new ServiceError(
        "VALIDATION_ERROR",
        "Paramètres userId et adherentId non autorisés"
      );
    }

    const q = request.nextUrl.searchParams.get("q") ?? "";
    const data = await searchMyChatContacts(actor, q);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}
