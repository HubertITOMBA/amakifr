/**
 * Indicateurs de charges / solde bancaire estimé (lot 4.0).
 * Classification exclusivement par `Depense.origine` — jamais par `noteFraisId`.
 */

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

/**
 * Agrège les charges à partir des dépenses validées.
 * Ne classe jamais par présence de `noteFraisId`.
 *
 * @param depenses - Dépenses au statut Valide avec origine
 */
export function computeChargesFromDepensesValides(
  depenses: DepenseValideForSynthese[]
): ChargesSyntheseIndicators {
  let totalCharges = 0;
  let depensesOrdinairesDecaissees = 0;
  for (const d of depenses) {
    const m = Number(d.montant);
    if (!Number.isFinite(m)) continue;
    totalCharges += m;
    if (d.origine === "ORDINAIRE") {
      depensesOrdinairesDecaissees += m;
    }
  }
  return {
    totalCharges: Number(totalCharges.toFixed(2)),
    depensesOrdinairesDecaissees: Number(
      depensesOrdinairesDecaissees.toFixed(2)
    ),
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
  recettesEncaissees: number,
  indicators: Pick<
    ChargesSyntheseIndicators,
    | "depensesOrdinairesDecaissees"
    | "decaissementsNotesFrais"
    | "restitutionsNotesFrais"
  >
): number {
  const solde =
    recettesEncaissees -
    indicators.depensesOrdinairesDecaissees -
    indicators.decaissementsNotesFrais +
    indicators.restitutionsNotesFrais;
  return Number(solde.toFixed(2));
}

/**
 * Injecte le total des compensations notes (lot 4.1+) dans les indicateurs.
 * N'affecte pas le solde bancaire estimé.
 *
 * @param indicators - Indicateurs charges / banque
 * @param compensationsNotesFrais - Σ règlements COMPENSATION EXECUTE
 */
export function withCompensationsNotesFrais(
  indicators: ChargesSyntheseIndicators,
  compensationsNotesFrais: number
): ChargesSyntheseIndicators {
  const v = Number(compensationsNotesFrais);
  return {
    ...indicators,
    compensationsNotesFrais: Number.isFinite(v) ? Number(v.toFixed(2)) : 0,
  };
}

/**
 * Injecte les décaissements notes (remboursements EXECUTE, lot 4.2+).
 * Impacte `soldeBancaireEstime` via `computeSoldeBancaireEstime`.
 *
 * @param indicators - Indicateurs
 * @param decaissementsNotesFrais - Σ règlements REMBOURSEMENT EXECUTE
 */
export function withDecaissementsNotesFrais(
  indicators: ChargesSyntheseIndicators,
  decaissementsNotesFrais: number
): ChargesSyntheseIndicators {
  const v = Number(decaissementsNotesFrais);
  return {
    ...indicators,
    decaissementsNotesFrais: Number.isFinite(v) ? Number(v.toFixed(2)) : 0,
  };
}
