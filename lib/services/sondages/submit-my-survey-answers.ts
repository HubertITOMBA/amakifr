import { z } from "zod";
import type { AuthContext } from "@/lib/auth-context";
import { db } from "@/lib/db";
import { ServiceError } from "@/lib/service-error";
import {
  isSondageModifiable,
  isSurveyCompleteForMember,
  type SondageReponseItemInput,
} from "@/lib/sondages";
import { resolveSelfAdherentId } from "@/lib/services/sondages/get-my-surveys";
import { Prisma, SondageQuestionLiveEtat } from "@prisma/client";

export type SubmitMySurveyAnswersOpts = {
  /**
   * Barrière de test après verrouillage FOR UPDATE (sondage + questions live)
   * et contrôles d’état, avant l’écriture de la réponse
   * (course avec closeLiveQuestion / closeSondage).
   */
  afterLiveEtatLocked?: () => Promise<void>;
};

const ItemSchema = z.object({
  questionId: z.string().min(1),
  optionId: z.string().min(1).optional().nullable(),
  ligneMatriceId: z.string().min(1).optional().nullable(),
  texteLibre: z.string().max(20000).optional().nullable(),
});

const BodySchema = z.object({
  items: z.array(ItemSchema),
  /** partial = sauvegarde sans exiger toutes les obligatoires */
  mode: z.enum(["partial", "complete"]).default("partial"),
});

function validateItemsStructure(
  questions: Array<{
    id: string;
    type: string;
    obligatoire: boolean;
    maxSelections: number | null;
    minCaracteres: number | null;
    maxCaracteres: number | null;
    options: Array<{ id: string }>;
    lignesMatrice: Array<{ id: string }>;
  }>,
  items: SondageReponseItemInput[],
  requireAllRequired: boolean
): string | null {
  const questionIds = new Set(questions.map((q) => q.id));
  const optionByQuestion = new Map(
    questions.map((q) => [q.id, new Set(q.options.map((o) => o.id))])
  );
  const linesByQuestion = new Map(
    questions.map((q) => [q.id, new Set(q.lignesMatrice.map((l) => l.id))])
  );

  for (const item of items) {
    if (!questionIds.has(item.questionId)) {
      return "Question invalide pour ce sondage";
    }
    const q = questions.find((x) => x.id === item.questionId)!;
    if (item.optionId) {
      if (!optionByQuestion.get(q.id)?.has(item.optionId)) {
        return "Choix invalide pour cette question";
      }
    }
    if (item.ligneMatriceId) {
      if (!linesByQuestion.get(q.id)?.has(item.ligneMatriceId)) {
        return "Ligne de matrice invalide";
      }
    }
    if (q.type === "TexteLibre" && item.texteLibre) {
      const text = item.texteLibre.trim();
      if (q.minCaracteres != null && text.length < q.minCaracteres) {
        return `Réponse trop courte (min. ${q.minCaracteres} caractères)`;
      }
      if (q.maxCaracteres != null && text.length > q.maxCaracteres) {
        return `Réponse trop longue (max. ${q.maxCaracteres} caractères)`;
      }
    }
    if (q.type === "ChoixMultiple") {
      const count = items.filter(
        (i) => i.questionId === q.id && i.optionId
      ).length;
      if (q.maxSelections != null && count > q.maxSelections) {
        return `Maximum ${q.maxSelections} sélection(s) autorisée(s)`;
      }
    }
  }

  if (requireAllRequired) {
    if (!isSurveyCompleteForMember(questions, items)) {
      return "Répondez à toutes les questions obligatoires";
    }
  }

  return null;
}

/**
 * Fusionne les items existants hors questions touchées + nouveaux items.
 * Conserve les réponses déjà enregistrées aux autres questions (En direct).
 */
export function mergeSurveyAnswerItems(
  existing: SondageReponseItemInput[],
  incoming: SondageReponseItemInput[],
  touchedQuestionIds: Set<string>
): SondageReponseItemInput[] {
  const kept = existing.filter((i) => !touchedQuestionIds.has(i.questionId));
  return [...kept, ...incoming];
}

/**
 * Enregistre les réponses de l'adhérent (partielles ou complètes).
 * Ownership via actor.userId → Adherent.
 * Mode En direct : n’accepte que les questions encore `Ouverte`,
 * avec verrouillage ligne (`FOR UPDATE`) partagé avec le pilote live.
 *
 * @param actor - Contexte auth self-service
 * @param surveyId - Identifiant sondage
 * @param input - Items + mode partial|complete
 * @param opts - Hooks de test (barrières de concurrence)
 */
export async function submitMySurveyAnswers(
  actor: AuthContext,
  surveyId: string,
  input: { items: SondageReponseItemInput[]; mode?: "partial" | "complete" },
  opts: SubmitMySurveyAnswersOpts = {}
): Promise<{
  id: string;
  estComplet: boolean;
  requiredTotal: number;
  requiredAnswered: number;
}> {
  const adherentId = await resolveSelfAdherentId(actor);
  const id = String(surveyId ?? "").trim();
  if (!id) throw new ServiceError("VALIDATION_ERROR", "Identifiant invalide");

  const parsed = BodySchema.safeParse({
    items: input.items,
    mode: input.mode ?? "partial",
  });
  if (!parsed.success) {
    throw new ServiceError("VALIDATION_ERROR", "Réponses invalides");
  }

  const sondage = await db.sondage.findUnique({
    where: { id },
    include: {
      questions: {
        include: {
          options: true,
          lignesMatrice: true,
        },
      },
    },
  });

  if (!sondage) throw new ServiceError("NOT_FOUND", "Sondage introuvable");

  if (!isSondageModifiable(sondage)) {
    throw new ServiceError(
      "FORBIDDEN",
      "Ce sondage est maintenant clôturé."
    );
  }

  const modeEnDirect = Boolean(sondage.modeEnDirect);
  const incoming = parsed.data.items;
  const touchedQuestionIds = new Set(incoming.map((i) => i.questionId));

  if (modeEnDirect) {
    if (incoming.length === 0) {
      throw new ServiceError("VALIDATION_ERROR", "Aucune réponse à enregistrer");
    }
    for (const qid of touchedQuestionIds) {
      const q = sondage.questions.find((x) => x.id === qid);
      if (!q || q.liveEtat !== SondageQuestionLiveEtat.Ouverte) {
        throw new ServiceError(
          "FORBIDDEN",
          "Cette question n’accepte plus de réponses."
        );
      }
    }
    // En direct : pas d’exigence « complete » sur tout le quiz.
  }

  const questionsForValidation = modeEnDirect
    ? sondage.questions.filter((q) => touchedQuestionIds.has(q.id))
    : sondage.questions;

  const structureError = validateItemsStructure(
    questionsForValidation,
    incoming,
    !modeEnDirect && parsed.data.mode === "complete"
  );
  if (structureError) {
    throw new ServiceError("VALIDATION_ERROR", structureError);
  }

  const reponse = await db.$transaction(async (tx) => {
    // 1) Verrouille le sondage : sérialise avec closeSondage (clôture quiz).
    await tx.$queryRaw`
      SELECT id FROM sondages WHERE id = ${id} FOR UPDATE
    `;
    const fresh = await tx.sondage.findUnique({
      where: { id },
      select: {
        status: true,
        dateDebut: true,
        dateFin: true,
        modeEnDirect: true,
      },
    });
    if (!fresh || !isSondageModifiable(fresh)) {
      throw new ServiceError(
        "FORBIDDEN",
        "Ce sondage est maintenant clôturé."
      );
    }
    if (fresh.modeEnDirect) {
      const touchedIds = [...touchedQuestionIds];
      // 2) Verrouille les questions touchées : sérialise avec closeLiveQuestion.
      const locked = await tx.$queryRaw<
        Array<{ id: string; liveEtat: SondageQuestionLiveEtat }>
      >`
        SELECT id, "liveEtat"
        FROM sondage_questions
        WHERE id IN (${Prisma.join(touchedIds)})
        ORDER BY ordre ASC
        FOR UPDATE
      `;
      if (locked.length !== touchedIds.length) {
        throw new ServiceError(
          "FORBIDDEN",
          "Cette question n’accepte plus de réponses."
        );
      }
      for (const q of locked) {
        if (q.liveEtat !== SondageQuestionLiveEtat.Ouverte) {
          throw new ServiceError(
            "FORBIDDEN",
            "Cette question n’accepte plus de réponses."
          );
        }
      }
    }
    if (opts.afterLiveEtatLocked) {
      await opts.afterLiveEtatLocked();
      // Recontrôle après barrière (clôture quiz concurrente).
      const afterGate = await tx.sondage.findUnique({
        where: { id },
        select: { status: true, dateDebut: true, dateFin: true },
      });
      if (!afterGate || !isSondageModifiable(afterGate)) {
        throw new ServiceError(
          "FORBIDDEN",
          "Ce sondage est maintenant clôturé."
        );
      }
    }

    const existing = await tx.sondageReponse.findUnique({
      where: {
        sondageId_adherentId: { sondageId: id, adherentId },
      },
      include: { items: true },
    });

    let finalItems = incoming;
    if (modeEnDirect && existing) {
      finalItems = mergeSurveyAnswerItems(
        existing.items.map((i) => ({
          questionId: i.questionId,
          optionId: i.optionId,
          ligneMatriceId: i.ligneMatriceId,
          texteLibre: i.texteLibre,
        })),
        incoming,
        touchedQuestionIds
      );
    }

    if (existing) {
      await tx.sondageReponseItem.deleteMany({
        where: modeEnDirect
          ? {
              reponseId: existing.id,
              questionId: { in: [...touchedQuestionIds] },
            }
          : { reponseId: existing.id },
      });
      return tx.sondageReponse.update({
        where: { id: existing.id },
        data: {
          modifieLe: new Date(),
          items: {
            create: (modeEnDirect ? incoming : finalItems).map((item) => ({
              questionId: item.questionId,
              optionId: item.optionId || null,
              ligneMatriceId: item.ligneMatriceId || null,
              texteLibre: item.texteLibre?.trim() || null,
            })),
          },
        },
        include: { items: true },
      });
    }

    return tx.sondageReponse.create({
      data: {
        sondageId: id,
        adherentId,
        items: {
          create: incoming.map((item) => ({
            questionId: item.questionId,
            optionId: item.optionId || null,
            ligneMatriceId: item.ligneMatriceId || null,
            texteLibre: item.texteLibre?.trim() || null,
          })),
        },
      },
      include: { items: true },
    });
  });

  const items: SondageReponseItemInput[] = reponse.items.map((i) => ({
    questionId: i.questionId,
    optionId: i.optionId,
    ligneMatriceId: i.ligneMatriceId,
    texteLibre: i.texteLibre,
  }));

  const { getSurveyRequiredProgress } = await import("@/lib/sondages");
  const progress = getSurveyRequiredProgress(sondage.questions, items);

  return {
    id: reponse.id,
    estComplet: isSurveyCompleteForMember(sondage.questions, items),
    requiredTotal: progress.requiredTotal,
    requiredAnswered: progress.requiredAnswered,
  };
}
