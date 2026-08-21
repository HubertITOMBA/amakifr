/**
 * Construction multipart fichier pour Expo SDK 57 / winter fetch.
 *
 * Expo `convertFormDataAsync` rejette `{ uri, name, type }`.
 * Il faut un Blob / `expo-file-system.File` (implémente Blob + bytes).
 */

import { File as ExpoFsFile, Paths } from "expo-file-system";
import { guessMimeFromName } from "@/api/payment-account-state";

/**
 * Métadonnées fichier après mapping picker (avant append FormData).
 */
export type ReactNativeFilePart = {
  uri: string;
  name: string;
  type: string;
};

export type ImagePickerAssetLike = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
};

export type DocumentPickerAssetLike = {
  uri: string;
  name: string;
  mimeType?: string | null;
  size?: number | null;
};

function extFromMime(mime: string): string {
  switch (mime.toLowerCase()) {
    case "application/pdf":
      return "pdf";
    case "image/png":
      return "png";
    case "image/gif":
      return "gif";
    case "image/webp":
      return "webp";
    case "image/jpeg":
    case "image/jpg":
      return "jpg";
    default:
      return "bin";
  }
}

/**
 * Nom de fichier sûr si le picker n'en fournit pas.
 */
export function fallbackJustificatifFileName(mime: string): string {
  return `justificatif_${Date.now()}.${extFromMime(mime)}`;
}

/**
 * Construit les métadonnées fichier (uri / name / type) depuis le picker.
 * Ne pas passer l'asset brut au FormData.
 */
export function buildReactNativeFilePart(input: {
  uri: string;
  name?: string | null;
  mimeType?: string | null;
}): ReactNativeFilePart {
  const uri = String(input.uri ?? "").trim();
  if (!uri) {
    throw new Error("URI du justificatif manquante");
  }

  const mimeRaw = String(input.mimeType ?? "").trim();
  const nameRaw = String(input.name ?? "").trim();
  const type =
    mimeRaw ||
    (nameRaw ? guessMimeFromName(nameRaw) : "") ||
    "application/octet-stream";
  const name = nameRaw || fallbackJustificatifFileName(type);

  return { uri, name, type };
}

/**
 * Mapping ImagePicker → métadonnées fichier.
 */
export function mapImagePickerAssetToFilePart(
  asset: ImagePickerAssetLike
): ReactNativeFilePart {
  return buildReactNativeFilePart({
    uri: asset.uri,
    name: asset.fileName,
    mimeType: asset.mimeType,
  });
}

/**
 * Mapping DocumentPicker → métadonnées fichier.
 */
export function mapDocumentPickerAssetToFilePart(
  asset: DocumentPickerAssetLike
): ReactNativeFilePart {
  return buildReactNativeFilePart({
    uri: asset.uri,
    name: asset.name,
    mimeType: asset.mimeType,
  });
}

/**
 * Scheme URI pour logs (__DEV__) — pas le chemin complet.
 */
export function uriSchemeForLog(uri: string): string {
  const m = String(uri).match(/^([a-zA-Z][a-zA-Z0-9+.-]*):/);
  return m?.[1]?.toLowerCase() ?? "unknown";
}

function logDev(message: string): void {
  if (typeof __DEV__ !== "undefined" && __DEV__) {
    // eslint-disable-next-line no-console
    console.log(message);
  }
}

/**
 * Ouvre / prépare un `expo-file-system.File` lisible pour FormData.
 * Copie vers Paths.cache uniquement si le File d'origine n'est pas utilisable.
 */
export async function prepareJustificatifExpoFile(
  part: ReactNativeFilePart
): Promise<ExpoFsFile> {
  logDev("[MOBILE_PAYMENT] before File()");
  let expoFile = new ExpoFsFile(part.uri);
  logDev("[MOBILE_PAYMENT] after File()");

  let exists = Boolean(expoFile.exists);
  let size = Number(expoFile.size ?? 0);
  logDev(`[MOBILE_PAYMENT] file exists=${exists}`);
  logDev(`[MOBILE_PAYMENT] expo file size=${size}`);

  if ((!exists || size <= 0) && uriSchemeForLog(part.uri) === "file") {
    // Tentative de copie cache (URI picker parfois non lisible directement).
    logDev("[MOBILE_PAYMENT] File unreadable — copy to cache");
    const safeName = part.name.replace(/[^\w.\-]+/g, "_");
    const dest = new ExpoFsFile(
      Paths.cache,
      `pay_${Date.now()}_${safeName}`
    );
    try {
      await expoFile.copy(dest);
      expoFile = dest;
      exists = Boolean(expoFile.exists);
      size = Number(expoFile.size ?? 0);
      logDev(`[MOBILE_PAYMENT] after cache copy exists=${exists}`);
      logDev(`[MOBILE_PAYMENT] after cache copy size=${size}`);
    } catch (error) {
      const detail =
        error instanceof Error ? error.message : String(error ?? "unknown");
      logDev(`[MOBILE_PAYMENT] cache copy failed ${detail}`);
    }
  }

  if (!exists || size <= 0) {
    throw new Error(
      "Justificatif illisible sur le téléphone (fichier introuvable ou vide)"
    );
  }

  return expoFile;
}

/**
 * Ajoute le justificatif au FormData (forme Expo documentée la plus simple).
 * `form.append("justificatif", file)` — sans 3e argument filename.
 */
export async function appendJustificatifToFormData(
  form: FormData,
  fieldName: string,
  part: ReactNativeFilePart
): Promise<ExpoFsFile> {
  const expoFile = await prepareJustificatifExpoFile(part);
  logDev("[MOBILE_PAYMENT] before form.append");
  // Forme documentée Expo Winter : append(name, Blob/File) uniquement.
  form.append(fieldName, expoFile as unknown as Blob);
  logDev("[MOBILE_PAYMENT] after form.append");
  return expoFile;
}
