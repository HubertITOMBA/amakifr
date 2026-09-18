/**
 * Archive privée purgeable (lot 4.9) — jamais source de synthèse.
 * Détachement comptable + journal financier via services dédiés.
 */
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
  isRetentionUsable,
  resolveEffectivePoliciesBundle,
  type InjectedArchiveRetentionPolicy,
  type InjectedNotesFraisRetentionBundle,
  type RetentionPolicyResolution,
} from "@/lib/frais-avances/retention-policy";
import {
  toNoteFraisArchivePublicDto,
  type NoteFraisArchivePublicDto,
} from "@/lib/frais-avances/dto";
import { canUserReadNotesFraisArchive } from "@/lib/frais-avances/authz";
import { cancelPendingMovesAndEnqueueUnlinks } from "@/lib/services/frais-avances/rgpd-account-deletion";
import {
  buildNoteFraisJournalSnapshot,
  insertJournalEvenementsInTx,
} from "@/lib/services/frais-avances/note-frais-journal-financier-service";
import {
  deleteNoteFraisLiveFinancialChainInTx,
  detachAccountingForNoteInTx,
  lockNoteFraisFinancialHistory,
  type DetachDbClient,
} from "@/lib/services/frais-avances/note-frais-detach-service";

/** @deprecated Conservé pour mapping UI historiques — plus levé en 4.9. */
export const NOTES_FRAIS_FINANCIAL_HISTORY_ARCHIVE_REQUIRED =
  "NOTES_FRAIS_FINANCIAL_HISTORY_ARCHIVE_REQUIRED";

export const NOTES_FRAIS_P1_RETENTION_REQUIRED =
  "NOTES_FRAIS_P1_RETENTION_REQUIRED";
export const NOTES_FRAIS_P2_RETENTION_REQUIRED =
  "NOTES_FRAIS_P2_RETENTION_REQUIRED";
export const NOTES_FRAIS_P3_RETENTION_REQUIRED =
  "NOTES_FRAIS_P3_RETENTION_REQUIRED";

/** Payload outbox après archivage RGPD — aucun userId / texte nominatif. */
export const NOTES_FRAIS_OUTBOX_RGPD_PURGED_PAYLOAD = {
  userIds: [] as string[],
};

/**
 * Purge RGPD des outbox d'une note dans la TX d'archivage.
 */
export async function purgeNoteFraisOutboxEventsForArchiveInTx(
  tx: {
    noteFraisOutboxEvent: {
      updateMany: typeof db.noteFraisOutboxEvent.updateMany;
    };
  },
  noteId: string
): Promise<void> {
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
      payload: NOTES_FRAIS_OUTBOX_RGPD_PURGED_PAYLOAD,
    },
  });

  await tx.noteFraisOutboxEvent.updateMany({
    where: {
      noteFraisId: noteId,
      status: { in: ["DONE", "FAILED"] },
    },
    data: {
      payload: NOTES_FRAIS_OUTBOX_RGPD_PURGED_PAYLOAD,
    },
  });
}

export type NotesFraisArchiveDbClient = DetachDbClient & {
  noteFraisFileJob: typeof db.noteFraisFileJob;
  noteFraisOutboxEvent: typeof db.noteFraisOutboxEvent;
  notification: typeof db.notification;
  noteFraisArchive: typeof db.noteFraisArchive;
  justificatifNoteFraisArchive: typeof db.justificatifNoteFraisArchive;
  noteFraisArchiveAccessLog: typeof db.noteFraisArchiveAccessLog;
  noteFraisJournalFinancierEvenement: typeof db.noteFraisJournalFinancierEvenement;
  noteFraisReportFinancierPeriode?: typeof db.noteFraisReportFinancierPeriode;
};

function extFromMimeOrName(typeMime: string, fallbackName?: string | null): string {
  const mimeMap: Record<string, string> = {
    "application/pdf": "pdf",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };
  if (typeMime && mimeMap[typeMime.toLowerCase()]) {
    return mimeMap[typeMime.toLowerCase()];
  }
  if (fallbackName) {
    const m = fallbackName.match(/\.([a-z0-9]+)$/i);
    if (m?.[1]) {
      return m[1].toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
    }
  }
  return "bin";
}

/**
 * Nom technique de téléchargement — jamais le nom original.
 */
export function archiveJustificatifDownloadName(
  rang: number,
  typeMime: string
): string {
  return `justificatif-${rang}.${extFromMimeOrName(typeMime)}`;
}

export type ArchivePoliciesInput = {
  p1: RetentionPolicyResolution;
  p2: RetentionPolicyResolution;
  p3: RetentionPolicyResolution;
};

/**
 * Archive atomique des notes SOUMISE|VALIDEE|REJETEE dans la TX de suppression compte.
 * Crée archive privée + PJ + journal financier + détachement + suppression live.
 */
export async function archiveSubmittedNotesInTransaction(
  tx: NotesFraisArchiveDbClient,
  noteIds: string[],
  resolutionOrPolicies:
    | RetentionPolicyResolution
    | ArchivePoliciesInput
): Promise<{
  archivesCreated: number;
  moveJobsEnqueued: number;
  journalEventsCreated: number;
}> {
  if (noteIds.length === 0) {
    return { archivesCreated: 0, moveJobsEnqueued: 0, journalEventsCreated: 0 };
  }

  // Compat : ancien appel avec une seule résolution P2 → bundle legacy.
  const policies: ArchivePoliciesInput =
    "p1" in resolutionOrPolicies && "p2" in resolutionOrPolicies
      ? resolutionOrPolicies
      : { p1: resolutionOrPolicies, p2: resolutionOrPolicies, p3: resolutionOrPolicies };

  if (!isRetentionUsable(policies.p2)) {
    throw new Error(NOTES_FRAIS_P2_RETENTION_REQUIRED);
  }

  const archivedAt = new Date();
  const retentionEndsAtP2 = computeRetentionEndsAt(archivedAt, policies.p2);
  if (!retentionEndsAtP2) {
    throw new Error(
      "Politique P2 archive privée sans durée calculable — archivage impossible"
    );
  }

  let archivesCreated = 0;
  let moveJobsEnqueued = 0;
  let journalEventsCreated = 0;

  for (const noteId of noteIds) {
    await lockNoteFraisFinancialHistory(tx, noteId);

    const note = await tx.noteFrais.findFirst({
      where: {
        id: noteId,
        statut: { in: ["SOUMISE", "VALIDEE", "REJETEE"] },
      },
      include: {
        Justificatifs: {
          where: { statut: "READY" },
          orderBy: { createdAt: "asc" },
        },
        ChoixReglements: {
          where: { statut: "ACTIF" },
          take: 1,
          select: {
            mode: true,
            montantRemboursement: true,
            montantCompensation: true,
          },
        },
      },
    });
    if (!note || !note.soumiseAt) continue;

    const hasPj = note.Justificatifs.length > 0;
    if (hasPj && !isRetentionUsable(policies.p1)) {
      throw new Error(NOTES_FRAIS_P1_RETENTION_REQUIRED);
    }

    const regCount = await tx.noteFraisReglement.count({
      where: { noteFraisId: noteId },
    });
    const corrCount = await tx.noteFraisReglementCorrection.count({
      where: { Reglement: { noteFraisId: noteId } },
    });
    const restitCount = await tx.noteFraisRestitution.count({
      where: { Reglement: { noteFraisId: noteId } },
    });
    const annulCount = await tx.noteFraisReglementAnnulationDemande.count({
      where: {
        OR: [
          { Reglement: { noteFraisId: noteId } },
          { Operation: { noteFraisId: noteId } },
        ],
      },
    });
    const hasFinancialHistory =
      regCount > 0 || corrCount > 0 || restitCount > 0 || annulCount > 0;

    if (hasFinancialHistory && !isRetentionUsable(policies.p3)) {
      throw new Error(NOTES_FRAIS_P3_RETENTION_REQUIRED);
    }

    let journalEvents = 0;
    if (hasFinancialHistory) {
      const snapshot = await buildNoteFraisJournalSnapshot(
        noteId,
        tx,
        policies.p3,
        archivedAt
      );
      journalEvents = await insertJournalEvenementsInTx(tx, snapshot.events);
      journalEventsCreated += journalEvents;
    }

    await cancelPendingMovesAndEnqueueUnlinks(tx as never, [noteId]);

    await tx.noteFrais.updateMany({
      where: { corrigeNoteFraisId: noteId },
      data: { corrigeNoteFraisId: null },
    });

    const choixActif = note.ChoixReglements[0] ?? null;

    const archive = await tx.noteFraisArchive.create({
      data: {
        dateDepense: note.dateDepense,
        montantDemande: note.montantDemande,
        soumiseAt: note.soumiseAt,
        statutFinal: note.statut,
        montantAccepte: note.montantAccepte,
        decideeAt: note.decideeAt,
        modeReglement: choixActif?.mode ?? null,
        montantRemboursementChoix: choixActif?.montantRemboursement ?? null,
        montantCompensationChoix: choixActif?.montantCompensation ?? null,
        archivedAt,
        retentionEndsAt: retentionEndsAtP2,
        reidentifiabilityNotice: ARCHIVE_REIDENTIFIABILITY_NOTICE,
      },
    });
    archivesCreated += 1;

    let rang = 0;
    for (const piece of note.Justificatifs) {
      rang += 1;
      const justifId = randomUUID().replace(/-/g, "").slice(0, 24);
      const ext = extFromMimeOrName(piece.typeMime, piece.nomFichierOrig);
      const newRel = path.posix.join(
        "archive",
        archive.id,
        `${justifId}.${ext}`
      );
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
          rang,
          nomFichierOrig: null,
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

    const liens = [
      `/admin/frais-avances/${noteId}`,
      `/user/frais-avances/${noteId}`,
    ];
    await tx.notification.deleteMany({ where: { lien: { in: liens } } });
    await purgeNoteFraisOutboxEventsForArchiveInTx(tx, noteId);

    await detachAccountingForNoteInTx(tx, noteId);
    await deleteNoteFraisLiveFinancialChainInTx(tx, noteId);
  }

  console.info("[notes-frais] rgpd_account_archive_submitted", {
    archives: archivesCreated,
    moves: moveJobsEnqueued,
    journalEvents: journalEventsCreated,
    retentionEnds: retentionEndsAtP2.toISOString(),
  });

  return { archivesCreated, moveJobsEnqueued, journalEventsCreated };
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
 * Liste les archives (DTO sans chemins ni nom original). Authz ADMIN|TRESOR|COMCPT.
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
      include: { Justificatifs: { orderBy: { rang: "asc" } } },
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
      include: { Justificatifs: { orderBy: { rang: "asc" } } },
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
 * Téléchargement archive — READY uniquement ; nom technique.
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
        downloadName: archiveJustificatifDownloadName(
          piece.rang,
          piece.typeMime
        ),
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
 * N'affecte PAS le journal financier ni la synthèse.
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

export type { InjectedArchiveRetentionPolicy, InjectedNotesFraisRetentionBundle };
export { resolveEffectivePoliciesBundle };
