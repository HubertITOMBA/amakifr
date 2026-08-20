/**
 * DTOs réunions mensuelles self-service mobile.
 * Aucune PII d'autres participants (email, liste nominative, adresses multiples).
 */

export type MyReunionHostTelephoneDto = {
  numero: string;
  type: string;
};

export type MyReunionDto = {
  id: string;
  /** Libellé affiché, ex. "Réunion de mars 2026" */
  titre: string;
  annee: number;
  mois: number;
  /**
   * Date/heure ISO uniquement si statut DateConfirmee.
   * null sinon — date non certaine côté métier.
   */
  dateReunion: string | null;
  /** StatutReunionMensuelle */
  statut: string;
  /** TypeLieuReunion */
  typeLieu: string;
  /**
   * Lieu compact (carte fermée) :
   * - Domicile → "Chez Prénom Nom" ou "Hôte à désigner"
   * - Restaurant → "Restaurant …"
   * - Autre → libellé court ou "Lieu à confirmer"
   */
  lieuLabel: string | null;
  /**
   * Adresse complète du lieu (carte dépliée).
   * Absente pour l'historique (minimisation des coordonnées passées).
   */
  lieuAdresse: string | null;
  /** L'adhérent connecté est-il l'hôte ? */
  isHost: boolean;
  /** Prénom + nom de l'hôte */
  hostName: string | null;
  /**
   * Téléphones utiles de l'hôte (futures/actives uniquement).
   * Absent si pas d'hôte ou réunion passée.
   */
  hostTelephones: MyReunionHostTelephoneDto[] | null;
  /**
   * Statut de participation de l'adhérent connecté uniquement.
   * null si aucune réponse enregistrée.
   */
  participationStatus: string | null;
  /** true si l'adhérent peut modifier sa participation (DateConfirmee, future) */
  canUpdateParticipation: boolean;
  /** Commentaires publics de la réunion */
  commentaires: string | null;
};

export type UpdateMyReunionParticipationInput = {
  statut: "Present" | "Absent" | "Excuse";
};

export type UpdateMyReunionParticipationResult = {
  statut: string;
};

export type HostProposalBlockedReason =
  | "ALREADY_HOST_THIS_YEAR"
  | "MONTH_ALREADY_TAKEN"
  | "MONTH_IN_PAST"
  | "STATUS_NOT_ELIGIBLE"
  | "CANCELLED";

export type MyReunionYearMonthDto = {
  annee: number;
  mois: number;
  monthLabel: string;
  reunionId: string | null;
  /** ISO uniquement si DateConfirmee */
  dateReunion: string | null;
  /** Statut Prisma ou null si aucune réunion */
  statut: string | null;
  /** Libellé UI (Disponible, En attente, …) */
  statusLabel: string;
  hostName: string | null;
  isCurrentUserHost: boolean;
  canProposeAsHost: boolean;
  /** true si l'adhérent connecté peut se désister (règle Web 28 jours) */
  canWithdrawAsHost: boolean;
  hostProposalBlockedReason: HostProposalBlockedReason | null;
};

export type WithdrawMyReunionHostProposalResult = {
  id: string;
  annee: number;
  mois: number;
  statut: string;
};

export type MyReunionYearDto = {
  annee: number;
  alreadyHostThisYear: boolean;
  months: MyReunionYearMonthDto[];
};

export type ProposeMyselfAsReunionHostInput = {
  annee: number;
  mois: number;
};

export type ProposeMyselfAsReunionHostResult = {
  id: string;
  annee: number;
  mois: number;
  statut: string;
  hostName: string;
};
