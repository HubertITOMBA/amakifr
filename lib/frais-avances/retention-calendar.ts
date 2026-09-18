/**
 * Calculs calendaires de conservation notes de frais (lot 4.10).
 * Arithmétique en UTC date-only (pas de millisecondes métier).
 */

export type ExerciceClotureConfig = {
  /** Mois 1–12 */
  mois: number;
  /** Jour 1–31 (validé avec le mois / année) */
  jour: number;
};

export const NOTES_FRAIS_EXERCICE_CLOTURE_INVALID =
  "NOTES_FRAIS_EXERCICE_CLOTURE_INVALID";

/**
 * True si mois/jour forment une date calendaire valide pour l'année donnée (UTC).
 */
export function isValidClotureDay(
  year: number,
  mois: number,
  jour: number
): boolean {
  if (mois < 1 || mois > 12 || jour < 1 || jour > 31) return false;
  const d = new Date(Date.UTC(year, mois - 1, jour));
  return (
    d.getUTCFullYear() === year &&
    d.getUTCMonth() === mois - 1 &&
    d.getUTCDate() === jour
  );
}

/**
 * Construit une date UTC à minuit pour année/mois/jour, ou null si invalide.
 */
export function utcDateOnly(
  year: number,
  mois: number,
  jour: number
): Date | null {
  if (!isValidClotureDay(year, mois, jour)) return null;
  return new Date(Date.UTC(year, mois - 1, jour));
}

/**
 * Clôture de l'exercice comptable contenant `dateEconomique` (typiquement dateDepense).
 *
 * Règle : clôture = prochain (ou égal) mois/jour configuré à partir de la date.
 * Ex. clôture 31/12, date 15/06/2024 → 31/12/2024.
 * Ex. clôture 31/03, date 15/06/2024 → 31/03/2025.
 *
 * @throws Error NOTES_FRAIS_EXERCICE_CLOTURE_INVALID si mois/jour invalides
 */
export function computeExerciceClotureContaining(
  dateEconomique: Date,
  cloture: ExerciceClotureConfig
): Date {
  const y = dateEconomique.getUTCFullYear();
  const candidate = utcDateOnly(y, cloture.mois, cloture.jour);
  if (!candidate) {
    // Essayer année non bissextile pour config 29/02 : invalide sauf années bissextiles
    // Si 29/02 n'existe pas cette année, on tente l'année suivante / précédente via boucle
    throw new Error(NOTES_FRAIS_EXERCICE_CLOTURE_INVALID);
  }

  const dayStart = Date.UTC(
    dateEconomique.getUTCFullYear(),
    dateEconomique.getUTCMonth(),
    dateEconomique.getUTCDate()
  );
  if (dayStart <= candidate.getTime()) {
    return candidate;
  }

  const next = utcDateOnly(y + 1, cloture.mois, cloture.jour);
  if (!next) {
    throw new Error(NOTES_FRAIS_EXERCICE_CLOTURE_INVALID);
  }
  return next;
}

/**
 * Ajoute N années calendaires à une date UTC (même mois/jour si possible).
 * Si le jour n'existe pas (ex. 29/02 + 1 an non bissextile) → dernier jour du mois cible.
 */
export function addCalendarYears(base: Date, years: number): Date {
  if (!Number.isInteger(years) || years < 1) {
    throw new Error("NOTES_FRAIS_RETENTION_YEARS_INVALID");
  }
  const y = base.getUTCFullYear() + years;
  const m = base.getUTCMonth();
  const d = base.getUTCDate();
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const day = Math.min(d, lastDay);
  return new Date(Date.UTC(y, m, day));
}

/**
 * Calcule les trois échéances P1/P2/P3 à partir de la date économique et de la politique.
 */
export function computeRetentionDeadlines(input: {
  dateEconomique: Date;
  p1Years: number;
  p2Years: number;
  p3Years: number;
  cloture: ExerciceClotureConfig;
}): {
  exerciceClotureAt: Date;
  retentionEndsAtP1: Date;
  retentionEndsAtP2: Date;
  retentionEndsAtP3: Date;
} {
  const exerciceClotureAt = computeExerciceClotureContainingSafe(
    input.dateEconomique,
    input.cloture
  );
  return {
    exerciceClotureAt,
    retentionEndsAtP1: addCalendarYears(exerciceClotureAt, input.p1Years),
    retentionEndsAtP2: addCalendarYears(exerciceClotureAt, input.p2Years),
    retentionEndsAtP3: addCalendarYears(exerciceClotureAt, input.p3Years),
  };
}

/**
 * Valide une config de clôture pour une année de référence (et année+1).
 */
export function assertClotureConfigValid(cloture: ExerciceClotureConfig): void {
  const y = new Date().getUTCFullYear();
  for (const year of [y - 1, y, y + 1, 2024, 2025]) {
    if (!isValidClotureDay(year, cloture.mois, cloture.jour)) {
      // 29 février : valide seulement les années bissextiles — config autorisée
      // si au moins une année bissextile proche accepte le jour
      if (cloture.mois === 2 && cloture.jour === 29) {
        const leap = [2024, 2028, 2032].some((ly) =>
          isValidClotureDay(ly, 2, 29)
        );
        if (leap) return;
      }
      throw new Error(NOTES_FRAIS_EXERCICE_CLOTURE_INVALID);
    }
  }
}

/**
 * Pour clôture 29/02 : dans une année non bissextile, utilise le 28/02 comme jour effectif.
 */
export function resolveClotureDateForYear(
  year: number,
  cloture: ExerciceClotureConfig
): Date {
  const exact = utcDateOnly(year, cloture.mois, cloture.jour);
  if (exact) return exact;
  if (cloture.mois === 2 && cloture.jour === 29) {
    const feb28 = utcDateOnly(year, 2, 28);
    if (feb28) return feb28;
  }
  throw new Error(NOTES_FRAIS_EXERCICE_CLOTURE_INVALID);
}

/**
 * Variante robuste de computeExerciceClotureContaining gérant 29/02.
 */
export function computeExerciceClotureContainingSafe(
  dateEconomique: Date,
  cloture: ExerciceClotureConfig
): Date {
  const y = dateEconomique.getUTCFullYear();
  const candidate = resolveClotureDateForYear(y, cloture);
  const dayStart = Date.UTC(
    dateEconomique.getUTCFullYear(),
    dateEconomique.getUTCMonth(),
    dateEconomique.getUTCDate()
  );
  if (dayStart <= candidate.getTime()) {
    return candidate;
  }
  return resolveClotureDateForYear(y + 1, cloture);
}
