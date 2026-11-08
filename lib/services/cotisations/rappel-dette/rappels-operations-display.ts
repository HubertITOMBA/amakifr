/**
 * Libellés et formatage UI Lot 3 — opérations rappels (présentation uniquement).
 * Aucune mutation / token / secret.
 */

/** Gel non rétroactif sur un envoi déjà autorisé. */
export const RAPPEL_DETTE_GEL_NON_RETROACTIF_MESSAGE =
  "Un gel ne peut pas interrompre un envoi déjà autorisé." as const;

/** Erreur réseau / transport sur confirm — résultat serveur inconnu. */
export const RAPPEL_DETTE_CONFIRM_UNCERTAIN_MESSAGE =
  "Résultat incertain : la confirmation n’a pas reçu de réponse fiable. Ne pas renvoyer ni reconfirmer aveuglément — vérifier l’historique des envois." as const;

/**
 * Orientation ops : le blocage UI reste — Actualiser / historique ne lèvent pas l’incertitude.
 */
export const RAPPEL_DETTE_CONFIRM_UNCERTAIN_OPS_HINT =
  "Blocage conservé pour cet adhérent. Actualiser ou relire l’historique ne lève pas l’incertitude. Une vérification est nécessaire." as const;

export const RAPPEL_DETTE_EMAIL_ACCEPTED_UI_LABEL =
  "Accepté par le fournisseur ne signifie pas livré" as const;

export const RAPPEL_DETTE_ENVOI_FLAG_OFF_BANNER =
  "L’envoi de rappels est actuellement désactivé." as const;

export const RAPPEL_DETTE_GEL_FLAG_OFF_BANNER =
  "La gestion des gels est actuellement désactivée." as const;

export const RAPPEL_DETTE_SOURCE_UNAVAILABLE_UI =
  "Historique temporairement indisponible." as const;

export const RAPPEL_DETTE_OPERATIONS_REFRESH_TOAST =
  "Fonctions et historiques actualisés." as const;

/**
 * Libellé français d’un motif de gel (présentation UI uniquement).
 * Ne modifie pas la valeur persistée (`motifCode`).
 *
 * @param motifCode - Code stocké (ex. VERIFICATION_ADMINISTRATIVE)
 */
export function formatRappelDetteGelMotifLabel(
  motifCode: string | null | undefined
): string {
  switch (motifCode) {
    case "CONTESTATION":
      return "Contestation";
    case "VERIFICATION_ADMINISTRATIVE":
      return "Vérification administrative";
    case "AUTRE":
      return "Autre";
    default:
      return motifCode?.trim() ? motifCode : "—";
  }
}

/**
 * Formate une date/heure ISO en fr-FR Europe/Paris (avec secondes).
 *
 * @param iso - Instant ISO ou null
 */
export function formatOperationsDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      timeZone: "Europe/Paris",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(new Date(iso));
  } catch {
    return "—";
  }
}

/**
 * Indique si le jeton de préparation est expiré côté client (horloge locale).
 *
 * @param prepareExpiresAt - ISO du prepare
 * @param nowMs - Instant de référence (tests)
 */
export function isPrepareExpired(
  prepareExpiresAt: string,
  nowMs: number = Date.now()
): boolean {
  const t = Date.parse(prepareExpiresAt);
  if (!Number.isFinite(t)) return true;
  return nowMs >= t;
}
