import { readFile } from "fs/promises";
import path from "path";
import type { AuthContext } from "@/lib/auth-context";
import { authorize } from "@/lib/authorize";
import { db } from "@/lib/db";
import { ServiceError } from "@/lib/service-error";

export type JustificatifFileResult = {
  absolutePath: string;
  contentType: string;
  downloadName: string;
  bytes: Buffer;
};

function contentTypeFromName(name: string): string {
  const ext = path.extname(name).toLowerCase();
  switch (ext) {
    case ".pdf":
      return "application/pdf";
    case ".png":
      return "image/png";
    case ".gif":
      return "image/gif";
    case ".webp":
      return "image/webp";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    default:
      return "application/octet-stream";
  }
}

/**
 * Résout un chemin justificatif stocké en base vers un fichier local sûr.
 * Interdit path traversal ; ne sert que storage privé ou legacy public.
 */
export function resolveJustificatifAbsolutePath(chemin: string): string {
  const raw = String(chemin ?? "").trim();
  if (!raw) {
    throw new ServiceError("NOT_FOUND", "Justificatif introuvable");
  }

  if (
    raw.startsWith("/ressources/justificatifs-paiements/") ||
    raw.startsWith("ressources/justificatifs-paiements/")
  ) {
    const rel = raw.replace(/^\//, "");
    const filename = path.basename(rel);
    const expected = `ressources/justificatifs-paiements/${filename}`;
    if (rel !== expected) {
      throw new ServiceError("VALIDATION_ERROR", "Chemin invalide");
    }
    return path.join(
      process.cwd(),
      "public",
      "ressources",
      "justificatifs-paiements",
      filename
    );
  }

  if (raw.startsWith("private/justificatifs-paiements/")) {
    const rest = raw.slice("private/justificatifs-paiements/".length);
    const filename = path.basename(rest);
    if (!filename || rest !== filename || filename.includes("..")) {
      throw new ServiceError("VALIDATION_ERROR", "Chemin invalide");
    }
    return path.join(
      process.cwd(),
      "storage",
      "justificatifs-paiements",
      filename
    );
  }

  throw new ServiceError("NOT_FOUND", "Justificatif introuvable");
}

/**
 * Sert le justificatif d'un paiement (admin finances).
 */
export async function getPaymentJustificatifForAdmin(
  actor: AuthContext,
  paiementId: string
): Promise<JustificatifFileResult> {
  await authorize({
    actor,
    permissionKey: "getAllPaiements",
    type: "READ",
  });

  const id = String(paiementId ?? "").trim();
  if (!id || id.includes("..") || id.includes("/") || id.includes("\\")) {
    throw new ServiceError("VALIDATION_ERROR", "Identifiant invalide");
  }

  const paiement = await db.paiementCotisation.findUnique({
    where: { id },
    select: { id: true, justificatifChemin: true, reference: true },
  });

  if (!paiement) {
    throw new ServiceError("NOT_FOUND", "Paiement introuvable");
  }
  if (!paiement.justificatifChemin) {
    throw new ServiceError("NOT_FOUND", "Justificatif introuvable");
  }

  const absolutePath = resolveJustificatifAbsolutePath(
    paiement.justificatifChemin
  );

  let bytes: Buffer;
  try {
    bytes = await readFile(absolutePath);
  } catch {
    throw new ServiceError("NOT_FOUND", "Justificatif introuvable");
  }

  const downloadName = path.basename(absolutePath);
  return {
    absolutePath,
    contentType: contentTypeFromName(downloadName),
    downloadName,
    bytes,
  };
}
