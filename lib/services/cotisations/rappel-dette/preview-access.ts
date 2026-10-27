/**
 * Accès Lot 2 — prévisualisation dry-run des rappels cotisations/dettes.
 *
 * Helper pur (sans Prisma, auth, ni modules serveur) : importable
 * côté client et serveur. Ne constitue PAS un bypass de permissions globales.
 */

/** Message unique carte / page / action / service. */
export const PREVIEW_RAPPELS_ACCESS_DENIED_MESSAGE =
  "Accès réservé aux administrateurs et au président." as const;

/**
 * Indique si le rôle principal peut accéder à la preview Lot 2.
 * Autorisés : ADMIN, PRESID. Tous les autres rôles (y compris TRESOR, SECRET, etc.) : refus.
 *
 * @param role - Rôle session / acteur (string, enum, null/undefined)
 * @returns true uniquement pour ADMIN ou PRESID (comparaison normalisée)
 */
export function canAccessPreviewRappelsDette(role: unknown): boolean {
  const normalized = String(role ?? "")
    .trim()
    .toUpperCase();
  return normalized === "ADMIN" || normalized === "PRESID";
}
