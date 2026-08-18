/**
 * Message utilisateur depuis ApiClientError (passeport).
 */
export function passeportErrorMessage(error: {
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
    return (
      error.message ||
      "Votre passeport sera disponible lorsque votre compte sera actif."
    );
  }
  if (error.status === 404 || error.code === "NOT_FOUND") {
    return "Dossier adhérent introuvable.";
  }
  if (error.status === 409 || error.code === "CONFLICT") {
    return "Votre passeport n'a pas encore été généré.";
  }
  if (error.status === 429 || error.code === "RATE_LIMITED") {
    return "Trop de requêtes. Réessayez plus tard.";
  }
  if (error.status >= 500) {
    return "Impossible d'accéder au passeport";
  }
  return error.message || "Impossible d'accéder au passeport";
}

/**
 * Formate une date ISO pour l'affichage passeport.
 */
export function formatPasseportDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

/**
 * Nom de fichier local cache pour le PDF passeport.
 */
export function passeportLocalFilename(numero: string): string {
  const safe = numero.replace(/[^\w-]/g, "_");
  return `Passeport-AMAKI-${safe}.pdf`;
}
