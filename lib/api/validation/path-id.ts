import { ServiceError } from "@/lib/service-error";

/**
 * Valide un identifiant de path (non vide après trim).
 * Pas de contrainte cuid/uuid inventée — aligné sur les services Notifications.
 *
 * @param raw - Valeur brute du segment path
 * @returns id trimé
 * @throws {ServiceError} VALIDATION_ERROR si vide
 */
export function requirePathId(raw: string | undefined | null): string {
  const id = typeof raw === "string" ? raw.trim() : "";
  if (!id) {
    throw new ServiceError("VALIDATION_ERROR", "Identifiant requis");
  }
  return id;
}
