/**
 * Flag d’activation serveur — mutations gels (pose / levée).
 * **Off par défaut.** Indépendant de `RAPPEL_DETTE_ENVOI_ENABLED`.
 * Aucun paramètre client ne peut le forcer.
 */

/**
 * Activation runtime des mutations gels. Toujours `false` en dépôt tant que
 * migrations Lot 3 non appliquées et activation serveur non autorisée.
 */
export const RAPPEL_DETTE_GEL_MUTATION_ENABLED = false as const;

/**
 * Indique si pose/levée gels sont activées côté serveur.
 *
 * @param testOverride - **Uniquement** via deps service / tests.
 *   Ne jamais brancher sur un champ FormData / query / body client.
 */
export function isRappelDetteGelMutationEnabled(
  testOverride?: boolean
): boolean {
  if (typeof testOverride === "boolean") {
    return testOverride;
  }
  return RAPPEL_DETTE_GEL_MUTATION_ENABLED;
}

export const RAPPEL_DETTE_GEL_MUTATION_DISABLED_MESSAGE =
  "La pose et la levée de gels de rappel ne sont pas activées sur ce serveur." as const;
