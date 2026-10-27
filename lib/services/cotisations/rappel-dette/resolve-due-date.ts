import { parisCivilDate, getParisYmd } from "@/lib/services/cotisations/rappel-dette/paris-calendar";
import { RAPPEL_DETTE_TIMEZONE } from "@/lib/services/cotisations/rappel-dette/types";

/**
 * Échéance d’une CotisationMensuelle : champ `dateEcheance` (déterministe).
 * Normalisée au jour civil Europe/Paris de cette date.
 *
 * @param dateEcheance - Date d’échéance stockée
 */
export function resolveCotisationMensuelleDueDate(dateEcheance: Date): Date {
  const ymd = getParisYmd(dateEcheance);
  return parisCivilDate(ymd.year, ymd.month, ymd.day);
}

/**
 * DetteInitiale n’a **pas** de `dateEcheance` en schéma.
 *
 * Convention Lot 1 (explicite, testable, **pas** `createdAt`) :
 * échéance = **01/01/(annee+1) 00:00 Europe/Paris**.
 *
 * Exemple : dette année 2023 → exigible à partir du 1er janvier 2024 00:00
 * (heure de Paris). J+15 = 16 janvier 2024 (jours civils Paris).
 *
 * Implémentation : janvier est toujours en heure d’hiver en France (CET, UTC+1),
 * donc l’instant est `YYYY-01-01T00:00:00+01:00`.
 *
 * @param annee - Année de la dette initiale
 */
export function resolveDetteInitialeDueDate(annee: number): Date {
  if (!Number.isInteger(annee) || annee < 1900 || annee > 2100) {
    throw new Error("Année de dette initiale invalide");
  }
  const nextYear = annee + 1;
  // 00:00 Europe/Paris le 1er janvier — CET (UTC+1), hors DST en janvier.
  const due = new Date(`${nextYear}-01-01T00:00:00+01:00`);
  const ymd = getParisYmd(due);
  if (ymd.year !== nextYear || ymd.month !== 1 || ymd.day !== 1) {
    throw new Error(
      `Convention DetteInitiale incohérente avec ${RAPPEL_DETTE_TIMEZONE}`
    );
  }
  return due;
}

/**
 * Assistance n’a pas de `dateEcheance` : on utilise `dateEvenement`
 * (seule date métier déterministe disponible), normalisée jour civil Paris.
 * **Ne pas** substituer `createdAt`.
 *
 * @param dateEvenement - Date de l’événement familial
 */
export function resolveAssistanceDueDate(dateEvenement: Date): Date {
  const ymd = getParisYmd(dateEvenement);
  return parisCivilDate(ymd.year, ymd.month, ymd.day);
}
