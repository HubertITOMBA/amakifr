import type { NextRequest } from "next/server";
import { resolveApiActor } from "@/lib/api/auth-resolve";
import { apiSuccess, apiError } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import { ServiceError } from "@/lib/service-error";
import { requestMyDocumentDeletion } from "@/lib/services/documents/request-my-document-deletion";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/v1/me/documents/[id]/deletion-request
 * Demande de suppression pour document Valide+Public uniquement.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const actor = await resolveApiActor(request);
    if (!actor) {
      return apiError("UNAUTHENTICATED", "Non authentifié", 401);
    }

    const params = request.nextUrl.searchParams;
    if (
      params.has("userId") ||
      params.has("adherentId") ||
      params.has("ownerId")
    ) {
      throw new ServiceError(
        "VALIDATION_ERROR",
        "Paramètres d'identité non autorisés"
      );
    }

    let motif: string | null = null;
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const body = (await request.json().catch(() => ({}))) as {
        motif?: unknown;
        userId?: unknown;
        adherentId?: unknown;
      };
      if (body.userId !== undefined || body.adherentId !== undefined) {
        throw new ServiceError(
          "VALIDATION_ERROR",
          "Champs d'identité non autorisés"
        );
      }
      if (typeof body.motif === "string") motif = body.motif;
    }

    const { id } = await context.params;
    const result = await requestMyDocumentDeletion(actor, id, { motif });
    return apiSuccess(result, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
