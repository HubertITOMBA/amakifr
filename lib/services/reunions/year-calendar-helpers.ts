/**
 * Helpers calendrier annuel (12 mois) pour proposition d'hôte self-service.
 * Alignés sur createReunionMensuelle (Web).
 */

export const MOIS_LABELS_FR = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
] as const;

export type HostProposalBlockedReason =
  | "ALREADY_HOST_THIS_YEAR"
  | "MONTH_ALREADY_TAKEN"
  | "MONTH_IN_PAST"
  | "STATUS_NOT_ELIGIBLE"
  | "CANCELLED";

export type YearMonthReunionInput = {
  id: string;
  mois: number;
  statut: string;
  dateReunion: Date | null;
  hostId: string | null;
  hostFirstname: string | null;
  hostLastname: string | null;
};

/**
 * Indique si le mois civil (année/mois) est entièrement passé
 * (dernier jour du mois < début de journée courante).
 */
export function isCalendarMonthPast(
  annee: number,
  mois: number,
  now: Date = new Date()
): boolean {
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const lastDay = new Date(annee, mois, 0);
  lastDay.setHours(0, 0, 0, 0);
  return lastDay.getTime() < startOfToday.getTime();
}

/**
 * Règle Web `desisterReunionMensuelle` : désistement si hôte et
 * (pas de date, ou date ≥ aujourd'hui + 28 jours). Aucun filtre de statut.
 */
export function canWithdrawAsReunionHost(input: {
  isCurrentUserHost: boolean;
  dateReunion: Date | null | undefined;
  now?: Date;
}): boolean {
  if (!input.isCurrentUserHost) return false;

  const now = input.now ?? new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const dans28Jours = new Date(startOfToday);
  dans28Jours.setDate(dans28Jours.getDate() + 28);

  if (!input.dateReunion) return true;

  const dateReunion = new Date(input.dateReunion);
  dateReunion.setHours(0, 0, 0, 0);
  return dateReunion.getTime() >= dans28Jours.getTime();
}

/**
 * Détermine l'éligibilité à se proposer comme hôte pour un mois.
 *
 * Disponible si :
 * - aucune ReunionMensuelle pour ce mois (création) ;
 * - ou réunion EnAttente sans hôte (après désistement — reclaim self-service).
 */
export function resolveHostProposalEligibility(input: {
  annee: number;
  mois: number;
  reunion: YearMonthReunionInput | null;
  alreadyHostThisYear: boolean;
  now?: Date;
}): {
  canProposeAsHost: boolean;
  hostProposalBlockedReason: HostProposalBlockedReason | null;
  statusLabel: string;
} {
  const now = input.now ?? new Date();

  if (isCalendarMonthPast(input.annee, input.mois, now)) {
    return {
      canProposeAsHost: false,
      hostProposalBlockedReason: "MONTH_IN_PAST",
      statusLabel: input.reunion
        ? input.reunion.hostId
          ? mapStatutToUiLabel(input.reunion.statut)
          : "Hôte à désigner"
        : "Passé",
    };
  }

  if (input.alreadyHostThisYear) {
    return {
      canProposeAsHost: false,
      hostProposalBlockedReason: "ALREADY_HOST_THIS_YEAR",
      statusLabel: input.reunion
        ? input.reunion.hostId
          ? mapStatutToUiLabel(input.reunion.statut)
          : "Hôte à désigner"
        : "Disponible",
    };
  }

  if (!input.reunion) {
    return {
      canProposeAsHost: true,
      hostProposalBlockedReason: null,
      statusLabel: "Disponible",
    };
  }

  if (input.reunion.statut === "Annulee") {
    return {
      canProposeAsHost: false,
      hostProposalBlockedReason: "CANCELLED",
      statusLabel: "Annulée",
    };
  }

  // Après désistement : EnAttente + sans hôte → reclaim self-service
  if (!input.reunion.hostId && input.reunion.statut === "EnAttente") {
    return {
      canProposeAsHost: true,
      hostProposalBlockedReason: null,
      statusLabel: "Hôte à désigner",
    };
  }

  if (!input.reunion.hostId) {
    return {
      canProposeAsHost: false,
      hostProposalBlockedReason: "STATUS_NOT_ELIGIBLE",
      statusLabel: "Hôte à désigner",
    };
  }

  return {
    canProposeAsHost: false,
    hostProposalBlockedReason: "MONTH_ALREADY_TAKEN",
    statusLabel: mapStatutToUiLabel(input.reunion.statut),
  };
}

/**
 * Libellé UI d'un statut métier Prisma (ou Disponible si pas de réunion).
 */
export function mapStatutToUiLabel(statut: string): string {
  switch (statut) {
    case "DateConfirmee":
      return "Date confirmée";
    case "MoisValide":
      return "Mois validé";
    case "EnAttente":
      return "En attente";
    case "Annulee":
      return "Annulée";
    default:
      return statut;
  }
}

/**
 * Construit les 12 mois d'une année à partir des réunions existantes.
 */
export function buildYearMonths(input: {
  annee: number;
  reunions: YearMonthReunionInput[];
  currentAdherentId: string;
  now?: Date;
}): Array<{
  annee: number;
  mois: number;
  monthLabel: string;
  reunionId: string | null;
  dateReunion: string | null;
  statut: string | null;
  statusLabel: string;
  hostName: string | null;
  isCurrentUserHost: boolean;
  canProposeAsHost: boolean;
  canWithdrawAsHost: boolean;
  hostProposalBlockedReason: HostProposalBlockedReason | null;
}> {
  const now = input.now ?? new Date();
  const byMonth = new Map<number, YearMonthReunionInput>();
  for (const r of input.reunions) {
    byMonth.set(r.mois, r);
  }

  const alreadyHostThisYear = input.reunions.some(
    (r) => r.hostId === input.currentAdherentId
  );

  return Array.from({ length: 12 }, (_, i) => {
    const mois = i + 1;
    const reunion = byMonth.get(mois) ?? null;
    const eligibility = resolveHostProposalEligibility({
      annee: input.annee,
      mois,
      reunion,
      alreadyHostThisYear,
      now,
    });

    const hostName = reunion?.hostId
      ? [reunion.hostFirstname, reunion.hostLastname]
          .filter(Boolean)
          .join(" ")
          .trim() || null
      : null;

    const isCurrentUserHost = reunion?.hostId === input.currentAdherentId;
    const dateConfirmed =
      reunion?.statut === "DateConfirmee" && reunion.dateReunion;

    return {
      annee: input.annee,
      mois,
      monthLabel: MOIS_LABELS_FR[i],
      reunionId: reunion?.id ?? null,
      dateReunion: dateConfirmed ? reunion.dateReunion!.toISOString() : null,
      statut: reunion?.statut ?? null,
      statusLabel: eligibility.statusLabel,
      hostName,
      isCurrentUserHost,
      canProposeAsHost: eligibility.canProposeAsHost,
      canWithdrawAsHost: canWithdrawAsReunionHost({
        isCurrentUserHost,
        // Règle Web : date réelle de la réunion (pas seulement DateConfirmee)
        dateReunion: reunion?.dateReunion ?? null,
        now,
      }),
      hostProposalBlockedReason: eligibility.hostProposalBlockedReason,
    };
  });
}
