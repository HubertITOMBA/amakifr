import { Prisma, TypeNotification } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { db } from "@/lib/db";
import {
  NotesFraisDisabledError,
  assertNotesFraisEnabled,
} from "@/lib/frais-avances/feature-flag";
import { canUserReadSubmittedNotesFrais } from "@/lib/frais-avances/authz";
import {
  toNoteFraisPublicDto,
  type NoteFraisPublicDto,
} from "@/lib/frais-avances/dto";
import { resolveSubmissionRecipientUserIds } from "@/lib/frais-avances/recipients";
import {
  absoluteFromRelative,
  assertPathInsideStorageRoot,
  buildFinalRelativePath,
  hashIdForLog,
  moveFileDurable,
  unlinkQuiet,
  writeTempFile,
} from "@/lib/frais-avances/storage";
import { assertAllowedJustificatifBuffer } from "@/lib/frais-avances/justificatif-validation";
import { sendPushToUsersDetailed } from "@/lib/services/push/send-push";
import { lockUserRowForNotesFrais } from "@/lib/services/frais-avances/rgpd-account-deletion";

export type NotesFraisActionResult<T = unknown> =
  | { success: true; data: T; message?: string }
  | { success: false; error: string; code?: string };

export const NOTES_FRAIS_VERSION_CONFLICT =
  "Conflit de version — rechargez la note et réessayez";

function disabledResult(): NotesFraisActionResult<never> {
  return {
    success: false,
    error: "Le module frais avancés n'est pas activé.",
    code: "NOTES_FRAIS_DISABLED",
  };
}

function mapError(error: unknown): NotesFraisActionResult<never> {
  if (error instanceof NotesFraisDisabledError) return disabledResult();
  if (error instanceof Error) {
    return {
      success: false,
      error: error.message,
      code:
        error.message === NOTES_FRAIS_VERSION_CONFLICT
          ? "VERSION_CONFLICT"
          : undefined,
    };
  }
  return { success: false, error: "Erreur inattendue" };
}

async function requireAdherentForUser(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      adherent: { select: { id: true } },
    },
  });
  if (!user?.adherent) {
    throw new Error("Profil adhérent requis");
  }
  return { userId: user.id, adherentId: user.adherent.id };
}

/**
 * Verrouille une note brouillon propriétaire via contrôle optimiste sur `version`.
 * Prend un verrou User pour se coordonner avec la suppression RGPD de compte.
 */
async function claimDraftMutation(input: {
  noteId: string;
  userId: string;
  expectedVersion: number;
  tx?: Prisma.TransactionClient;
}): Promise<{ id: string; version: number }> {
  if (
    !Number.isInteger(input.expectedVersion) ||
    input.expectedVersion < 1
  ) {
    throw new Error("Version de note invalide");
  }

  const run = async (tx: Prisma.TransactionClient) => {
    await lockUserRowForNotesFrais(tx, input.userId);
    const claimed = await tx.noteFrais.updateMany({
      where: {
        id: input.noteId,
        demandeurUserId: input.userId,
        statut: "BROUILLON",
        version: input.expectedVersion,
      },
      data: { version: { increment: 1 } },
    });
    if (claimed.count !== 1) {
      const exists = await tx.noteFrais.findFirst({
        where: { id: input.noteId, demandeurUserId: input.userId },
        select: { statut: true },
      });
      if (!exists) throw new Error("Note introuvable");
      if (exists.statut !== "BROUILLON") {
        throw new Error("Seuls les brouillons sont modifiables");
      }
      throw new Error(NOTES_FRAIS_VERSION_CONFLICT);
    }
    return { id: input.noteId, version: input.expectedVersion + 1 };
  };

  if (input.tx) return run(input.tx);
  return db.$transaction((tx) => run(tx));
}

/**
 * Crée un brouillon de note de frais.
 */
export async function createNoteFraisDraft(input: {
  userId: string;
  libelle: string;
  description?: string | null;
  dateDepense: Date;
  montantDemande: number;
}): Promise<NotesFraisActionResult<{ id: string; version: number }>> {
  try {
    assertNotesFraisEnabled();
    if (!input.libelle?.trim()) throw new Error("Libellé requis");
    if (!(input.montantDemande > 0)) {
      throw new Error("Le montant demandé doit être strictement positif");
    }
    const { userId, adherentId } = await requireAdherentForUser(input.userId);

    const note = await db.$transaction(async (tx) => {
      await lockUserRowForNotesFrais(tx, userId);
      return tx.noteFrais.create({
        data: {
          adherentId,
          demandeurUserId: userId,
          libelle: input.libelle.trim().slice(0, 200),
          description: input.description?.trim() || null,
          dateDepense: input.dateDepense,
          montantDemande: new Prisma.Decimal(input.montantDemande),
          statut: "BROUILLON",
        },
        select: { id: true, version: true },
      });
    });
    return { success: true, data: note, message: "Brouillon créé" };
  } catch (error) {
    return mapError(error);
  }
}

/**
 * Met à jour un brouillon (propriétaire + version attendue).
 */
export async function updateNoteFraisDraft(input: {
  userId: string;
  noteId: string;
  expectedVersion: number;
  libelle?: string;
  description?: string | null;
  dateDepense?: Date;
  montantDemande?: number;
}): Promise<NotesFraisActionResult<{ id: string; version: number }>> {
  try {
    assertNotesFraisEnabled();
    if (input.montantDemande !== undefined && !(input.montantDemande > 0)) {
      throw new Error("Le montant demandé doit être strictement positif");
    }
    const updated = await db.$transaction(async (tx) => {
      const claimed = await claimDraftMutation({
        noteId: input.noteId,
        userId: input.userId,
        expectedVersion: input.expectedVersion,
        tx,
      });
      await tx.noteFrais.update({
        where: { id: claimed.id },
        data: {
          ...(input.libelle !== undefined
            ? { libelle: input.libelle.trim().slice(0, 200) }
            : {}),
          ...(input.description !== undefined
            ? { description: input.description?.trim() || null }
            : {}),
          ...(input.dateDepense ? { dateDepense: input.dateDepense } : {}),
          ...(input.montantDemande !== undefined
            ? { montantDemande: new Prisma.Decimal(input.montantDemande) }
            : {}),
        },
      });
      return claimed;
    });
    return { success: true, data: { id: updated.id, version: updated.version } };
  } catch (error) {
    return mapError(error);
  }
}

/**
 * Upload justificatif : PENDING → move → READY (ou FAILED).
 */
export async function uploadNoteFraisJustificatif(input: {
  userId: string;
  noteId: string;
  expectedVersion: number;
  buffer: Buffer;
  claimedMime?: string;
  originalName: string;
}): Promise<
  NotesFraisActionResult<{ id: string; statut: string; version: number }>
> {
  let tempAbs: string | null = null;
  let justificatifId: string | null = null;
  try {
    assertNotesFraisEnabled();
    const detected = assertAllowedJustificatifBuffer(
      input.buffer,
      input.claimedMime
    );
    const written = await writeTempFile(input.buffer, detected.ext);
    tempAbs = written.absolutePath;

    const { claimed, created, relative, finalAbs } = await db.$transaction(
      async (tx) => {
        const claimed = await claimDraftMutation({
          noteId: input.noteId,
          userId: input.userId,
          expectedVersion: input.expectedVersion,
          tx,
        });
        const created = await tx.justificatifNoteFrais.create({
          data: {
            noteFraisId: claimed.id,
            nomFichierOrig: input.originalName.slice(0, 255),
            cheminRelatif: buildFinalRelativePath(
              claimed.id,
              "pending",
              detected.ext
            ),
            typeMime: detected.mime,
            taille: input.buffer.length,
            statut: "PENDING",
            uploadedBy: input.userId,
          },
        });
        justificatifId = created.id;
        const relative = buildFinalRelativePath(
          claimed.id,
          created.id,
          detected.ext
        );
        const finalAbs = absoluteFromRelative(relative);
        await tx.noteFraisFileJob.create({
          data: {
            noteFraisId: claimed.id,
            operation: "MOVE",
            sourcePath: tempAbs,
            targetPath: finalAbs,
            status: "PENDING",
          },
        });
        return { claimed, created, relative, finalAbs };
      }
    );
    try {
      await moveFileDurable(tempAbs, finalAbs);
      tempAbs = null;

      // Course RGPD / delete pièce : ne pas finaliser si la ligne a disparu
      // (évite de « recréer » un fichier après UNLINK).
      const stillValid = await db.justificatifNoteFrais.findFirst({
        where: {
          id: created.id,
          statut: "PENDING",
          NoteFrais: {
            id: claimed.id,
            statut: "BROUILLON",
            demandeurUserId: input.userId,
          },
        },
        select: { id: true },
      });
      if (!stillValid) {
        await unlinkQuiet(finalAbs).catch(() => {});
        await db.noteFraisFileJob.updateMany({
          where: {
            noteFraisId: claimed.id,
            operation: "MOVE",
            targetPath: finalAbs,
            status: { in: ["PENDING", "PROCESSING"] },
          },
          data: {
            status: "FAILED",
            lastError: "orphaned_move_after_delete",
            lockedAt: null,
            lockedBy: null,
            processedAt: new Date(),
          },
        });
        await db.noteFraisFileJob.create({
          data: {
            noteFraisId: claimed.id,
            operation: "UNLINK",
            sourcePath: null,
            targetPath: finalAbs,
            status: "PENDING",
          },
        });
        throw new Error("Pièce ou note supprimée pendant le transfert");
      }

      const ready = await db.justificatifNoteFrais.update({
        where: { id: created.id },
        data: { cheminRelatif: relative, statut: "READY" },
        select: { id: true, statut: true },
      });
      await db.noteFraisFileJob.updateMany({
        where: {
          noteFraisId: claimed.id,
          operation: "MOVE",
          targetPath: finalAbs,
          status: "PENDING",
        },
        data: { status: "DONE", processedAt: new Date() },
      });
      return {
        success: true,
        data: { ...ready, version: claimed.version },
      };
    } catch (moveError) {
      await db.justificatifNoteFrais
        .update({
          where: { id: created.id },
          data: { statut: "FAILED" },
        })
        .catch(() => {});
      throw moveError instanceof Error
        ? moveError
        : new Error("Échec finalisation fichier");
    }
  } catch (error) {
    if (tempAbs) {
      await unlinkQuiet(tempAbs).catch(() => {});
    }
    void justificatifId;
    return mapError(error);
  }
}

/**
 * Supprime une pièce en brouillon (propriétaire) et planifie un UNLINK durable.
 */
export async function deleteNoteFraisJustificatif(input: {
  userId: string;
  noteId: string;
  justificatifId: string;
  expectedVersion: number;
}): Promise<NotesFraisActionResult<{ version: number }>> {
  try {
    assertNotesFraisEnabled();
    const claimed = await db.$transaction(async (tx) => {
      const claimed = await claimDraftMutation({
        noteId: input.noteId,
        userId: input.userId,
        expectedVersion: input.expectedVersion,
        tx,
      });

      const piece = await tx.justificatifNoteFrais.findFirst({
        where: {
          id: input.justificatifId,
          noteFraisId: claimed.id,
        },
      });
      if (!piece) throw new Error("Pièce jointe introuvable");

      let absPath: string | null = null;
      try {
        absPath = absoluteFromRelative(piece.cheminRelatif);
      } catch {
        absPath = null;
      }

      await tx.justificatifNoteFrais.delete({ where: { id: piece.id } });

      if (absPath) {
        await tx.noteFraisFileJob.create({
          data: {
            noteFraisId: claimed.id,
            operation: "UNLINK",
            sourcePath: null,
            targetPath: absPath,
            status: "PENDING",
          },
        });
      }
      return claimed;
    });

    void processNoteFraisFileJobsOnce().catch((err) => {
      console.error("[notes-frais] unlink enqueue kick failed", {
        note: hashIdForLog(claimed.id),
        err: err instanceof Error ? err.message.slice(0, 120) : "unknown",
      });
    });

    return { success: true, data: { version: claimed.version } };
  } catch (error) {
    return mapError(error);
  }
}

type SubmitResult = {
  id: string;
  recipientCount: number;
  alreadySubmitted: boolean;
  version: number;
};

async function resolveAlreadySubmittedResult(
  noteId: string,
  alerteSansDestinataire: boolean,
  version: number,
  client: typeof db = db
): Promise<SubmitResult> {
  const event = await client.noteFraisOutboxEvent.findFirst({
    where: {
      noteFraisId: noteId,
      kind: { in: ["SUBMITTED", "SUBMITTED_NO_RECIPIENT"] },
    },
    orderBy: { createdAt: "desc" },
  });
  const payload = event?.payload as { userIds?: string[] } | null;
  const recipientCount = Array.isArray(payload?.userIds)
    ? payload!.userIds!.length
    : alerteSansDestinataire
      ? 0
      : 0;
  return {
    id: noteId,
    recipientCount,
    alreadySubmitted: true,
    version,
  };
}

/**
 * Soumet une note (READY ≥ 1, aucun PENDING). Idempotence obligatoire.
 *
 * @param input.client - Prisma injectable (tests PG) ; défaut = db app
 * @param input.beforeUserLock / afterUserLock - hooks barrière (tests concurrence)
 */
export async function submitNoteFrais(input: {
  userId: string;
  noteId: string;
  idempotencyKey: string;
  expectedVersion: number;
  client?: typeof db;
  beforeUserLock?: () => Promise<void>;
  afterUserLock?: () => Promise<void>;
}): Promise<NotesFraisActionResult<SubmitResult>> {
  const client = input.client ?? db;
  try {
    assertNotesFraisEnabled();
    const key = input.idempotencyKey?.trim();
    if (!key || key.length < 8 || key.length > 64) {
      throw new Error("Clé d'idempotence requise (8–64 caractères)");
    }
    if (
      !Number.isInteger(input.expectedVersion) ||
      input.expectedVersion < 1
    ) {
      throw new Error("Version de note invalide");
    }

    const byKey = await client.noteFrais.findFirst({
      where: { submitIdempotencyKey: key },
    });
    if (byKey) {
      if (byKey.id !== input.noteId) {
        throw new Error("Clé d'idempotence déjà utilisée");
      }
      if (byKey.demandeurUserId !== input.userId) {
        throw new Error("Note introuvable");
      }
      if (byKey.statut === "SOUMISE") {
        return {
          success: true,
          data: await resolveAlreadySubmittedResult(
            byKey.id,
            byKey.alerteSansDestinataire,
            byKey.version,
            client
          ),
          message: "Déjà soumise",
        };
      }
    }

    const recipients = await resolveSubmissionRecipientUserIds(
      input.userId,
      client
    );

    const result = await client.$transaction(async (tx) => {
      if (input.beforeUserLock) {
        await input.beforeUserLock();
      }
      await lockUserRowForNotesFrais(tx, input.userId);
      if (input.afterUserLock) {
        await input.afterUserLock();
      }

      const current = await tx.noteFrais.findFirst({
        where: { id: input.noteId, demandeurUserId: input.userId },
      });
      if (!current) throw new Error("Note introuvable");
      if (
        current.statut === "SOUMISE" &&
        current.submitIdempotencyKey === key
      ) {
        return { kind: "already" as const, note: current };
      }
      if (current.statut === "SOUMISE") {
        throw new Error("Note déjà soumise");
      }
      if (current.statut !== "BROUILLON") {
        throw new Error("Statut incompatible avec la soumission");
      }
      if (current.version !== input.expectedVersion) {
        throw new Error(NOTES_FRAIS_VERSION_CONFLICT);
      }

      const pending = await tx.justificatifNoteFrais.count({
        where: { noteFraisId: input.noteId, statut: "PENDING" },
      });
      if (pending > 0) {
        throw new Error(
          "Des pièces jointes sont encore en cours de finalisation"
        );
      }
      const ready = await tx.justificatifNoteFrais.count({
        where: { noteFraisId: input.noteId, statut: "READY" },
      });
      if (ready < 1) {
        throw new Error("Au moins une pièce jointe prête est requise");
      }

      const claimed = await tx.noteFrais.updateMany({
        where: {
          id: input.noteId,
          demandeurUserId: input.userId,
          statut: "BROUILLON",
          version: input.expectedVersion,
        },
        data: {
          statut: "SOUMISE",
          soumiseAt: new Date(),
          submitIdempotencyKey: key,
          version: { increment: 1 },
          alerteSansDestinataire: recipients.length === 0,
          alerteSansDestinataireAt:
            recipients.length === 0 ? new Date() : null,
        },
      });
      if (claimed.count !== 1) {
        throw new Error(NOTES_FRAIS_VERSION_CONFLICT);
      }

      const updated = await tx.noteFrais.findUniqueOrThrow({
        where: { id: input.noteId },
      });

      const titre = "Nouvelle note de frais soumise";
      const message =
        "Une note de frais a été soumise et attend une prise en charge.";
      const lien = `/admin/frais-avances/${updated.id}`;
      const noRecipients = recipients.length === 0;

      if (recipients.length > 0) {
        await tx.notification.createMany({
          data: recipients.map((userId) => ({
            userId,
            type: TypeNotification.Action,
            titre,
            message,
            lien,
            lue: false,
          })),
        });
      }

      await tx.noteFraisOutboxEvent.create({
        data: {
          noteFraisId: updated.id,
          eventKey: noRecipients
            ? `note:${updated.id}:submitted-no-recipient`
            : `note:${updated.id}:submitted`,
          kind: noRecipients ? "SUBMITTED_NO_RECIPIENT" : "SUBMITTED",
          payload: {
            userIds: recipients,
            titre,
            message,
            lien,
          },
          status: "PENDING",
        },
      });

      if (noRecipients) {
        console.info("[notes-frais] submitted_no_recipient", {
          note: hashIdForLog(updated.id),
        });
      }

      return {
        kind: "fresh" as const,
        note: updated,
        recipientCount: recipients.length,
      };
    });

    if (result.kind === "already") {
      return {
        success: true,
        data: await resolveAlreadySubmittedResult(
          result.note.id,
          result.note.alerteSansDestinataire,
          result.note.version,
          client
        ),
        message: "Déjà soumise",
      };
    }

    // Ne pas kick l'outbox via le singleton app si un client de test est injecté
    // (évite tout accès implicite à DATABASE_URL).
    if (!input.client) {
      void processNoteFraisOutboxOnce().catch((err) => {
        console.error("[notes-frais] outbox kick failed", {
          note: hashIdForLog(result.note.id),
          err: err instanceof Error ? err.message.slice(0, 120) : "unknown",
        });
      });
    }

    return {
      success: true,
      data: {
        id: result.note.id,
        recipientCount: result.recipientCount,
        alreadySubmitted: false,
        version: result.note.version,
      },
      message: "Note soumise",
    };
  } catch (error) {
    return mapError(error);
  }
}

/**
 * Liste les notes du demandeur (DTO sans chemins).
 */
export async function listMyNotesFrais(
  userId: string
): Promise<NotesFraisActionResult<NoteFraisPublicDto[]>> {
  try {
    assertNotesFraisEnabled();
    const rows = await db.noteFrais.findMany({
      where: { demandeurUserId: userId },
      orderBy: { updatedAt: "desc" },
      include: {
        Justificatifs: {
          select: {
            id: true,
            nomFichierOrig: true,
            typeMime: true,
            taille: true,
            statut: true,
            createdAt: true,
          },
        },
      },
    });
    return {
      success: true,
      data: rows.map((r) => toNoteFraisPublicDto(r)),
    };
  } catch (error) {
    return mapError(error);
  }
}

/**
 * Liste admin des notes soumises uniquement (authz dans le service).
 */
export async function listAdminNotesFrais(input: {
  actorUserId: string;
  onlyAlerteSansDestinataire?: boolean;
}): Promise<NotesFraisActionResult<NoteFraisPublicDto[]>> {
  try {
    assertNotesFraisEnabled();
    const allowed = await canUserReadSubmittedNotesFrais(input.actorUserId);
    if (!allowed) {
      return { success: false, error: "Non autorisé", code: "FORBIDDEN" };
    }

    const rows = await db.noteFrais.findMany({
      where: {
        statut: "SOUMISE",
        ...(input.onlyAlerteSansDestinataire
          ? { alerteSansDestinataire: true }
          : {}),
      },
      orderBy: { soumiseAt: "desc" },
      include: {
        Demandeur: { select: { id: true, email: true, name: true } },
        Adherent: { select: { id: true, firstname: true, lastname: true } },
        Justificatifs: {
          where: { statut: "READY" },
          select: {
            id: true,
            nomFichierOrig: true,
            typeMime: true,
            taille: true,
            statut: true,
            createdAt: true,
          },
        },
      },
    });
    return {
      success: true,
      data: rows.map((r) => toNoteFraisPublicDto(r)),
    };
  } catch (error) {
    return mapError(error);
  }
}

/**
 * Détail note : propriétaire (tout statut) ou responsable (SOUMISE uniquement).
 */
export async function getNoteFraisForUser(input: {
  userId: string;
  noteId: string;
}): Promise<NotesFraisActionResult<NoteFraisPublicDto>> {
  try {
    assertNotesFraisEnabled();
    const note = await db.noteFrais.findUnique({
      where: { id: input.noteId },
      include: {
        Justificatifs: {
          select: {
            id: true,
            nomFichierOrig: true,
            typeMime: true,
            taille: true,
            statut: true,
            createdAt: true,
          },
        },
        Demandeur: { select: { id: true, email: true, name: true } },
        Adherent: { select: { id: true, firstname: true, lastname: true } },
      },
    });
    if (!note) throw new Error("Note introuvable");

    const isOwner = note.demandeurUserId === input.userId;
    if (isOwner) {
      return { success: true, data: toNoteFraisPublicDto(note) };
    }

    const asAdmin = await canUserReadSubmittedNotesFrais(input.userId);
    if (!asAdmin || note.statut === "BROUILLON") {
      throw new Error("Note introuvable");
    }
    return { success: true, data: toNoteFraisPublicDto(note) };
  } catch (error) {
    return mapError(error);
  }
}

export type JustificatifFileResult = {
  bytes: Buffer;
  contentType: string;
  downloadName: string;
};

/**
 * Téléchargement authentifié : propriétaire ou responsable, pièce READY uniquement.
 * Ne expose aucun chemin dans le résultat.
 */
export async function downloadNoteFraisJustificatif(input: {
  userId: string;
  justificatifId: string;
}): Promise<NotesFraisActionResult<JustificatifFileResult>> {
  try {
    assertNotesFraisEnabled();
    const id = String(input.justificatifId || "").trim();
    if (!id || id.includes("..") || id.includes("/") || id.includes("\\")) {
      throw new Error("Identifiant invalide");
    }

    const piece = await db.justificatifNoteFrais.findUnique({
      where: { id },
      include: {
        NoteFrais: {
          select: {
            id: true,
            demandeurUserId: true,
            statut: true,
          },
        },
      },
    });
    if (!piece || piece.statut !== "READY") {
      throw new Error("Pièce jointe introuvable");
    }

    const note = piece.NoteFrais;
    const isOwner = note.demandeurUserId === input.userId;
    if (!isOwner) {
      const asAdmin = await canUserReadSubmittedNotesFrais(input.userId);
      if (!asAdmin || note.statut === "BROUILLON") {
        throw new Error("Pièce jointe introuvable");
      }
    }

    const abs = absoluteFromRelative(piece.cheminRelatif);
    assertPathInsideStorageRoot(abs);
    const bytes = await readFile(abs);
    return {
      success: true,
      data: {
        bytes,
        contentType: piece.typeMime || "application/octet-stream",
        downloadName: piece.nomFichierOrig || "justificatif",
      },
    };
  } catch (error) {
    return mapError(error);
  }
}

export const LEASE_MS = 2 * 60 * 1000;

export function backoffMs(attempts: number): number {
  const steps = [60_000, 300_000, 900_000, 3_600_000];
  return steps[Math.min(attempts - 1, steps.length - 1)] ?? 3_600_000;
}

function isNotesFraisEnabledSafe(): boolean {
  try {
    assertNotesFraisEnabled();
    return true;
  } catch {
    return false;
  }
}

/**
 * Remet en PENDING les outbox dont le lease a expiré.
 */
export async function recoverExpiredOutboxLocks(
  now = new Date()
): Promise<number> {
  const res = await db.noteFraisOutboxEvent.updateMany({
    where: {
      status: "PROCESSING",
      lockedAt: { lt: new Date(now.getTime() - LEASE_MS) },
    },
    data: { status: "PENDING", lockedAt: null, lockedBy: null },
  });
  return res.count;
}

/**
 * Remet en PENDING les file jobs dont le lease a expiré.
 *
 * @param now - horodatage de référence
 * @param client - Prisma injectable (tests PG) ; défaut = db app
 */
export async function recoverExpiredFileJobLocks(
  now = new Date(),
  client: typeof db = db
): Promise<number> {
  const res = await client.noteFraisFileJob.updateMany({
    where: {
      status: "PROCESSING",
      lockedAt: { lt: new Date(now.getTime() - LEASE_MS) },
    },
    data: { status: "PENDING", lockedAt: null, lockedBy: null },
  });
  return res.count;
}

/**
 * Traite un lot d'événements outbox (push détaillé).
 */
export async function processNoteFraisOutboxOnce(limit = 10): Promise<number> {
  if (!isNotesFraisEnabledSafe()) return 0;

  const now = new Date();
  await recoverExpiredOutboxLocks(now);

  const candidates = await db.noteFraisOutboxEvent.findMany({
    where: {
      status: "PENDING",
      OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  let processed = 0;
  for (const event of candidates) {
    const lockId = randomUUID();
    const claimed = await db.noteFraisOutboxEvent.updateMany({
      where: { id: event.id, status: "PENDING" },
      data: {
        status: "PROCESSING",
        lockedAt: new Date(),
        lockedBy: lockId,
        attempts: { increment: 1 },
      },
    });
    if (claimed.count !== 1) continue;

    const payload = event.payload as {
      userIds?: string[];
      titre?: string;
      message?: string;
      lien?: string;
    };

    try {
      if (event.kind === "SUBMITTED_NO_RECIPIENT") {
        await finishOutbox(event.id, lockId, "DONE", null);
        processed += 1;
        continue;
      }

      const userIds = payload.userIds ?? [];
      const detailed = await sendPushToUsersDetailed(userIds, {
        title: payload.titre || "AMAKI",
        body: payload.message || "",
        data: { url: payload.lien || "/notifications" },
      });

      if (
        detailed.summary === "success" ||
        detailed.summary === "no_tokens" ||
        detailed.summary === "no_user_ids" ||
        detailed.summary === "all_failed_definitive"
      ) {
        await finishOutbox(event.id, lockId, "DONE", null);
      } else if (
        detailed.summary === "transport_failed" ||
        detailed.summary === "all_failed_temporary" ||
        detailed.summary === "partial"
      ) {
        const row = await db.noteFraisOutboxEvent.findUnique({
          where: { id: event.id },
          select: { attempts: true, maxAttempts: true },
        });
        const attempts = row?.attempts ?? event.attempts + 1;
        const maxAttempts = event.maxAttempts;
        if (attempts >= maxAttempts) {
          await finishOutbox(
            event.id,
            lockId,
            "FAILED",
            `max_attempts:${detailed.summary}`
          );
        } else {
          await requeueOutbox(event.id, lockId, detailed.summary, attempts);
        }
      } else {
        await finishOutbox(event.id, lockId, "DONE", null);
      }
      processed += 1;
    } catch (error) {
      const msg =
        error instanceof Error ? error.message.slice(0, 200) : "outbox_error";
      console.error("[notes-frais] outbox process error", {
        event: hashIdForLog(event.id),
        err: msg,
      });
      await requeueOutbox(event.id, lockId, msg, event.attempts + 1);
    }
  }
  return processed;
}

async function finishOutbox(
  id: string,
  lockId: string,
  status: "DONE" | "FAILED",
  lastError: string | null
) {
  await db.noteFraisOutboxEvent.updateMany({
    where: { id, lockedBy: lockId, status: "PROCESSING" },
    data: {
      status,
      processedAt: new Date(),
      lockedAt: null,
      lockedBy: null,
      lastError,
    },
  });
}

async function requeueOutbox(
  id: string,
  lockId: string,
  lastError: string,
  attempts: number
) {
  await db.noteFraisOutboxEvent.updateMany({
    where: { id, lockedBy: lockId, status: "PROCESSING" },
    data: {
      status: "PENDING",
      lockedAt: null,
      lockedBy: null,
      lastError: lastError.slice(0, 500),
      nextAttemptAt: new Date(Date.now() + backoffMs(attempts)),
    },
  });
}

/**
 * Traite les jobs fichiers (MOVE/UNLINK) avec verrou unique.
 *
 * @param limit - nombre max de jobs à tenter
 * @param client - Prisma injectable (tests PG) ; défaut = db app
 */
export async function processNoteFraisFileJobsOnce(
  limit = 10,
  client: typeof db = db
): Promise<number> {
  // Jobs FS (MOVE archive / UNLINK) doivent pouvoir tourner même si le module
  // métier est off — durabilité post-suppression de compte.
  const now = new Date();
  await recoverExpiredFileJobLocks(now, client);

  const jobs = await client.noteFraisFileJob.findMany({
    where: {
      status: "PENDING",
      OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
    },
    take: limit,
    orderBy: { createdAt: "asc" },
  });

  let n = 0;
  for (const job of jobs) {
    const lockId = randomUUID();
    const claimed = await client.noteFraisFileJob.updateMany({
      where: { id: job.id, status: "PENDING" },
      data: {
        status: "PROCESSING",
        lockedAt: new Date(),
        lockedBy: lockId,
        attempts: { increment: 1 },
      },
    });
    if (claimed.count !== 1) continue;

    try {
      if (job.operation === "MOVE" && job.sourcePath && job.targetPath) {
        assertPathInsideStorageRoot(job.sourcePath);
        assertPathInsideStorageRoot(job.targetPath);

        const abortMoveWithoutRecreating = async (reason: string) => {
          await unlinkQuiet(job.sourcePath!).catch(() => {});
          await unlinkQuiet(job.targetPath!).catch(() => {});
          await client.noteFraisFileJob.updateMany({
            where: { id: job.id, lockedBy: lockId, status: "PROCESSING" },
            data: {
              status: "FAILED",
              lastError: reason,
              processedAt: new Date(),
              lockedAt: null,
              lockedBy: null,
            },
          });
        };

        // Purge / cancel peut avoir basculé le job en FAILED pendant le lease.
        const stillOurs = await client.noteFraisFileJob.findFirst({
          where: {
            id: job.id,
            lockedBy: lockId,
            status: "PROCESSING",
          },
          select: { id: true },
        });
        if (!stillOurs) {
          await unlinkQuiet(job.sourcePath).catch(() => {});
          await unlinkQuiet(job.targetPath).catch(() => {});
          n += 1;
          continue;
        }

        // Si un UNLINK vise déjà source/cible, ne pas recréer le fichier.
        const blockingUnlink = await client.noteFraisFileJob.findFirst({
          where: {
            operation: "UNLINK",
            status: { in: ["PENDING", "PROCESSING"] },
            OR: [
              { targetPath: job.targetPath },
              { targetPath: job.sourcePath },
              { sourcePath: job.targetPath },
              { sourcePath: job.sourcePath },
            ],
          },
          select: { id: true },
        });
        if (blockingUnlink) {
          await abortMoveWithoutRecreating("move_aborted_unlink_pending");
          n += 1;
          continue;
        }

        // Re-vérifier juste avant le FS (barrière tests / course purge).
        const stillOursBeforeFs = await client.noteFraisFileJob.findFirst({
          where: {
            id: job.id,
            lockedBy: lockId,
            status: "PROCESSING",
          },
          select: { id: true },
        });
        if (!stillOursBeforeFs) {
          await unlinkQuiet(job.sourcePath).catch(() => {});
          await unlinkQuiet(job.targetPath).catch(() => {});
          n += 1;
          continue;
        }

        const unlinkRaceBeforeFs = await client.noteFraisFileJob.findFirst({
          where: {
            operation: "UNLINK",
            status: { in: ["PENDING", "PROCESSING"] },
            OR: [
              { targetPath: job.targetPath },
              { targetPath: job.sourcePath },
              { sourcePath: job.targetPath },
              { sourcePath: job.sourcePath },
            ],
          },
          select: { id: true },
        });
        if (unlinkRaceBeforeFs) {
          await abortMoveWithoutRecreating("move_aborted_unlink_pending");
          n += 1;
          continue;
        }

        await moveFileDurable(job.sourcePath, job.targetPath);

        // Si cancel/purge a gagné pendant le rename : ne laisser aucun fichier.
        const stillOursAfterFs = await client.noteFraisFileJob.findFirst({
          where: {
            id: job.id,
            lockedBy: lockId,
            status: "PROCESSING",
          },
          select: { id: true },
        });
        if (!stillOursAfterFs) {
          await unlinkQuiet(job.targetPath).catch(() => {});
          await unlinkQuiet(job.sourcePath).catch(() => {});
          n += 1;
          continue;
        }

        if (job.archiveJustificatifId) {
          const { markArchiveJustificatifReadyAfterMove } = await import(
            "@/lib/services/frais-avances/note-frais-archive-service"
          );
          await markArchiveJustificatifReadyAfterMove(
            client,
            job.archiveJustificatifId
          );
        }
      } else if (job.operation === "UNLINK") {
        const p = job.targetPath || job.sourcePath;
        if (p) {
          assertPathInsideStorageRoot(p);
          await unlinkQuiet(p);
        }
      }
      await client.noteFraisFileJob.updateMany({
        where: { id: job.id, lockedBy: lockId, status: "PROCESSING" },
        data: {
          status: "DONE",
          processedAt: new Date(),
          lockedAt: null,
          lockedBy: null,
        },
      });
      n += 1;
    } catch (error) {
      const msg =
        error instanceof Error ? error.message.slice(0, 200) : "file_job_error";
      console.error("[notes-frais] file job error", {
        job: hashIdForLog(job.id),
        op: job.operation,
        err: msg,
      });
      const attempts = job.attempts + 1;
      if (attempts >= job.maxAttempts) {
        await client.noteFraisFileJob.updateMany({
          where: { id: job.id, lockedBy: lockId, status: "PROCESSING" },
          data: {
            status: "FAILED",
            lastError: msg,
            lockedAt: null,
            lockedBy: null,
            processedAt: new Date(),
          },
        });
      } else {
        await client.noteFraisFileJob.updateMany({
          where: { id: job.id, lockedBy: lockId, status: "PROCESSING" },
          data: {
            status: "PENDING",
            lastError: msg,
            lockedAt: null,
            lockedBy: null,
            nextAttemptAt: new Date(Date.now() + backoffMs(attempts)),
          },
        });
      }
    }
  }
  return n;
}
