import { Prisma, StatutPaiementEvenement } from "@prisma/client";

/**
 * Helpers purs / Decimal pour le paiement des inscriptions événements.
 */

/**
 * Snapshot montant attendu à l'inscription (prix unitaire × places).
 */
export function computeInscriptionMontantAttendu(
  prix: Prisma.Decimal | number | null | undefined,
  nombrePersonnes: number
): Prisma.Decimal {
  if (prix == null) return new Prisma.Decimal(0);
  const unit = new Prisma.Decimal(prix);
  if (unit.lte(0)) return new Prisma.Decimal(0);
  const n = Math.max(1, Math.floor(nombrePersonnes) || 1);
  return unit.mul(n);
}

/**
 * Statut initial à la création d'inscription.
 */
export function initialStatutPaiementEvenement(
  montantAttendu: Prisma.Decimal
): StatutPaiementEvenement {
  return montantAttendu.gt(0)
    ? StatutPaiementEvenement.APayer
    : StatutPaiementEvenement.NonApplicable;
}

/**
 * Montant restant dû (jamais négatif).
 */
export function inscriptionMontantRestant(
  montantAttendu: Prisma.Decimal | number | string,
  montantPaye: Prisma.Decimal | number | string
): Prisma.Decimal {
  const restant = new Prisma.Decimal(montantAttendu).minus(
    new Prisma.Decimal(montantPaye)
  );
  return restant.gt(0) ? restant : new Prisma.Decimal(0);
}

/**
 * Recalcule statutPaiement après crédit / rejet (hors EnAttenteValidation).
 */
export function resolveStatutPaiementAfterAmounts(params: {
  montantAttendu: Prisma.Decimal;
  montantPaye: Prisma.Decimal;
  hasPendingPayment?: boolean;
}): StatutPaiementEvenement {
  if (params.montantAttendu.lte(0)) {
    return StatutPaiementEvenement.NonApplicable;
  }
  if (params.hasPendingPayment) {
    return StatutPaiementEvenement.EnAttenteValidation;
  }
  const restant = inscriptionMontantRestant(
    params.montantAttendu,
    params.montantPaye
  );
  if (restant.lte(0)) return StatutPaiementEvenement.Paye;
  if (params.montantPaye.gt(0)) return StatutPaiementEvenement.PartiellementPaye;
  return StatutPaiementEvenement.APayer;
}

/**
 * Self-service peut-il se désinscrire ?
 */
export function canSelfWithdrawEventInscription(params: {
  montantPaye: Prisma.Decimal | number | string;
  hasPendingPayment: boolean;
}): { allowed: boolean; reason?: string } {
  if (params.hasPendingPayment) {
    return {
      allowed: false,
      reason:
        "Un paiement est en attente de validation. Annulation impossible pour le moment.",
    };
  }
  if (new Prisma.Decimal(params.montantPaye).gt(0)) {
    return {
      allowed: false,
      reason:
        "Cette inscription comporte un paiement. Contactez l'association pour toute demande d'annulation.",
    };
  }
  return { allowed: true };
}

/**
 * Self-service peut-il déclarer un paiement ?
 */
export function canDeclareEventInscriptionPayment(params: {
  statutPaiement: StatutPaiementEvenement | string;
  montantRestant: Prisma.Decimal;
  hasPendingPayment: boolean;
  inscriptionStatut?: string | null;
}): boolean {
  if (params.inscriptionStatut === "Annulee") return false;
  if (params.hasPendingPayment) return false;
  if (params.montantRestant.lte(0)) return false;
  const s = params.statutPaiement;
  return (
    s === StatutPaiementEvenement.APayer ||
    s === StatutPaiementEvenement.PartiellementPaye ||
    s === "APayer" ||
    s === "PartiellementPaye"
  );
}
