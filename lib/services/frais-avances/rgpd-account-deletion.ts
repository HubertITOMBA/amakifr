import { db } from "@/lib/db";
import { absoluteFromRelative, hashIdForLog } from "@/lib/frais-avances/storage";
import {
  resolveEffectiveArchiveRetention,
  type InjectedArchiveRetentionPolicy,
} from "@/lib/frais-avances/retention-policy";
import { archiveSubmittedNotesInTransaction } from "@/lib/services/frais-avances/note-frais-archive-service";

export type NotesFraisDbClient =
  | typeof db
  | {
      $executeRaw: typeof db.$executeRaw;
      noteFrais: typeof db.noteFrais;
      justificatifNoteFrais: typeof db.justificatifNoteFrais;
      noteFraisFileJob: typeof db.noteFraisFileJob;
      noteFraisOutboxEvent: typeof db.noteFraisOutboxEvent;
      notification: typeof db.notification;
      user: typeof db.user;
      noteFraisArchive?: typeof db.noteFraisArchive;
      justificatifNoteFraisArchive?: typeof db.justificatifNoteFraisArchive;
      noteFraisArchiveAccessLog?: typeof db.noteFraisArchiveAccessLog;
    };

export class NotesFraisRgpdBlockError extends Error {
  readonly code = "NOTES_FRAIS_SUBMITTED_RETENTION_REQUIRED" as const;

  constructor(
    message = "Suppression impossible : des notes de frais soumises existent et aucune politique de conservation/destruction des justificatifs originaux n'est validée."
  ) {
    super(message);
    this.name = "NotesFraisRgpdBlockError";
  }
}

/**
 * True uniquement si l'erreur vise explicitement notes_frais / justificatifs_note_frais.
 * meta.table obligatoire pour P2021 — ne pas traiter un P2021 sans table comme « notes absentes ».
 */
export function isNotesFraisTableMissingError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as {
    code?: string;
    meta?: { table?: string; modelName?: string };
    message?: string;
  };
  if (e.code === "P2021") {
    const table = String(e.meta?.table || e.meta?.modelName || "").toLowerCase();
    if (!table) return false;
    return (
      table.includes("notes_frais") ||
      table.includes("notefrais") ||
      table.includes("justificatifs_note_frais")
    );
  }
  if (e.code === "42P01") {
    const msg = String(e.message || "").toLowerCase();
    return msg.includes("notes_frais") || msg.includes("justificatifs_note_frais");
  }
  return false;
}

/**
 * Détection sûre hors transaction : `to_regclass` (autocommit).
 */
export async function isNotesFraisSchemaPresent(
  client: { $queryRaw: typeof db.$queryRaw } = db
): Promise<boolean> {
  const rows = await client.$queryRaw<Array<{ present: boolean | null }>>`
    SELECT to_regclass('public.notes_frais') IS NOT NULL AS present
  `;
  return Boolean(rows[0]?.present);
}

/**
 * Verrouille la ligne User pour sérialiser création/upload/soumission vs suppression compte.
 */
export async function lockUserRowForNotesFrais(
  tx: NotesFraisDbClient,
  userId: string
): Promise<void> {
  await tx.$executeRaw`
    SELECT 1 FROM "users" WHERE id = ${userId} FOR UPDATE
  `;
}

/**
 * Annule les MOVE non terminés d'un périmètre notes et enfile des UNLINK
 * pour source/cible (évite qu'un MOVE post-suppression recrée un fichier).
 */
export async function cancelPendingMovesAndEnqueueUnlinks(
  tx: NotesFraisDbClient,
  noteIds: string[]
): Promise<number> {
  if (noteIds.length === 0) return 0;

  const pendingMoves = await tx.noteFraisFileJob.findMany({
    where: {
      noteFraisId: { in: noteIds },
      operation: "MOVE",
      status: { in: ["PENDING", "PROCESSING"] },
    },
    select: {
      id: true,
      noteFraisId: true,
      sourcePath: true,
      targetPath: true,
    },
  });

  if (pendingMoves.length === 0) return 0;

  await tx.noteFraisFileJob.updateMany({
    where: {
      id: { in: pendingMoves.map((m) => m.id) },
    },
    data: {
      status: "FAILED",
      lastError: "rgpd_or_delete_cancelled_move",
      lockedAt: null,
      lockedBy: null,
      processedAt: new Date(),
    },
  });

  let unlinks = 0;
  const seen = new Set<string>();
  for (const move of pendingMoves) {
    const noteId = move.noteFraisId || noteIds[0]!;
    for (const path of [move.sourcePath, move.targetPath]) {
      if (!path || seen.has(path)) continue;
      seen.add(path);
      await tx.noteFraisFileJob.create({
        data: {
          noteFraisId: noteId,
          operation: "UNLINK",
          sourcePath: null,
          targetPath: path,
          status: "PENDING",
        },
      });
      unlinks += 1;
    }
  }

  return unlinks;
}

export type PrepareNotesFraisResult = {
  skippedSchemaAbsent: boolean;
  draftsRemoved: number;
  archivesCreated: number;
  archiveMoveJobs: number;
  unlinkJobsEnqueued: number;
  outboxCancelled: number;
  notificationsRemoved: number;
  movesCancelled: number;
};

/**
 * Prépare le périmètre notes dans une TX où `notes_frais` existe déjà.
 * SOUMISE sans politique validée/injectée → refus.
 * SOUMISE avec politique → archive privée atomique.
 * BROUILLON → purge sans archive.
 */
export async function prepareNotesFraisForAccountDeletion(
  tx: NotesFraisDbClient,
  userId: string,
  options?: {
    beforeUserLock?: () => Promise<void>;
    afterUserLock?: () => Promise<void>;
    /** Politique injectée — tests uniquement ; aucune durée produit par défaut. */
    injectedRetention?: InjectedArchiveRetentionPolicy | null;
  }
): Promise<PrepareNotesFraisResult> {
  const empty: PrepareNotesFraisResult = {
    skippedSchemaAbsent: false,
    draftsRemoved: 0,
    archivesCreated: 0,
    archiveMoveJobs: 0,
    unlinkJobsEnqueued: 0,
    outboxCancelled: 0,
    notificationsRemoved: 0,
    movesCancelled: 0,
  };

  if (options?.beforeUserLock) {
    await options.beforeUserLock();
  }
  await lockUserRowForNotesFrais(tx, userId);
  if (options?.afterUserLock) {
    await options.afterUserLock();
  }

  await tx.$executeRaw`
    SELECT id FROM notes_frais WHERE "demandeurUserId" = ${userId} FOR UPDATE
  `;

  const notes = await tx.noteFrais.findMany({
    where: { demandeurUserId: userId },
    select: { id: true, statut: true },
  });

  const soumises = notes.filter((n) => n.statut === "SOUMISE");
  const retention = resolveEffectiveArchiveRetention({
    injected: options?.injectedRetention,
  });
  const canArchive =
    retention.status === "validated_injected" ||
    retention.status === "validated";

  let archivesCreated = 0;
  let archiveMoveJobs = 0;

  if (soumises.length > 0) {
    if (!canArchive) {
      throw new NotesFraisRgpdBlockError();
    }
    // Politique env « validated » sans durée mappée : refuse encore (trésorier).
    if (retention.status === "validated") {
      throw new NotesFraisRgpdBlockError(
        "Suppression impossible : politique listée sans durée/archivage mappé — validation trésorier requise."
      );
    }
    const archived = await archiveSubmittedNotesInTransaction(
      tx as never,
      soumises.map((s) => s.id),
      retention
    );
    archivesCreated = archived.archivesCreated;
    archiveMoveJobs = archived.moveJobsEnqueued;
  }

  const drafts = notes.filter((n) => n.statut === "BROUILLON");
  if (drafts.length === 0) {
    return {
      ...empty,
      archivesCreated,
      archiveMoveJobs,
    };
  }

  const draftIds = drafts.map((d) => d.id);

  const pendingMoveCount = await tx.noteFraisFileJob.count({
    where: {
      noteFraisId: { in: draftIds },
      operation: "MOVE",
      status: { in: ["PENDING", "PROCESSING"] },
    },
  });
  const movesCancelledUnlinks = await cancelPendingMovesAndEnqueueUnlinks(
    tx,
    draftIds
  );

  const pieces = await tx.justificatifNoteFrais.findMany({
    where: { noteFraisId: { in: draftIds } },
    select: { id: true, noteFraisId: true, cheminRelatif: true },
  });

  let unlinkJobsEnqueued = movesCancelledUnlinks;
  const unlinkPaths = new Set<string>();
  for (const piece of pieces) {
    let targetPath: string | null = null;
    try {
      targetPath = absoluteFromRelative(piece.cheminRelatif);
    } catch {
      targetPath = null;
    }
    if (!targetPath || unlinkPaths.has(targetPath)) continue;
    unlinkPaths.add(targetPath);
    await tx.noteFraisFileJob.create({
      data: {
        noteFraisId: piece.noteFraisId,
        operation: "UNLINK",
        sourcePath: null,
        targetPath,
        status: "PENDING",
      },
    });
    unlinkJobsEnqueued += 1;
  }

  const outboxCancel = await tx.noteFraisOutboxEvent.updateMany({
    where: {
      noteFraisId: { in: draftIds },
      status: { in: ["PENDING", "PROCESSING"] },
    },
    data: {
      status: "FAILED",
      lastError: "rgpd_account_deletion_cancelled",
      lockedAt: null,
      lockedBy: null,
      processedAt: new Date(),
    },
  });

  let notificationsRemoved = 0;
  for (const id of draftIds) {
    const lien = `/admin/frais-avances/${id}`;
    const res = await tx.notification.deleteMany({
      where: { lien },
    });
    notificationsRemoved += res.count;
  }

  await tx.justificatifNoteFrais.deleteMany({
    where: { noteFraisId: { in: draftIds } },
  });
  const deletedNotes = await tx.noteFrais.deleteMany({
    where: { id: { in: draftIds }, statut: "BROUILLON" },
  });

  console.info("[notes-frais] rgpd_account_deletion_drafts", {
    user: hashIdForLog(userId),
    drafts: deletedNotes.count,
    unlinks: unlinkJobsEnqueued,
    outboxCancelled: outboxCancel.count,
    movesCancelled: pendingMoveCount,
    archives: archivesCreated,
  });

  return {
    skippedSchemaAbsent: false,
    draftsRemoved: deletedNotes.count,
    archivesCreated,
    archiveMoveJobs,
    unlinkJobsEnqueued,
    outboxCancelled: outboxCancel.count,
    notificationsRemoved,
    movesCancelled: pendingMoveCount,
  };
}

/**
 * Suppression compte atomique.
 * Probe schéma hors TX ; si présentes → prepare (archive SOUMISE si politique) + user.delete.
 */
export async function deleteUserAtomicallyWithNotesFraisRgpd(
  userId: string,
  client: {
    $queryRaw: typeof db.$queryRaw;
    $transaction: typeof db.$transaction;
    user: { delete: typeof db.user.delete };
  } = db,
  options?: {
    beforeUserLock?: () => Promise<void>;
    afterUserLock?: () => Promise<void>;
    injectedRetention?: InjectedArchiveRetentionPolicy | null;
  }
): Promise<{
  notesFrais: PrepareNotesFraisResult;
}> {
  const present = await isNotesFraisSchemaPresent(client);
  if (!present) {
    await client.user.delete({ where: { id: userId } });
    return {
      notesFrais: {
        skippedSchemaAbsent: true,
        draftsRemoved: 0,
        archivesCreated: 0,
        archiveMoveJobs: 0,
        unlinkJobsEnqueued: 0,
        outboxCancelled: 0,
        notificationsRemoved: 0,
        movesCancelled: 0,
      },
    };
  }

  return client.$transaction(async (tx) => {
    const notesFrais = await prepareNotesFraisForAccountDeletion(
      tx as NotesFraisDbClient,
      userId,
      options
    );
    await tx.user.delete({ where: { id: userId } });
    return { notesFrais };
  });
}
