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

/**
 * Document de l'utilisateur connecté (DTO self-service).
 *
 * Exclus volontairement : userId, adherentId, nom interne stocké.
 * `chemin` est le chemin relatif public Web (ex. /ressources/documents/…).
 */
export type DocumentDto = {
  id: string;
  nomOriginal: string;
  type: TypeDocumentDto;
  categorie: string | null;
  chemin: string;
  taille: number;
  mimeType: string;
  description: string | null;
  createdAt: string;
};
