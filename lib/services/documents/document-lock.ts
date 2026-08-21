import type { StatutValidationDocument } from "@prisma/client";

/**
 * Document verrouillé pour l'adhérent : Valide + Public.
 * Seul l'admin peut alors supprimer ; l'adhérent peut demander la suppression.
 */
export function isDocumentLockedForMember(doc: {
  statutValidation: StatutValidationDocument | string;
  estPublic: boolean;
}): boolean {
  return doc.statutValidation === "Valide" && doc.estPublic === true;
}

/**
 * canDelete self-service (serveur — jamais confiance client).
 */
export function computeCanDeleteDocument(doc: {
  userId: string;
  statutValidation: StatutValidationDocument | string;
  estPublic: boolean;
}, actorUserId: string): boolean {
  if (doc.userId !== actorUserId) return false;
  return !isDocumentLockedForMember(doc);
}

/**
 * canRequestDelete self-service.
 */
export function computeCanRequestDeleteDocument(doc: {
  userId: string;
  statutValidation: StatutValidationDocument | string;
  estPublic: boolean;
}, actorUserId: string): boolean {
  if (doc.userId !== actorUserId) return false;
  return isDocumentLockedForMember(doc);
}

/**
 * Badge affichage validation + publication.
 */
export function documentValidationLabel(
  statutValidation: string,
  estPublic: boolean
): string {
  if (statutValidation === "Valide" && estPublic) return "Validé · Public";
  if (statutValidation === "Valide") return "Validé";
  if (statutValidation === "Rejete") return "Rejeté";
  if (estPublic) return "En attente · Visible admin";
  return "En attente";
}
