"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { ServiceError } from "@/lib/service-error";
import {
  getSondageStatusPresentation,
  getSondageStatutEffectif,
  isSondageCorrigeVisiblesPourAdherent,
  isSondageModifiable,
  isSondageResultatsCollectifsVisiblesPourAdherent,
  isSondageVisiblePourAdherent,
  sondageKindLabel,
  validateQuizReadyForOpen,
  validateSondageDates,
  type SondageQuestionInput,
  type SondageReponseItemInput,
} from "@/lib/sondages";
import { listSondageNotifyEligibleUserIds } from "@/lib/sondages-notifications";
import { buildSondageSynthese, type SondageSynthese } from "@/lib/sondages-synthese";
import { buildSondageSynthesePDF } from "@/lib/sondages-synthese-pdf";
import { buildPersonalSyntheseQuestions } from "@/lib/services/sondages/get-my-surveys";
import {
  closeSondageService,
  publishSondageService,
} from "@/lib/services/sondages/publish-and-close-sondage";
import jsPDF from "jspdf";
import {
  Prisma,
  SondageKind,
  SondageQuestionType,
  SondageStatus,
  UserRole,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const SondageQuestionTypeSchema = z.enum([
  "ChoixUnique",
  "ChoixMultiple",
  "TexteLibre",
  "Matrice",
]);

const SondageKindSchema = z.enum(["Sondage", "Quiz"]);

const QuestionInputSchema = z.object({
  ordre: z.number().int().min(0),
  section: z.string().max(255).optional().nullable(),
  libelle: z.string().min(1, "Le libellé de la question est requis").max(10000),
  type: SondageQuestionTypeSchema,
  obligatoire: z.boolean().optional().default(true),
  maxSelections: z.number().int().positive().optional().nullable(),
  minCaracteres: z.number().int().min(0).optional().nullable(),
  maxCaracteres: z.number().int().positive().optional().nullable(),
  explication: z.string().max(20000).optional().nullable(),
  options: z
    .array(
      z.object({
        ordre: z.number().int().min(0),
        libelle: z.string().min(1).max(500),
        permetTexteLibre: z.boolean().optional().default(false),
        estCorrecte: z.boolean().optional().default(false),
      })
    )
    .optional()
    .default([]),
  lignesMatrice: z
    .array(
      z.object({
        ordre: z.number().int().min(0),
        libelle: z.string().min(1).max(500),
      })
    )
    .optional()
    .default([]),
});

const CreateSondageSchema = z.object({
  sujet: z.string().min(1, "Le sujet est requis").max(255),
  introduction: z.string().max(20000).optional().nullable(),
  conclusion: z.string().max(20000).optional().nullable(),
  dateDebut: z.coerce.date(),
  dateFin: z.coerce.date(),
  /** Défaut Sondage — créations sans type restent sondages. */
  kind: SondageKindSchema.optional().default("Sondage"),
  /** Quiz uniquement — diffusion question par question. Ignoré pour Sondage. */
  modeEnDirect: z.boolean().optional().default(false),
  questions: z.array(QuestionInputSchema).min(1, "Ajoutez au moins une question"),
});

const SetCorrigeVisiblesSchema = z.object({
  id: z.string().min(1),
  visibles: z.boolean(),
});

const UpdateSondageSchema = CreateSondageSchema.extend({
  id: z.string().min(1),
});

/** Ajout de questions à un sondage déjà publié (Ouvert) */
const AddQuestionsToSondageSchema = z.object({
  id: z.string().min(1),
  questions: z.array(QuestionInputSchema).min(1, "Ajoutez au moins une question"),
});

const SondageIdSchema = z.object({
  id: z.string().min(1),
});

const SetResultatsVisiblesSchema = z.object({
  id: z.string().min(1),
  visibles: z.boolean(),
});

const DuplicateSondageSchema = z.object({
  sourceId: z.string().min(1),
  sujet: z.string().min(1).max(255),
  dateDebut: z.coerce.date(),
  dateFin: z.coerce.date(),
});

const UpdateSondageDatesSchema = z.object({
  id: z.string().min(1),
  dateDebut: z.coerce.date(),
  dateFin: z.coerce.date(),
});

const SubmitReponseSchema = z.object({
  sondageId: z.string().min(1),
  items: z.array(
    z.object({
      questionId: z.string().min(1),
      optionId: z.string().min(1).optional().nullable(),
      ligneMatriceId: z.string().min(1).optional().nullable(),
      texteLibre: z.string().max(20000).optional().nullable(),
    })
  ),
});

const sondageInclude = {
  questions: {
    orderBy: { ordre: "asc" as const },
    include: {
      options: { orderBy: { ordre: "asc" as const } },
      lignesMatrice: { orderBy: { ordre: "asc" as const } },
    },
  },
  CreatedBy: { select: { id: true, name: true, email: true } },
  _count: { select: { reponses: true } },
} satisfies Prisma.SondageInclude;

async function assertAdmin() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== UserRole.ADMIN) {
    return { ok: false as const, error: "Non autorisé" };
  }
  return { ok: true as const, userId: session.user.id };
}

async function assertAdherent() {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false as const, error: "Non autorisé" };
  }

  const adherent = await db.adherent.findUnique({
    where: { userId: session.user.id },
    select: { id: true, firstname: true, lastname: true },
  });

  if (!adherent) {
    return { ok: false as const, error: "Profil adhérent introuvable" };
  }

  return { ok: true as const, adherentId: adherent.id, userId: session.user.id };
}

function validateQuestionsStructure(questions: SondageQuestionInput[]): string | null {
  for (const question of questions) {
    if (question.type === "TexteLibre") {
      if (question.minCaracteres != null && question.maxCaracteres != null) {
        if (question.minCaracteres > question.maxCaracteres) {
          return `Question « ${question.libelle.slice(0, 40)}… » : min caractères > max`;
        }
      }
      continue;
    }

    if (question.type === "Matrice") {
      if (!question.lignesMatrice?.length) {
        return `Question matrice « ${question.libelle.slice(0, 40)}… » : ajoutez des lignes`;
      }
      if (!question.options?.length) {
        return `Question matrice « ${question.libelle.slice(0, 40)}… » : ajoutez des colonnes`;
      }
      continue;
    }

    if (!question.options?.length) {
      return `Question « ${question.libelle.slice(0, 40)}… » : ajoutez des options`;
    }

    if (question.type === "ChoixMultiple" && question.maxSelections != null) {
      if (question.maxSelections > question.options.length) {
        return `Question « ${question.libelle.slice(0, 40)}… » : max sélections trop élevé`;
      }
    }
  }

  return null;
}

function mapSondageListItem(
  sondage: Prisma.SondageGetPayload<{ include: typeof sondageInclude }>
) {
  const presentation = getSondageStatusPresentation(sondage);
  return {
    id: sondage.id,
    sujet: sondage.sujet,
    introduction: sondage.introduction,
    conclusion: sondage.conclusion,
    dateDebut: sondage.dateDebut.toISOString(),
    dateFin: sondage.dateFin.toISOString(),
    kind: sondage.kind,
    kindLabel: sondageKindLabel(sondage.kind),
    modeEnDirect: Boolean(sondage.modeEnDirect),
    /** Statut stocké en base (peut rester Ouvert si échéance passée). */
    status: sondage.status,
    /** Statut effectif = règle mobile (sans écriture DB). */
    statusEffectif: presentation.effectif,
    statusLabel: presentation.label,
    statusBadgeKey: presentation.badgeKey,
    echeancePassee: presentation.echeancePassee,
    resultatsVisiblesAdherents: sondage.resultatsVisiblesAdherents,
    resultatsCollectifsPublies:
      isSondageResultatsCollectifsVisiblesPourAdherent(sondage),
    corrigeVisiblesAdherents: sondage.corrigeVisiblesAdherents,
    corrigePublie: isSondageCorrigeVisiblesPourAdherent(sondage),
    sourceId: sondage.sourceId,
    createdAt: sondage.createdAt.toISOString(),
    updatedAt: sondage.updatedAt.toISOString(),
    createdByName: sondage.CreatedBy.name || sondage.CreatedBy.email || "Admin",
    questionCount: sondage.questions.length,
    reponseCount: sondage._count.reponses,
    modifiable: isSondageModifiable(sondage),
    visibleAdherent: isSondageVisiblePourAdherent(sondage),
  };
}

function mapSondageDetail(
  sondage: Prisma.SondageGetPayload<{ include: typeof sondageInclude }>,
  options?: { includeCorrigeFields?: boolean }
) {
  const includeCorrigeFields = options?.includeCorrigeFields ?? true;
  return {
    ...mapSondageListItem(sondage),
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
      liveEtat: q.liveEtat,
      ...(includeCorrigeFields
        ? { explication: q.explication }
        : {}),
      options: q.options.map((o) => ({
        id: o.id,
        ordre: o.ordre,
        libelle: o.libelle,
        permetTexteLibre: o.permetTexteLibre,
        ...(includeCorrigeFields ? { estCorrecte: o.estCorrecte } : {}),
      })),
      lignesMatrice: q.lignesMatrice.map((l) => ({
        id: l.id,
        ordre: l.ordre,
        libelle: l.libelle,
      })),
    })),
  };
}

async function createQuestionsNested(
  questions: SondageQuestionInput[]
): Promise<Prisma.SondageQuestionCreateWithoutSondageInput[]> {
  return questions.map((question) => ({
    ordre: question.ordre,
    section: question.section || null,
    libelle: question.libelle,
    type: question.type,
    obligatoire: question.obligatoire ?? true,
    maxSelections: question.maxSelections ?? null,
    minCaracteres: question.minCaracteres ?? null,
    maxCaracteres: question.maxCaracteres ?? null,
    explication: question.explication?.trim() || null,
    options: {
      create: (question.options || []).map((option) => ({
        ordre: option.ordre,
        libelle: option.libelle,
        permetTexteLibre: option.permetTexteLibre ?? false,
        estCorrecte: option.estCorrecte ?? false,
      })),
    },
    lignesMatrice: {
      create: (question.lignesMatrice || []).map((ligne) => ({
        ordre: ligne.ordre,
        libelle: ligne.libelle,
      })),
    },
  }));
}

/**
 * Liste tous les sondages (admin).
 */
export async function getSondagesAdmin() {
  try {
    const guard = await assertAdmin();
    if (!guard.ok) return { success: false, error: guard.error };

    const sondages = await db.sondage.findMany({
      include: sondageInclude,
      orderBy: [{ createdAt: "desc" }],
    });

    return {
      success: true,
      data: sondages.map(mapSondageListItem),
    };
  } catch (error) {
    console.error("Erreur getSondagesAdmin:", error);
    return { success: false, error: "Erreur lors du chargement des sondages" };
  }
}

/**
 * Récupère un sondage avec ses questions (admin).
 */
export async function getSondageByIdAdmin(sondageId: string) {
  try {
    const guard = await assertAdmin();
    if (!guard.ok) return { success: false, error: guard.error };

    const parsed = SondageIdSchema.parse({ id: sondageId });
    const sondage = await db.sondage.findUnique({
      where: { id: parsed.id },
      include: sondageInclude,
    });

    if (!sondage) {
      return { success: false, error: "Sondage introuvable" };
    }

    return { success: true, data: mapSondageDetail(sondage) };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    console.error("Erreur getSondageByIdAdmin:", error);
    return { success: false, error: "Erreur lors du chargement du sondage" };
  }
}

/**
 * Crée un sondage ou un quiz **toujours en brouillon**.
 * Aucun email / notification in-app / push à la création — publication via `publishSondage`.
 */
export async function createSondage(input: z.infer<typeof CreateSondageSchema>) {
  try {
    const guard = await assertAdmin();
    if (!guard.ok) return { success: false, error: guard.error };

    const parsed = CreateSondageSchema.parse(input);
    const dateError = validateSondageDates(parsed.dateDebut, parsed.dateFin);
    if (dateError) return { success: false, error: dateError };

    const structureError = validateQuestionsStructure(parsed.questions);
    if (structureError) return { success: false, error: structureError };

    const quizError = validateQuizReadyForOpen(parsed.kind, parsed.questions);
    if (quizError) return { success: false, error: quizError };

    if (parsed.modeEnDirect && parsed.kind !== "Quiz") {
      return {
        success: false,
        error: "Le mode En direct est réservé aux quiz",
      };
    }

    const existing = await db.sondage.findUnique({
      where: { sujet: parsed.sujet },
      select: { id: true },
    });
    if (existing) {
      return { success: false, error: "Un sondage avec ce sujet existe déjà" };
    }

    const kindLabel = sondageKindLabel(parsed.kind);
    const sondage = await db.sondage.create({
      data: {
        sujet: parsed.sujet,
        introduction: parsed.introduction || null,
        conclusion: parsed.conclusion || null,
        dateDebut: parsed.dateDebut,
        dateFin: parsed.dateFin,
        kind: parsed.kind as SondageKind,
        modeEnDirect: parsed.kind === "Quiz" ? Boolean(parsed.modeEnDirect) : false,
        status: SondageStatus.Brouillon,
        createdBy: guard.userId,
        questions: {
          create: await createQuestionsNested(parsed.questions),
        },
      },
      include: sondageInclude,
    });

    return {
      success: true,
      message: `${kindLabel} créé en brouillon`,
      id: sondage.id,
      data: mapSondageDetail(sondage),
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { success: false, error: "Un sondage avec ce sujet existe déjà" };
    }
    console.error("Erreur createSondage:", error);
    return { success: false, error: "Erreur lors de la création du sondage" };
  } finally {
    revalidatePath("/admin/sondages");
    revalidatePath("/user/profile");
  }
}

/**
 * Met à jour uniquement les dates d'un sondage (brouillon ou ouvert).
 * Ne touche pas aux questions ni aux réponses existantes.
 */
export async function updateSondageDates(
  input: z.infer<typeof UpdateSondageDatesSchema>
) {
  try {
    const guard = await assertAdmin();
    if (!guard.ok) return { success: false, error: guard.error };

    const parsed = UpdateSondageDatesSchema.parse(input);
    const dateError = validateSondageDates(parsed.dateDebut, parsed.dateFin);
    if (dateError) return { success: false, error: dateError };

    const existing = await db.sondage.findUnique({
      where: { id: parsed.id },
      select: {
        id: true,
        status: true,
        dateDebut: true,
        dateFin: true,
        _count: { select: { reponses: true } },
      },
    });

    if (!existing) {
      return { success: false, error: "Sondage introuvable" };
    }

    // Même règle que le mobile : échéance passée = clôturé effectif (sans écrire le statut).
    if (getSondageStatutEffectif(existing) === SondageStatus.Cloture) {
      return {
        success: false,
        error: "Impossible de modifier les dates d'un sondage terminé",
      };
    }

    const updated = await db.sondage.update({
      where: { id: parsed.id },
      data: {
        dateDebut: parsed.dateDebut,
        dateFin: parsed.dateFin,
      },
      select: {
        id: true,
        dateDebut: true,
        dateFin: true,
        status: true,
        _count: { select: { reponses: true } },
      },
    });

    return {
      success: true,
      message: "Dates du sondage mises à jour",
      data: {
        id: updated.id,
        dateDebut: updated.dateDebut.toISOString(),
        dateFin: updated.dateFin.toISOString(),
        status: updated.status,
        reponseCount: updated._count.reponses,
      },
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    console.error("Erreur updateSondageDates:", error);
    return { success: false, error: "Erreur lors de la mise à jour des dates" };
  } finally {
    revalidatePath("/admin/sondages");
    revalidatePath(`/admin/sondages/${input.id}`);
    revalidatePath("/user/profile");
    revalidatePath(`/sondages/${input.id}`);
  }
}

/**
 * Met à jour un sondage en brouillon (questions remplacées).
 */
export async function updateSondage(input: z.infer<typeof UpdateSondageSchema>) {
  try {
    const guard = await assertAdmin();
    if (!guard.ok) return { success: false, error: guard.error };

    const parsed = UpdateSondageSchema.parse(input);
    const dateError = validateSondageDates(parsed.dateDebut, parsed.dateFin);
    if (dateError) return { success: false, error: dateError };

    const structureError = validateQuestionsStructure(parsed.questions);
    if (structureError) return { success: false, error: structureError };

    const quizError = validateQuizReadyForOpen(parsed.kind, parsed.questions);
    if (quizError) return { success: false, error: quizError };

    if (parsed.modeEnDirect && parsed.kind !== "Quiz") {
      return {
        success: false,
        error: "Le mode En direct est réservé aux quiz",
      };
    }

    const existing = await db.sondage.findUnique({
      where: { id: parsed.id },
      select: { id: true, status: true, sujet: true },
    });

    if (!existing) {
      return { success: false, error: "Sondage introuvable" };
    }

    if (existing.status !== SondageStatus.Brouillon) {
      return {
        success: false,
        error: "Seuls les sondages en brouillon peuvent être modifiés",
      };
    }

    if (parsed.sujet !== existing.sujet) {
      const duplicate = await db.sondage.findUnique({
        where: { sujet: parsed.sujet },
        select: { id: true },
      });
      if (duplicate) {
        return { success: false, error: "Un sondage avec ce sujet existe déjà" };
      }
    }

    const sondage = await db.$transaction(async (tx) => {
      await tx.sondageQuestion.deleteMany({ where: { sondageId: parsed.id } });

      return tx.sondage.update({
        where: { id: parsed.id },
        data: {
          sujet: parsed.sujet,
          introduction: parsed.introduction || null,
          conclusion: parsed.conclusion || null,
          dateDebut: parsed.dateDebut,
          dateFin: parsed.dateFin,
          kind: parsed.kind as SondageKind,
          modeEnDirect:
            parsed.kind === "Quiz" ? Boolean(parsed.modeEnDirect) : false,
          questions: {
            create: await createQuestionsNested(parsed.questions),
          },
        },
        include: sondageInclude,
      });
    });

    return {
      success: true,
      message: `${sondageKindLabel(parsed.kind)} mis à jour`,
      data: mapSondageDetail(sondage),
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    console.error("Erreur updateSondage:", error);
    return { success: false, error: "Erreur lors de la mise à jour du sondage" };
  } finally {
    revalidatePath("/admin/sondages");
    revalidatePath(`/admin/sondages/${input.id}`);
  }
}

/**
 * Ajoute une ou plusieurs questions à un sondage déjà publié (statut Ouvert).
 * Les questions existantes et les réponses déjà soumises ne sont pas modifiées.
 *
 * @param input - Identifiant du sondage et questions à ajouter
 * @returns Succès avec le détail du sondage, ou erreur
 */
export async function addQuestionsToSondage(
  input: z.infer<typeof AddQuestionsToSondageSchema>
) {
  try {
    const guard = await assertAdmin();
    if (!guard.ok) return { success: false, error: guard.error };

    const parsed = AddQuestionsToSondageSchema.parse(input);
    const structureError = validateQuestionsStructure(parsed.questions);
    if (structureError) return { success: false, error: structureError };

    const existing = await db.sondage.findUnique({
      where: { id: parsed.id },
      select: {
        id: true,
        status: true,
        kind: true,
        questions: { select: { ordre: true }, orderBy: { ordre: "desc" }, take: 1 },
      },
    });

    if (!existing) {
      return { success: false, error: "Sondage introuvable" };
    }

    if (existing.status !== SondageStatus.Ouvert) {
      return {
        success: false,
        error: "Des questions ne peuvent être ajoutées qu'à un sondage ouvert",
      };
    }

    const quizAddError = validateQuizReadyForOpen(
      existing.kind,
      parsed.questions
    );
    if (quizAddError) return { success: false, error: quizAddError };

    const maxOrdre = existing.questions[0]?.ordre ?? -1;
    const questionsWithOrdre = parsed.questions.map((q, i) => ({
      ...q,
      ordre: maxOrdre + 1 + i,
    }));

    const sondage = await db.sondage.update({
      where: { id: parsed.id },
      data: {
        questions: {
          create: await createQuestionsNested(questionsWithOrdre),
        },
      },
      include: sondageInclude,
    });

    const count = questionsWithOrdre.length;
    return {
      success: true,
      message:
        count === 1
          ? "Question ajoutée au sondage"
          : `${count} questions ajoutées au sondage`,
      data: mapSondageDetail(sondage),
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    console.error("Erreur addQuestionsToSondage:", error);
    return { success: false, error: "Erreur lors de l'ajout des questions" };
  } finally {
    revalidatePath("/admin/sondages");
    revalidatePath(`/admin/sondages/${input.id}`);
    revalidatePath("/user/profile");
    revalidatePath(`/sondages/${input.id}`);
  }
}

/**
 * Audience de notification pour la confirmation de publication (adhérents actifs éligibles).
 *
 * @returns count d’utilisateurs qui recevront in-app / push (email si adresse présente)
 */
export async function getSondagePublishAudiencePreview() {
  try {
    const guard = await assertAdmin();
    if (!guard.ok) return { success: false as const, error: guard.error };

    const userIds = await listSondageNotifyEligibleUserIds();
    return {
      success: true as const,
      count: userIds.length,
      message:
        userIds.length === 0
          ? "Aucun adhérent actif éligible ne sera averti."
          : `${userIds.length} adhérent(s) actif(s) (membres et administrateurs avec fiche adhérent) seront avertis par notification dans l’application et push ; un e-mail sera envoyé à ceux qui ont une adresse.`,
    };
  } catch (error) {
    console.error("Erreur getSondagePublishAudiencePreview:", error);
    return {
      success: false as const,
      error: "Impossible de préparer la confirmation de publication",
    };
  }
}

/**
 * Publie un sondage (passe en statut Ouvert).
 * Délègue au service ; aucune injection de deps / canaux (non exposée au client).
 *
 * @param sondageId - Identifiant du brouillon
 */
export async function publishSondage(sondageId: string) {
  try {
    const guard = await assertAdmin();
    if (!guard.ok) return { success: false, error: guard.error };

    SondageIdSchema.parse({ id: sondageId });
    return await publishSondageService(sondageId);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    console.error("Erreur publishSondage:", error);
    return { success: false, error: "Erreur lors de la publication" };
  } finally {
    revalidatePath("/admin/sondages");
    revalidatePath("/user/profile");
  }
}

/**
 * Clôture un sondage (plus de modification possible pour les adhérents).
 * Délègue au service ; aucune barrière de test exposée au client.
 *
 * @param sondageId - Identifiant du sondage
 */
export async function closeSondage(sondageId: string) {
  try {
    const guard = await assertAdmin();
    if (!guard.ok) return { success: false, error: guard.error };

    SondageIdSchema.parse({ id: sondageId });
    return await closeSondageService(sondageId);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    console.error("Erreur closeSondage:", error);
    return { success: false, error: "Erreur lors de la clôture" };
  } finally {
    revalidatePath("/admin/sondages");
    revalidatePath("/user/profile");
  }
}

/**
 * Autorise ou retire la consultation des résultats collectifs par les adhérents.
 * Indépendant de la clôture ; réservé ADMIN.
 *
 * @param input - Identifiant sondage + flag visibles
 */
export async function setSondageResultatsVisiblesAdherents(
  input: z.infer<typeof SetResultatsVisiblesSchema>
) {
  try {
    const guard = await assertAdmin();
    if (!guard.ok) return { success: false, error: guard.error };

    const parsed = SetResultatsVisiblesSchema.parse(input);
    const sondage = await db.sondage.findUnique({
      where: { id: parsed.id },
      select: {
        id: true,
        status: true,
        dateDebut: true,
        dateFin: true,
        resultatsVisiblesAdherents: true,
      },
    });

    if (!sondage) {
      return { success: false, error: "Sondage introuvable" };
    }

    // Autorisation possible dès que le sondage est effectivement terminé
    // (statut Cloture OU échéance passée) — même règle que l’API mobile.
    const effectif = getSondageStatutEffectif(sondage);
    if (parsed.visibles && effectif !== SondageStatus.Cloture) {
      return {
        success: false,
        error:
          "Les résultats collectifs ne peuvent être autorisés qu’après la fin du sondage.",
      };
    }

    // Uniquement le flag de publication — jamais les dates ni les réponses.
    await db.sondage.update({
      where: { id: parsed.id },
      data: { resultatsVisiblesAdherents: parsed.visibles },
    });

    const effectifPublie = isSondageResultatsCollectifsVisiblesPourAdherent({
      ...sondage,
      resultatsVisiblesAdherents: parsed.visibles,
    });

    return {
      success: true,
      message: parsed.visibles
        ? "Résultats collectifs autorisés à la consultation"
        : "Résultats collectifs retirés de la consultation",
      data: {
        resultatsVisiblesAdherents: parsed.visibles,
        resultatsCollectifsPublies: effectifPublie,
      },
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    console.error("Erreur setSondageResultatsVisiblesAdherents:", error);
    return {
      success: false,
      error:
        "Impossible d’enregistrer l’autorisation des résultats collectifs",
    };
  } finally {
    revalidatePath("/admin/sondages");
    revalidatePath(`/admin/sondages/${input.id}`);
    revalidatePath("/user/profile");
  }
}

/**
 * Publie ou retire le corrigé d'un quiz pour les adhérents.
 * Réservé ADMIN, après clôture effective. Indépendant des résultats collectifs.
 *
 * @param input - Identifiant + flag visibles
 */
export async function setSondageCorrigeVisiblesAdherents(
  input: z.infer<typeof SetCorrigeVisiblesSchema>
) {
  try {
    const guard = await assertAdmin();
    if (!guard.ok) return { success: false, error: guard.error };

    const parsed = SetCorrigeVisiblesSchema.parse(input);
    const sondage = await db.sondage.findUnique({
      where: { id: parsed.id },
      select: {
        id: true,
        kind: true,
        status: true,
        dateDebut: true,
        dateFin: true,
        corrigeVisiblesAdherents: true,
      },
    });

    if (!sondage) {
      return { success: false, error: "Sondage introuvable" };
    }

    if (sondage.kind !== SondageKind.Quiz) {
      return {
        success: false,
        error: "Le corrigé ne s’applique qu’aux quiz",
      };
    }

    const effectif = getSondageStatutEffectif(sondage);
    if (parsed.visibles && effectif !== SondageStatus.Cloture) {
      return {
        success: false,
        error: "Le corrigé ne peut être publié qu’après la fin du quiz.",
      };
    }

    await db.sondage.update({
      where: { id: parsed.id },
      data: { corrigeVisiblesAdherents: parsed.visibles },
    });

    const corrigePublie = isSondageCorrigeVisiblesPourAdherent({
      ...sondage,
      corrigeVisiblesAdherents: parsed.visibles,
    });

    return {
      success: true,
      message: parsed.visibles
        ? "Corrigé publié pour les adhérents"
        : "Corrigé retiré de la consultation",
      data: {
        corrigeVisiblesAdherents: parsed.visibles,
        corrigePublie,
      },
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    console.error("Erreur setSondageCorrigeVisiblesAdherents:", error);
    return {
      success: false,
      error: "Impossible d’enregistrer la publication du corrigé",
    };
  } finally {
    revalidatePath("/admin/sondages");
    revalidatePath(`/admin/sondages/${input.id}`);
    revalidatePath("/user/profile");
  }
}

/**
 * Duplique un sondage pour une nouvelle période (questions recopiées).
 */
export async function duplicateSondage(input: z.infer<typeof DuplicateSondageSchema>) {
  try {
    const guard = await assertAdmin();
    if (!guard.ok) return { success: false, error: guard.error };

    const parsed = DuplicateSondageSchema.parse(input);
    const dateError = validateSondageDates(parsed.dateDebut, parsed.dateFin);
    if (dateError) return { success: false, error: dateError };

    const source = await db.sondage.findUnique({
      where: { id: parsed.sourceId },
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

    if (!source) {
      return { success: false, error: "Sondage source introuvable" };
    }

    const duplicateSujet = await db.sondage.findUnique({
      where: { sujet: parsed.sujet },
      select: { id: true },
    });
    if (duplicateSujet) {
      return { success: false, error: "Un sondage avec ce sujet existe déjà" };
    }

    const questionsInput: SondageQuestionInput[] = source.questions.map((q) => ({
      ordre: q.ordre,
      section: q.section,
      libelle: q.libelle,
      type: q.type,
      obligatoire: q.obligatoire,
      maxSelections: q.maxSelections,
      minCaracteres: q.minCaracteres,
      maxCaracteres: q.maxCaracteres,
      explication: q.explication,
      options: q.options.map((o) => ({
        ordre: o.ordre,
        libelle: o.libelle,
        permetTexteLibre: o.permetTexteLibre,
        estCorrecte: o.estCorrecte,
      })),
      lignesMatrice: q.lignesMatrice.map((l) => ({
        ordre: l.ordre,
        libelle: l.libelle,
      })),
    }));

    const sondage = await db.sondage.create({
      data: {
        sujet: parsed.sujet,
        introduction: source.introduction,
        conclusion: source.conclusion,
        dateDebut: parsed.dateDebut,
        dateFin: parsed.dateFin,
        kind: source.kind,
        status: SondageStatus.Brouillon,
        sourceId: source.id,
        createdBy: guard.userId,
        questions: {
          create: await createQuestionsNested(questionsInput),
        },
      },
      include: sondageInclude,
    });

    return {
      success: true,
      message: `${sondageKindLabel(source.kind)} dupliqué en brouillon`,
      id: sondage.id,
      data: mapSondageDetail(sondage),
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    console.error("Erreur duplicateSondage:", error);
    return { success: false, error: "Erreur lors de la duplication" };
  } finally {
    revalidatePath("/admin/sondages");
  }
}

/**
 * Supprime un sondage (brouillon sans réponses uniquement).
 */
export async function deleteSondage(sondageId: string) {
  try {
    const guard = await assertAdmin();
    if (!guard.ok) return { success: false, error: guard.error };

    const parsed = SondageIdSchema.parse({ id: sondageId });
    const sondage = await db.sondage.findUnique({
      where: { id: parsed.id },
      include: { _count: { select: { reponses: true } } },
    });

    if (!sondage) {
      return { success: false, error: "Sondage introuvable" };
    }

    if (sondage._count.reponses > 0) {
      return {
        success: false,
        error: "Impossible de supprimer un sondage ayant des réponses",
      };
    }

    await db.sondage.delete({ where: { id: parsed.id } });

    return { success: true, message: "Sondage supprimé" };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    console.error("Erreur deleteSondage:", error);
    return { success: false, error: "Erreur lors de la suppression" };
  } finally {
    revalidatePath("/admin/sondages");
  }
}

/**
 * Liste la participation des adhérents actifs à un sondage (admin).
 */
export async function getSondageParticipationAdmin(sondageId: string) {
  try {
    const guard = await assertAdmin();
    if (!guard.ok) return { success: false, error: guard.error };

    const parsed = SondageIdSchema.parse({ id: sondageId });
    const sondage = await db.sondage.findUnique({
      where: { id: parsed.id },
      select: { id: true, sujet: true },
    });

    if (!sondage) {
      return { success: false, error: "Sondage introuvable" };
    }

    const [adherents, reponses] = await Promise.all([
      db.adherent.findMany({
        where: {
          User: {
            status: "Actif",
            role: { in: [UserRole.MEMBRE, UserRole.ADMIN] },
          },
        },
        select: {
          id: true,
          firstname: true,
          lastname: true,
          civility: true,
          User: { select: { email: true } },
        },
        orderBy: [{ lastname: "asc" }, { firstname: "asc" }],
      }),
      db.sondageReponse.findMany({
        where: { sondageId: parsed.id },
        select: {
          id: true,
          adherentId: true,
          soumiseLe: true,
          modifieLe: true,
        },
      }),
    ]);

    const reponseByAdherent = new Map(reponses.map((r) => [r.adherentId, r]));

    return {
      success: true,
      data: {
        sondageId: sondage.id,
        sujet: sondage.sujet,
        totalActifs: adherents.length,
        totalReponses: reponses.length,
        participants: adherents.map((a) => {
          const rep = reponseByAdherent.get(a.id);
          return {
            adherentId: a.id,
            nomComplet: `${a.firstname} ${a.lastname}`.trim(),
            civility: a.civility,
            email: a.User.email,
            aRepondu: Boolean(rep),
            reponseId: rep?.id ?? null,
            soumiseLe: rep?.soumiseLe.toISOString() ?? null,
            modifieLe: rep?.modifieLe.toISOString() ?? null,
          };
        }),
      },
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    console.error("Erreur getSondageParticipationAdmin:", error);
    return { success: false, error: "Erreur lors du chargement de la participation" };
  }
}

/**
 * Sondages ouverts visibles sur le profil adhérent.
 */
export async function getActiveSondagesForAdherent() {
  try {
    const guard = await assertAdherent();
    if (!guard.ok) return { success: false, error: guard.error };

    const now = new Date();
    const sondages = await db.sondage.findMany({
      where: {
        status: SondageStatus.Ouvert,
        dateDebut: { lte: now },
        dateFin: { gte: now },
      },
      orderBy: { dateFin: "asc" },
      include: {
        reponses: {
          where: { adherentId: guard.adherentId },
          select: { id: true, modifieLe: true },
        },
      },
    });

    return {
      success: true,
      data: sondages.map((s) => ({
        id: s.id,
        sujet: s.sujet,
        kind: s.kind,
        kindLabel: sondageKindLabel(s.kind),
        dateDebut: s.dateDebut.toISOString(),
        dateFin: s.dateFin.toISOString(),
        aRepondu: s.reponses.length > 0,
        modifieLe: s.reponses[0]?.modifieLe.toISOString() ?? null,
      })),
    };
  } catch (error) {
    console.error("Erreur getActiveSondagesForAdherent:", error);
    return { success: false, error: "Erreur lors du chargement des sondages actifs" };
  }
}

/**
 * Détail d'un sondage pour un adhérent (sans les réponses des autres).
 */
export async function getSondageForAdherent(sondageId: string) {
  try {
    const guard = await assertAdherent();
    if (!guard.ok) return { success: false, error: guard.error };

    const parsed = SondageIdSchema.parse({ id: sondageId });
    const sondage = await db.sondage.findUnique({
      where: { id: parsed.id },
      include: sondageInclude,
    });

    if (!sondage) {
      return { success: false, error: "Sondage introuvable" };
    }

    if (!isSondageVisiblePourAdherent(sondage) && sondage.status !== SondageStatus.Cloture) {
      return { success: false, error: "Ce sondage n'est pas accessible" };
    }

    const maReponse = await db.sondageReponse.findUnique({
      where: {
        sondageId_adherentId: {
          sondageId: parsed.id,
          adherentId: guard.adherentId,
        },
      },
      include: {
        items: true,
      },
    });

    const modifiable = isSondageModifiable(sondage);
    const corrigePublie = isSondageCorrigeVisiblesPourAdherent(sondage);
    const items = (maReponse?.items ?? []).map((item) => ({
      questionId: item.questionId,
      optionId: item.optionId,
      ligneMatriceId: item.ligneMatriceId,
      texteLibre: item.texteLibre,
    }));

    // Jamais estCorrecte / explication sur les questions du formulaire adhérent.
    const detail = mapSondageDetail(sondage, { includeCorrigeFields: false });

    let synthesePersonnelle: {
      aRepondu: boolean;
      message: string | null;
      questions: ReturnType<typeof buildPersonalSyntheseQuestions>;
      soumiseLe: string | null;
      modifieLe: string | null;
      corrigePublie: boolean;
      score: { correct: number; total: number } | null;
    } | null = null;

    if (!modifiable) {
      if (maReponse) {
        const questionsSynthese = buildPersonalSyntheseQuestions(
          sondage.questions,
          items,
          corrigePublie
        );
        const scored = corrigePublie
          ? questionsSynthese.filter((q) => typeof q.estCorrecte === "boolean")
          : [];
        synthesePersonnelle = {
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
        synthesePersonnelle = {
          aRepondu: false,
          message: "Vous n’avez pas répondu",
          questions: [],
          soumiseLe: null,
          modifieLe: null,
          corrigePublie,
          score: null,
        };
      }
    }

    return {
      success: true,
      data: {
        ...detail,
        // Ne pas exposer le flag admin brut côté adhérent (seul corrigePublie compte).
        corrigeVisiblesAdherents: undefined,
        corrigePublie,
        modifiable,
        synthesePersonnelle,
        maReponse: maReponse
          ? {
              id: maReponse.id,
              soumiseLe: maReponse.soumiseLe.toISOString(),
              modifieLe: maReponse.modifieLe.toISOString(),
              items,
            }
          : null,
      },
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    console.error("Erreur getSondageForAdherent:", error);
    return { success: false, error: "Erreur lors du chargement du sondage" };
  }
}

/**
 * Réponse d'un adhérent pour un sondage (admin).
 */
export async function getSondageReponseByAdherentAdmin(
  sondageId: string,
  adherentId: string
) {
  try {
    const guard = await assertAdmin();
    if (!guard.ok) return { success: false, error: guard.error };

    const reponse = await db.sondageReponse.findUnique({
      where: {
        sondageId_adherentId: { sondageId, adherentId },
      },
      include: {
        Adherent: {
          select: { id: true, firstname: true, lastname: true, civility: true },
        },
        items: {
          include: {
            Question: { select: { libelle: true, type: true, ordre: true } },
            Option: { select: { libelle: true } },
            LigneMatrice: { select: { libelle: true } },
          },
        },
      },
    });

    if (!reponse) {
      return { success: false, error: "Aucune réponse pour cet adhérent" };
    }

    return {
      success: true,
      data: {
        id: reponse.id,
        soumiseLe: reponse.soumiseLe.toISOString(),
        modifieLe: reponse.modifieLe.toISOString(),
        adherent: {
          id: reponse.Adherent.id,
          nomComplet: `${reponse.Adherent.firstname} ${reponse.Adherent.lastname}`.trim(),
          civility: reponse.Adherent.civility,
        },
        items: reponse.items
          .sort((a, b) => a.Question.ordre - b.Question.ordre)
          .map((item) => ({
            questionId: item.questionId,
            questionLibelle: item.Question.libelle,
            questionType: item.Question.type,
            optionLibelle: item.Option?.libelle ?? null,
            ligneMatriceLibelle: item.LigneMatrice?.libelle ?? null,
            texteLibre: item.texteLibre,
          })),
      },
    };
  } catch (error) {
    console.error("Erreur getSondageReponseByAdherentAdmin:", error);
    return { success: false, error: "Erreur lors du chargement de la réponse" };
  }
}

function validateReponseItems(
  questions: Array<{
    id: string;
    type: SondageQuestionType;
    obligatoire: boolean;
    maxSelections: number | null;
    minCaracteres: number | null;
    maxCaracteres: number | null;
    options: Array<{ id: string }>;
    lignesMatrice: Array<{ id: string }>;
  }>,
  items: SondageReponseItemInput[]
): string | null {
  const itemsByQuestion = new Map<string, SondageReponseItemInput[]>();
  for (const item of items) {
    const list = itemsByQuestion.get(item.questionId) || [];
    list.push(item);
    itemsByQuestion.set(item.questionId, list);
  }

  for (const question of questions) {
    const answers = itemsByQuestion.get(question.id) || [];

    if (question.obligatoire && answers.length === 0) {
      return `La question « ${question.id} » est obligatoire`;
    }

    if (question.type === "TexteLibre") {
      const text = answers[0]?.texteLibre?.trim() || "";
      if (question.obligatoire && !text) {
        return "Une réponse texte est requise";
      }
      if (question.minCaracteres != null && text.length < question.minCaracteres) {
        return `Réponse trop courte (min. ${question.minCaracteres} caractères)`;
      }
      if (question.maxCaracteres != null && text.length > question.maxCaracteres) {
        return `Réponse trop longue (max. ${question.maxCaracteres} caractères)`;
      }
      continue;
    }

    if (question.type === "ChoixUnique") {
      const optionIds = answers.map((a) => a.optionId).filter(Boolean);
      if (question.obligatoire && optionIds.length !== 1) {
        return "Sélectionnez une option";
      }
      continue;
    }

    if (question.type === "ChoixMultiple") {
      const optionIds = answers.map((a) => a.optionId).filter(Boolean);
      if (question.obligatoire && optionIds.length === 0) {
        return "Sélectionnez au moins une option";
      }
      if (question.maxSelections != null && optionIds.length > question.maxSelections) {
        return `Maximum ${question.maxSelections} sélection(s) autorisée(s)`;
      }
      continue;
    }

    if (question.type === "Matrice") {
      const coveredLines = new Set(
        answers.map((a) => a.ligneMatriceId).filter(Boolean) as string[]
      );
      if (question.obligatoire && coveredLines.size < question.lignesMatrice.length) {
        return "Répondez à toutes les lignes du tableau";
      }
    }
  }

  return null;
}

/**
 * Soumet ou met à jour la réponse de l'adhérent connecté.
 */
export async function submitSondageReponse(input: z.infer<typeof SubmitReponseSchema>) {
  try {
    const guard = await assertAdherent();
    if (!guard.ok) return { success: false, error: guard.error };

    const parsed = SubmitReponseSchema.parse(input);
    const sondage = await db.sondage.findUnique({
      where: { id: parsed.sondageId },
      include: {
        questions: {
          include: {
            options: true,
            lignesMatrice: true,
          },
        },
      },
    });

    if (!sondage) {
      return { success: false, error: "Sondage introuvable" };
    }

    if (!isSondageModifiable(sondage)) {
      return {
        success: false,
        error: "Ce sondage est clôturé : vos réponses ne peuvent plus être modifiées",
      };
    }

    const validationError = validateReponseItems(sondage.questions, parsed.items);
    if (validationError) {
      return { success: false, error: validationError };
    }

    const questionIds = new Set(sondage.questions.map((q) => q.id));
    for (const item of parsed.items) {
      if (!questionIds.has(item.questionId)) {
        return { success: false, error: "Question invalide" };
      }
    }

    const reponse = await db.$transaction(async (tx) => {
      const existing = await tx.sondageReponse.findUnique({
        where: {
          sondageId_adherentId: {
            sondageId: parsed.sondageId,
            adherentId: guard.adherentId,
          },
        },
      });

      if (existing) {
        await tx.sondageReponseItem.deleteMany({ where: { reponseId: existing.id } });
        return tx.sondageReponse.update({
          where: { id: existing.id },
          data: {
            modifieLe: new Date(),
            items: {
              create: parsed.items.map((item) => ({
                questionId: item.questionId,
                optionId: item.optionId || null,
                ligneMatriceId: item.ligneMatriceId || null,
                texteLibre: item.texteLibre?.trim() || null,
              })),
            },
          },
        });
      }

      return tx.sondageReponse.create({
        data: {
          sondageId: parsed.sondageId,
          adherentId: guard.adherentId,
          items: {
            create: parsed.items.map((item) => ({
              questionId: item.questionId,
              optionId: item.optionId || null,
              ligneMatriceId: item.ligneMatriceId || null,
              texteLibre: item.texteLibre?.trim() || null,
            })),
          },
        },
      });
    });

    return {
      success: true,
      message: "Votre réponse a été enregistrée",
      reponseId: reponse.id,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    console.error("Erreur submitSondageReponse:", error);
    return { success: false, error: "Erreur lors de l'enregistrement de votre réponse" };
  } finally {
    revalidatePath("/user/profile");
    revalidatePath(`/sondages/${input.sondageId}`);
  }
}

function serializeSynthese(synthese: SondageSynthese) {
  return {
    ...synthese,
    dateDebut: synthese.dateDebut.toISOString(),
    dateFin: synthese.dateFin.toISOString(),
    generatedAt: synthese.generatedAt.toISOString(),
  };
}

async function loadSondageSyntheseData(sondageId: string) {
  const sondage = await db.sondage.findUnique({
    where: { id: sondageId },
    include: {
      questions: {
        orderBy: { ordre: "asc" },
        include: {
          options: { orderBy: { ordre: "asc" } },
          lignesMatrice: { orderBy: { ordre: "asc" } },
        },
      },
      reponses: {
        include: { items: true },
      },
    },
  });

  if (!sondage) return null;

  const totalAdherentsActifs = await db.adherent.count({
    where: {
      User: {
        status: "Actif",
        role: { in: [UserRole.MEMBRE, UserRole.ADMIN] },
      },
    },
  });

  return buildSondageSynthese({
    sondageId: sondage.id,
    sujet: sondage.sujet,
    dateDebut: sondage.dateDebut,
    dateFin: sondage.dateFin,
    status: sondage.status,
    totalAdherentsActifs,
    questions: sondage.questions,
    reponses: sondage.reponses,
  });
}

/**
 * Synthèse agrégée des résultats d'un sondage (admin).
 */
export async function getSondageSyntheseAdmin(sondageId: string) {
  try {
    const guard = await assertAdmin();
    if (!guard.ok) return { success: false, error: guard.error };

    const parsed = SondageIdSchema.parse({ id: sondageId });
    const synthese = await loadSondageSyntheseData(parsed.id);

    if (!synthese) {
      return { success: false, error: "Sondage introuvable" };
    }

    return { success: true, data: serializeSynthese(synthese) };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    console.error("Erreur getSondageSyntheseAdmin:", error);
    return { success: false, error: "Erreur lors du calcul de la synthèse" };
  }
}

/**
 * Génère un PDF imprimable de la synthèse du sondage (admin).
 */
export async function generateSondageSynthesePdf(sondageId: string) {
  try {
    const guard = await assertAdmin();
    if (!guard.ok) return { success: false, error: guard.error };

    const parsed = SondageIdSchema.parse({ id: sondageId });
    const synthese = await loadSondageSyntheseData(parsed.id);

    if (!synthese) {
      return { success: false, error: "Sondage introuvable" };
    }

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    buildSondageSynthesePDF(doc, synthese);

    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const safeName = synthese.sujet
      .slice(0, 40)
      .replace(/[^a-zA-Z0-9_-]+/g, "_")
      .replace(/_+/g, "_");

    return {
      success: true,
      fileName: `synthese_sondage_${safeName}_${stamp}.pdf`,
      mimeType: "application/pdf",
      data: doc.output("datauristring"),
      message: "Synthèse PDF générée",
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    console.error("Erreur generateSondageSynthesePdf:", error);
    return { success: false, error: "Erreur lors de la génération du PDF" };
  }
}

const LiveQuestionSchema = z.object({
  sondageId: z.string().min(1),
  questionId: z.string().min(1),
});

const LiveSondageSchema = z.object({
  sondageId: z.string().min(1),
});

const SetModeEnDirectSchema = z.object({
  id: z.string().min(1),
  enabled: z.boolean(),
});

/**
 * Active / désactive le mode En direct (quiz uniquement, ADMIN).
 */
export async function setSondageModeEnDirect(
  input: z.infer<typeof SetModeEnDirectSchema>
) {
  try {
    const guard = await assertAdmin();
    if (!guard.ok) return { success: false, error: guard.error };
    const parsed = SetModeEnDirectSchema.parse(input);
    const { setQuizModeEnDirect } = await import(
      "@/lib/services/sondages/live-pilot"
    );
    const data = await setQuizModeEnDirect(parsed.id, parsed.enabled);
    return {
      success: true,
      message: parsed.enabled
        ? "Mode En direct activé"
        : "Mode En direct désactivé",
      data,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    if (error instanceof ServiceError) {
      return { success: false, error: error.message };
    }
    console.error("Erreur setSondageModeEnDirect:", error);
    return { success: false, error: "Impossible de modifier le mode En direct" };
  } finally {
    revalidatePath("/admin/sondages");
    revalidatePath(`/admin/sondages/${input.id}`);
  }
}

/**
 * Ouvre une question aux réponses (pilote En direct).
 */
export async function openSondageLiveQuestion(
  input: z.infer<typeof LiveQuestionSchema>
) {
  try {
    const guard = await assertAdmin();
    if (!guard.ok) return { success: false, error: guard.error };
    const parsed = LiveQuestionSchema.parse(input);
    const { openLiveQuestion } = await import(
      "@/lib/services/sondages/live-pilot"
    );
    const data = await openLiveQuestion(null, parsed.sondageId, parsed.questionId);
    return { success: true, message: "Question ouverte aux réponses", data };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    if (error instanceof ServiceError) {
      return { success: false, error: error.message };
    }
    console.error("Erreur openSondageLiveQuestion:", error);
    return { success: false, error: "Impossible d’ouvrir la question" };
  } finally {
    revalidatePath(`/admin/sondages/${input.sondageId}`);
  }
}

/**
 * Ferme les réponses d'une question live.
 */
export async function closeSondageLiveQuestion(
  input: z.infer<typeof LiveQuestionSchema>
) {
  try {
    const guard = await assertAdmin();
    if (!guard.ok) return { success: false, error: guard.error };
    const parsed = LiveQuestionSchema.parse(input);
    const { closeLiveQuestion } = await import(
      "@/lib/services/sondages/live-pilot"
    );
    const data = await closeLiveQuestion(null, parsed.sondageId, parsed.questionId);
    return { success: true, message: "Réponses fermées", data };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    if (error instanceof ServiceError) {
      return { success: false, error: error.message };
    }
    console.error("Erreur closeSondageLiveQuestion:", error);
    return { success: false, error: "Impossible de fermer la question" };
  } finally {
    revalidatePath(`/admin/sondages/${input.sondageId}`);
  }
}

/**
 * Révèle le corrigé d'une question live (après fermeture).
 */
export async function revealSondageLiveQuestionCorrige(
  input: z.infer<typeof LiveQuestionSchema>
) {
  try {
    const guard = await assertAdmin();
    if (!guard.ok) return { success: false, error: guard.error };
    const parsed = LiveQuestionSchema.parse(input);
    const { revealLiveQuestionCorrige } = await import(
      "@/lib/services/sondages/live-pilot"
    );
    const data = await revealLiveQuestionCorrige(
      null,
      parsed.sondageId,
      parsed.questionId
    );
    return { success: true, message: "Corrigé révélé", data };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    if (error instanceof ServiceError) {
      return { success: false, error: error.message };
    }
    console.error("Erreur revealSondageLiveQuestionCorrige:", error);
    return { success: false, error: "Impossible de révéler le corrigé" };
  } finally {
    revalidatePath(`/admin/sondages/${input.sondageId}`);
  }
}

/**
 * Ouvre la prochaine question en attente (sans exiger la révélation du corrigé).
 */
export async function openNextSondageLiveQuestion(
  input: z.infer<typeof LiveSondageSchema>
) {
  try {
    const guard = await assertAdmin();
    if (!guard.ok) return { success: false, error: guard.error };
    const parsed = LiveSondageSchema.parse(input);
    const { openNextLiveQuestion } = await import(
      "@/lib/services/sondages/live-pilot"
    );
    const data = await openNextLiveQuestion(null, parsed.sondageId);
    return { success: true, message: "Question suivante ouverte", data };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    if (error instanceof ServiceError) {
      return { success: false, error: error.message };
    }
    console.error("Erreur openNextSondageLiveQuestion:", error);
    return { success: false, error: "Impossible d’ouvrir la question suivante" };
  } finally {
    revalidatePath(`/admin/sondages/${input.sondageId}`);
  }
}
