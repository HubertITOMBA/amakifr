/**
 * Helpers purs sondages mobile.
 */

export function sondageErrorMessage(error: {
  status: number;
  code: string;
  message: string;
}): string {
  if (error.status === 0 || error.code === "NETWORK_ERROR") {
    return "Serveur injoignable";
  }
  if (error.status === 403 || error.code === "FORBIDDEN") {
    return error.message || "Ce sondage est maintenant clôturé.";
  }
  if (error.status >= 500) {
    return "Impossible de charger les sondages";
  }
  return error.message || "Impossible de charger les sondages";
}

export function formatSurveyProgress(
  requiredAnswered: number,
  requiredTotal: number
): string {
  if (requiredTotal <= 0) return "Aucune question obligatoire";
  return `${requiredAnswered} question${requiredAnswered !== 1 ? "s" : ""} obligatoire${requiredAnswered !== 1 ? "s" : ""} sur ${requiredTotal} complétée${requiredAnswered !== 1 ? "s" : ""}`;
}

export function formatSurveyPeriod(dateDebut: string, dateFin: string): string {
  try {
    const d1 = new Date(dateDebut);
    const d2 = new Date(dateFin);
    if (Number.isNaN(d1.getTime()) || Number.isNaN(d2.getTime())) return "—";
    const fmt = (d: Date) =>
      new Intl.DateTimeFormat("fr-FR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(d);
    return `${fmt(d1)} → ${fmt(d2)}`;
  } catch {
    return "—";
  }
}

/**
 * Filtre liste « À répondre » — même règle que summary / isSurveyToComplete.
 */
export function filterSurveysToAnswer<
  T extends { estComplet: boolean; modifiable: boolean },
>(items: T[]): T[] {
  return items.filter((s) => !s.estComplet && s.modifiable);
}

/**
 * Compteur accueil (miroir backend countSurveysToComplete).
 */
export function countSurveysToAnswer(
  items: Array<{ estComplet: boolean; modifiable: boolean }>
): number {
  return filterSurveysToAnswer(items).length;
}

/**
 * Affiche bannière / tuile Sondages sur l'accueil uniquement si summary > 0.
 * Source de vérité : GET /api/v1/me/sondages?summary=1 → aCompleterCount.
 *
 * @param aCompleterCount - Compteur renvoyé par le summary API
 */
export function shouldShowHomeSurveyCta(aCompleterCount: number): boolean {
  return Number.isFinite(aCompleterCount) && aCompleterCount > 0;
}
