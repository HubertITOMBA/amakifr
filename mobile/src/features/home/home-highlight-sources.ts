import type { MyElectionsSummaryDto } from "@/api/types";
import type { MyEventsSummaryDto } from "@/api/types";
import type { MySurveysSummaryDto } from "@/api/types";
import type { HomeHighlightInput } from "@/features/home/home-model";

/** Entrées par défaut après échec ou avant chargement (compteurs à zéro). */
export const EMPTY_HOME_HIGHLIGHT_INPUT: HomeHighlightInput = {
  electionsCount: 0,
  surveyCount: 0,
  eventsCount: 0,
  nextEventTitle: null,
  nextEventWhen: null,
};

export type HomeHighlightSummaryFetchers = {
  getSurveysSummary: () => Promise<MySurveysSummaryDto>;
  getEventsSummary: () => Promise<MyEventsSummaryDto>;
  getElectionsSummary: () => Promise<MyElectionsSummaryDto>;
};

/**
 * Agrège les trois summaries « À la une » après Promise.allSettled.
 * Une source en erreur ne bloque pas les autres ; compteurs à 0 pour la source fautive.
 */
export function buildHomeHighlightInputFromSettled(
  settled: [
    PromiseSettledResult<MySurveysSummaryDto>,
    PromiseSettledResult<MyEventsSummaryDto>,
    PromiseSettledResult<MyElectionsSummaryDto>,
  ],
  formatEventWhen: (iso: string) => string
): HomeHighlightInput {
  const input: HomeHighlightInput = { ...EMPTY_HOME_HIGHLIGHT_INPUT };

  const [surveys, events, elections] = settled;

  if (surveys.status === "fulfilled") {
    input.surveyCount = surveys.value.aCompleterCount;
  }

  if (elections.status === "fulfilled") {
    input.electionsCount = elections.value.aVoterCount;
  }

  if (events.status === "fulfilled") {
    const summary = events.value;
    input.eventsCount = summary.upcomingCount;
    if (summary.upcomingCount > 0 && summary.nextEvent) {
      input.nextEventTitle = summary.nextEvent.titre;
      input.nextEventWhen = formatEventWhen(summary.nextEvent.dateDebut);
    }
  }

  return input;
}

/**
 * Charge les sources de la bannière accueil (sondages, événements, élections).
 */
export async function loadHomeHighlightInput(
  fetchers: HomeHighlightSummaryFetchers,
  formatEventWhen: (iso: string) => string
): Promise<HomeHighlightInput> {
  const settled = await Promise.allSettled([
    fetchers.getSurveysSummary(),
    fetchers.getEventsSummary(),
    fetchers.getElectionsSummary(),
  ]);
  return buildHomeHighlightInputFromSettled(settled, formatEventWhen);
}

export type HomeHighlightLoadPhase = "loading" | "ready";

/**
 * Afficher la bannière uniquement s’il existe au moins une slide réelle.
 * Loading ou ready sans slide → masqué (pas de fallback ni spinner).
 */
export function shouldRenderHomeHighlightBanner(slideCount: number): boolean {
  return slideCount > 0;
}

/**
 * Pendant un refresh focus : conserver les slides tant que le fetch n’est pas terminé.
 * Ne remet en « loading » (slides vides côté UI) que lors du tout premier chargement.
 */
export function shouldKeepHighlightSlidesDuringRefresh(
  everReady: boolean,
  phase: HomeHighlightLoadPhase
): boolean {
  return everReady && phase === "ready";
}

/**
 * Applique l’input highlight seulement si le cycle focus est encore actif (évite setState après unmount).
 */
export function applyHomeHighlightInputIfActive(
  isActive: () => boolean,
  input: HomeHighlightInput,
  apply: (input: HomeHighlightInput) => void
): void {
  if (!isActive()) return;
  apply(input);
}
