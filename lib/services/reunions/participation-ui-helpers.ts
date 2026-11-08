/**
 * Helpers UI participation (mobile / web) — logique pure pour tests.
 */

/**
 * Indique si la mise à jour locale / reload doit suivre un succès serveur.
 * Ordre attendu : await API → succès → onSuccess → onReload ; jamais avant.
 */
export function shouldApplyLocalParticipationAfterServer(
  serverSucceeded: boolean
): boolean {
  return serverSucceeded === true;
}
