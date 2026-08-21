/**
 * Types de document (miroir string, pas d'import Prisma obligatoire côté client).
 */
export type TypeDocumentDto =
  | "PDF"
  | "Image"
  | "Video"
  | "Excel"
  | "Word"
  | "Autre";

export type StatutValidationDocumentDto = "EnAttente" | "Valide" | "Rejete";

/**
 * Document de l'utilisateur connecté (DTO self-service).
 * Exclus : userId, adherentId, chemin physique.
 */
export type DocumentDto = {
  id: string;
  nomOriginal: string;
  type: TypeDocumentDto;
  categorie: string | null;
  taille: number;
  mimeType: string;
  description: string | null;
  createdAt: string;
  estPublic: boolean;
  statutValidation: StatutValidationDocumentDto;
  /** Libellé badge combiné validation + publication. */
  statusLabel: string;
  canDelete: boolean;
  canRequestDelete: boolean;
  /** Demande de suppression active (si Valide+Public). */
  deletionRequestStatus: "EnAttente" | "Traitee" | "Annulee" | null;
};

/** Alias explicite mobile. */
export type MyDocumentDto = DocumentDto;
