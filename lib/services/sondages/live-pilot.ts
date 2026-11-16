import { z } from "zod";
import type { AuthContext } from "@/lib/auth-context";
import { db } from "@/lib/db";
import { ServiceError } from "@/lib/service-error";
import {
  isQuestionLiveOuverte,
  isSondageModifiable,
  sondageQuestionLiveEtatLabel,
} from "@/lib/sondages";
import { SondageKind, SondageQuestionLiveEtat, SondageStatus } from "@prisma/client";

export type LivePilotOpts = {
  /**
   * Barrière de test après `FOR UPDATE` sur la question, avant mutation liveEtat.
   */
  afterQuestionLocked?: () => Promise<void>;
  /**
   * Barrière de test après verrouillage de toutes les questions du quiz
   * (ouverture concurrente), avant mutation liveEtat.
   */
  afterQuestionsLocked?: () => Promise<void>;
};

const IdSchema = z.object({
  sondageId: z.string().min(1),
  questionId: z.string().min(1).optional(),
});

type LiveQuestionRow = {
  id: string;
  ordre: number;
  libelle: string;
  liveEtat: SondageQuestionLiveEtat;
};

/**
 * Charge un quiz En direct pour le pilote ADMIN (ou vérif interne).
 */
async function loadLiveQuizOrThrow(sondageId: string) {
  const sondage = await db.sondage.findUnique({
    where: { id: sondageId },
    include: {
      questions: {
        orderBy: { ordre: "asc" },
        select: {
          id: true,
          ordre: true,
          libelle: true,
          liveEtat: true,
          type: true,
        },
      },
    },
  });
  if (!sondage) throw new ServiceError("NOT_FOUND", "Quiz introuvable");
  if (sondage.kind !== SondageKind.Quiz) {
    throw new ServiceError(
      "VALIDATION_ERROR",
      "Le mode En direct est réservé aux quiz"
    );
  }
  if (!sondage.modeEnDirect) {
    throw new ServiceError(
      "VALIDATION_ERROR",
      "Ce quiz n’est pas en mode En direct"
    );
  }
  return sondage;
}

/**
 * Résumé pilote : question active + liste des états.
 */
export function buildLivePilotSnapshot(questions: LiveQuestionRow[]) {
  const ouverte = questions.find((q) => q.liveEtat === "Ouverte") ?? null;
  const focus =
    ouverte ??
    [...questions].reverse().find(
      (q) => q.liveEtat === "Fermee" || q.liveEtat === "CorrigeRevele"
    ) ??
    questions.find((q) => q.liveEtat === "EnAttente") ??
    null;
  const nextEnAttente =
    questions.find((q) => q.liveEtat === "EnAttente") ?? null;

  return {
    questionActiveId: ouverte?.id ?? null,
    questionFocusId: focus?.id ?? null,
    nextQuestionId: nextEnAttente?.id ?? null,
    questions: questions.map((q) => ({
      id: q.id,
      ordre: q.ordre,
      libelle: q.libelle,
      liveEtat: q.liveEtat,
      liveEtatLabel: sondageQuestionLiveEtatLabel(q.liveEtat),
      ouverte: isQuestionLiveOuverte(q.liveEtat),
    })),
  };
}

/**
 * Ouvre une question aux réponses (une seule à la fois).
 * Verrouille toutes les questions du quiz (`FOR UPDATE` ordonné) pour
 * empêcher deux admins d’ouvrir deux questions distinctes en parallèle.
 *
 * @param _actor - Réservé (ADMIN via actions)
 * @param sondageId - Quiz en direct
 * @param questionId - Question à ouvrir
 * @param opts - Hooks de test (barrières)
 */
export async function openLiveQuestion(
  _actor: AuthContext | null,
  sondageId: string,
  questionId: string,
  opts: LivePilotOpts = {}
) {
  const sondage = await loadLiveQuizOrThrow(sondageId);
  if (sondage.status !== SondageStatus.Ouvert) {
    throw new ServiceError(
      "FORBIDDEN",
      "Le quiz doit être ouvert pour piloter les questions"
    );
  }
  if (!isSondageModifiable(sondage)) {
    throw new ServiceError("FORBIDDEN", "Ce quiz est clôturé");
  }

  const target = sondage.questions.find((q) => q.id === questionId);
  if (!target) {
    throw new ServiceError("NOT_FOUND", "Question introuvable");
  }
  if (target.liveEtat === "Ouverte") {
    return buildLivePilotSnapshot(sondage.questions);
  }
  if (target.liveEtat === "CorrigeRevele" || target.liveEtat === "Fermee") {
    throw new ServiceError(
      "VALIDATION_ERROR",
      "Cette question a déjà été diffusée ; ouvrez la suivante"
    );
  }

  await db.$transaction(async (tx) => {
    // Ordre stable (ordre ASC) : évite les deadlocks entre ouvertures concurrentes.
    await tx.$queryRaw`
      SELECT id FROM sondage_questions
      WHERE "sondageId" = ${sondageId}
      ORDER BY ordre ASC
      FOR UPDATE
    `;
    if (opts.afterQuestionsLocked) {
      await opts.afterQuestionsLocked();
    }

    const autreOuverte = await tx.sondageQuestion.findFirst({
      where: {
        sondageId,
        liveEtat: SondageQuestionLiveEtat.Ouverte,
        NOT: { id: questionId },
      },
      select: { id: true },
    });
    if (autreOuverte) {
      throw new ServiceError(
        "VALIDATION_ERROR",
        "Fermez d’abord la question actuellement ouverte"
      );
    }

    const opened = await tx.sondageQuestion.updateMany({
      where: {
        id: questionId,
        liveEtat: SondageQuestionLiveEtat.EnAttente,
      },
      data: { liveEtat: SondageQuestionLiveEtat.Ouverte },
    });
    if (opened.count !== 1) {
      // Déjà ouverte par un concurrent, ou état inattendu.
      const current = await tx.sondageQuestion.findUnique({
        where: { id: questionId },
        select: { liveEtat: true },
      });
      if (current?.liveEtat !== SondageQuestionLiveEtat.Ouverte) {
        throw new ServiceError(
          "VALIDATION_ERROR",
          "Impossible d’ouvrir cette question"
        );
      }
    }
  });

  const refreshed = await loadLiveQuizOrThrow(sondageId);
  return buildLivePilotSnapshot(refreshed.questions);
}

/**
 * Ferme les réponses de la question ouverte (sans révéler le corrigé).
 * Verrouille la ligne question (`FOR UPDATE`) pour sérialiser avec la soumission.
 *
 * @param _actor - Réservé (ADMIN via actions)
 * @param sondageId - Quiz en direct
 * @param questionId - Question à fermer
 * @param opts - Hooks de test (barrières)
 */
export async function closeLiveQuestion(
  _actor: AuthContext | null,
  sondageId: string,
  questionId: string,
  opts: LivePilotOpts = {}
) {
  const sondage = await loadLiveQuizOrThrow(sondageId);
  const target = sondage.questions.find((q) => q.id === questionId);
  if (!target) throw new ServiceError("NOT_FOUND", "Question introuvable");
  if (target.liveEtat !== "Ouverte") {
    throw new ServiceError(
      "VALIDATION_ERROR",
      "Seule une question ouverte peut être fermée"
    );
  }

  await db.$transaction(async (tx) => {
    await tx.$queryRaw`
      SELECT id FROM sondage_questions WHERE id = ${questionId} FOR UPDATE
    `;
    if (opts.afterQuestionLocked) {
      await opts.afterQuestionLocked();
    }
    const closed = await tx.sondageQuestion.updateMany({
      where: {
        id: questionId,
        liveEtat: SondageQuestionLiveEtat.Ouverte,
      },
      data: { liveEtat: SondageQuestionLiveEtat.Fermee },
    });
    if (closed.count !== 1) {
      throw new ServiceError(
        "VALIDATION_ERROR",
        "Seule une question ouverte peut être fermée"
      );
    }
  });

  const refreshed = await loadLiveQuizOrThrow(sondageId);
  return buildLivePilotSnapshot(refreshed.questions);
}

/**
 * Révèle le corrigé d'une question fermée (ou déjà révélée = no-op).
 */
export async function revealLiveQuestionCorrige(
  _actor: AuthContext | null,
  sondageId: string,
  questionId: string
) {
  const sondage = await loadLiveQuizOrThrow(sondageId);
  const target = sondage.questions.find((q) => q.id === questionId);
  if (!target) throw new ServiceError("NOT_FOUND", "Question introuvable");
  if (target.liveEtat === "CorrigeRevele") {
    return buildLivePilotSnapshot(sondage.questions);
  }
  if (target.liveEtat !== "Fermee") {
    throw new ServiceError(
      "VALIDATION_ERROR",
      "Fermez d’abord les réponses avant de révéler le corrigé"
    );
  }

  await db.sondageQuestion.update({
    where: { id: questionId },
    data: { liveEtat: SondageQuestionLiveEtat.CorrigeRevele },
  });

  const refreshed = await loadLiveQuizOrThrow(sondageId);
  return buildLivePilotSnapshot(refreshed.questions);
}

/**
 * Passe à la question suivante : n’ouvre pas si une question est encore ouverte.
 * N’exige pas la révélation du corrigé (question peut rester Fermee).
 */
export async function openNextLiveQuestion(
  _actor: AuthContext | null,
  sondageId: string
) {
  const sondage = await loadLiveQuizOrThrow(sondageId);
  if (!isSondageModifiable(sondage)) {
    throw new ServiceError("FORBIDDEN", "Ce quiz est clôturé");
  }

  const ouverte = sondage.questions.find((q) => q.liveEtat === "Ouverte");
  if (ouverte) {
    throw new ServiceError(
      "VALIDATION_ERROR",
      "Fermez d’abord la question ouverte (vous pouvez passer sans révéler le corrigé)"
    );
  }

  const next = sondage.questions.find((q) => q.liveEtat === "EnAttente");
  if (!next) {
    throw new ServiceError(
      "VALIDATION_ERROR",
      "Aucune question suivante en attente"
    );
  }

  return openLiveQuestion(_actor, sondageId, next.id);
}

/**
 * Active le mode En direct sur un quiz (ADMIN). Réinitialise les états live.
 */
export async function setQuizModeEnDirect(
  sondageId: string,
  enabled: boolean
) {
  const parsed = IdSchema.parse({ sondageId });
  const sondage = await db.sondage.findUnique({
    where: { id: parsed.sondageId },
    select: {
      id: true,
      kind: true,
      status: true,
      modeEnDirect: true,
      questions: { select: { id: true, liveEtat: true } },
    },
  });
  if (!sondage) throw new ServiceError("NOT_FOUND", "Quiz introuvable");
  if (sondage.kind !== SondageKind.Quiz) {
    throw new ServiceError(
      "VALIDATION_ERROR",
      "Le mode En direct est réservé aux quiz"
    );
  }

  if (!enabled) {
    const hasStarted = sondage.questions.some((q) => q.liveEtat !== "EnAttente");
    if (hasStarted && sondage.status === SondageStatus.Ouvert) {
      throw new ServiceError(
        "VALIDATION_ERROR",
        "Impossible de désactiver le mode En direct après le début de la diffusion"
      );
    }
  }

  await db.$transaction(async (tx) => {
    await tx.sondage.update({
      where: { id: sondage.id },
      data: { modeEnDirect: enabled },
    });
    if (enabled) {
      await tx.sondageQuestion.updateMany({
        where: { sondageId: sondage.id },
        data: { liveEtat: SondageQuestionLiveEtat.EnAttente },
      });
    }
  });

  return { modeEnDirect: enabled };
}
