import type { AuthContext } from "@/lib/auth-context";
import { db } from "@/lib/db";
import { ServiceError } from "@/lib/service-error";
import {
  getSurveyRequiredProgress,
  isSondageModifiable,
  isSondageVisiblePourAdherent,
  isSurveyCompleteForMember,
  countSurveysToComplete,
  type SondageReponseItemInput,
} from "@/lib/sondages";

/**
 * Résout l'adhérent self-service depuis actor.userId.
 */
export async function resolveSelfAdherentId(actor: AuthContext): Promise<string> {
  if (!actor?.userId || String(actor.userId).trim() === "") {
    throw new ServiceError("UNAUTHENTICATED", "Non autorisé");
  }
  const adherent = await db.adherent.findUnique({
    where: { userId: actor.userId },
    select: { id: true },
  });
  if (!adherent) {
    throw new ServiceError("NOT_FOUND", "Adhérent introuvable");
  }
  return adherent.id;
}

export type MyActiveSurveyDto = {
  id: string;
  sujet: string;
  introduction: string | null;
  dateDebut: string;
  dateFin: string;
  statusLabel: string;
  requiredTotal: number;
  requiredAnswered: number;
  estComplet: boolean;
  modifiable: boolean;
};

export type MySurveysSummaryDto = {
  aCompleterCount: number;
};

/**
 * Compteur léger pour l'accueil mobile.
 */
export async function getMySurveysSummary(
  actor: AuthContext
): Promise<MySurveysSummaryDto> {
  const list = await getMyActiveSurveys(actor);
  return {
    aCompleterCount: countSurveysToComplete(list),
  };
}

/**
 * Sondages ouverts dans la période, avec progression obligatoire.
 */
export async function getMyActiveSurveys(
  actor: AuthContext
): Promise<MyActiveSurveyDto[]> {
  const adherentId = await resolveSelfAdherentId(actor);
  const now = new Date();

  const sondages = await db.sondage.findMany({
    where: {
      status: "Ouvert",
      dateDebut: { lte: now },
      dateFin: { gte: now },
    },
    orderBy: { dateFin: "asc" },
    select: {
      id: true,
      sujet: true,
      introduction: true,
      dateDebut: true,
      dateFin: true,
      status: true,
      questions: {
        select: {
          id: true,
          type: true,
          obligatoire: true,
          lignesMatrice: { select: { id: true } },
        },
      },
      reponses: {
        where: { adherentId },
        select: {
          items: {
            select: {
              questionId: true,
              optionId: true,
              ligneMatriceId: true,
              texteLibre: true,
            },
          },
        },
        take: 1,
      },
    },
  });

  return sondages.map((s) => {
    const items: SondageReponseItemInput[] = (s.reponses[0]?.items ?? []).map(
      (i) => ({
        questionId: i.questionId,
        optionId: i.optionId,
        ligneMatriceId: i.ligneMatriceId,
        texteLibre: i.texteLibre,
      })
    );
    const progress = getSurveyRequiredProgress(s.questions, items);
    const estComplet = isSurveyCompleteForMember(s.questions, items);
    const modifiable = isSondageModifiable(s, now);
    return {
      id: s.id,
      sujet: s.sujet,
      introduction: s.introduction,
      dateDebut: s.dateDebut.toISOString(),
      dateFin: s.dateFin.toISOString(),
      statusLabel: estComplet
        ? "Complété"
        : progress.requiredAnswered > 0
          ? "En cours"
          : "À compléter",
      requiredTotal: progress.requiredTotal,
      requiredAnswered: progress.requiredAnswered,
      estComplet,
      modifiable,
    };
  });
}

export type MySurveyDetailDto = {
  id: string;
  sujet: string;
  introduction: string | null;
  conclusion: string | null;
  dateDebut: string;
  dateFin: string;
  modifiable: boolean;
  estComplet: boolean;
  requiredTotal: number;
  requiredAnswered: number;
  questions: Array<{
    id: string;
    ordre: number;
    section: string | null;
    libelle: string;
    type: string;
    obligatoire: boolean;
    maxSelections: number | null;
    minCaracteres: number | null;
    maxCaracteres: number | null;
    options: Array<{
      id: string;
      ordre: number;
      libelle: string;
      permetTexteLibre: boolean;
    }>;
    lignesMatrice: Array<{ id: string; ordre: number; libelle: string }>;
  }>;
  maReponse: {
    id: string;
    soumiseLe: string;
    modifieLe: string;
    items: SondageReponseItemInput[];
  } | null;
};

/**
 * Détail questionnaire + réponses de l'adhérent.
 */
export async function getMySurvey(
  actor: AuthContext,
  surveyId: string
): Promise<MySurveyDetailDto> {
  const adherentId = await resolveSelfAdherentId(actor);
  const id = String(surveyId ?? "").trim();
  if (!id) throw new ServiceError("VALIDATION_ERROR", "Identifiant invalide");

  const sondage = await db.sondage.findUnique({
    where: { id },
    include: {
      questions: {
        orderBy: { ordre: "asc" },
        include: {
          options: { orderBy: { ordre: "asc" } },
          lignesMatrice: { orderBy: { ordre: "asc" } },
        },
      },
    },
  });

  if (!sondage) throw new ServiceError("NOT_FOUND", "Sondage introuvable");

  if (
    !isSondageVisiblePourAdherent(sondage) &&
    sondage.status !== "Cloture"
  ) {
    throw new ServiceError("FORBIDDEN", "Ce sondage n'est pas accessible");
  }

  const maReponse = await db.sondageReponse.findUnique({
    where: {
      sondageId_adherentId: { sondageId: id, adherentId },
    },
    include: { items: true },
  });

  const items: SondageReponseItemInput[] = (maReponse?.items ?? []).map((i) => ({
    questionId: i.questionId,
    optionId: i.optionId,
    ligneMatriceId: i.ligneMatriceId,
    texteLibre: i.texteLibre,
  }));

  const progress = getSurveyRequiredProgress(sondage.questions, items);

  return {
    id: sondage.id,
    sujet: sondage.sujet,
    introduction: sondage.introduction,
    conclusion: sondage.conclusion,
    dateDebut: sondage.dateDebut.toISOString(),
    dateFin: sondage.dateFin.toISOString(),
    modifiable: isSondageModifiable(sondage),
    estComplet: isSurveyCompleteForMember(sondage.questions, items),
    requiredTotal: progress.requiredTotal,
    requiredAnswered: progress.requiredAnswered,
    questions: sondage.questions.map((q) => ({
      id: q.id,
      ordre: q.ordre,
      section: q.section,
      libelle: q.libelle,
      type: q.type,
      obligatoire: q.obligatoire,
      maxSelections: q.maxSelections,
      minCaracteres: q.minCaracteres,
      maxCaracteres: q.maxCaracteres,
      options: q.options.map((o) => ({
        id: o.id,
        ordre: o.ordre,
        libelle: o.libelle,
        permetTexteLibre: o.permetTexteLibre,
      })),
      lignesMatrice: q.lignesMatrice.map((l) => ({
        id: l.id,
        ordre: l.ordre,
        libelle: l.libelle,
      })),
    })),
    maReponse: maReponse
      ? {
          id: maReponse.id,
          soumiseLe: maReponse.soumiseLe.toISOString(),
          modifieLe: maReponse.modifieLe.toISOString(),
          items,
        }
      : null,
  };
}
