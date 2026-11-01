/**
 * Constantes / DTO affichage recherche adhérents ops — module pur.
 * Aucun import Node / Prisma / db.
 * Importable côté client et serveur.
 */

export const RAPPEL_DETTE_ADHERENT_SEARCH_MIN_CHARS = 2 as const;
export const RAPPEL_DETTE_ADHERENT_SEARCH_LIMIT = 20 as const;

export const RAPPEL_DETTE_ADHERENT_SEARCH_TRUNCATED_MESSAGE =
  "Résultats tronqués (20 max). Affinez la recherche." as const;

export type RappelDetteAdherentSearchItem = {
  adherentId: string;
  firstname: string;
  lastname: string;
  /**
   * Référence locale aux résultats courants : « Fiche N » pour les seuls
   * homonymes. Jamais de passeport / PII.
   */
  disambiguationLabel: string | null;
};
