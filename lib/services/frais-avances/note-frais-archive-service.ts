import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { db } from "@/lib/db";
import {
  absoluteFromRelative,
  assertPathInsideStorageRoot,
  hashIdForLog,
} from "@/lib/frais-avances/storage";
import {
  ARCHIVE_REIDENTIFIABILITY_NOTICE,
  computeRetentionEndsAt,
  resolveEffectiveArchiveRetention,
  type InjectedArchiveRetentionPolicy,
  type RetentionPolicyResolution,
} from "@/lib/frais-avances/retention-policy";
import {
  toNoteFraisArchivePublicDto,
  type NoteFraisArchivePublicDto,
} from "@/lib/frais-avances/dto";
import { canUserReadNotesFraisArchive } from "@/lib/frais-avances/authz";
import { cancelPendingMovesAndEnqueueUnlinks } from "@/lib/services/frais-avances/rgpd-account-deletion";

export type NotesFraisArchiveDbClient = {
  $executeRaw: typeof db.$executeRaw;
  noteFrais: typeof db.noteFrais;
  justificatifNoteFrais: typeof db.justificatifNoteFrais;
  noteFraisFileJob: typeof db.noteFraisFileJob;
  noteFraisOutboxEvent: typeof db.noteFraisOutboxEvent;
  notification: typeof db.notification;
  noteFraisArchive: typeof db.noteFraisArchive;
  justificatifNoteFraisArchive: typeof db.justificatifNoteFraisArchive;
  noteFraisArchiveAccessLog: typeof db.noteFraisArchiveAccessLog;
};

function extFromFilename(name: string): string {
  const m = name.match(/\.([a-z0-9]+)$/i);
  return (m?.[1] || "bin").toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
}

/**
 * Archive atomique des notes SOUMISES dans la TX de suppression compte.
 * Crée des PJ archive en PENDING + jobs MOVE durables (READY après déplacement réel).
 */
export async function archiveSubmittedNotesInTransaction(
  tx: NotesFraisArchiveDbClient,
  noteIds: string[],
  resolution: RetentionPolicyResolution
): Promise<{ archivesCreated: number; moveJobsEnqueued: number }> {
  if (noteIds.length === 0) return { archivesCreated: 0, moveJobsEnqueued: 0 };

  const archivedAt = new Date();
  const retentionEndsAt = computeRetentionEndsAt(archivedAt, resolution);
  if (!retentionEndsAt) {
    throw new Error(
      "Politique de conservation sans durée calculable — archivage impossible"
    );
  }

  let archivesCreated = 0;
  let moveJobsEnqueued = 0;

  for (const noteId of noteIds) {
    const note = await tx.noteFrais.findFirst({
      where: { id: noteId, statut: "SOUMISE" },
      include: {
        Justificatifs: {
          where: { statut: "READY" },
        },
      },
    });
    if (!note || !note.soumiseAt) continue;

    await cancelPendingMovesAndEnqueueUnlinks(tx as never, [noteId]);

    const archive = await tx.noteFraisArchive.create({
      data: {
        dateDepense: note.dateDepense,
        montantDemande: note.montantDemande,
        soumiseAt: note.soumiseAt,
        archivedAt,
        retentionEndsAt,
        reidentifiabilityNotice: ARCHIVE_REIDENTIFIABILITY_NOTICE,
      },
    });
    archivesCreated += 1;

    for (const piece of note.Justificatifs) {
      const justifId = randomUUID().replace(/-/g, "").slice(0, 24);
      const ext = extFromFilename(piece.nomFichierOrig);
      const newRel = path.posix.join("archive", archive.id, `${justifId}.${ext}`);
      let sourceAbs: string;
      try {
        sourceAbs = absoluteFromRelative(piece.cheminRelatif);
      } catch {
        continue;
      }
      const targetAbs = absoluteFromRelative(newRel);

      await tx.justificatifNoteFraisArchive.create({
        data: {
          id: justifId,
          archiveId: archive.id,
          nomFichierOrig: piece.nomFichierOrig,
          cheminRelatif: newRel,
          typeMime: piece.typeMime,
          taille: piece.taille,
          statut: "PENDING",
        },
      });

      await tx.noteFraisFileJob.create({
        data: {
          noteFraisId: null,
          archiveJustificatifId: justifId,
          operation: "MOVE",
          sourcePath: sourceAbs,
          targetPath: targetAbs,
          status: "PENDING",
        },
      });
      moveJobsEnqueued += 1;
    }

    const lien = `/admin/frais-avances/${noteId}`;
    await tx.notification.deleteMany({ where: { lien } });
    await tx.noteFraisOutboxEvent.updateMany({
      where: {
        noteFraisId: noteId,
        status: { in: ["PENDING", "PROCESSING"] },
      },
      data: {
        status: "FAILED",
        lastError: "rgpd_account_archived",
        lockedAt: null,
        lockedBy: null,
        processedAt: new Date(),
      },
    });

    await tx.justificatifNoteFrais.deleteMany({ where: { noteFraisId: noteId } });
    await tx.noteFrais.deleteMany({
      where: { id: noteId, statut: "SOUMISE" },
    });
  }

  console.info("[notes-frais] rgpd_account_archive_submitted", {
    archives: archivesCreated,
    moves: moveJobsEnqueued,
    retentionEnds: retentionEndsAt.toISOString(),
  });

  return { archivesCreated, moveJobsEnqueued };
}

/**
 * Après MOVE réussi vers un justificatif archive : passe PENDING → READY.
 */
export async function markArchiveJustificatifReadyAfterMove(
  client: {
    justificatifNoteFraisArchive: typeof db.justificatifNoteFraisArchive;
  },
  archiveJustificatifId: string
): Promise<void> {
  await client.justificatifNoteFraisArchive.updateMany({
    where: { id: archiveJustificatifId, statut: "PENDING" },
    data: { statut: "READY" },
  });
}

async function logArchiveAccess(
  client: { noteFraisArchiveAccessLog: typeof db.noteFraisArchiveAccessLog },
  input: { archiveId: string; actorUserId: string; action: string }
) {
  await client.noteFraisArchiveAccessLog.create({
    data: {
      archiveId: input.archiveId,
      actorUserId: input.actorUserId,
      action: input.action,
    },
  });
}

/**
 * Liste les archives (DTO sans chemins). Authz ADMIN|TRESOR|COMCPT.
 */
export async function listNotesFraisArchives(input: {
  userId: string;
  client?: typeof db;
}): Promise<
  | { success: true; data: NoteFraisArchivePublicDto[] }
  | { success: false; error: string }
> {
  const client = input.client ?? db;
  try {
    if (!(await canUserReadNotesFraisArchive(input.userId, client))) {
      return { success: false, error: "Accès archive refusé" };
    }
    const rows = await client.noteFraisArchive.findMany({
      orderBy: { archivedAt: "desc" },
      include: { Justificatifs: true },
    });
    return {
      success: true,
      data: rows.map(toNoteFraisArchivePublicDto),
    };
  } catch (e) {
    console.error("[notes-frais] list archives", e);
    return { success: false, error: "Erreur chargement archives" };
  }
}

/**
 * Détail archive + journal VIEW.
 */
export async function getNotesFraisArchive(input: {
  userId: string;
  archiveId: string;
  client?: typeof db;
}): Promise<
  | { success: true; data: NoteFraisArchivePublicDto }
  | { success: false; error: string }
> {
  const client = input.client ?? db;
  try {
    if (!(await canUserReadNotesFraisArchive(input.userId, client))) {
      return { success: false, error: "Accès archive refusé" };
    }
    const row = await client.noteFraisArchive.findUnique({
      where: { id: input.archiveId },
      include: { Justificatifs: true },
    });
    if (!row) return { success: false, error: "Archive introuvable" };
    await logArchiveAccess(client, {
      archiveId: row.id,
      actorUserId: input.userId,
      action: "VIEW",
    });
    return { success: true, data: toNoteFraisArchivePublicDto(row) };
  } catch (e) {
    console.error("[notes-frais] get archive", e);
    return { success: false, error: "Erreur lecture archive" };
  }
}

/**
 * Téléchargement archive — READY uniquement ; DTO sans chemin.
 */
export async function downloadNotesFraisArchiveJustificatif(input: {
  userId: string;
  justificatifId: string;
  client?: typeof db;
}): Promise<
  | {
      success: true;
      data: { bytes: Buffer; contentType: string; downloadName: string };
    }
  | { success: false; error: string }
> {
  const client = input.client ?? db;
  try {
    if (!(await canUserReadNotesFraisArchive(input.userId, client))) {
      return { success: false, error: "Accès archive refusé" };
    }
    const piece = await client.justificatifNoteFraisArchive.findUnique({
      where: { id: input.justificatifId },
    });
    if (!piece) return { success: false, error: "Pièce introuvable" };
    if (piece.statut !== "READY") {
      return {
        success: false,
        error: "Téléchargement autorisé uniquement pour les pièces READY",
      };
    }
    const abs = absoluteFromRelative(piece.cheminRelatif);
    assertPathInsideStorageRoot(abs);
    const bytes = await readFile(abs);
    await logArchiveAccess(client, {
      archiveId: piece.archiveId,
      actorUserId: input.userId,
      action: "DOWNLOAD",
    });
    return {
      success: true,
      data: {
        bytes,
        contentType: piece.typeMime,
        downloadName: piece.nomFichierOrig,
      },
    };
  } catch (e) {
    console.error("[notes-frais] download archive", {
      err: e instanceof Error ? e.message.slice(0, 120) : "unknown",
      j: hashIdForLog(input.justificatifId),
    });
    return { success: false, error: "Erreur téléchargement" };
  }
}

/**
 * Purge des archives arrivées à échéance : cancel MOVE + UNLINK + delete DB.
 * Les jobs UNLINK survivent (pas de FK bloquante).
 */
export async function processNoteFraisArchivePurgeOnce(
  limit = 20,
  client: typeof db = db,
  now = new Date()
): Promise<number> {
  const due = await client.noteFraisArchive.findMany({
    where: { retentionEndsAt: { lte: now } },
    take: limit,
    orderBy: { retentionEndsAt: "asc" },
    include: { Justificatifs: true },
  });

  let purged = 0;
  for (const archive of due) {
    await client.$transaction(async (tx) => {
      for (const piece of archive.Justificatifs) {
        const pendingMoves = await tx.noteFraisFileJob.findMany({
          where: {
            archiveJustificatifId: piece.id,
            operation: "MOVE",
            status: { in: ["PENDING", "PROCESSING"] },
          },
          select: { id: true, sourcePath: true, targetPath: true },
        });

        if (pendingMoves.length > 0) {
          await tx.noteFraisFileJob.updateMany({
            where: { id: { in: pendingMoves.map((m) => m.id) } },
            data: {
              status: "FAILED",
              lastError: "archive_purge_cancelled_move",
              lockedAt: null,
              lockedBy: null,
              processedAt: new Date(),
            },
          });
        }

        const paths = new Set<string>();
        try {
          paths.add(absoluteFromRelative(piece.cheminRelatif));
        } catch {
          /* ignore */
        }
        for (const m of pendingMoves) {
          if (m.sourcePath) paths.add(m.sourcePath);
          if (m.targetPath) paths.add(m.targetPath);
        }

        for (const p of paths) {
          await tx.noteFraisFileJob.create({
            data: {
              archiveJustificatifId: piece.id,
              operation: "UNLINK",
              sourcePath: null,
              targetPath: p,
              status: "PENDING",
            },
          });
        }
      }

      await tx.noteFraisArchiveAccessLog.deleteMany({
        where: { archiveId: archive.id },
      });
      await tx.justificatifNoteFraisArchive.deleteMany({
        where: { archiveId: archive.id },
      });
      await tx.noteFraisArchive.delete({ where: { id: archive.id } });
    });
    purged += 1;
  }

  if (purged > 0) {
    console.info("[notes-frais] archive_purge", { purged });
  }
  return purged;
}

export type { InjectedArchiveRetentionPolicy };
