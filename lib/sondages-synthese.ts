import type {
  SondageMatriceLigne,
  SondageOption,
  SondageQuestion,
  SondageQuestionType,
  SondageReponseItem,
} from "@prisma/client";

export type SondageSyntheseChoix = {
  optionId: string;
  libelle: string;
  count: number;
  percent: number;
};

export type SondageSyntheseMatriceLigne = {
  ligneId: string;
  libelle: string;
  colonnes: SondageSyntheseChoix[];
};

export type SondageSyntheseQuestion = {
  id: string;
  ordre: number;
  section: string | null;
  libelle: string;
  type: SondageQuestionType;
  participations: number;
  choix?: SondageSyntheseChoix[];
  textes?: string[];
  matrice?: SondageSyntheseMatriceLigne[];
};

export type SondageSynthese = {
  sondageId: string;
  sujet: string;
  dateDebut: Date;
  dateFin: Date;
  status: string;
  totalReponses: number;
  totalAdherentsActifs: number;
  tauxParticipation: number;
  generatedAt: Date;
  questions: SondageSyntheseQuestion[];
};

type QuestionWithRelations = SondageQuestion & {
  options: SondageOption[];
  lignesMatrice: SondageMatriceLigne[];
};

type ReponseWithItems = {
  id: string;
  items: SondageReponseItem[];
};

function percent(count: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((count / total) * 1000) / 10;
}

/**
 * Agrège les réponses d'un sondage pour la synthèse admin.
 */
export function buildSondageSynthese(params: {
  sondageId: string;
  sujet: string;
  dateDebut: Date;
  dateFin: Date;
  status: string;
  totalAdherentsActifs: number;
  questions: QuestionWithRelations[];
  reponses: ReponseWithItems[];
}): SondageSynthese {
  const totalReponses = params.reponses.length;
  const tauxParticipation = percent(totalReponses, params.totalAdherentsActifs);

  const questions: SondageSyntheseQuestion[] = params.questions.map((question) => {
    const itemsForQuestion = params.reponses.flatMap((r) =>
      r.items.filter((i) => i.questionId === question.id)
    );
    const participations = new Set(
      params.reponses
        .filter((r) => r.items.some((i) => i.questionId === question.id))
        .map((r) => r.id)
    ).size;

    if (question.type === "TexteLibre") {
      return {
        id: question.id,
        ordre: question.ordre,
        section: question.section,
        libelle: question.libelle,
        type: question.type,
        participations,
        textes: itemsForQuestion
          .map((i) => i.texteLibre?.trim())
          .filter((t): t is string => Boolean(t)),
      };
    }

    if (question.type === "Matrice") {
      const matrice: SondageSyntheseMatriceLigne[] = question.lignesMatrice.map((ligne) => {
        const colonnes = question.options.map((opt) => {
          const count = itemsForQuestion.filter(
            (i) => i.ligneMatriceId === ligne.id && i.optionId === opt.id
          ).length;
          return {
            optionId: opt.id,
            libelle: opt.libelle,
            count,
            percent: percent(count, participations),
          };
        });
        return { ligneId: ligne.id, libelle: ligne.libelle, colonnes };
      });

      return {
        id: question.id,
        ordre: question.ordre,
        section: question.section,
        libelle: question.libelle,
        type: question.type,
        participations,
        matrice,
      };
    }

    const choix = question.options.map((opt) => {
      const count = itemsForQuestion.filter((i) => i.optionId === opt.id).length;
      return {
        optionId: opt.id,
        libelle: opt.libelle,
        count,
        percent: percent(count, participations),
      };
    });

    return {
      id: question.id,
      ordre: question.ordre,
      section: question.section,
      libelle: question.libelle,
      type: question.type,
      participations,
      choix,
    };
  });

  return {
    sondageId: params.sondageId,
    sujet: params.sujet,
    dateDebut: params.dateDebut,
    dateFin: params.dateFin,
    status: params.status,
    totalReponses,
    totalAdherentsActifs: params.totalAdherentsActifs,
    tauxParticipation,
    generatedAt: new Date(),
    questions,
  };
}
