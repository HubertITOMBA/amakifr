import { createHash, randomUUID } from "node:crypto";
import { mkdir, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Racine privée configurable — hors public/ et hors .next/.
 * Défaut local : <cwd>/data/notes-frais (à gitignorer).
 */
export function getNotesFraisStorageRoot(): string {
  const fromEnv = process.env.NOTES_FRAIS_STORAGE_ROOT?.trim();
  if (fromEnv) {
    return path.resolve(fromEnv);
  }
  return path.resolve(process.cwd(), "data", "notes-frais");
}

export function assertPathInsideStorageRoot(absolutePath: string): string {
  const root = getNotesFraisStorageRoot();
  const resolved = path.resolve(absolutePath);
  const rootWithSep = root.endsWith(path.sep) ? root : root + path.sep;
  if (resolved !== root && !resolved.startsWith(rootWithSep)) {
    throw new Error("Chemin hors racine de stockage notes-frais");
  }
  return resolved;
}

export async function ensureNotesFraisStorageDirs(): Promise<void> {
  const root = getNotesFraisStorageRoot();
  await mkdir(path.join(root, "tmp"), { recursive: true });
  await mkdir(path.join(root, "notes"), { recursive: true });
}

export function buildTempAbsolutePath(uploadId: string, ext: string): string {
  const safeExt = ext.replace(/[^a-z0-9]/gi, "").toLowerCase() || "bin";
  return path.join(getNotesFraisStorageRoot(), "tmp", `${uploadId}.${safeExt}`);
}

export function buildFinalRelativePath(
  noteId: string,
  justificatifId: string,
  ext: string
): string {
  const safeExt = ext.replace(/[^a-z0-9]/gi, "").toLowerCase() || "bin";
  return path.posix.join("notes", noteId, `${justificatifId}.${safeExt}`);
}

export function absoluteFromRelative(relativePath: string): string {
  const normalized = relativePath.replace(/\\/g, "/");
  if (normalized.includes("..")) {
    throw new Error("Chemin relatif invalide");
  }
  return assertPathInsideStorageRoot(
    path.join(getNotesFraisStorageRoot(), ...normalized.split("/"))
  );
}

export async function writeTempFile(
  buffer: Buffer,
  ext: string
): Promise<{ uploadId: string; absolutePath: string }> {
  await ensureNotesFraisStorageDirs();
  const uploadId = randomUUID();
  const absolutePath = buildTempAbsolutePath(uploadId, ext);
  await writeFile(absolutePath, buffer, { mode: 0o600 });
  return { uploadId, absolutePath };
}

export async function moveFileDurable(
  sourceAbs: string,
  targetAbs: string
): Promise<void> {
  assertPathInsideStorageRoot(sourceAbs);
  assertPathInsideStorageRoot(targetAbs);
  await mkdir(path.dirname(targetAbs), { recursive: true });
  await rename(sourceAbs, targetAbs);
}

export async function unlinkQuiet(absolutePath: string): Promise<void> {
  try {
    assertPathInsideStorageRoot(absolutePath);
    await unlink(absolutePath);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException)?.code;
    if (code !== "ENOENT") throw error;
  }
}

/** Empreinte non réversible pour logs (pas d'identité). */
export function hashIdForLog(id: string): string {
  return createHash("sha256").update(id).digest("hex").slice(0, 12);
}
