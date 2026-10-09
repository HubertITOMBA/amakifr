import type { NextRequest } from "next/server";
import { resolveApiActor } from "@/lib/api/auth-resolve";
import { apiSuccess, apiError } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import { ServiceError } from "@/lib/service-error";
import { listPublishedRapportsForAdherent } from "@/lib/services/rapports-reunion/published-rapports";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/me/rapports-reunion — métadonnées des rapports PUBLISHED.
 * Bearer (ou session web via resolveApiActor). Anti-IDOR : pas de userId/adherentId.
 *
 * Note M2-D : le HTML n’est pas inclus ici ; le détail sanitise côté client.
 */
export async function GET(request: NextRequest) {
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

    const limitRaw = params.get("limit");
    const offsetRaw = params.get("offset");
    const limit =
      limitRaw === null || limitRaw === ""
        ? undefined
        : Number.parseInt(limitRaw, 10);
    const offset =
      offsetRaw === null || offsetRaw === ""
        ? undefined
        : Number.parseInt(offsetRaw, 10);

    if (
      (limitRaw !== null &&
        limitRaw !== "" &&
        (!Number.isFinite(limit) || Number.isNaN(limit))) ||
      (offsetRaw !== null &&
        offsetRaw !== "" &&
        (!Number.isFinite(offset) || Number.isNaN(offset)))
    ) {
      throw new ServiceError("VALIDATION_ERROR", "Pagination invalide");
    }

    const page = await listPublishedRapportsForAdherent(actor, {
      limit,
      offset,
    });
    return apiSuccess(page);
  } catch (error) {
    return handleApiError(error);
  }
}
