import type { NextRequest } from "next/server";
import { resolveApiActor } from "@/lib/api/auth-resolve";
import { apiSuccess, apiError } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import { ServiceError } from "@/lib/service-error";
import { getMyDocuments } from "@/lib/services/documents/get-my-documents";
import { uploadMyDocument } from "@/lib/services/documents/upload-my-document";

export const dynamic = "force-dynamic";

const FORBIDDEN_KEYS = [
  "userId",
  "adherentId",
  "ownerId",
  "auteurId",
  "authorId",
] as const;

/**
 * GET /api/v1/me/documents — mes documents (DTO léger, sans chemin).
 */
export async function GET(request: NextRequest) {
  try {
    const actor = await resolveApiActor(request);
    if (!actor) {
      return apiError("UNAUTHENTICATED", "Non authentifié", 401);
    }

    const params = request.nextUrl.searchParams;
    for (const key of FORBIDDEN_KEYS) {
      if (params.has(key)) {
        throw new ServiceError(
          "VALIDATION_ERROR",
          `Paramètre ${key} non autorisé`
        );
      }
    }

    const documents = await getMyDocuments(actor);
    return apiSuccess(documents);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/v1/me/documents — upload multipart (file + description? + categorie?).
 * Phase 1 : PDF / image uniquement. estPublic forcé false côté service.
 */
export async function POST(request: NextRequest) {
  try {
    const actor = await resolveApiActor(request);
    if (!actor) {
      return apiError("UNAUTHENTICATED", "Non authentifié", 401);
    }

    const contentType = request.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      throw new ServiceError(
        "VALIDATION_ERROR",
        "Content-Type multipart/form-data requis"
      );
    }

    const form = await request.formData();

    for (const key of FORBIDDEN_KEYS) {
      if (form.has(key)) {
        throw new ServiceError(
          "VALIDATION_ERROR",
          `Champ ${key} non autorisé`
        );
      }
    }

    // Refuser injection publication / validation
    if (form.has("estPublic") || form.has("status") || form.has("validated")) {
      throw new ServiceError(
        "VALIDATION_ERROR",
        "Champ de publication non autorisé"
      );
    }

    const file = form.get("file");
    if (!(file instanceof File)) {
      throw new ServiceError("VALIDATION_ERROR", "Fichier manquant");
    }

    const descriptionRaw = form.get("description");
    const categorieRaw = form.get("categorie");
    const description =
      typeof descriptionRaw === "string" ? descriptionRaw : null;
    const categorie = typeof categorieRaw === "string" ? categorieRaw : null;

    const document = await uploadMyDocument(actor, {
      file,
      description,
      categorie,
    });
    return apiSuccess(document, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
