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
