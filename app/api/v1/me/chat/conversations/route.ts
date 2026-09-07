import type { NextRequest } from "next/server";
import { resolveApiActor } from "@/lib/api/auth-resolve";
import { apiSuccess, apiError } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import { ServiceError } from "@/lib/service-error";
import { getMyConversations } from "@/lib/services/chat/get-my-conversations";
import { createMyConversation } from "@/lib/services/chat/create-my-conversation";

export const dynamic = "force-dynamic";

const FORBIDDEN = [
  "userId",
  "adherentId",
  "senderId",
  "expediteurId",
  "participantId",
  "ownerId",
  "isAdmin",
  "createdBy",
] as const;

function rejectForbiddenParams(params: URLSearchParams) {
  for (const key of FORBIDDEN) {
    if (params.has(key)) {
      throw new ServiceError(
        "VALIDATION_ERROR",
        `Paramètre ${key} non autorisé`
      );
    }
  }
}

function rejectForbiddenBody(body: Record<string, unknown>) {
  for (const key of FORBIDDEN) {
    if (key in body) {
      throw new ServiceError("VALIDATION_ERROR", `Champ ${key} non autorisé`);
    }
  }
}

/**
 * GET /api/v1/me/chat/conversations
 */
export async function GET(request: NextRequest) {
  try {
    const actor = await resolveApiActor(request);
    if (!actor) return apiError("UNAUTHENTICATED", "Non authentifié", 401);
    rejectForbiddenParams(request.nextUrl.searchParams);

    const limit = request.nextUrl.searchParams.get("limit");
    const offset = request.nextUrl.searchParams.get("offset");
    const data = await getMyConversations(actor, {
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/v1/me/chat/conversations
 * Body: { type?, titre?, participantIds: string[] }
 * participantIds = User.id destinataires (pas Adherent.id, pas sender).
 */
export async function POST(request: NextRequest) {
  try {
    const actor = await resolveApiActor(request);
    if (!actor) return apiError("UNAUTHENTICATED", "Non authentifié", 401);

    let raw: unknown = await request.json().catch(() => ({}));
    // Défense : body double-encodé (string JSON) → reparse
    if (typeof raw === "string") {
      try {
        raw = JSON.parse(raw);
      } catch {
        throw new ServiceError("VALIDATION_ERROR", "Corps de requête invalide");
      }
    }
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      throw new ServiceError("VALIDATION_ERROR", "Corps de requête invalide");
    }
    const body = raw as Record<string, unknown>;
    rejectForbiddenBody(body);

    const participantIds = Array.isArray(body.participantIds)
      ? body.participantIds.filter((x): x is string => typeof x === "string")
      : [];

    const result = await createMyConversation(actor, {
      type: body.type === "Groupe" ? "Groupe" : "Privee",
      titre: typeof body.titre === "string" ? body.titre : undefined,
      participantIds,
    });
    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}
