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
  buildRetentionSnapshotFromPolicy,
  getActiveRetentionPolicy,
  type ActiveRetentionPolicy,
} from "@/lib/services/frais-avances/note-frais-retention-policy-service";
import { hasActiveLegalHoldOnArchive } from "@/lib/services/frais-avances/note-frais-legal-hold-service";
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
  noteFraisRetentionPolicyVersion?: typeof db.noteFraisRetentionPolicyVersion;
  noteFraisLegalHold?: typeof db.noteFraisLegalHold;
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
  /**
   * Politique ACTIVE DB (lot 4.10) — snapshot calendaire immuable.
   * Prioritaire sur les durées injectées pour les échéances persistées.
   */
  dbPolicy?: ActiveRetentionPolicy | null;
};

/**
 * Archive atomique des notes SOUMISE|VALIDEE|REJETEE dans la TX de suppression compte.
 * Crée archive privée + PJ + journal financier + détachement + suppression live.
 *
 * Règle P2-avant-P1 (la plus protectrice) : si P2 purge avant P1, la purge P2
 * unlink systématiquement les fichiers restants — aucun orphelin disque.
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

  const injectedUsable = isRetentionUsable(policies.p2);
  let dbPolicy: ActiveRetentionPolicy | null = policies.dbPolicy ?? null;
  if (
    !injectedUsable &&
    !dbPolicy &&
    tx.noteFraisRetentionPolicyVersion
  ) {
    dbPolicy = await getActiveRetentionPolicy(tx as never);
  }

  const useDb = !injectedUsable && !!dbPolicy;
  if (!injectedUsable && !useDb) {
    throw new Error(NOTES_FRAIS_P2_RETENTION_REQUIRED);
  }

  const archivedAt = new Date();
  let retentionEndsAtP2Injected: Date | null = null;
  if (!useDb) {
    retentionEndsAtP2Injected = computeRetentionEndsAt(archivedAt, policies.p2);
    if (!retentionEndsAtP2Injected) {
      throw new Error(
        "Politique P2 archive privée sans durée calculable — archivage impossible"
      );
    }
  }

  let archivesCreated = 0;
  let moveJobsEnqueued = 0;
  let journalEventsCreated = 0;
  let lastRetentionEndsIso: string | null = null;

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
    if (!useDb && hasPj && !isRetentionUsable(policies.p1)) {
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

    if (!useDb && hasFinancialHistory && !isRetentionUsable(policies.p3)) {
      throw new Error(NOTES_FRAIS_P3_RETENTION_REQUIRED);
    }

    const snapshot = useDb
      ? buildRetentionSnapshotFromPolicy(dbPolicy!, note.dateDepense)
      : null;

    const retentionEndsAtP2 =
      snapshot?.retentionEndsAtP2 ?? retentionEndsAtP2Injected!;
    const retentionEndsAtP1 =
      snapshot?.retentionEndsAtP1 ??
      (hasPj ? computeRetentionEndsAt(archivedAt, policies.p1) : null);
    lastRetentionEndsIso = retentionEndsAtP2.toISOString();

    let journalEvents = 0;
    if (hasFinancialHistory) {
      const journalSnap = await buildNoteFraisJournalSnapshot(
        noteId,
        tx,
        policies.p3,
        archivedAt,
        snapshot
          ? {
              retentionEndsAt: snapshot.retentionEndsAtP3,
              policyVersionId: snapshot.policyVersionId,
              exerciceClotureAt: snapshot.exerciceClotureAt,
              resolvePeriodeCle: (d: Date) => String(d.getUTCFullYear()),
            }
          : undefined
      );
      journalEvents = await insertJournalEvenementsInTx(tx, journalSnap.events);
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
        policyVersionId: snapshot?.policyVersionId ?? null,
        exerciceClotureAt: snapshot?.exerciceClotureAt ?? null,
        retentionEndsAtP1: retentionEndsAtP1,
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
          retentionEndsAtP1: retentionEndsAtP1,
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
    retentionEnds: lastRetentionEndsIso,
    policySource: useDb ? "db" : "injected",
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
 * Purge P1 autonome : fichiers + lignes PJ arrivés à échéance P1.
 * Ne supprime PAS l'archive P2.
 * Bloqué par legal hold ACTIF sur l'archive.
 *
 * Règle protectrice P2-avant-P1 : si P2 a déjà purgé l'archive, les PJ
 * n'existent plus (cascade) — ce worker est no-op. Si P2 purge alors que
 * P1 n'est pas due, P2 unlink tous les fichiers restants (pas d'orphelin).
 */
export async function processNoteFraisPiecesPurgeOnce(
  limit = 20,
  client: typeof db = db,
  now = new Date()
): Promise<number> {
  const due = await client.justificatifNoteFraisArchive.findMany({
    where: { retentionEndsAtP1: { lte: now } },
    take: limit,
    orderBy: { retentionEndsAtP1: "asc" },
    select: {
      id: true,
      archiveId: true,
      cheminRelatif: true,
    },
  });

  let purged = 0;
  for (const piece of due) {
    if (await hasActiveLegalHoldOnArchive(piece.archiveId, client)) {
      continue;
    }

    const didPurge = await client.$transaction(async (tx) => {
      // Re-check hold in TX
      if (await hasActiveLegalHoldOnArchive(piece.archiveId, tx as never)) {
        return false;
      }

      const still = await tx.justificatifNoteFraisArchive.findUnique({
        where: { id: piece.id },
      });
      if (!still) return false;

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
            lastError: "p1_purge_cancelled_move",
            lockedAt: null,
            lockedBy: null,
            processedAt: new Date(),
          },
        });
      }

      const paths = new Set<string>();
      try {
        paths.add(absoluteFromRelative(still.cheminRelatif));
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

      await tx.justificatifNoteFraisArchive.delete({ where: { id: piece.id } });
      return true;
    });
    if (didPurge) purged += 1;
  }

  if (purged > 0) {
    console.info("[notes-frais] p1_pieces_purge", { purged });
  }
  return purged;
}

/**
 * Purge P2 des archives arrivées à échéance : cancel MOVE + UNLINK + delete DB.
 * N'affecte PAS le journal financier ni la synthèse.
 * Bloqué par legal hold ACTIF.
 *
 * Si P2 arrive avant P1 : unlink de tous les fichiers restants (règle protectrice).
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
    if (await hasActiveLegalHoldOnArchive(archive.id, client)) {
      continue;
    }

    const didPurge = await client.$transaction(async (tx) => {
      if (await hasActiveLegalHoldOnArchive(archive.id, tx as never)) {
        return false;
      }

      const still = await tx.noteFraisArchive.findUnique({
        where: { id: archive.id },
        include: { Justificatifs: true },
      });
      if (!still) return false;

      for (const piece of still.Justificatifs) {
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

      const holdActif = await tx.noteFraisLegalHold.count({
        where: { archiveId: archive.id, statut: "ACTIF" },
      });
      if (holdActif > 0) return false;

      // Détache holds LEVE (append-only conservé, archiveId nullisé).
      await tx.noteFraisLegalHold.updateMany({
        where: { archiveId: archive.id, statut: "LEVE" },
        data: { archiveId: null },
      });

      await tx.noteFraisArchiveAccessLog.deleteMany({
        where: { archiveId: archive.id },
      });
      await tx.justificatifNoteFraisArchive.deleteMany({
        where: { archiveId: archive.id },
      });
      await tx.noteFraisArchive.delete({ where: { id: archive.id } });
      return true;
    });
    if (didPurge) purged += 1;
  }

  if (purged > 0) {
    console.info("[notes-frais] archive_purge", { purged });
  }
  return purged;
}

export type { InjectedArchiveRetentionPolicy, InjectedNotesFraisRetentionBundle };
export { resolveEffectivePoliciesBundle };
