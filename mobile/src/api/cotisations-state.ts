/**
 * Helpers affichage / erreurs pour l'écran Cotisations (purs, testables).
 */

/**
 * Formate une date ISO (échéance) en fr-FR court. Ne crash pas.
 */
export function formatIsoDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return new Intl.DateTimeFormat("fr-FR", {
      dateStyle: "short",
    }).format(d);
  } catch {
    return "—";
  }
}

/**
 * Message utilisateur depuis ApiClientError (cotisations).
 */
export function cotisationErrorMessage(error: {
  status: number;
  code: string;
  message: string;
}): string {
  if (error.status === 0 || error.code === "NETWORK_ERROR") {
    return "Serveur injoignable";
  }
  if (error.status === 429 || error.code === "RATE_LIMITED") {
    return "Trop de requêtes. Réessayez plus tard.";
  }
  if (error.status === 404 || error.code === "NOT_FOUND") {
    return "Aucun dossier adhérent associé";
  }
  if (error.status === 403 || error.code === "FORBIDDEN") {
    return error.message || "Accès refusé.";
  }
  if (error.status >= 500) {
    return "Impossible de charger les cotisations";
  }
  return error.message || "Impossible de charger les cotisations";
}
