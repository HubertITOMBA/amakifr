import type { AuthContext } from "@/lib/auth-context";
import { db } from "@/lib/db";
import { ServiceError } from "@/lib/service-error";
import {
  getSurveyRequiredProgress,
  getSondageStatutEffectif,
  isSondageCorrigeVisiblesPourAdherent,
  isSondageModifiable,
  isSondageResultatsCollectifsVisiblesPourAdherent,
  isSondageVisiblePourAdherent,
  isSurveyCompleteForMember,
  countSurveysToComplete,
  isQuestionLiveCorrigeRevele,
  sondageKindLabel,
  sondageQuestionLiveEtatLabel,
  type SondageReponseItemInput,
} from "@/lib/sondages";
import { buildSondageSynthese } from "@/lib/sondages-synthese";
import { UserRole } from "@prisma/client";

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
  /** Sondage (défaut) ou Quiz — champ optionnel pour clients ≥ quiz v1. */
  kind?: string;
  kindLabel?: string;
  /** Quiz piloté question par question — absent = formulaire classique (compat 1.1.1). */
  modeEnDirect?: boolean;
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

const surveyListSelect = {
  id: true,
  sujet: true,
  introduction: true,
  dateDebut: true,
  dateFin: true,
  status: true,
  kind: true,
  modeEnDirect: true,
  questions: {
    select: {
      id: true,
      type: true,
      obligatoire: true,
      lignesMatrice: { select: { id: true } },
    },
  },
} as const;

type SurveyListRow = {
  id: string;
  sujet: string;
  introduction: string | null;
  dateDebut: Date;
  dateFin: Date;
  status: string;
  kind: string;
  modeEnDirect: boolean;
  questions: Array<{
    id: string;
    type: string;
    obligatoire: boolean;
    lignesMatrice: Array<{ id: string }>;
  }>;
  reponses: Array<{
    items: Array<{
      questionId: string;
      optionId: string | null;
      ligneMatriceId: string | null;
      texteLibre: string | null;
    }>;
  }>;
};

/**
 * Mappe une ligne Prisma vers le DTO liste adhérent.
 *
 * @param s - Sondage + éventuelle réponse adhérent
 * @param now - Instant de référence
 * @param closedSection - true pour la rubrique Terminés (libellé figé)
 */
function mapSurveyListRow(
  s: SurveyListRow,
  now: Date,
  closedSection = false
): MyActiveSurveyDto {
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
  const modifiable = closedSection ? false : isSondageModifiable(s, now);
  let statusLabel: string;
  if (closedSection || !modifiable) {
    statusLabel = "Terminé";
  } else if (estComplet) {
    statusLabel = "Complété";
  } else if (progress.requiredAnswered > 0) {
    statusLabel = "En cours";
  } else {
    statusLabel = "À compléter";
  }
  return {
    id: s.id,
    sujet: s.sujet,
    introduction: s.introduction,
    dateDebut: s.dateDebut.toISOString(),
    dateFin: s.dateFin.toISOString(),
    statusLabel,
    requiredTotal: progress.requiredTotal,
    requiredAnswered: progress.requiredAnswered,
    estComplet: s.modeEnDirect ? false : estComplet,
    modifiable,
    kind: s.kind,
    kindLabel: sondageKindLabel(s.kind),
    modeEnDirect: Boolean(s.modeEnDirect),
  };
}

/**
 * Sondages ouverts dans la période (y compris déjà complétés, encore modifiables).
 *
 * @param actor - Contexte auth self-service
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
      ...surveyListSelect,
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

  return sondages.map((s) => mapSurveyListRow(s, now, false));
}

/**
 * Archives adhérent : sondages clôturés ou dont la période est écoulée.
 * Lecture seule — ne remplace pas le listing défaut (compat AMAKI 1.1.1).
 *
 * @param actor - Contexte auth self-service
 */
export async function getMyClosedSurveys(
  actor: AuthContext
): Promise<MyActiveSurveyDto[]> {
  const adherentId = await resolveSelfAdherentId(actor);
  const now = new Date();

  const sondages = await db.sondage.findMany({
    where: {
      status: { in: ["Ouvert", "Cloture"] },
      dateDebut: { lte: now },
      OR: [{ status: "Cloture" }, { dateFin: { lt: now } }],
    },
    orderBy: { dateFin: "desc" },
    select: {
      ...surveyListSelect,
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

  return sondages.map((s) => mapSurveyListRow(s, now, true));
}

export type MySurveyPersonalSyntheseQuestion = {
  questionId: string;
  libelle: string;
  type: string;
  /** Libellés / textes de la réponse de l’adhérent (jamais les agrégats collectifs). */
  reponses: string[];
  /**
   * Présents uniquement si le corrigé quiz est publié ADMIN.
   * Absents sinon (ne pas déduire le corrigé).
   */
  estCorrecte?: boolean | null;
  bonneReponse?: string | null;
  explication?: string | null;
};

export type MySurveyPersonalSyntheseDto = {
  sondageId: string;
  sujet: string;
  aRepondu: boolean;
  /** Présent uniquement si aRepondu — synthèse personnelle lecture seule. */
  message: string | null;
  questions: MySurveyPersonalSyntheseQuestion[];
  soumiseLe: string | null;
  modifieLe: string | null;
  /** true seulement si corrigé quiz publié — jamais de score sinon. */
  corrigePublie?: boolean;
  score?: { correct: number; total: number } | null;
};

/**
 * Mode d’affichage mobile :
 * - formulaire : sondage / quiz classique ouvert
 * - en_direct : quiz piloté (jamais toutes les questions d’un coup)
 * - synthese / non_repondu : après clôture
 */
export type MySurveyVue =
  | "formulaire"
  | "en_direct"
  | "synthese"
  | "non_repondu";

/** Phase live exposée au client (≥ quiz en direct). Absente pour 1.1.1 / classiques. */
export type MySurveyLivePhase =
  | "attente"
  | "question_ouverte"
  | "question_fermee"
  | "corrige_question";

export type MySurveyLiveQuestionDto = {
  id: string;
  ordre: number;
  libelle: string;
  liveEtat: string;
  liveEtatLabel: string;
  options: Array<{ id: string; ordre: number; libelle: string }>;
  monOptionId: string | null;
  /** Uniquement si liveEtat = CorrigeRevele (ou corrigé global post-clôture). */
  estCorrecte?: boolean | null;
  bonneReponse?: string | null;
  explication?: string | null;
};

export type MySurveyLiveDto = {
  phase: MySurveyLivePhase;
  message: string;
  question: MySurveyLiveQuestionDto | null;
};

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
  kind: string;
  kindLabel: string;
  /** Quiz En direct — absent/false = formulaire classique (compat 1.1.1). */
  modeEnDirect?: boolean;
  vue: MySurveyVue;
  /** Null avant clôture — même si des réponses existent pour le formulaire. */
  synthesePersonnelle: MySurveyPersonalSyntheseDto | null;
  /**
   * true uniquement si ADMIN a autorisé la consultation des agrégats
   * et que le sondage est clôturé. Indépendant de la synthèse personnelle.
   */
  resultatsCollectifsPublies: boolean;
  /** true uniquement si quiz + ADMIN a publié le corrigé après clôture. */
  corrigePublie: boolean;
  /** État live — présent seulement si modeEnDirect et quiz encore ouvert. */
  live?: MySurveyLiveDto | null;
  /**
   * Formulaire classique : toutes les questions (sans corrigé).
   * En direct ouvert : **toujours []** (jamais le formulaire multi-questions 1.1.1).
   */
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
  /** Réponses brutes pour édition du formulaire (ouvert). Absent d’obligation après clôture. */
  maReponse: {
    id: string;
    soumiseLe: string;
    modifieLe: string;
    items: SondageReponseItemInput[];
  } | null;
};

type QuestionWithChoices = {
  id: string;
  libelle: string;
  type: string;
  explication?: string | null;
  options: Array<{ id: string; libelle: string; estCorrecte?: boolean }>;
  lignesMatrice: Array<{ id: string; libelle: string }>;
};

/**
 * Construit la synthèse personnelle (libellés).
 * Corrigé / score uniquement si `includeCorrige` (publication ADMIN).
 */
export function buildPersonalSyntheseQuestions(
  questions: QuestionWithChoices[],
  items: SondageReponseItemInput[],
  includeCorrige = false
): MySurveyPersonalSyntheseQuestion[] {
  return questions.map((q) => {
    const answers = items.filter((i) => i.questionId === q.id);
    const reponses: string[] = [];
    if (q.type === "TexteLibre") {
      const t = answers[0]?.texteLibre?.trim();
      if (t) reponses.push(t);
    } else if (q.type === "Matrice") {
      for (const line of q.lignesMatrice) {
        const hit = answers.find((a) => a.ligneMatriceId === line.id);
        const opt = hit?.optionId
          ? q.options.find((o) => o.id === hit.optionId)
          : undefined;
        if (opt) reponses.push(`${line.libelle} : ${opt.libelle}`);
      }
    } else {
      for (const a of answers) {
        const opt = a.optionId
          ? q.options.find((o) => o.id === a.optionId)
          : undefined;
        if (opt) {
          const extra = a.texteLibre?.trim();
          reponses.push(extra ? `${opt.libelle} (${extra})` : opt.libelle);
        }
      }
    }
    const base: MySurveyPersonalSyntheseQuestion = {
      questionId: q.id,
      libelle: q.libelle,
      type: q.type,
      reponses,
    };
    if (!includeCorrige) return base;

    const correctOpt = q.options.find((o) => o.estCorrecte);
    const chosenIds = new Set(
      answers.map((a) => a.optionId).filter(Boolean) as string[]
    );
    const estCorrecte = correctOpt
      ? chosenIds.size === 1 && chosenIds.has(correctOpt.id)
      : null;

    return {
      ...base,
      estCorrecte,
      bonneReponse: correctOpt?.libelle ?? null,
      explication: q.explication?.trim() || null,
    };
  });
}

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

  // Ouvert dans la fenêtre → visible ; clôturé (DB ou dateFin passée) → lecture seule.
  // Brouillon / futur → refus.
  const now = new Date();
  const effectif = getSondageStatutEffectif(sondage, now);
  const readableArchive = effectif === "Cloture";
  if (!isSondageVisiblePourAdherent(sondage, now) && !readableArchive) {
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
  const modifiable = isSondageModifiable(sondage, now);
  const closed = !modifiable;
  const modeEnDirect = Boolean(sondage.modeEnDirect);
  const resultatsCollectifsPublies =
    isSondageResultatsCollectifsVisiblesPourAdherent(sondage, now);
  const corrigePublie = isSondageCorrigeVisiblesPourAdherent(sondage, now);

  let vue: MySurveyVue = "formulaire";
  let synthesePersonnelle: MySurveyPersonalSyntheseDto | null = null;
  let live: MySurveyLiveDto | null = null;

  if (closed) {
    if (maReponse) {
      vue = "synthese";
      const questionsSynthese = buildPersonalSyntheseQuestions(
        sondage.questions,
        items,
        corrigePublie
      );
      const scored = corrigePublie
        ? questionsSynthese.filter((q) => typeof q.estCorrecte === "boolean")
        : [];
      synthesePersonnelle = {
        sondageId: sondage.id,
        sujet: sondage.sujet,
        aRepondu: true,
        message: null,
        questions: questionsSynthese,
        soumiseLe: maReponse.soumiseLe.toISOString(),
        modifieLe: maReponse.modifieLe.toISOString(),
        corrigePublie,
        score:
          corrigePublie && scored.length > 0
            ? {
                correct: scored.filter((q) => q.estCorrecte).length,
                total: scored.length,
              }
            : null,
      };
    } else {
      vue = "non_repondu";
      synthesePersonnelle = {
        sondageId: sondage.id,
        sujet: sondage.sujet,
        aRepondu: false,
        message: "Vous n’avez pas répondu",
        questions: [],
        soumiseLe: null,
        modifieLe: null,
        corrigePublie,
        score: null,
      };
    }
  } else if (modeEnDirect) {
    // Quiz En direct : jamais de formulaire classique multi-questions (compat 1.1.1).
    vue = "en_direct";
    const ouverte = sondage.questions.find((q) => q.liveEtat === "Ouverte");
    const derniereDiffusée = [...sondage.questions]
      .reverse()
      .find(
        (q) => q.liveEtat === "Fermee" || q.liveEtat === "CorrigeRevele"
      );

    const focus = ouverte ?? derniereDiffusée ?? null;
    if (!focus) {
      live = {
        phase: "attente",
        message: "En attente de la prochaine question",
        question: null,
      };
    } else {
      const monOptionId =
        items.find((i) => i.questionId === focus.id)?.optionId ?? null;
      const reveal = isQuestionLiveCorrigeRevele(focus.liveEtat);
      const correctOpt = focus.options.find((o) => o.estCorrecte);
      const chosenOk =
        reveal && correctOpt && monOptionId
          ? monOptionId === correctOpt.id
          : null;
      let phase: MySurveyLivePhase = "attente";
      let message = "En attente de la prochaine question";
      if (focus.liveEtat === "Ouverte") {
        phase = "question_ouverte";
        message = monOptionId
          ? "Réponse enregistrée — vous pouvez encore modifier"
          : "Choisissez une réponse";
      } else if (focus.liveEtat === "Fermee") {
        phase = "question_fermee";
        message = "Réponses fermées — en attente de la suite";
      } else if (focus.liveEtat === "CorrigeRevele") {
        phase = "corrige_question";
        message = "Corrigé de la question";
      }
      live = {
        phase,
        message,
        question: {
          id: focus.id,
          ordre: focus.ordre,
          libelle: focus.libelle,
          liveEtat: focus.liveEtat,
          liveEtatLabel: sondageQuestionLiveEtatLabel(focus.liveEtat),
          options: focus.options.map((o) => ({
            id: o.id,
            ordre: o.ordre,
            libelle: o.libelle,
          })),
          monOptionId,
          ...(reveal
            ? {
                estCorrecte: chosenOk,
                bonneReponse: correctOpt?.libelle ?? null,
                explication: focus.explication?.trim() || null,
              }
            : {}),
        },
      };
    }
  }

  // En direct ouvert : questions [] — un client 1.1.1 ne peut pas afficher le formulaire classique.
  const questionsDto =
    modeEnDirect && !closed
      ? []
      : sondage.questions.map((q) => ({
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
        }));

  return {
    id: sondage.id,
    sujet: sondage.sujet,
    introduction: sondage.introduction,
    conclusion: sondage.conclusion,
    dateDebut: sondage.dateDebut.toISOString(),
    dateFin: sondage.dateFin.toISOString(),
    modifiable,
    estComplet: modeEnDirect
      ? false
      : isSurveyCompleteForMember(sondage.questions, items),
    requiredTotal: progress.requiredTotal,
    requiredAnswered: progress.requiredAnswered,
    kind: sondage.kind,
    kindLabel: sondageKindLabel(sondage.kind),
    modeEnDirect,
    vue,
    synthesePersonnelle: closed ? synthesePersonnelle : null,
    resultatsCollectifsPublies,
    corrigePublie,
    live: modeEnDirect && !closed ? live : null,
    questions: questionsDto,
    maReponse:
      !closed && !modeEnDirect && maReponse
        ? {
            id: maReponse.id,
            soumiseLe: maReponse.soumiseLe.toISOString(),
            modifieLe: maReponse.modifieLe.toISOString(),
            items,
          }
        : null,
  };
}

/**
 * Synthèse personnelle exclusive — refusée tant que le sondage est ouvert.
 * Corrigé / score uniquement si ADMIN a publié le corrigé (quiz).
 *
 * @param actor - Contexte auth self-service
 * @param surveyId - Identifiant sondage
 */
export async function getMySurveyPersonalSynthese(
  actor: AuthContext,
  surveyId: string
): Promise<MySurveyPersonalSyntheseDto> {
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

  const now = new Date();
  const effectif = getSondageStatutEffectif(sondage, now);
  if (effectif === "Brouillon") {
    throw new ServiceError("FORBIDDEN", "Ce sondage n'est pas accessible");
  }
  if (isSondageModifiable(sondage, now)) {
    throw new ServiceError(
      "FORBIDDEN",
      "La synthèse personnelle n’est pas disponible avant la clôture du sondage."
    );
  }
  // Après clôture : même règle de lisibilité que le détail
  if (
    !isSondageVisiblePourAdherent(sondage, now) &&
    effectif !== "Cloture"
  ) {
    throw new ServiceError("FORBIDDEN", "Ce sondage n'est pas accessible");
  }

  const corrigePublie = isSondageCorrigeVisiblesPourAdherent(sondage, now);

  const maReponse = await db.sondageReponse.findUnique({
    where: {
      sondageId_adherentId: { sondageId: id, adherentId },
    },
    include: { items: true },
  });

  if (!maReponse) {
    return {
      sondageId: id,
      sujet: sondage.sujet,
      aRepondu: false,
      message: "Vous n’avez pas répondu",
      questions: [],
      soumiseLe: null,
      modifieLe: null,
      corrigePublie,
      score: null,
    };
  }

  const items: SondageReponseItemInput[] = maReponse.items.map((i) => ({
    questionId: i.questionId,
    optionId: i.optionId,
    ligneMatriceId: i.ligneMatriceId,
    texteLibre: i.texteLibre,
  }));

  const questionsSynthese = buildPersonalSyntheseQuestions(
    sondage.questions,
    items,
    corrigePublie
  );
  const scored = corrigePublie
    ? questionsSynthese.filter((q) => typeof q.estCorrecte === "boolean")
    : [];

  return {
    sondageId: id,
    sujet: sondage.sujet,
    aRepondu: true,
    message: null,
    questions: questionsSynthese,
    soumiseLe: maReponse.soumiseLe.toISOString(),
    modifieLe: maReponse.modifieLe.toISOString(),
    corrigePublie,
    score:
      corrigePublie && scored.length > 0
        ? {
            correct: scored.filter((q) => q.estCorrecte).length,
            total: scored.length,
          }
        : null,
  };
}

export type MySurveyCollectiveResultsDto = {
  sondageId: string;
  sujet: string;
  totalReponses: number;
  totalAdherentsActifs: number;
  tauxParticipation: number;
  generatedAt: string;
  questions: Array<{
    id: string;
    ordre: number;
    section: string | null;
    libelle: string;
    type: string;
    participations: number;
    choix?: Array<{
      optionId: string;
      libelle: string;
      count: number;
      percent: number;
    }>;
    /** Nombre de textes libres — pas les contenus (réservés admin / corrigés). */
    textesCount?: number;
    matrice?: Array<{
      ligneId: string;
      libelle: string;
      colonnes: Array<{
        optionId: string;
        libelle: string;
        count: number;
        percent: number;
      }>;
    }>;
  }>;
};

/**
 * Résultats collectifs adhérent — uniquement si ADMIN a autorisé
 * (`resultatsVisiblesAdherents`) et sondage clôturé.
 * Accès direct refusé sinon. Aucun corrigé admin / texte libre brut.
 *
 * @param actor - Contexte auth self-service
 * @param surveyId - Identifiant sondage
 */
export async function getMySurveyCollectiveResults(
  actor: AuthContext,
  surveyId: string
): Promise<MySurveyCollectiveResultsDto> {
  await resolveSelfAdherentId(actor);
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
      reponses: { include: { items: true } },
    },
  });
  if (!sondage) throw new ServiceError("NOT_FOUND", "Sondage introuvable");

  const now = new Date();
  const effectif = getSondageStatutEffectif(sondage, now);
  if (effectif === "Brouillon") {
    throw new ServiceError("FORBIDDEN", "Ce sondage n'est pas accessible");
  }
  if (
    !isSondageVisiblePourAdherent(sondage, now) &&
    effectif !== "Cloture"
  ) {
    throw new ServiceError("FORBIDDEN", "Ce sondage n'est pas accessible");
  }
  if (!isSondageResultatsCollectifsVisiblesPourAdherent(sondage, now)) {
    throw new ServiceError(
      "FORBIDDEN",
      "Les résultats collectifs ne sont pas encore autorisés à la consultation."
    );
  }

  const totalAdherentsActifs = await db.adherent.count({
    where: {
      User: {
        status: "Actif",
        role: { in: [UserRole.MEMBRE, UserRole.ADMIN] },
      },
    },
  });

  const synthese = buildSondageSynthese({
    sondageId: sondage.id,
    sujet: sondage.sujet,
    dateDebut: sondage.dateDebut,
    dateFin: sondage.dateFin,
    status: sondage.status,
    totalAdherentsActifs,
    questions: sondage.questions,
    reponses: sondage.reponses,
  });

  return {
    sondageId: synthese.sondageId,
    sujet: synthese.sujet,
    totalReponses: synthese.totalReponses,
    totalAdherentsActifs: synthese.totalAdherentsActifs,
    tauxParticipation: synthese.tauxParticipation,
    generatedAt: synthese.generatedAt.toISOString(),
    questions: synthese.questions.map((q) => ({
      id: q.id,
      ordre: q.ordre,
      section: q.section,
      libelle: q.libelle,
      type: q.type,
      participations: q.participations,
      choix: q.choix,
      textesCount: q.textes ? q.textes.length : undefined,
      matrice: q.matrice,
    })),
  };
}
