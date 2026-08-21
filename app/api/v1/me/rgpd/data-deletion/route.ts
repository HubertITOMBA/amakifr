import type { NextRequest } from "next/server";
import { resolveApiActor } from "@/lib/api/auth-resolve";
import { apiSuccess, apiError } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import { ServiceError } from "@/lib/service-error";
import {
  getMyDataDeletionRequest,
  submitMyDataDeletionRequest,
} from "@/lib/services/rgpd/submit-my-data-deletion";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/me/rgpd/data-deletion — statut demande active.
 */
export async function GET(request: NextRequest) {
  try {
    const actor = await resolveApiActor(request);
    if (!actor) {
      return apiError("UNAUTHENTICATED", "Non authentifié", 401);
    }

    if (
      request.nextUrl.searchParams.has("userId") ||
      request.nextUrl.searchParams.has("email")
    ) {
      throw new ServiceError(
        "VALIDATION_ERROR",
        "Paramètres d'identité non autorisés"
      );
    }

    const data = await getMyDataDeletionRequest(actor);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/v1/me/rgpd/data-deletion — crée une demande (compte connecté).
 * Body JSON optionnel : { message?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const actor = await resolveApiActor(request);
    if (!actor) {
      return apiError("UNAUTHENTICATED", "Non authentifié", 401);
    }

    let message: string | null = null;
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const body = (await request.json().catch(() => ({}))) as {
        message?: unknown;
        userId?: unknown;
        email?: unknown;
      };
      if (body.userId !== undefined || body.email !== undefined) {
        throw new ServiceError(
          "VALIDATION_ERROR",
          "Champs d'identité non autorisés"
        );
      }
      if (typeof body.message === "string") message = body.message;
    }

    const result = await submitMyDataDeletionRequest(actor, { message });
    return apiSuccess(result, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
