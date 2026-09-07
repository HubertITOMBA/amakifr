import type { NextRequest } from "next/server";
import { resolveApiActor } from "@/lib/api/auth-resolve";
import { apiSuccess, apiError } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import { ServiceError } from "@/lib/service-error";
import {
  registerMyEvent,
  withdrawMyEvent,
} from "@/lib/services/evenements/register-my-event";

export const dynamic = "force-dynamic";

const FORBIDDEN_BODY_KEYS = [
  "userId",
  "adherentId",
  "participantId",
  "inscriptionId",
  "evenementId",
  "force",
  "override",
  "isAdmin",
] as const;

/**
 * POST /api/v1/me/evenements/[id]/inscription — s'inscrire.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await resolveApiActor(request);
    if (!actor) {
      return apiError("UNAUTHENTICATED", "Non authentifié", 401);
    }

    const query = request.nextUrl.searchParams;
    if (query.has("adherentId") || query.has("userId")) {
      throw new ServiceError(
        "VALIDATION_ERROR",
        "Paramètres userId et adherentId non autorisés"
      );
    }

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      raw = {};
    }
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
      throw new ServiceError("VALIDATION_ERROR", "Corps JSON invalide");
    }
    const body = raw as Record<string, unknown>;
    for (const key of FORBIDDEN_BODY_KEYS) {
      if (key in body) {
        throw new ServiceError("VALIDATION_ERROR", `Champ ${key} non autorisé`);
      }
    }

    const { id } = await params;
    const result = await registerMyEvent(actor, id, {
      nombrePersonnes:
        typeof body.nombrePersonnes === "number" ? body.nombrePersonnes : 1,
      commentaires:
        typeof body.commentaires === "string" ? body.commentaires : undefined,
    });
    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/v1/me/evenements/[id]/inscription — se désinscrire.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await resolveApiActor(request);
    if (!actor) {
      return apiError("UNAUTHENTICATED", "Non authentifié", 401);
    }

    const query = request.nextUrl.searchParams;
    if (query.has("adherentId") || query.has("userId") || query.has("inscriptionId")) {
      throw new ServiceError(
        "VALIDATION_ERROR",
        "Paramètres userId, adherentId et inscriptionId non autorisés"
      );
    }

    const { id } = await params;
    const result = await withdrawMyEvent(actor, id);
    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}
