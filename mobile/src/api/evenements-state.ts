import { formatDateTimeFr } from "@/utils/profile-helpers";

/**
 * Helpers purs UI événements.
 */

export function evenementErrorMessage(error: {
  status: number;
  code: string;
  message: string;
}): string {
  if (error.status === 0 || error.code === "NETWORK_ERROR") {
    return "Serveur injoignable";
  }
  if (error.status === 403 || error.code === "FORBIDDEN") {
    return error.message || "Action impossible pour cet événement.";
  }
  if (error.status >= 500) {
    return "Impossible de charger les événements";
  }
  return error.message || "Impossible de charger les événements";
}

/**
 * Période date/heure lisible.
 */
export function formatEventPeriod(
  dateDebut: string,
  dateFin: string | null
): string {
  const start = formatDateTimeFr(dateDebut);
  if (!dateFin) return start;
  try {
    const d1 = new Date(dateDebut);
    const d2 = new Date(dateFin);
    if (Number.isNaN(d1.getTime()) || Number.isNaN(d2.getTime())) return start;
    const sameDay =
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate();
    if (sameDay) {
      const timeEnd = new Intl.DateTimeFormat("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(d2);
      return `${start} → ${timeEnd}`;
    }
    return `${start} → ${formatDateTimeFr(dateFin)}`;
  } catch {
    return start;
  }
}

export function placesLabel(
  placesRestantes: number | null,
  placesDisponibles: number | null
): string | null {
  if (placesDisponibles == null || placesRestantes == null) return null;
  return `${placesRestantes} place${placesRestantes !== 1 ? "s" : ""} restante${placesRestantes !== 1 ? "s" : ""}`;
}

export function shouldShowHomeEventsBanner(upcomingCount: number): boolean {
  return Number.isFinite(upcomingCount) && upcomingCount > 0;
}

/**
 * Classification locale — dateDebut/dateFin uniquement (jamais createdAt).
 */
export function classifyEventTimingFromIso(
  dateDebut: string,
  dateFin: string | null,
  now = new Date()
): "upcoming" | "ongoing" | "past" {
  const start = new Date(dateDebut);
  const end = dateFin ? new Date(dateFin) : null;
  if (Number.isNaN(start.getTime())) return "past";
  if (start > now) return "upcoming";
  if (end != null && !Number.isNaN(end.getTime()) && end >= now) {
    return "ongoing";
  }
  return "past";
}

/**
 * Libellé complet — jamais un seul caractère « À ».
 */
export function formatEventStatusLabel(
  dateDebut: string,
  dateFin: string | null,
  now = new Date()
): "À venir" | "En cours" | "Terminé" {
  const t = classifyEventTimingFromIso(dateDebut, dateFin, now);
  if (t === "upcoming") return "À venir";
  if (t === "ongoing") return "En cours";
  return "Terminé";
}

export function eventStatusTone(
  label: string
): "primary" | "success" | "neutral" | "warning" {
  if (label === "À venir") return "primary";
  if (label === "En cours") return "success";
  if (label === "Terminé" || label === "Archivé") return "neutral";
  return "warning";
}

/**
 * Tarif informatif — pas de paiement événement self-service.
 */
export function formatEventPrix(prix: string | null | undefined): string | null {
  if (prix == null || prix === "") return null;
  const n = Number(prix);
  if (!Number.isFinite(n) || n <= 0) return null;
  return `${n.toFixed(2).replace(".", ",")} €`;
}

/**
 * Total estimé avant inscription (prix × N) — affichage uniquement.
 */
export function formatEventTotalEstimate(
  prix: string | null | undefined,
  nombrePersonnes: number
): string | null {
  if (prix == null || prix === "") return null;
  const n = Number(prix);
  if (!Number.isFinite(n) || n <= 0) return null;
  const total = n * Math.max(1, nombrePersonnes);
  return `${total.toFixed(2).replace(".", ",")} €`;
}

export function eventPaymentStatusLabel(
  statut: string | null | undefined
): string {
  switch (statut) {
    case "APayer":
      return "À payer";
    case "EnAttenteValidation":
      return "En attente de validation";
    case "PartiellementPaye":
      return "Partiellement payé";
    case "Paye":
      return "Payé";
    case "NonApplicable":
      return "Non applicable";
    default:
      return statut || "";
  }
}

/**
 * Libellés d'onglets liste (NBSP pour Android).
 */
export function eventScopeTabLabel(scope: "upcoming" | "past"): string {
  return scope === "past" ? "Passés" : "À venir";
}
