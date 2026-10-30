/**
 * Flag d’activation serveur Lot 3 — envoi manuel.
 * **Off par défaut.** Aucun paramètre client ne peut le forcer.
 * L’orchestrateur lit ce flag (ou une injection **deps** réservée aux tests).
 */

/**
 * Activation runtime Lot 3 (envoi). Toujours `false` en dépôt tant que
 * non basculé explicitement par configuration serveur ultérieure.
 */
export const RAPPEL_DETTE_ENVOI_ENABLED = false as const;

/**
 * Indique si l’envoi Lot 3 est activé côté serveur.
 *
 * @param testOverride - **Uniquement** via deps orchestrateur / tests.
 *   Ne jamais brancher sur un champ FormData / query / body client.
 */
export function isRappelDetteEnvoiEnabled(
  testOverride?: boolean
): boolean {
  if (typeof testOverride === "boolean") {
    return testOverride;
  }
  return RAPPEL_DETTE_ENVOI_ENABLED;
}

export const RAPPEL_DETTE_ENVOI_DISABLED_MESSAGE =
  "L’envoi de rappel de dette n’est pas activé sur ce serveur." as const;
