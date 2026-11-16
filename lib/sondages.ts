import type {
  Sondage,
  SondageKind,
  SondageQuestionLiveEtat,
  SondageQuestionType,
  SondageStatus,
} from "@prisma/client";

export type SondageQuestionInput = {
  ordre: number;
  section?: string | null;
  libelle: string;
  type: SondageQuestionType;
  obligatoire?: boolean;
  maxSelections?: number | null;
  minCaracteres?: number | null;
  maxCaracteres?: number | null;
  /** Explication du corrigé (quiz) — facultative. */
  explication?: string | null;
  options?: Array<{
    ordre: number;
    libelle: string;
    permetTexteLibre?: boolean;
    /** Bonne réponse (quiz / ChoixUnique). */
    estCorrecte?: boolean;
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
 * Résultats collectifs consultables par les adhérents.
 *
 * Règle : autorisation ADMIN explicite (`resultatsVisiblesAdherents`)
 * et sondage effectivement clôturé. La clôture seule ne publie pas.
 * Les corrigés / agrégats admin ne sont jamais déduits de la seule clôture.
 *
 * @param sondage - Sondage (dates + statut + flag publication)
 * @param now - Instant de référence
 */
export function isSondageResultatsCollectifsVisiblesPourAdherent(
  sondage: Pick<
    Sondage,
    "status" | "dateDebut" | "dateFin" | "resultatsVisiblesAdherents"
  >,
  now = new Date()
): boolean {
  if (!sondage.resultatsVisiblesAdherents) return false;
  if (isSondageModifiable(sondage, now)) return false;
  return getSondageStatutEffectif(sondage, now) === "Cloture";
}

/**
 * Corrigé quiz consultable par les adhérents.
 *
 * Règle : campagne Quiz + autorisation ADMIN (`corrigeVisiblesAdherents`)
 * + clôture effective. Indépendant des résultats collectifs.
 * Tant que faux, les API adhérent ne doivent exposer ni bonne réponse,
 * ni explication, ni score déductible.
 *
 * @param sondage - Kind + flag corrigé + dates/statut
 * @param now - Instant de référence
 */
export function isSondageCorrigeVisiblesPourAdherent(
  sondage: Pick<
    Sondage,
    "status" | "dateDebut" | "dateFin" | "kind" | "corrigeVisiblesAdherents"
  >,
  now = new Date()
): boolean {
  if (sondage.kind !== "Quiz") return false;
  if (!sondage.corrigeVisiblesAdherents) return false;
  if (isSondageModifiable(sondage, now)) return false;
  return getSondageStatutEffectif(sondage, now) === "Cloture";
}

/**
 * Valide la structure d'un quiz avant ouverture / publication.
 * Quiz v1 : uniquement ChoixUnique, une bonne réponse par question.
 *
 * @param kind - Nature de campagne
 * @param questions - Questions à valider
 * @returns Message d'erreur ou null si OK
 */
export function validateQuizReadyForOpen(
  kind: SondageKind | string,
  questions: SondageQuestionInput[]
): string | null {
  if (kind !== "Quiz") return null;
  if (!questions.length) {
    return "Un quiz doit contenir au moins une question";
  }
  for (const question of questions) {
    const label = question.libelle?.trim()
      ? `« ${question.libelle.trim().slice(0, 40)} »`
      : `n°${question.ordre + 1}`;
    if (question.type !== "ChoixUnique") {
      return `Quiz : la question ${label} doit être en choix unique`;
    }
    const options = question.options ?? [];
    if (options.length < 2) {
      return `Quiz : la question ${label} doit avoir au moins deux options`;
    }
    const correctCount = options.filter((o) => o.estCorrecte).length;
    if (correctCount !== 1) {
      return `Quiz : la question ${label} doit avoir exactement une bonne réponse`;
    }
  }
  return null;
}

/**
 * Libellé d'affichage du kind (Web / mobile).
 */
export function sondageKindLabel(kind: SondageKind | string | null | undefined): string {
  return kind === "Quiz" ? "Quiz" : "Sondage";
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

export type SondageStatusPresentation = {
  /** Statut effectif (même règle que le mobile) — lecture seule, sans écriture DB. */
  effectif: SondageStatus;
  /** Clé visuelle badge : Brouillon | Ouvert | Cloture */
  badgeKey: SondageStatus;
  /** Libellé admin / filtre */
  label: string;
  /** true si Ouvert en base mais échéance dépassée */
  echeancePassee: boolean;
};

/**
 * Libellé et badge admin alignés sur la clôture effective mobile.
 * N’écrit rien en base.
 *
 * @param sondage - Dates + statut stocké
 * @param now - Instant de référence
 */
export function getSondageStatusPresentation(
  sondage: Pick<Sondage, "status" | "dateDebut" | "dateFin">,
  now = new Date()
): SondageStatusPresentation {
  const effectif = getSondageStatutEffectif(sondage, now);
  const echeancePassee =
    sondage.status === "Ouvert" && now > sondage.dateFin;

  if (effectif === "Brouillon") {
    return {
      effectif,
      badgeKey: "Brouillon",
      label: "Brouillon",
      echeancePassee: false,
    };
  }
  if (effectif === "Ouvert") {
    return {
      effectif,
      badgeKey: "Ouvert",
      label: "Ouvert",
      echeancePassee: false,
    };
  }
  return {
    effectif: "Cloture",
    badgeKey: "Cloture",
    label: echeancePassee ? "Terminé — échéance passée" : "Terminé",
    echeancePassee,
  };
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
 * Les quiz « En direct » sont exclus du bandeau classique (compat AMAKI 1.1.1).
 */
export function isSurveyToComplete(survey: {
  estComplet: boolean;
  modifiable: boolean;
  modeEnDirect?: boolean;
}): boolean {
  if (survey.modeEnDirect) return false;
  return !survey.estComplet && survey.modifiable;
}

/**
 * Compte les sondages encore à compléter (même règle que la liste).
 */
export function countSurveysToComplete(
  surveys: Array<{
    estComplet: boolean;
    modifiable: boolean;
    modeEnDirect?: boolean;
  }>
): number {
  return surveys.filter(isSurveyToComplete).length;
}

/**
 * Libellé d'état de diffusion d'une question (pilote En direct).
 */
export function sondageQuestionLiveEtatLabel(
  etat: SondageQuestionLiveEtat | string | null | undefined
): string {
  switch (etat) {
    case "Ouverte":
      return "Ouverte aux réponses";
    case "Fermee":
      return "Réponses fermées";
    case "CorrigeRevele":
      return "Corrigé révélé";
    default:
      return "En attente";
  }
}

/**
 * Une question accepte encore des réponses en mode En direct.
 */
export function isQuestionLiveOuverte(
  etat: SondageQuestionLiveEtat | string | null | undefined
): boolean {
  return etat === "Ouverte";
}

/**
 * Corrigé d'une question live consultable (révélation ADMIN pour cette question).
 * Indépendant de `corrigeVisiblesAdherents` (publication globale post-clôture).
 */
export function isQuestionLiveCorrigeRevele(
  etat: SondageQuestionLiveEtat | string | null | undefined
): boolean {
  return etat === "CorrigeRevele";
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
