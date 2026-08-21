import { unlink } from "fs/promises";
import { db } from "@/lib/db";
import { ServiceError } from "@/lib/service-error";
import { resolveDocumentAbsolutePath } from "@/lib/services/documents/resolve-document-path";

/**
 * Valide un document (appelé après contrôle permission admin).
 */
export async function adminValidateDocumentDb(
  adminUserId: string,
  documentId: string
): Promise<{ id: string; statutValidation: string }> {
  const id = String(documentId ?? "").trim();
  if (!id) throw new ServiceError("VALIDATION_ERROR", "Identifiant invalide");

  const document = await db.document.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!document) throw new ServiceError("NOT_FOUND", "Document introuvable");

  const updated = await db.document.update({
    where: { id },
    data: {
      statutValidation: "Valide",
      validatedAt: new Date(),
      validatedBy: adminUserId,
      rejectionReason: null,
    },
    select: { id: true, statutValidation: true },
  });

  return {
    id: updated.id,
    statutValidation: updated.statutValidation,
  };
}

/**
 * Rejette un document — estPublic forcé false ; owner peut supprimer.
 */
export async function adminRejectDocumentDb(
  adminUserId: string,
  documentId: string,
  reason?: string | null
): Promise<{ id: string; statutValidation: string }> {
  const id = String(documentId ?? "").trim();
  if (!id) throw new ServiceError("VALIDATION_ERROR", "Identifiant invalide");

  const document = await db.document.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!document) throw new ServiceError("NOT_FOUND", "Document introuvable");

  const updated = await db.document.update({
    where: { id },
    data: {
      statutValidation: "Rejete",
      validatedAt: new Date(),
      validatedBy: adminUserId,
      rejectionReason: reason?.trim() || null,
      estPublic: false,
    },
    select: { id: true, statutValidation: true },
  });

  return {
    id: updated.id,
    statutValidation: updated.statutValidation,
  };
}

/**
 * Publication admin (indépendante de la propriété du document).
 */
export async function adminSetDocumentPublicDb(
  documentId: string,
  estPublic: boolean
): Promise<{ id: string; estPublic: boolean; statutValidation: string }> {
  const id = String(documentId ?? "").trim();
  if (!id) throw new ServiceError("VALIDATION_ERROR", "Identifiant invalide");

  const document = await db.document.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!document) throw new ServiceError("NOT_FOUND", "Document introuvable");

  return db.document.update({
    where: { id },
    data: { estPublic },
    select: { id: true, estPublic: true, statutValidation: true },
  });
}

/**
 * Suppression admin sécurisée + clôture demandes.
 */
export async function adminDeleteDocumentDb(
  adminUserId: string,
  documentId: string
): Promise<{ id: string }> {
  const id = String(documentId ?? "").trim();
  if (!id || id.includes("..") || id.includes("/") || id.includes("\\")) {
    throw new ServiceError("VALIDATION_ERROR", "Identifiant invalide");
  }

  const document = await db.document.findUnique({
    where: { id },
    select: { id: true, chemin: true },
  });
  if (!document) throw new ServiceError("NOT_FOUND", "Document introuvable");

  try {
    const abs = resolveDocumentAbsolutePath(document.chemin);
    await unlink(abs);
  } catch (fileError) {
    console.warn("[adminDeleteDocumentDb] Fichier:", fileError);
  }

  await db.documentDeletionRequest.updateMany({
    where: { documentId: document.id, statut: "EnAttente" },
    data: {
      statut: "Traitee",
      resolvedAt: new Date(),
      resolvedBy: adminUserId,
    },
  });

  await db.document.delete({ where: { id: document.id } });
  return { id: document.id };
}
