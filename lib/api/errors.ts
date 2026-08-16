import type { NextResponse } from "next/server";
import { isServiceError, type ServiceErrorCode } from "@/lib/service-error";
import { apiError } from "@/lib/api/response";

/**
 * Mapping central ServiceError.code → status HTTP.
 * ServiceError reste indépendante d'HTTP ; ce mapping vit uniquement dans la couche API.
 */
export const SERVICE_ERROR_HTTP_STATUS: Record<ServiceErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
};

/**
 * Convertit une erreur (ServiceError ou inconnue) en réponse API JSON.
 * Fail closed : erreur inconnue → 500 générique, log serveur, pas de stack exposée.
 *
 * @param error - Erreur capturée dans un Route Handler
 */
export function handleApiError(error: unknown): NextResponse {
  if (isServiceError(error)) {
    const status = SERVICE_ERROR_HTTP_STATUS[error.code] ?? 500;
    const message =
      error.code === "INTERNAL_ERROR"
        ? "Erreur interne du serveur"
        : error.message;
    return apiError(error.code, message, status);
  }

  console.error("[api/v1] Erreur non gérée:", error);
  return apiError(
    "INTERNAL_ERROR",
    "Erreur interne du serveur",
    500
  );
}
