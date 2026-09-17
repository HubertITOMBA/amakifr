/**
 * Indicateurs de charges / solde bancaire estimé (lot 4.0).
 * Classification exclusivement par `Depense.origine` — jamais par `noteFraisId`.
 * Agrégats monétaires via Prisma.Decimal (pas de flottant intermédiaire).
 */

import { Prisma } from "@prisma/client";

export type OrigineDepenseSynthese = "ORDINAIRE" | "FRAIS_AVANCE";

export type DepenseValideForSynthese = {
  montant: number | string;
  origine: OrigineDepenseSynthese;
};

export type ChargesSyntheseIndicators = {
  /** Σ toutes Depense Valide (ORDINAIRE + FRAIS_AVANCE). */
  totalCharges: number;
  /** Σ Depense Valide origine ORDINAIRE (seul impact banque historique). */
  depensesOrdinairesDecaissees: number;
  /** Remboursements nets exécutés (lot 4.2+) — 0 tant que non implémenté. */
  decaissementsNotesFrais: number;
  /** Compensations nettes exécutées (Σ règlements COMPENSATION EXECUTE). */
  compensationsNotesFrais: number;
  /** Restitutions exécutées — 0 tant que non implémenté. */
  restitutionsNotesFrais: number;
  /** Restant dû notes validées — 0 tant que non calculé (lots 4.1+). */
  restantDuNotesFrais: number;
};

function money(v: Prisma.Decimal | number | string): Prisma.Decimal {
  return new Prisma.Decimal(v);
}

function toMoneyNumber(v: Prisma.Decimal): number {
  return Number(v.toFixed(2));
}

/**
 * Agrège les charges à partir des dépenses validées.
 * Ne classe jamais par présence de `noteFraisId`.
 *
 * @param depenses - Dépenses au statut Valide avec origine
 */
export function computeChargesFromDepensesValides(
  depenses: DepenseValideForSynthese[]
): ChargesSyntheseIndicators {
  let totalCharges = money(0);
  let depensesOrdinairesDecaissees = money(0);
  for (const d of depenses) {
    try {
      const m = money(d.montant);
      totalCharges = totalCharges.plus(m);
      if (d.origine === "ORDINAIRE") {
        depensesOrdinairesDecaissees = depensesOrdinairesDecaissees.plus(m);
      }
    } catch {
      // montant non décimal — ignore
    }
  }
  return {
    totalCharges: toMoneyNumber(totalCharges),
    depensesOrdinairesDecaissees: toMoneyNumber(depensesOrdinairesDecaissees),
    decaissementsNotesFrais: 0,
    compensationsNotesFrais: 0,
    restitutionsNotesFrais: 0,
    restantDuNotesFrais: 0,
  };
}

/**
 * Solde bancaire estimé (lot 4.0) :
 * recettes − décaissements ordinaires − décaissements notes + restitutions.
 *
 * @param recettesEncaissees - Σ PaiementCotisation Valide
 * @param indicators - Indicateurs issus de `computeChargesFromDepensesValides`
 */
export function computeSoldeBancaireEstime(
  recettesEncaissees: number | string,
  indicators: Pick<
    ChargesSyntheseIndicators,
    | "depensesOrdinairesDecaissees"
    | "decaissementsNotesFrais"
    | "restitutionsNotesFrais"
  >
): number {
  const solde = money(recettesEncaissees)
    .minus(money(indicators.depensesOrdinairesDecaissees))
    .minus(money(indicators.decaissementsNotesFrais))
    .plus(money(indicators.restitutionsNotesFrais));
  return toMoneyNumber(solde);
}

/**
 * Injecte le total des compensations notes (lot 4.1+) dans les indicateurs.
 * N'affecte pas le solde bancaire estimé.
 *
 * @param indicators - Indicateurs charges / banque
 * @param compensationsNotesFrais - Σ règlements COMPENSATION EXECUTE + corrections négatives
 */
export function withCompensationsNotesFrais(
  indicators: ChargesSyntheseIndicators,
  compensationsNotesFrais: number | string
): ChargesSyntheseIndicators {
  try {
    return {
      ...indicators,
      compensationsNotesFrais: toMoneyNumber(money(compensationsNotesFrais)),
    };
  } catch {
    return { ...indicators, compensationsNotesFrais: 0 };
  }
}

/**
 * Injecte les décaissements notes nets (remboursements EXECUTE + corrections négatives, lot 4.6).
 * Impacte `soldeBancaireEstime` via `computeSoldeBancaireEstime`.
 * Ne pas y intégrer les restitutions — indicateurs séparés (lot 4.7).
 *
 * @param indicators - Indicateurs
 * @param decaissementsNotesFrais - Σ REMBOURSEMENT EXECUTE + corrections MONTANT_NEGATIF
 */
export function withDecaissementsNotesFrais(
  indicators: ChargesSyntheseIndicators,
  decaissementsNotesFrais: number | string
): ChargesSyntheseIndicators {
  try {
    return {
      ...indicators,
      decaissementsNotesFrais: toMoneyNumber(money(decaissementsNotesFrais)),
    };
  } catch {
    return { ...indicators, decaissementsNotesFrais: 0 };
  }
}

/**
 * Injecte les restitutions réelles notes (lot 4.7) — entrée bancaire.
 * N'altère pas `decaissementsNotesFrais`.
 *
 * @param indicators - Indicateurs
 * @param restitutionsNotesFrais - Σ NoteFraisRestitution.montant
 */
export function withRestitutionsNotesFrais(
  indicators: ChargesSyntheseIndicators,
  restitutionsNotesFrais: number | string
): ChargesSyntheseIndicators {
  try {
    return {
      ...indicators,
      restitutionsNotesFrais: toMoneyNumber(money(restitutionsNotesFrais)),
    };
  } catch {
    return { ...indicators, restitutionsNotesFrais: 0 };
  }
}

/**
 * Injecte le restant dû global des notes VALIDEE (choix ACTIF uniquement).
 *
 * @param indicators - Indicateurs
 * @param restantDuNotesFrais - Σ (accepte − rembUtilise − compUtilise)
 */
export function withRestantDuNotesFrais(
  indicators: ChargesSyntheseIndicators,
  restantDuNotesFrais: number | string
): ChargesSyntheseIndicators {
  try {
    const v = money(restantDuNotesFrais);
    if (v.lt(0)) {
      throw new Error("restantDuNotesFrais négatif");
    }
    return {
      ...indicators,
      restantDuNotesFrais: toMoneyNumber(v),
    };
  } catch {
    throw new Error("NOTES_FRAIS_FINANCIAL_STATE_INCONSISTENT");
  }
}
