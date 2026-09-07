import { ServiceError } from "@/lib/service-error";

const FORBIDDEN_ME_PARAMS = [
  "userId",
  "adherentId",
  "ownerId",
  "createdBy",
  "isAdmin",
  "senderId",
  "expediteurId",
  "participantId",
  "force",
] as const;

/**
 * Rejette les paramètres d'identité injectés sur les routes /api/v1/me/*.
 * L'acteur vient uniquement de resolveApiActor.
 */
export function rejectMeIdorSearchParams(params: URLSearchParams): void {
  for (const key of FORBIDDEN_ME_PARAMS) {
    if (params.has(key)) {
      throw new ServiceError(
        "VALIDATION_ERROR",
        `Paramètre ${key} non autorisé`
      );
    }
  }
}

/**
 * Rejette les champs d'identité injectés dans un body JSON /me.
 */
export function rejectMeIdorBody(body: Record<string, unknown>): void {
  for (const key of FORBIDDEN_ME_PARAMS) {
    if (key in body) {
      throw new ServiceError(
        "VALIDATION_ERROR",
        `Champ ${key} non autorisé`
      );
    }
  }
}
