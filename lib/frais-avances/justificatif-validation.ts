/**
 * Validation MIME + magic bytes pour justificatifs notes de frais.
 */

export const NOTES_FRAIS_ALLOWED_MIMES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export const NOTES_FRAIS_MAX_BYTES = 10 * 1024 * 1024;

export type DetectedFileKind = "pdf" | "jpeg" | "png" | "webp";

export function extensionForKind(kind: DetectedFileKind): string {
  switch (kind) {
    case "pdf":
      return "pdf";
    case "jpeg":
      return "jpg";
    case "png":
      return "png";
    case "webp":
      return "webp";
  }
}

export function mimeForKind(kind: DetectedFileKind): string {
  switch (kind) {
    case "pdf":
      return "application/pdf";
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
  }
}

/**
 * Détecte le type réel via magic bytes (ne fait pas confiance au MIME client).
 */
export function detectFileKindFromMagic(buffer: Buffer): DetectedFileKind | null {
  if (buffer.length >= 5 && buffer.subarray(0, 5).toString("ascii") === "%PDF-") {
    return "pdf";
  }
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return "jpeg";
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return "png";
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "webp";
  }
  return null;
}

function normalizeClaimedMime(claimed?: string): string | null {
  if (!claimed) return null;
  const n = claimed.toLowerCase().trim();
  if (n === "image/jpg") return "image/jpeg";
  return n;
}

/**
 * Valide taille + magic bytes. Si un MIME est déclaré, il doit correspondre au contenu.
 */
export function assertAllowedJustificatifBuffer(
  buffer: Buffer,
  claimedMime?: string
): { kind: DetectedFileKind; mime: string; ext: string } {
  if (buffer.length === 0) {
    throw new Error("Fichier vide");
  }
  if (buffer.length > NOTES_FRAIS_MAX_BYTES) {
    throw new Error("Fichier trop volumineux (max 10 Mo)");
  }
  const kind = detectFileKindFromMagic(buffer);
  if (!kind) {
    throw new Error("Contenu de fichier non reconnu (PDF/JPEG/PNG/WEBP)");
  }
  const mime = mimeForKind(kind);
  const claimed = normalizeClaimedMime(claimedMime);
  if (claimed && claimed !== mime) {
    throw new Error("Le type déclaré ne correspond pas au contenu du fichier");
  }
  return { kind, mime, ext: extensionForKind(kind) };
}
