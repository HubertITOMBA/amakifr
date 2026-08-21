import { fetch as expoFetch } from "expo/fetch";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import {
  authenticatedBinaryFetch,
  authenticatedFetch,
} from "@/auth/session";
import type { DocumentDto } from "@/api/types";
import {
  appendJustificatifToFormData,
  buildReactNativeFilePart,
} from "@/api/react-native-form-data-file";

/**
 * GET /api/v1/me/documents
 */
export async function getMyDocuments(): Promise<DocumentDto[]> {
  return authenticatedFetch<DocumentDto[]>("/api/v1/me/documents");
}

export type UploadMyDocumentInput = {
  uri: string;
  name: string;
  mimeType: string;
  description?: string;
  categorie?: string;
};

/**
 * POST multipart /api/v1/me/documents
 * FormData + expo-file-system.File (pas d'asset brut).
 */
export async function uploadMyDocument(
  input: UploadMyDocumentInput
): Promise<DocumentDto> {
  const part = buildReactNativeFilePart({
    uri: input.uri,
    name: input.name,
    mimeType: input.mimeType,
  });

  const form = new FormData();
  form.append("description", input.description?.trim() || "");
  if (input.categorie?.trim()) {
    form.append("categorie", input.categorie.trim());
  }
  await appendJustificatifToFormData(form, "file", part);

  return authenticatedFetch<DocumentDto>("/api/v1/me/documents", {
    method: "POST",
    body: form,
    fetchImpl: expoFetch as unknown as typeof fetch,
    timeoutMs: 30_000,
  });
}

/**
 * DELETE /api/v1/me/documents/[id]
 */
export async function deleteMyDocument(id: string): Promise<{ id: string }> {
  return authenticatedFetch<{ id: string }>(
    `/api/v1/me/documents/${encodeURIComponent(id)}`,
    { method: "DELETE" }
  );
}

/**
 * POST /api/v1/me/documents/[id]/deletion-request
 */
export async function requestMyDocumentDeletion(
  id: string,
  motif?: string
): Promise<{ id: string; statut: string }> {
  return authenticatedFetch<{ id: string; statut: string }>(
    `/api/v1/me/documents/${encodeURIComponent(id)}/deletion-request`,
    {
      method: "POST",
      body: motif ? { motif } : {},
    }
  );
}

/**
 * Télécharge le fichier authentifié puis ouvre le partage OS.
 */
export async function openMyDocumentFile(
  document: Pick<DocumentDto, "id" | "nomOriginal" | "mimeType">
): Promise<"shared" | "unavailable" | "failed"> {
  let buffer: ArrayBuffer;
  try {
    buffer = await authenticatedBinaryFetch(
      `/api/v1/me/documents/${encodeURIComponent(document.id)}/file`,
      { accept: document.mimeType || "*/*" }
    );
  } catch {
    return "failed";
  }

  const safeName = document.nomOriginal.replace(/[^\w.\-]+/g, "_") || "document";
  const file = new File(Paths.cache, `doc_${Date.now()}_${safeName}`);
  try {
    file.write(new Uint8Array(buffer));
  } catch {
    return "failed";
  }

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) return "unavailable";

  try {
    await Sharing.shareAsync(file.uri, {
      mimeType: document.mimeType || "application/octet-stream",
    });
    return "shared";
  } catch {
    return "unavailable";
  }
}
