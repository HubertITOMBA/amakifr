/** Contrat API /api/v1 (miroir minimal côté mobile). */

export type ApiErrorBody = {
  code: string;
  message: string;
};

export type ApiSuccessResponse<T> = {
  success: true;
  data?: T;
};

export type ApiErrorResponse = {
  success: false;
  error: ApiErrorBody;
};

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export type AuthUserDto = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  status: string;
};

export type MobileAuthSessionDto = {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
  refreshTokenExpiresAt: string;
  user: AuthUserDto;
};

export type MeAddressDto = {
  id: string;
  streetnum: string | null;
  street1: string | null;
  street2: string | null;
  codepost: string | null;
  city: string | null;
  country: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MeAdherentDto = {
  id: string;
  civility: string;
  firstname: string | null;
  lastname: string | null;
  created_at: string | null;
  updated_at: string | null;
  addresses: MeAddressDto[];
};

export type MeAccountDto = {
  id: string;
  type: string;
  provider: string;
};

export type MeDto = {
  id: string;
  name: string | null;
  email: string | null;
  image?: string | null;
  role: string;
  status: string;
  lastLogin?: string | null;
  createdAt?: string;
  updatedAt?: string;
  adherentId?: string | null;
  adherent?: MeAdherentDto | null;
  accounts?: MeAccountDto[];
};

/** Aligné sur enum Prisma TypeNotification (miroir string, pas d'import Prisma). */
export type TypeNotification =
  | "Systeme"
  | "Email"
  | "Action"
  | "Cotisation"
  | "Idee"
  | "Election"
  | "Evenement"
  | "Chat"
  | "Autre";

export type GetNotificationsOptions = {
  lue?: boolean;
  type?: TypeNotification;
  limit?: number;
  offset?: number;
};

export type NotificationDto = {
  id: string;
  userId: string;
  type: TypeNotification;
  titre: string;
  message: string;
  lien: string | null;
  lue: boolean;
  createdAt: string;
};

export type UnreadCountDto = {
  count: number;
};

export type MarkReadResultDto = {
  updated: true;
};

export type MarkAllReadResultDto = {
  count: number;
};

export type DeleteNotificationResultDto = {
  deleted: true;
};

/**
 * Catégorie type cotisation (miroir string, pas d'import Prisma).
 * Aligné sur enum backend CategorieTypeCotisation.
 */
export type CategorieTypeCotisation =
  | "ForfaitMensuel"
  | "Assistance"
  | "Divers";

/**
 * Type de cotisation mensuelle (sous-ensemble JSON-safe).
 * montant : string décimale — jamais number.
 */
export type TypeCotisationMensuelleDto = {
  id: string;
  nom: string;
  description: string | null;
  montant: string;
  obligatoire: boolean;
  actif: boolean;
  ordre: number;
  categorie: CategorieTypeCotisation;
  aBeneficiaire: boolean;
};

/**
 * Cotisation mensuelle self-service.
 * Montants : string décimale. Dates : ISO string.
 * Pas de relation Prisma complète / paiements / secrets.
 */
export type CotisationMensuelleDto = {
  id: string;
  periode: string;
  annee: number;
  mois: number;
  typeCotisationId: string;
  adherentId: string;
  adherentBeneficiaireId: string | null;
  montantAttendu: string;
  montantPaye: string;
  montantRestant: string;
  dateEcheance: string;
  statut: string;
  description: string | null;
  cotisationDuMoisId: string | null;
  createdAt: string;
  updatedAt: string;
  typeCotisation: TypeCotisationMensuelleDto;
};

/** Dette initiale self-service (lecture). */
export type MyDebtDto = {
  id: string;
  annee: number;
  montant: string;
  montantPaye: string;
  montantRestant: string;
  description: string | null;
};

/** Assistance à payer (ligne CotisationMensuelle catégorie Assistance). */
export type MyAssistanceDto = {
  id: string;
  source: "cotisation";
  /** Libellé Web prêt à afficher (ex. « Décès adhérent - Madame Henriette ») */
  displayLabel: string;
  libelle: string;
  description: string | null;
  annee: number;
  mois: number;
  periode: string;
  dateEvenement: string | null;
  typeEvenement: string | null;
  montantAttendu: string;
  montantPaye: string;
  montantRestant: string;
  statut: string;
};

/** Versement self-service (sans secrets / justificatif). */
export type MyPaymentDto = {
  id: string;
  datePaiement: string;
  montant: string;
  moyenPaiement: string;
  statut: string;
  reference: string | null;
  destinationLabel: string;
  cotisationMensuelleId: string | null;
  detteInitialeId: string | null;
  assistanceId: string | null;
};

export type MyCotisationYearItemDto = CotisationMensuelleDto & {
  paiements: MyPaymentDto[];
};

export type MyCotisationYearSummaryDto = {
  detteBrute: string;
  avoirDisponible: string;
  resteNet: string;
  totalPayeAnnee: string;
};

export type MyCotisationYearDto = {
  annee: number;
  summary: MyCotisationYearSummaryDto;
  cotisations: MyCotisationYearItemDto[];
  assistances: MyAssistanceDto[];
  dettes: MyDebtDto[];
  paiements: MyPaymentDto[];
};



/** Aligné sur enum Prisma TypeDocument (miroir string). */
export type TypeDocument =
  | "PDF"
  | "Image"
  | "Video"
  | "Excel"
  | "Word"
  | "Autre";

/**
 * Document self-service.
 * Dates : ISO string. Pas de userId / adherentId / nom interne.
 */
export type DocumentDto = {
  id: string;
  nomOriginal: string;
  type: TypeDocument;
  categorie: string | null;
  chemin: string;
  taille: number;
  mimeType: string;
  description: string | null;
  createdAt: string;
};

/**
 * Métadonnées passeport self-service (DTO minimal).
 */
export type PasseportDto = {
  numeroPasseport: string | null;
  dateGenerationPasseport: string | null;
  disponible: boolean;
  peutGenerer: boolean;
};

/* ── Tâches ─────────────────────────────────────────────── */

export type MyTacheCommentaireAuteurDto = {
  id: string;
  firstname: string | null;
  lastname: string | null;
};

export type MyTacheCommentaireDto = {
  id: string;
  contenu: string;
  pourcentageAvancement: number | null;
  auteur: MyTacheCommentaireAuteurDto;
  createdAt: string;
};

export type MyTacheProjetDto = {
  id: string;
  titre: string;
};

export type MyTacheDto = {
  id: string;
  titre: string;
  description: string;
  statut: string;
  dateDebut: string | null;
  dateFin: string | null;
  projet: MyTacheProjetDto;
  responsable: boolean;
  commentaires: MyTacheCommentaireDto[];
};

export type CreateMyTacheCommentaireInput = {
  contenu: string;
  pourcentageAvancement?: number | null;
};

export type CreateMyTacheCommentaireResult = {
  id: string;
};

export type MyReunionHostTelephoneDto = {
  numero: string;
  type: string;
};

export type MyReunionDto = {
  id: string;
  titre: string;
  annee: number;
  mois: number;
  dateReunion: string | null;
  statut: string;
  typeLieu: string;
  lieuLabel: string | null;
  lieuAdresse: string | null;
  isHost: boolean;
  hostName: string | null;
  hostTelephones: MyReunionHostTelephoneDto[] | null;
  participationStatus: string | null;
  canUpdateParticipation: boolean;
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
  dateReunion: string | null;
  statut: string | null;
  statusLabel: string;
  hostName: string | null;
  isCurrentUserHost: boolean;
  canProposeAsHost: boolean;
  canWithdrawAsHost: boolean;
  hostProposalBlockedReason: HostProposalBlockedReason | null;
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

export type WithdrawMyReunionHostProposalResult = {
  id: string;
  annee: number;
  mois: number;
  statut: string;
};

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
  }
}
