/**
 * Autorisation lecture `getCumulDette` — séparée du calcul financier.
 *
 * Droit administratif retenu pour une fiche tierce :
 * `canRead(userId, "getAdherentFinancialItems")` — même action que
 * `getAdherentFinancialItems` (Server Action finances adhérent).
 * `hasPermission` accorde tout à `UserRole.ADMIN` → compatible avec
 * l’appelant legacy `checkAndSendRelances` (garde ADMIN puis
 * `getCumulDette(adherent.id)`). Pas de bypass PRESID dédié.
 */

export type AuthorizeCumulDetteResult =
  | { ok: true; mode: "self" | "admin" }
  | { ok: false };

export type AuthorizeCumulDetteDeps = {
  /**
   * Résout l’adhérent lié à la session (lecture self uniquement).
   * Retourne null si aucun adhérent — n’indique pas l’existence d’un tiers.
   */
  resolveSelfAdherentId: (userId: string) => Promise<string | null>;
  /**
   * Permission dynamique READ sur l’action `getAdherentFinancialItems`.
   */
  canReadAdherentFinancialItems: (userId: string) => Promise<boolean>;
};

/**
 * Décide si la session peut lire le cumul de dette pour `targetAdherentId`.
 * Refus avant toute lecture des lignes financières du tiers.
 *
 * @param sessionUserId - ID utilisateur session (absent = refus)
 * @param targetAdherentId - Adhérent demandé
 * @param deps - Résolution self + canRead
 */
export async function authorizeCumulDetteAccess(
  sessionUserId: string | null | undefined,
  targetAdherentId: string,
  deps: AuthorizeCumulDetteDeps
): Promise<AuthorizeCumulDetteResult> {
  if (!sessionUserId || String(sessionUserId).trim() === "") {
    return { ok: false };
  }

  if (!targetAdherentId || String(targetAdherentId).trim() === "") {
    return { ok: false };
  }

  const selfAdherentId = await deps.resolveSelfAdherentId(sessionUserId);
  if (selfAdherentId != null && selfAdherentId === targetAdherentId) {
    return { ok: true, mode: "self" };
  }

  const adminRead = await deps.canReadAdherentFinancialItems(sessionUserId);
  if (adminRead) {
    return { ok: true, mode: "admin" };
  }

  return { ok: false };
}
