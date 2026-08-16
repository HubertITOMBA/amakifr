import { ApiClientError } from "@/api/types";

/**
 * Indique si une erreur de refresh doit invalider les tokens locaux.
 *
 * Session morte (clear) : 401 UNAUTHENTICATED, 403 FORBIDDEN (inactif / email).
 * Transitoire (conserver tokens) : réseau, 429, 500, autres.
 */
export function shouldClearTokensAfterRefreshError(error: unknown): boolean {
  if (!(error instanceof ApiClientError)) {
    return false;
  }
  if (error.status === 401 || error.code === "UNAUTHENTICATED") {
    return true;
  }
  if (error.status === 403 || error.code === "FORBIDDEN") {
    return true;
  }
  return false;
}
