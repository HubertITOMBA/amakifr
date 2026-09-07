import type { NextRequest } from "next/server";
import { resolveApiActor } from "@/lib/api/auth-resolve";
import { apiSuccess, apiError } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import { ServiceError } from "@/lib/service-error";
import {
  getMyEvents,
  getMyEventsSummary,
} from "@/lib/services/evenements/get-my-events";
import type { EventScope } from "@/lib/services/evenements/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/me/evenements
 * Query : scope=upcoming|past, limit, offset, summary=1
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

    if (params.get("summary") === "1") {
      const summary = await getMyEventsSummary(actor);
      return apiSuccess(summary);
    }

    const scopeRaw = params.get("scope") ?? "upcoming";
    if (scopeRaw !== "upcoming" && scopeRaw !== "past") {
      throw new ServiceError(
        "VALIDATION_ERROR",
        "scope invalide (upcoming|past)"
      );
    }
    const scope = scopeRaw as EventScope;
    const limit = params.get("limit");
    const offset = params.get("offset");

    const data = await getMyEvents(actor, {
      scope,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}
