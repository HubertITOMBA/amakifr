/**
 * Feature flag frais avancés — false par défaut dans tous les environnements.
 * Activation uniquement si NOTES_FRAIS_ENABLED === "true" (strict).
 */

export function isNotesFraisEnabled(): boolean {
  return process.env.NOTES_FRAIS_ENABLED === "true";
}

export const NOTES_FRAIS_DISABLED_MESSAGE =
  "Le module frais avancés n'est pas activé.";

/**
 * Refuse explicitement si le module est désactivé (jamais un faux succès).
 */
export function assertNotesFraisEnabled(): void {
  if (!isNotesFraisEnabled()) {
    throw new NotesFraisDisabledError();
  }
}

export class NotesFraisDisabledError extends Error {
  readonly code = "NOTES_FRAIS_DISABLED" as const;

  constructor(message = NOTES_FRAIS_DISABLED_MESSAGE) {
    super(message);
    this.name = "NotesFraisDisabledError";
  }
}
