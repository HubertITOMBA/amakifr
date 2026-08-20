/**
 * Helpers affichage / erreurs pour l'écran Cotisations (purs, testables).
 */

import type {
  MyAssistanceDto,
  MyCotisationYearItemDto,
  MyDebtDto,
} from "@/api/types";
import type { CotisationStatusDisplay } from "@/api/cotisation-display";
import { mapCotisationStatut } from "@/api/cotisation-display";

export const MOIS_FILTER_ALL = 0;

/** Ordre exact des sections de l'écran Mes cotisations (Phase A). */
export const COTISATION_SCREEN_SECTIONS = [
  "synthese",
  "dettes",
  "cotisations",
  "assistances",
  "historique",
] as const;

export type CotisationScreenSection = (typeof COTISATION_SCREEN_SECTIONS)[number];

export const COTISATION_SECTION_TITLES: Record<CotisationScreenSection, string> =
  {
    synthese: "Synthèse",
    dettes: "Dettes antérieures",
    cotisations: "Cotisation mensuelle forfaitaire",
    assistances: "Assistances",
    historique: "Historique des paiements",
  };

export const MOIS_LABELS_SHORT = [
  "Janv.",
  "Févr.",
  "Mars",
  "Avr.",
  "Mai",
  "Juin",
  "Juil.",
  "Août",
  "Sept.",
  "Oct.",
  "Nov.",
  "Déc.",
] as const;

/**
 * Formate une date ISO (échéance) en fr-FR court. Ne crash pas.
 */
export function formatIsoDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return new Intl.DateTimeFormat("fr-FR", {
      dateStyle: "short",
    }).format(d);
  } catch {
    return "—";
  }
}

/**
 * Libellé période courte pour une assistance (ex. « Mars 2026 »).
 */
export function formatAssistanceMonthLabel(
  item: Pick<MyAssistanceDto, "mois" | "annee">
): string {
  const moisLabel = MOIS_LABELS_SHORT[item.mois - 1] ?? String(item.mois);
  return `${moisLabel} ${item.annee}`;
}

/**
 * Message utilisateur depuis ApiClientError (cotisations).
 */
export function cotisationErrorMessage(error: {
  status: number;
  code: string;
  message: string;
}): string {
  if (error.status === 0 || error.code === "NETWORK_ERROR") {
    return "Serveur injoignable";
  }
  if (error.status === 429 || error.code === "RATE_LIMITED") {
    return "Trop de requêtes. Réessayez plus tard.";
  }
  if (error.status === 404 || error.code === "NOT_FOUND") {
    return "Aucun dossier adhérent associé";
  }
  if (error.status === 403 || error.code === "FORBIDDEN") {
    return error.message || "Accès refusé.";
  }
  if (error.status >= 500) {
    return "Impossible de charger les cotisations";
  }
  return error.message || "Impossible de charger les cotisations";
}

/**
 * Filtre les cotisations d'une année par mois (0 = tous).
 */
export function filterCotisationsByMonth(
  items: MyCotisationYearItemDto[],
  mois: number
): MyCotisationYearItemDto[] {
  if (!mois || mois < 1 || mois > 12) return items;
  return items.filter((c) => c.mois === mois);
}

/**
 * Filtre les assistances par mois civil (0 = tous).
 * Chaque assistance n'apparaît que pour son CotisationMensuelle.mois.
 */
export function filterAssistancesByMonth(
  items: MyAssistanceDto[],
  mois: number
): MyAssistanceDto[] {
  if (!mois || mois < 1 || mois > 12) return items;
  return items.filter((a) => a.mois === mois);
}

/**
 * Affiche un avoir seulement s'il est strictement positif.
 */
export function shouldShowAvoir(
  avoirDisponible: string | null | undefined
): boolean {
  if (!avoirDisponible) return false;
  const n = Number(avoirDisponible);
  return Number.isFinite(n) && n > 0;
}

/**
 * Libellé moyen de paiement.
 */
export function mapMoyenPaiement(moyen: string): string {
  switch (moyen) {
    case "Virement":
      return "Virement";
    case "CarteBancaire":
    case "Stripe":
    case "Mollie":
      return "Carte bancaire";
    case "Especes":
      return "Espèces";
    case "Cheque":
      return "Chèque";
    case "PayPal":
      return "PayPal";
    case "GooglePay":
      return "Google Pay";
    default:
      return moyen;
  }
}

/**
 * Libellé statut dette / assistance / paiement.
 */
export function mapGenericFinanceStatut(statut: string): string {
  switch (statut) {
    case "Paye":
      return "Payé";
    case "EnAttente":
      return "En attente";
    case "PartiellementPaye":
      return "Partiellement payé";
    case "EnRetard":
      return "En retard";
    case "Affecte":
      return "Affecté";
    case "Annule":
      return "Annulé";
    case "Valide":
      return "Validé";
    case "EnCours":
      return "En cours";
    default:
      return statut;
  }
}

/**
 * Badge statut finance (texte + tone) — ne dépend pas uniquement de la couleur.
 */
export function mapFinanceStatutDisplay(statut: string): CotisationStatusDisplay {
  switch (statut) {
    case "Paye":
    case "EnAttente":
    case "PartiellementPaye":
    case "EnRetard":
      return mapCotisationStatut(statut);
    case "Affecte":
      return { label: "Affecté", tone: "primary" };
    case "Annule":
      return { label: "Annulé", tone: "neutral" };
    case "Valide":
      return { label: "Validé", tone: "success" };
    case "EnCours":
      return { label: "En cours", tone: "warning" };
    default:
      return { label: mapGenericFinanceStatut(statut), tone: "neutral" };
  }
}

/**
 * Titre d'affichage : privilégie displayLabel serveur (aligné Web).
 */
export function formatAssistanceTitle(
  item: Pick<MyAssistanceDto, "displayLabel" | "libelle" | "description">
): string {
  if (item.displayLabel?.trim()) return item.displayLabel.trim();
  const typeLabel = item.libelle?.trim() || "Assistance";
  const description = item.description?.trim();
  if (description) {
    return description.includes(" - ")
      ? description
      : `${typeLabel} — ${description}`;
  }
  return typeLabel;
}

export function hasOpenDebt(dettes: MyDebtDto[]): boolean {
  return dettes.some((d) => Number(d.montantRestant) > 0);
}

export function countNestedPayments(
  item: Pick<MyCotisationYearItemDto, "paiements">
): number {
  return item.paiements?.length ?? 0;
}
