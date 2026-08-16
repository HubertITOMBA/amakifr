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
