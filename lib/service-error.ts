/**
 * Erreur de domaine / service métier.
 * Ne contient pas de Response HTTP ni de status code :
 * le mapping HTTP sera fait plus tard dans /api/v1.
 */

export type ServiceErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INTERNAL_ERROR";

export class ServiceError extends Error {
  readonly code: ServiceErrorCode;
  readonly details?: unknown;

  constructor(code: ServiceErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "ServiceError";
    this.code = code;
    this.details = details;
  }
}

/**
 * Indique si une valeur est une ServiceError.
 */
export function isServiceError(error: unknown): error is ServiceError {
  return error instanceof ServiceError;
}
