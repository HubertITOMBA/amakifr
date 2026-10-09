import type { MyReunionDto } from "@/api/types";

/**
 * true si la réunion expose un compte rendu publiable côté adhérent.
 */
export function canOpenPublishedReport(
  reunion: Pick<MyReunionDto, "hasPublishedReport" | "publishedReportId">
): boolean {
  return (
    reunion.hasPublishedReport === true &&
    typeof reunion.publishedReportId === "string" &&
    reunion.publishedReportId.trim().length > 0
  );
}

/**
 * Messages utilisateur pour le lecteur de compte rendu (jamais message serveur brut).
 */
export function rapportErrorMessage(error: {
  status: number;
  code: string;
  message: string;
}): string {
  if (error.status === 0 || error.code === "NETWORK_ERROR") {
    return "Serveur injoignable. Vérifiez votre connexion.";
  }
  if (error.status === 401 || error.code === "UNAUTHENTICATED") {
    return "Session expirée. Reconnectez-vous.";
  }
  if (
    error.status === 403 ||
    error.code === "FORBIDDEN" ||
    error.status === 404 ||
    error.code === "NOT_FOUND"
  ) {
    return "Compte rendu indisponible";
  }
  if (error.status >= 500) {
    return "Impossible de charger le compte rendu";
  }
  return "Impossible de charger le compte rendu";
}

/**
 * Formate une date ISO en libellé fr-FR (lecture).
 */
export function formatRapportDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

/**
 * Formate date+heure de publication.
 */
export function formatRapportDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}
