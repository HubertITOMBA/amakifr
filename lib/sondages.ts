import type { Sondage, SondageQuestionType, SondageStatus } from "@prisma/client";

export type SondageQuestionInput = {
  ordre: number;
  section?: string | null;
  libelle: string;
  type: SondageQuestionType;
  obligatoire?: boolean;
  maxSelections?: number | null;
  minCaracteres?: number | null;
  maxCaracteres?: number | null;
  options?: Array<{
    ordre: number;
    libelle: string;
    permetTexteLibre?: boolean;
  }>;
  lignesMatrice?: Array<{
    ordre: number;
    libelle: string;
  }>;
};

export type SondageReponseItemInput = {
  questionId: string;
  optionId?: string | null;
  ligneMatriceId?: string | null;
  texteLibre?: string | null;
};

export type SondageQuestionForCompletion = {
  id: string;
  type: SondageQuestionType | string;
  obligatoire: boolean;
  lignesMatrice?: Array<{ id: string }>;
};

/**
 * Indique si un sondage accepte encore des réponses ou modifications.
 */
export function isSondageModifiable(
  sondage: Pick<Sondage, "status" | "dateDebut" | "dateFin">,
  now = new Date()
): boolean {
  if (sondage.status !== "Ouvert") return false;
  return sondage.dateDebut <= now && now <= sondage.dateFin;
}

/**
 * Indique si un sondage est visible pour les adhérents (lien profil).
 */
export function isSondageVisiblePourAdherent(
  sondage: Pick<Sondage, "status" | "dateDebut" | "dateFin">,
  now = new Date()
): boolean {
  if (sondage.status !== "Ouvert") return false;
  return sondage.dateDebut <= now && now <= sondage.dateFin;
}

/**
 * Calcule le statut effectif en tenant compte des dates (sans modifier la base).
 */
export function getSondageStatutEffectif(
  sondage: Pick<Sondage, "status" | "dateDebut" | "dateFin">,
  now = new Date()
): SondageStatus {
  if (sondage.status === "Cloture") return "Cloture";
  if (sondage.status === "Brouillon") return "Brouillon";
  if (now > sondage.dateFin) return "Cloture";
  return "Ouvert";
}

/**
 * Valide la cohérence des dates d'un sondage.
 */
export function validateSondageDates(dateDebut: Date, dateFin: Date): string | null {
  if (!(dateDebut instanceof Date) || Number.isNaN(dateDebut.getTime())) {
    return "Date de début invalide";
  }
  if (!(dateFin instanceof Date) || Number.isNaN(dateFin.getTime())) {
    return "Date de fin invalide";
  }
  if (dateFin <= dateDebut) {
    return "La date de fin doit être postérieure à la date de début";
  }
  return null;
}

/**
 * Une question obligatoire est-elle correctement répondue ?
 */
export function isRequiredQuestionAnswered(
  question: SondageQuestionForCompletion,
  items: SondageReponseItemInput[]
): boolean {
  const answers = items.filter((i) => i.questionId === question.id);
  if (!question.obligatoire) return true;

  if (question.type === "TexteLibre") {
    return Boolean(answers[0]?.texteLibre?.trim());
  }
  if (question.type === "ChoixUnique") {
    return answers.filter((a) => a.optionId).length === 1;
  }
  if (question.type === "ChoixMultiple") {
    return answers.some((a) => a.optionId);
  }
  if (question.type === "Matrice") {
    const lines = question.lignesMatrice ?? [];
    if (lines.length === 0) return answers.length > 0;
    const covered = new Set(
      answers.map((a) => a.ligneMatriceId).filter(Boolean) as string[]
    );
    return lines.every((l) => covered.has(l.id));
  }
  return answers.length > 0;
}

/**
 * Progression sur les questions obligatoires.
 */
export function getSurveyRequiredProgress(
  questions: SondageQuestionForCompletion[],
  items: SondageReponseItemInput[]
): { requiredTotal: number; requiredAnswered: number } {
  const required = questions.filter((q) => q.obligatoire);
  const requiredAnswered = required.filter((q) =>
    isRequiredQuestionAnswered(q, items)
  ).length;
  return { requiredTotal: required.length, requiredAnswered };
}

/**
 * Sondage « à compléter » : ouvert/modifiable et obligatoires non toutes répondues.
 * Source unique liste + summary + accueil.
 */
export function isSurveyToComplete(survey: {
  estComplet: boolean;
  modifiable: boolean;
}): boolean {
  return !survey.estComplet && survey.modifiable;
}

/**
 * Compte les sondages encore à compléter (même règle que la liste).
 */
export function countSurveysToComplete(
  surveys: Array<{ estComplet: boolean; modifiable: boolean }>
): number {
  return surveys.filter(isSurveyToComplete).length;
}

/**
 * Sondage complet pour un adhérent = toutes les questions obligatoires répondues.
 * Les facultatives manquantes ne bloquent pas.
 */
export function isSurveyCompleteForMember(
  questions: SondageQuestionForCompletion[],
  items: SondageReponseItemInput[]
): boolean {
  const { requiredTotal, requiredAnswered } = getSurveyRequiredProgress(
    questions,
    items
  );
  if (requiredTotal === 0) {
    return true;
  }
  return requiredAnswered >= requiredTotal;
}
