/**
 * Message utilisateur depuis ApiClientError (tâches).
 */
export function tachesErrorMessage(error: {
  status: number;
  code: string;
  message: string;
}): string {
  if (error.status === 0 || error.code === "NETWORK_ERROR") {
    return "Serveur injoignable";
  }
  if (error.status === 401 || error.code === "UNAUTHENTICATED") {
    return "Session expirée. Reconnectez-vous.";
  }
  if (error.status === 403 || error.code === "FORBIDDEN") {
    return error.message || "Vous n'êtes pas autorisé à effectuer cette action.";
  }
  if (error.status === 404 || error.code === "NOT_FOUND") {
    return "Dossier adhérent introuvable.";
  }
  if (error.status >= 500) {
    return "Impossible de charger les tâches";
  }
  return error.message || "Impossible de charger les tâches";
}

/**
 * Formate une date ISO avec heure pour l'affichage des commentaires.
 */
export function formatTacheDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/**
 * Formate une date ISO pour l'affichage.
 */
export function formatTacheDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}
