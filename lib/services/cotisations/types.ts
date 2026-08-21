import type { CategorieTypeCotisation } from "@prisma/client";

/**
 * Type de cotisation mensuelle (sous-ensemble JSON-safe) pour DTO self-service.
 */
export type TypeCotisationMensuelleDto = {
  id: string;
  nom: string;
  description: string | null;
  /** Montant catalogue en string décimale (ex. "15", "15.5") — jamais Prisma.Decimal */
  montant: string;
  obligatoire: boolean;
  actif: boolean;
  ordre: number;
  categorie: CategorieTypeCotisation;
  aBeneficiaire: boolean;
};

/**
 * Cotisation mensuelle de l'adhérent connecté (DTO partagé Web/mobile futur).
 *
 * Montants : string décimale via Decimal.toString() (pas Number).
 * Dates : ISO string.
 *
 * Exclus volontairement : User, Adherent complet, Paiements, Stripe/Mollie/PayPal,
 * receiptUrl, justificatifs, createdBy.
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
  /** Un paiement EnAttente existe déjà pour cette dette. */
  hasPendingPayment: boolean;
};

/** Assistance à payer (ligne CotisationMensuelle catégorie Assistance). */
export type MyAssistanceDto = {
  id: string;
  /** Toujours `cotisation` : aligné liste mensuelle Web (pas l’entité Assistance bénéficiaire). */
  source: "cotisation";
  /**
   * Cible de paiement réelle (serveur) — ne pas déduire du libellé UI.
   * Pour les lignes affichées en « Assistances », c’est toujours cotisation-mensuelle.
   */
  paymentTargetType: "cotisation-mensuelle";
  /**
   * Libellé prêt à afficher (règle Web) :
   * ex. « Décès adhérent - Madame Henriette »
   */
  displayLabel: string;
  /** Nom du type de cotisation (ex. « Décès adhérent ») */
  libelle: string;
  /** Description brute Prisma si présente */
  description: string | null;
  /** Mois civil de rattachement (CotisationMensuelle.mois) */
  annee: number;
  mois: number;
  periode: string;
  dateEvenement: string | null;
  typeEvenement: string | null;
  montantAttendu: string;
  montantPaye: string;
  montantRestant: string;
  statut: string;
  /** Un paiement EnAttente existe déjà pour cette ligne CM. */
  hasPendingPayment: boolean;
};

/** Versement self-service (sans secrets / justificatif). */
export type MyPaymentDto = {
  id: string;
  datePaiement: string;
  montant: string;
  moyenPaiement: string;
  statut: string;
  reference: string | null;
  /** Libellé destination déterminé serveur (ex. « Cotisation mars 2026 ») */
  destinationLabel: string;
  cotisationMensuelleId: string | null;
  detteInitialeId: string | null;
  assistanceId: string | null;
};

/** Cotisation annuelle (sans historique détaillé — lazy via /payments). */
export type MyCotisationYearItemDto = CotisationMensuelleDto & {
  hasPendingPayment: boolean;
};

/**
 * Synthèse financière — alignée sur la logique getCumulDette (Web),
 * mais résolue uniquement via actor.userId (jamais adherentId client).
 */
export type MyCotisationYearSummaryDto = {
  detteBrute: string;
  avoirDisponible: string;
  resteNet: string;
  /** Somme des paiements Valide de l'année civile sélectionnée */
  totalPayeAnnee: string;
};

/** Vue annuelle financière self-service (historique paiements hors DTO). */
export type MyCotisationYearDto = {
  annee: number;
  summary: MyCotisationYearSummaryDto;
  /** Cotisations hors catégorie Assistance */
  cotisations: MyCotisationYearItemDto[];
  /** Lignes CotisationMensuelle Assistance (pas l’entité Assistance bénéficiaire) */
  assistances: MyAssistanceDto[];
  dettes: MyDebtDto[];
};

/** Ligne unifiée (vue Toutes les années). */
export type MyCotisationLineDto = {
  kind: "dette" | "cotisation" | "assistance";
  id: string;
  annee: number;
  mois: number | null;
  label: string;
  montantAttendu: string;
  montantPaye: string;
  montantRestant: string;
  statut: string;
  hasPendingPayment: boolean;
  paymentTargetType:
    | "cotisation-mensuelle"
    | "dette-initiale"
    | "assistance"
    | "obligation";
  paymentTargetId: string;
};

/** Page historique paiements. */
export type MyPaymentsPageDto = {
  items: MyPaymentDto[];
  total: number;
  limit: number;
  offset: number;
};

/** Page lignes Toutes les années. */
export type MyCotisationLinesPageDto = {
  items: MyCotisationLineDto[];
  total: number;
  limit: number;
  offset: number;
  summary: MyCotisationYearSummaryDto;
};
