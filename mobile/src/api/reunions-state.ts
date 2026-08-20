import type {
  HostProposalBlockedReason,
  MyReunionDto,
  MyReunionYearMonthDto,
} from "@/api/types";

/**
 * Message utilisateur depuis ApiClientError (réunions).
 */
export function reunionsErrorMessage(error: {
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
    return error.message || "Vous n'êtes pas autorisé à consulter les réunions.";
  }
  if (error.status === 404 || error.code === "NOT_FOUND") {
    return "Dossier adhérent introuvable.";
  }
  if (error.status >= 500) {
    return "Impossible de charger les réunions";
  }
  return error.message || "Impossible de charger les réunions";
}

/**
 * Message utilisateur pour erreurs de participation.
 */
export function participationErrorMessage(error: {
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
  if (error.status === 403 || error.code === "FORBIDDEN") {
    return error.message || "Modification non autorisée pour cette réunion.";
  }
  if (error.status === 404 || error.code === "NOT_FOUND") {
    return "Réunion introuvable.";
  }
  if (error.status === 400 || error.code === "VALIDATION_ERROR") {
    return error.message || "Statut de participation invalide.";
  }
  if (error.status >= 500) {
    return "Impossible d'enregistrer votre participation";
  }
  return error.message || "Impossible d'enregistrer votre participation";
}

/**
 * Message utilisateur pour proposition d'hôte.
 */
export function hostProposalErrorMessage(error: {
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
  if (error.status === 403 || error.code === "FORBIDDEN") {
    return (
      error.message ||
      "Vous ne pouvez pas vous proposer comme hôte pour ce mois."
    );
  }
  if (error.status === 409 || error.code === "CONFLICT") {
    return error.message || "Ce mois n'est plus disponible.";
  }
  if (error.status === 400 || error.code === "VALIDATION_ERROR") {
    return error.message || "Données invalides.";
  }
  if (error.status === 404 || error.code === "NOT_FOUND") {
    return "Dossier adhérent introuvable.";
  }
  if (error.status >= 500) {
    return "Impossible d'enregistrer votre proposition";
  }
  return error.message || "Impossible d'enregistrer votre proposition";
}

/**
 * Message utilisateur pour désistement hôte.
 */
export function hostWithdrawErrorMessage(error: {
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
  if (error.status === 403 || error.code === "FORBIDDEN") {
    return (
      error.message ||
      "Vous ne pouvez pas vous désister pour cette réunion."
    );
  }
  if (error.status === 400 || error.code === "VALIDATION_ERROR") {
    return error.message || "Données invalides.";
  }
  if (error.status === 404 || error.code === "NOT_FOUND") {
    return "Réunion introuvable.";
  }
  if (error.status >= 500) {
    return "Impossible d'enregistrer votre désistement";
  }
  return error.message || "Impossible d'enregistrer votre désistement";
}

/**
 * Libellé lisible d'une raison de blocage proposition.
 */
export function hostProposalBlockedLabel(
  reason: HostProposalBlockedReason | null | undefined
): string | null {
  if (!reason) return null;
  switch (reason) {
    case "ALREADY_HOST_THIS_YEAR":
      return "Vous avez déjà accueilli ou réservé une réunion pour cette année.";
    case "MONTH_ALREADY_TAKEN":
      return "Ce mois a déjà un hôte.";
    case "MONTH_IN_PAST":
      return "Ce mois est déjà passé.";
    case "STATUS_NOT_ELIGIBLE":
      return "Ce mois n'est pas disponible pour une proposition.";
    case "CANCELLED":
      return "Cette réunion est annulée.";
    default:
      return null;
  }
}

/**
 * Formate une date/heure de réunion.
 */
export function formatReunionDateTime(iso: string | null | undefined): string {
  if (!iso) return "Date à confirmer";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Date à confirmer";
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/**
 * Formate une date seule (sans heure).
 */
export function formatReunionDate(iso: string | null | undefined): string {
  if (!iso) return "Date à confirmer";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Date à confirmer";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

/**
 * Affiche la date d'une ligne du calendrier annuel.
 */
export function formatYearMonthDate(
  month: Pick<MyReunionYearMonthDto, "dateReunion">
): string {
  return formatReunionDate(month.dateReunion);
}

/**
 * Affiche l'hôte d'une ligne du calendrier annuel.
 */
export function formatYearMonthHost(
  month: Pick<MyReunionYearMonthDto, "hostName">
): string {
  return month.hostName?.trim() || "Hôte à désigner";
}

export const HOST_WITHDRAW_BLOCKED_BY_28_DAYS_MESSAGE =
  "Le désistement n'est plus possible à moins de 28 jours de la réunion.";

/**
 * Message UX quand l'hôte ne peut plus se désister (règle J-28).
 * Affiché seulement si hôte + date confirmée + canWithdrawAsHost=false.
 * La règle métier reste côté serveur (`canWithdrawAsHost`).
 */
export function shouldShowHostWithdrawBlockedBy28DaysMessage(
  month: Pick<
    MyReunionYearMonthDto,
    "isCurrentUserHost" | "dateReunion" | "canWithdrawAsHost"
  >
): boolean {
  if (!month.isCurrentUserHost) return false;
  if (!month.dateReunion) return false;
  if (month.canWithdrawAsHost) return false;
  return true;
}

export type ReunionStatusDisplay = {
  label: string;
  tone: "primary" | "neutral" | "success" | "warning" | "danger";
};

/**
 * Mapping d'affichage des statuts de réunion (valeurs métier inchangées).
 */
export function mapReunionStatut(statut: string): ReunionStatusDisplay {
  switch (statut) {
    case "DateConfirmee":
      return { label: "Confirmée", tone: "success" };
    case "MoisValide":
      return { label: "Mois validé", tone: "primary" };
    case "EnAttente":
      return { label: "En attente", tone: "warning" };
    case "Annulee":
      return { label: "Annulée", tone: "danger" };
    default:
      return { label: statut, tone: "neutral" };
  }
}

/**
 * Mapping d'affichage du libellé annuel (inclut Disponible).
 */
export function mapYearMonthStatusLabel(
  statusLabel: string
): ReunionStatusDisplay {
  switch (statusLabel) {
    case "Disponible":
      return { label: "Disponible", tone: "primary" };
    case "Date confirmée":
      return { label: "Date confirmée", tone: "success" };
    case "Mois validé":
      return { label: "Mois validé", tone: "primary" };
    case "En attente":
      return { label: "En attente", tone: "warning" };
    case "Annulée":
      return { label: "Annulée", tone: "danger" };
    case "Passé":
      return { label: "Passé", tone: "neutral" };
    default:
      return { label: statusLabel, tone: "neutral" };
  }
}

/**
 * Mapping d'affichage du statut de participation propre.
 */
export function mapParticipationStatut(
  statut: string | null
): ReunionStatusDisplay | null {
  if (!statut) return null;
  switch (statut) {
    case "Present":
      return { label: "Présent", tone: "success" };
    case "Absent":
      return { label: "Absent", tone: "danger" };
    case "Excuse":
      return { label: "Excusé", tone: "warning" };
    case "NonRepondu":
      return { label: "Non répondu", tone: "neutral" };
    default:
      return { label: statut, tone: "neutral" };
  }
}

/**
 * Sépare les réunions à venir et l'historique.
 * À venir : date future/aujourd'hui, ou date absente et non annulée.
 * Historique : date passée, ou annulée.
 */
export function splitReunionsByTime(
  reunions: MyReunionDto[],
  now: Date = new Date()
): { upcoming: MyReunionDto[]; past: MyReunionDto[] } {
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  const upcoming: MyReunionDto[] = [];
  const past: MyReunionDto[] = [];

  for (const r of reunions) {
    if (r.statut === "Annulee") {
      past.push(r);
      continue;
    }
    if (!r.dateReunion) {
      upcoming.push(r);
      continue;
    }
    const d = new Date(r.dateReunion);
    if (Number.isNaN(d.getTime()) || d >= startOfToday) {
      upcoming.push(r);
    } else {
      past.push(r);
    }
  }

  upcoming.sort((a, b) => {
    if (!a.dateReunion && !b.dateReunion) {
      return a.annee !== b.annee ? a.annee - b.annee : a.mois - b.mois;
    }
    if (!a.dateReunion) return 1;
    if (!b.dateReunion) return -1;
    return (
      new Date(a.dateReunion).getTime() - new Date(b.dateReunion).getTime()
    );
  });

  past.sort((a, b) => {
    if (!a.dateReunion && !b.dateReunion) {
      return a.annee !== b.annee ? b.annee - a.annee : b.mois - a.mois;
    }
    if (!a.dateReunion) return 1;
    if (!b.dateReunion) return -1;
    return (
      new Date(b.dateReunion).getTime() - new Date(a.dateReunion).getTime()
    );
  });

  return { upcoming, past };
}
