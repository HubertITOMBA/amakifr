/**
 * Métadonnées passeport adhérent self-service (DTO JSON).
 */
export type MyPasseportDto = {
  numeroPasseport: string | null;
  dateGenerationPasseport: string | null;
  /** Compte actif + dossier adhérent présent */
  disponible: boolean;
  /** Génération possible (disponible et numéro absent) */
  peutGenerer: boolean;
};

export type MyPasseportPdfResult = {
  buffer: Buffer;
  numeroPasseport: string;
  filename: string;
};
