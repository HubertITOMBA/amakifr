import type { NextRequest } from "next/server";
import { resolveApiActor } from "@/lib/api/auth-resolve";
import { apiSuccess, apiError } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import { ServiceError } from "@/lib/service-error";
import { createMyTacheCommentaire } from "@/lib/services/taches/create-my-tache-commentaire";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/me/taches/[id]/commentaires — ajouter un commentaire self-service.
 * Auteur déterminé côté serveur via Bearer — aucun userId/adherentId client.
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
      throw new ServiceError("VALIDATION_ERROR", "Corps JSON invalide");
    }

    if (
      raw === null ||
      typeof raw !== "object" ||
      Array.isArray(raw)
    ) {
      throw new ServiceError("VALIDATION_ERROR", "Corps JSON invalide");
    }

    const body = raw as Record<string, unknown>;

    const forbidden = [
      "userId",
      "adherentId",
      "auteurId",
      "authorId",
    ];
    for (const key of forbidden) {
      if (key in body) {
        throw new ServiceError(
          "VALIDATION_ERROR",
          `Champ ${key} non autorisé`
        );
      }
    }

    const { id: tacheId } = await params;

    const result = await createMyTacheCommentaire(actor, tacheId, {
      contenu: typeof body.contenu === "string" ? body.contenu : "",
      pourcentageAvancement:
        typeof body.pourcentageAvancement === "number"
          ? body.pourcentageAvancement
          : body.pourcentageAvancement === null
            ? null
            : undefined,
    });

    return apiSuccess(result, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
