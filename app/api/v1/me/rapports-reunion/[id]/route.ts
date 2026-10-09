import type { NextRequest } from "next/server";
import { resolveApiActor } from "@/lib/api/auth-resolve";
import { apiSuccess, apiError } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import { ServiceError } from "@/lib/service-error";
import { getPublishedRapportForAdherent } from "@/lib/services/rapports-reunion/published-rapports";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/v1/me/rapports-reunion/[id] — détail PUBLISHED + contenuHtml.
 * DRAFT / ID inconnu → NOT_FOUND (non révélateur).
 * M2-D : sanitiser contenuHtml avant rendu (WebView / lecteur contrôlé).
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const actor = await resolveApiActor(request);
    if (!actor) {
      return apiError("UNAUTHENTICATED", "Non authentifié", 401);
    }

    const params = request.nextUrl.searchParams;
    if (params.has("adherentId") || params.has("userId")) {
      throw new ServiceError(
        "VALIDATION_ERROR",
        "Paramètres userId et adherentId non autorisés"
      );
    }

    const { id } = await context.params;
    const detail = await getPublishedRapportForAdherent(actor, id);
    return apiSuccess(detail);
  } catch (error) {
    return handleApiError(error);
  }
}
