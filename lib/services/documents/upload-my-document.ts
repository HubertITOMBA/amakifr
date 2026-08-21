import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { TypeDocument } from "@prisma/client";
import { z } from "zod";
import type { AuthContext } from "@/lib/auth-context";
import { db } from "@/lib/db";
import { ServiceError } from "@/lib/service-error";
import {
  mapDocumentToDto,
} from "@/lib/services/documents/get-my-documents";
import type { DocumentDto } from "@/lib/services/documents/types";

/** Aligné Web documents (50 Mo) — serveur autorité. */
export const MY_DOCUMENT_MAX_BYTES = 50 * 1024 * 1024;

/** Phase 1 mobile : PDF + images uniquement (vidéo refusée). */
export const MY_DOCUMENT_ALLOWED_MIMES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
]);

const MetaSchema = z.object({
  description: z.string().max(2000).optional().nullable(),
  categorie: z.string().max(100).optional().nullable(),
});

function typeFromMime(mime: string): TypeDocument {
  if (mime === "application/pdf") return TypeDocument.PDF;
  if (mime.startsWith("image/")) return TypeDocument.Image;
  throw new ServiceError(
    "VALIDATION_ERROR",
    "Format non autorisé (PDF ou image uniquement)"
  );
}

function extensionFromMime(mime: string): string {
  switch (mime) {
    case "application/pdf":
      return "pdf";
    case "image/png":
      return "png";
    case "image/gif":
      return "gif";
    case "image/webp":
      return "webp";
    default:
      return "jpg";
  }
}

export type UploadMyDocumentInput = {
  file: File;
  description?: string | null;
  categorie?: string | null;
};

/**
 * Upload self-service d'un document (PDF / image).
 * Stockage privé : storage/documents/ — chemin DB private/documents/...
 * estPublic forcé à false (publication admin via Web existant).
 *
 * @throws {ServiceError} UNAUTHENTICATED | VALIDATION_ERROR | INTERNAL_ERROR
 */
export async function uploadMyDocument(
  actor: AuthContext,
  input: UploadMyDocumentInput
): Promise<DocumentDto> {
  if (!actor?.userId || String(actor.userId).trim() === "") {
    throw new ServiceError("UNAUTHENTICATED", "Non autorisé");
  }

  const file = input.file;
  if (!file || typeof file.arrayBuffer !== "function") {
    throw new ServiceError("VALIDATION_ERROR", "Aucun fichier fourni");
  }

  const mime = String(file.type || "").toLowerCase().trim();
  if (!MY_DOCUMENT_ALLOWED_MIMES.has(mime)) {
    if (mime.startsWith("video/")) {
      throw new ServiceError(
        "VALIDATION_ERROR",
        "Les vidéos ne sont pas acceptées dans cette version"
      );
    }
    throw new ServiceError(
      "VALIDATION_ERROR",
      "Format non autorisé (PDF ou image uniquement)"
    );
  }

  if (file.size <= 0 || file.size > MY_DOCUMENT_MAX_BYTES) {
    throw new ServiceError(
      "VALIDATION_ERROR",
      "Fichier trop volumineux (max 50 Mo)"
    );
  }

  const meta = MetaSchema.safeParse({
    description: input.description,
    categorie: input.categorie,
  });
  if (!meta.success) {
    throw new ServiceError("VALIDATION_ERROR", "Métadonnées invalides");
  }

  const type = typeFromMime(mime);
  const bytes = Buffer.from(await file.arrayBuffer());

  const { validateFileContent, validateFileSize } = await import(
    "@/lib/file-validation"
  );
  const contentCheck = await validateFileContent(
    bytes,
    mime,
    file.name || `document.${extensionFromMime(mime)}`
  );
  if (!contentCheck.valid) {
    throw new ServiceError(
      "VALIDATION_ERROR",
      contentCheck.error || "Fichier invalide"
    );
  }
  const sizeCheck = validateFileSize(file.size, MY_DOCUMENT_MAX_BYTES, "document");
  if (!sizeCheck.valid) {
    throw new ServiceError(
      "VALIDATION_ERROR",
      sizeCheck.error || "Fichier trop volumineux"
    );
  }

  const adherent = await db.adherent.findUnique({
    where: { userId: actor.userId },
    select: { id: true },
  });

  const ext = extensionFromMime(mime);
  const nom = `${Date.now()}.${ext}`;
  const absDir = path.join(process.cwd(), "storage", "documents");
  await mkdir(absDir, { recursive: true });
  const absPath = path.join(absDir, nom);
  await writeFile(absPath, bytes);

  const chemin = `private/documents/${nom}`;
  const nomOriginal =
    String(file.name || "").trim() || `document.${ext}`;

  try {
    const created = await db.document.create({
      data: {
        userId: actor.userId,
        adherentId: adherent?.id ?? null,
        nom,
        nomOriginal,
        type,
        categorie: meta.data.categorie?.trim() || null,
        chemin,
        taille: file.size,
        mimeType: mime === "image/jpg" ? "image/jpeg" : mime,
        description: meta.data.description?.trim() || null,
        estPublic: false,
        statutValidation: "EnAttente",
      },
      select: {
        id: true,
        userId: true,
        nomOriginal: true,
        type: true,
        categorie: true,
        taille: true,
        mimeType: true,
        description: true,
        createdAt: true,
        estPublic: true,
        statutValidation: true,
      },
    });

    return mapDocumentToDto(created, actor.userId);
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    console.error("[uploadMyDocument] Erreur:", error);
    throw new ServiceError(
      "INTERNAL_ERROR",
      "Erreur lors de l'upload du document"
    );
  }
}
