/**
 * Indice UI uniquement — la source de vérité reste le serveur
 * (assertNotesFraisEnabled / actions).
 * NEXT_PUBLIC_NOTES_FRAIS_ENABLED optionnel pour l'UI ; défaut false.
 */
export function isNotesFraisEnabledClientHint(): boolean {
  return process.env.NEXT_PUBLIC_NOTES_FRAIS_ENABLED === "true";
}
