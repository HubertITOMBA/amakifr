/**
 * Paramètre URL `vue` de la section cotisations du profil.
 */

export const COTISATIONS_VUE_VALUES = ["mois", "annee", "toutes"] as const;

export type CotisationsVue = (typeof COTISATIONS_VUE_VALUES)[number];

/** Défaut UI historique lorsque `vue` est absent ou invalide. */
export const COTISATIONS_VUE_DEFAULT: CotisationsVue = "mois";

/**
 * Parse le paramètre URL `vue` (mois | annee | toutes).
 * Retourne null si absent ou invalide — le caller conserve alors le défaut.
 *
 * @param raw - Valeur brute de `searchParams.get("vue")`
 */
export function parseCotisationsVueParam(
  raw: string | null | undefined
): CotisationsVue | null {
  if (raw === "mois" || raw === "annee" || raw === "toutes") {
    return raw;
  }
  return null;
}

/**
 * Résout la vue à appliquer : paramètre valide, sinon défaut.
 *
 * @param raw - Valeur brute éventuelle
 */
export function resolveCotisationsVue(
  raw: string | null | undefined
): CotisationsVue {
  return parseCotisationsVueParam(raw) ?? COTISATIONS_VUE_DEFAULT;
}
