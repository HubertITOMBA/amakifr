import type { NextRequest } from "next/server";
import { resolveApiActor } from "@/lib/api/auth-resolve";
import { apiSuccess, apiError } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import { ServiceError } from "@/lib/service-error";
import { updateMyReunionParticipation } from "@/lib/services/reunions/update-my-reunion-participation";

export const dynamic = "force-dynamic";

const FORBIDDEN_BODY_KEYS = [
  "userId",
  "adherentId",
  "participantId",
  "auteurId",
  "authorId",
] as const;

/**
 * PATCH /api/v1/me/reunions/[id]/participation — confirmer sa présence self-service.
 * Identité via Bearer uniquement — aucun userId/adherentId client.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await resolveApiActor(request);
    if (!actor) {
      return apiError("UNAUTHENTICATED", "Non authentifié", 401);
    }

    const query = request.nextUrl.searchParams;
    if (query.has("adherentId") || query.has("userId") || query.has("participantId")) {
      throw new ServiceError(
        "VALIDATION_ERROR",
        "Paramètres userId, adherentId et participantId non autorisés"
      );
    }

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      throw new ServiceError("VALIDATION_ERROR", "Corps JSON invalide");
    }

    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
      throw new ServiceError("VALIDATION_ERROR", "Corps JSON invalide");
    }

    const body = raw as Record<string, unknown>;

    for (const key of FORBIDDEN_BODY_KEYS) {
      if (key in body) {
        throw new ServiceError(
          "VALIDATION_ERROR",
          `Champ ${key} non autorisé`
        );
      }
    }

    const statut = body.statut;
    if (typeof statut !== "string") {
      throw new ServiceError(
        "VALIDATION_ERROR",
        "Statut de participation invalide"
      );
    }

    const { id: reunionId } = await params;

    const result = await updateMyReunionParticipation(actor, reunionId, {
      statut: statut as "Present" | "Absent" | "Excuse",
    });

    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}
