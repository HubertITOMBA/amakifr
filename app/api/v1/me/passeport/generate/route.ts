import type { NextRequest } from "next/server";
import { resolveApiActor } from "@/lib/api/auth-resolve";
import { apiSuccess, apiError } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import { ServiceError } from "@/lib/service-error";
import { generateMyPasseport } from "@/lib/services/passeport/generate-my-passeport";

export const dynamic = "force-dynamic";

function rejectClientIdentityParams(
  params: URLSearchParams,
  body: Record<string, unknown> | null
): void {
  if (params.has("adherentId") || params.has("userId")) {
    throw new ServiceError(
      "VALIDATION_ERROR",
      "Paramètres userId et adherentId non autorisés"
    );
  }

  if (body && ("adherentId" in body || "userId" in body)) {
    throw new ServiceError(
      "VALIDATION_ERROR",
      "Champs userId et adherentId non autorisés"
    );
  }
}

/**
 * POST /api/v1/me/passeport/generate — génération explicite (idempotente).
 */
export async function POST(request: NextRequest) {
  try {
    const actor = await resolveApiActor(request);
    if (!actor) {
      return apiError("UNAUTHENTICATED", "Non authentifié", 401);
    }

    let body: Record<string, unknown> | null = null;
    try {
      const text = await request.text();
      if (text.trim()) {
        body = JSON.parse(text) as Record<string, unknown>;
      }
    } catch {
      throw new ServiceError("VALIDATION_ERROR", "Corps JSON invalide");
    }

    rejectClientIdentityParams(request.nextUrl.searchParams, body);

    const data = await generateMyPasseport(actor);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}
