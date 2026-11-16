/**
 * Publication et clôture de sondage/quiz — logique métier (hors Server Actions).
 *
 * Les deps / barrières sont réservées aux tests et ne sont jamais exposées
 * via les actions `"use server"` (un client ne peut pas les injecter).
 */
import { db } from "@/lib/db";
import {
  sondageKindLabel,
  validateQuizReadyForOpen,
  validateSondageDates,
} from "@/lib/sondages";
import {
  notifySondagePublishedInApp,
  sendSondageInvitationsToActiveAdherents,
} from "@/lib/sondages-notifications";
import { SondageStatus } from "@prisma/client";
import { z } from "zod";

const SondageIdSchema = z.object({
  id: z.string().min(1, "Identifiant requis"),
});

export type PublishSondageDeps = {
  sendInvitations?: typeof sendSondageInvitationsToActiveAdherents;
  notifyInApp?: typeof notifySondagePublishedInApp;
};

export type PublishSondageResult =
  | {
      success: true;
      message: string;
      emailStats: { sentCount: number; failedCount: number };
      inAppStats: {
        createdCount: number;
        skippedDuplicateCount: number;
      };
    }
  | {
      success: false;
      error: string;
      raced?: true;
    };

/**
 * Publie un brouillon (transition atomique Brouillon → Ouvert).
 * Seul le gagnant déclenche les invitations / notifications.
 *
 * @param sondageId - Identifiant du brouillon
 * @param deps - Injectables tests uniquement (canaux simulés) — jamais depuis une Server Action
 */
export async function publishSondageService(
  sondageId: string,
  deps: PublishSondageDeps = {}
): Promise<PublishSondageResult> {
  const parsed = SondageIdSchema.parse({ id: sondageId });
  const sondage = await db.sondage.findUnique({
    where: { id: parsed.id },
    include: {
      questions: {
        include: {
          options: { orderBy: { ordre: "asc" } },
          lignesMatrice: { orderBy: { ordre: "asc" } },
        },
      },
    },
  });

  if (!sondage) {
    return { success: false, error: "Sondage introuvable" };
  }

  if (sondage.status !== SondageStatus.Brouillon) {
    return { success: false, error: "Seul un brouillon peut être publié" };
  }

  if (!sondage.questions.length) {
    return {
      success: false,
      error: "Ajoutez au moins une question avant publication",
    };
  }

  const dateError = validateSondageDates(sondage.dateDebut, sondage.dateFin);
  if (dateError) return { success: false, error: dateError };

  const quizError = validateQuizReadyForOpen(
    sondage.kind,
    sondage.questions.map((q) => ({
      ordre: q.ordre,
      libelle: q.libelle,
      type: q.type,
      options: q.options.map((o) => ({
        ordre: o.ordre,
        libelle: o.libelle,
        estCorrecte: o.estCorrecte,
      })),
    }))
  );
  if (quizError) return { success: false, error: quizError };

  const transitioned = await db.sondage.updateMany({
    where: { id: parsed.id, status: SondageStatus.Brouillon },
    data: { status: SondageStatus.Ouvert },
  });
  if (transitioned.count !== 1) {
    return {
      success: false,
      error: "Seul un brouillon peut être publié",
      raced: true,
    };
  }

  const sendInvitations =
    deps.sendInvitations ?? sendSondageInvitationsToActiveAdherents;
  const notifyInApp = deps.notifyInApp ?? notifySondagePublishedInApp;
  const notify = await sendInvitations(sondage);
  const inApp = await notifyInApp(sondage);
  const emailPart =
    notify.sentCount > 0
      ? ` — ${notify.sentCount} email(s) envoyé(s) aux adhérents actifs`
      : notify.failedCount > 0
        ? " — échec de l'envoi des emails"
        : "";
  const notifPart =
    inApp.createdCount > 0
      ? ` — ${inApp.createdCount} notification(s) in-app`
      : inApp.skippedDuplicateCount > 0
        ? " — notifications déjà envoyées (pas de doublon)"
        : "";

  return {
    success: true,
    message: `${sondageKindLabel(sondage.kind)} publié${emailPart}${notifPart}`,
    emailStats: {
      sentCount: notify.sentCount,
      failedCount: notify.failedCount,
    },
    inAppStats: {
      createdCount: inApp.createdCount,
      skippedDuplicateCount: inApp.skippedDuplicateCount,
    },
  };
}

export type CloseSondageDeps = {
  /**
   * Barrière de test après `FOR UPDATE` sur le sondage, avant transition Cloture.
   * Réservée aux tests — jamais exposée par une Server Action.
   */
  afterSondageLocked?: () => Promise<void>;
};

export type CloseSondageResult =
  | { success: true; message: string }
  | { success: false; error: string };

/**
 * Clôture un sondage sous `FOR UPDATE` (sérialise avec les soumissions).
 *
 * @param sondageId - Identifiant du sondage
 * @param deps - Injectables tests uniquement (barrières) — jamais depuis une Server Action
 */
export async function closeSondageService(
  sondageId: string,
  deps: CloseSondageDeps = {}
): Promise<CloseSondageResult> {
  const parsed = SondageIdSchema.parse({ id: sondageId });

  const outcome = await db.$transaction(async (tx) => {
    await tx.$queryRaw`
      SELECT id FROM sondages WHERE id = ${parsed.id} FOR UPDATE
    `;
    if (deps.afterSondageLocked) {
      await deps.afterSondageLocked();
    }
    const existing = await tx.sondage.findUnique({
      where: { id: parsed.id },
      select: { id: true, status: true },
    });
    if (!existing) {
      return { ok: false as const, error: "Sondage introuvable" };
    }
    if (existing.status === SondageStatus.Cloture) {
      return { ok: false as const, error: "Ce sondage est déjà clôturé" };
    }
    const closed = await tx.sondage.updateMany({
      where: {
        id: parsed.id,
        status: { not: SondageStatus.Cloture },
      },
      data: {
        status: SondageStatus.Cloture,
        resultatsVisiblesAdherents: false,
        corrigeVisiblesAdherents: false,
      },
    });
    if (closed.count !== 1) {
      return { ok: false as const, error: "Ce sondage est déjà clôturé" };
    }
    return { ok: true as const };
  });

  if (!outcome.ok) {
    return { success: false, error: outcome.error };
  }

  return { success: true, message: "Sondage clôturé" };
}
