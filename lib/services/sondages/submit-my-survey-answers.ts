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
 * Enregistre les réponses de l'adhérent (partielles ou complètes).
 * Ownership via actor.userId → Adherent.
 */
export async function submitMySurveyAnswers(
  actor: AuthContext,
  surveyId: string,
  input: { items: SondageReponseItemInput[]; mode?: "partial" | "complete" }
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

  const structureError = validateItemsStructure(
    sondage.questions,
    parsed.data.items,
    parsed.data.mode === "complete"
  );
  if (structureError) {
    throw new ServiceError("VALIDATION_ERROR", structureError);
  }

  const reponse = await db.$transaction(async (tx) => {
    const existing = await tx.sondageReponse.findUnique({
      where: {
        sondageId_adherentId: { sondageId: id, adherentId },
      },
    });

    if (existing) {
      await tx.sondageReponseItem.deleteMany({
        where: { reponseId: existing.id },
      });
      return tx.sondageReponse.update({
        where: { id: existing.id },
        data: {
          modifieLe: new Date(),
          items: {
            create: parsed.data.items.map((item) => ({
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
          create: parsed.data.items.map((item) => ({
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
