import { RAPPEL_DETTE_TIMEZONE } from "@/lib/services/cotisations/rappel-dette/types";

export type ParisYmd = {
  year: number;
  month: number;
  day: number;
};

/**
 * Extrait la date civile (Y-M-D) d’un instant dans le fuseau Europe/Paris.
 *
 * @param date - Instant UTC/local quelconque
 * @returns Année, mois (1–12), jour civils à Paris
 */
export function getParisYmd(date: Date): ParisYmd {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: RAPPEL_DETTE_TIMEZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(date);

  const num = (type: Intl.DateTimeFormatPartTypes): number => {
    const v = parts.find((p) => p.type === type)?.value;
    if (!v) {
      throw new Error(`Impossible d'extraire ${type} en ${RAPPEL_DETTE_TIMEZONE}`);
    }
    return Number(v);
  };

  return {
    year: num("year"),
    month: num("month"),
    day: num("day"),
  };
}

/**
 * Représente un jour civil Paris par un instant stable (midi UTC du Y-M-D).
 * Sert uniquement aux comparaisons / additions de jours civils (pas d’affichage).
 *
 * @param ymd - Jour civil Paris
 */
export function parisYmdToUtcNoon(ymd: ParisYmd): Date {
  return new Date(Date.UTC(ymd.year, ymd.month - 1, ymd.day, 12, 0, 0, 0));
}

/**
 * Nombre de jours civils Europe/Paris entre deux instants (to − from).
 * Ex. même jour civil → 0 ; lendemain → 1.
 *
 * @param from - Instant de début
 * @param to - Instant de fin
 */
export function civilDaysBetweenParis(from: Date, to: Date): number {
  const a = parisYmdToUtcNoon(getParisYmd(from)).getTime();
  const b = parisYmdToUtcNoon(getParisYmd(to)).getTime();
  return Math.round((b - a) / 86_400_000);
}

/**
 * Ajoute N jours civils Europe/Paris à la date civile de `date`.
 *
 * @param date - Instant de référence
 * @param days - Décalage (peut être négatif)
 */
export function addCivilDaysParis(date: Date, days: number): Date {
  const noon = parisYmdToUtcNoon(getParisYmd(date));
  noon.setUTCDate(noon.getUTCDate() + days);
  return noon;
}

/**
 * Construit le jour civil Paris Y-M-D sous forme d’instant midi UTC.
 *
 * @param year - Année
 * @param month - Mois 1–12
 * @param day - Jour
 */
export function parisCivilDate(year: number, month: number, day: number): Date {
  return parisYmdToUtcNoon({ year, month, day });
}
