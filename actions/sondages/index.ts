"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  isSondageModifiable,
  isSondageVisiblePourAdherent,
  validateSondageDates,
  type SondageQuestionInput,
  type SondageReponseItemInput,
} from "@/lib/sondages";
import { sendSondageInvitationsToActiveAdherents } from "@/lib/sondages-notifications";
import {
  Prisma,
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

const QuestionInputSchema = z.object({
  ordre: z.number().int().min(0),
  section: z.string().max(255).optional().nullable(),
  libelle: z.string().min(1, "Le libellé de la question est requis").max(10000),
  type: SondageQuestionTypeSchema,
  obligatoire: z.boolean().optional().default(true),
  maxSelections: z.number().int().positive().optional().nullable(),
  minCaracteres: z.number().int().min(0).optional().nullable(),
  maxCaracteres: z.number().int().positive().optional().nullable(),
  options: z
    .array(
      z.object({
        ordre: z.number().int().min(0),
        libelle: z.string().min(1).max(500),
        permetTexteLibre: z.boolean().optional().default(false),
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
  questions: z.array(QuestionInputSchema).min(1, "Ajoutez au moins une question"),
  /** Si true (défaut), le sondage est publié et les adhérents actifs sont notifiés par email */
  publier: z.boolean().optional().default(true),
});

const UpdateSondageSchema = CreateSondageSchema.extend({
  id: z.string().min(1),
});

const SondageIdSchema = z.object({
  id: z.string().min(1),
});

const DuplicateSondageSchema = z.object({
  sourceId: z.string().min(1),
  sujet: z.string().min(1).max(255),
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
  return {
    id: sondage.id,
    sujet: sondage.sujet,
    introduction: sondage.introduction,
    conclusion: sondage.conclusion,
    dateDebut: sondage.dateDebut.toISOString(),
    dateFin: sondage.dateFin.toISOString(),
    status: sondage.status,
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
  sondage: Prisma.SondageGetPayload<{ include: typeof sondageInclude }>
) {
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
    options: {
      create: (question.options || []).map((option) => ({
        ordre: option.ordre,
        libelle: option.libelle,
        permetTexteLibre: option.permetTexteLibre ?? false,
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
 * Crée un sondage avec ses questions et notifie les adhérents actifs si publié.
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

    const existing = await db.sondage.findUnique({
      where: { sujet: parsed.sujet },
      select: { id: true },
    });
    if (existing) {
      return { success: false, error: "Un sondage avec ce sujet existe déjà" };
    }

    const sondage = await db.sondage.create({
      data: {
        sujet: parsed.sujet,
        introduction: parsed.introduction || null,
        conclusion: parsed.conclusion || null,
        dateDebut: parsed.dateDebut,
        dateFin: parsed.dateFin,
        status: parsed.publier ? SondageStatus.Ouvert : SondageStatus.Brouillon,
        createdBy: guard.userId,
        questions: {
          create: await createQuestionsNested(parsed.questions),
        },
      },
      include: sondageInclude,
    });

    let emailStats = { sentCount: 0, failedCount: 0 };
    if (parsed.publier) {
      const notify = await sendSondageInvitationsToActiveAdherents(sondage);
      emailStats = { sentCount: notify.sentCount, failedCount: notify.failedCount };
    }

    const emailPart =
      parsed.publier && emailStats.sentCount > 0
        ? ` (${emailStats.sentCount} email(s) envoyé(s))`
        : parsed.publier && emailStats.failedCount > 0
          ? " (échec partiel de l'envoi des emails)"
          : "";

    return {
      success: true,
      message: parsed.publier
        ? `Sondage créé et publié${emailPart}`
        : "Sondage créé en brouillon",
      id: sondage.id,
      data: mapSondageDetail(sondage),
      emailStats: parsed.publier ? emailStats : undefined,
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
          questions: {
            create: await createQuestionsNested(parsed.questions),
          },
        },
        include: sondageInclude,
      });
    });

    return {
      success: true,
      message: "Sondage mis à jour",
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
 * Publie un sondage (passe en statut Ouvert).
 */
export async function publishSondage(sondageId: string) {
  try {
    const guard = await assertAdmin();
    if (!guard.ok) return { success: false, error: guard.error };

    const parsed = SondageIdSchema.parse({ id: sondageId });
    const sondage = await db.sondage.findUnique({
      where: { id: parsed.id },
      include: { questions: true },
    });

    if (!sondage) {
      return { success: false, error: "Sondage introuvable" };
    }

    if (sondage.status !== SondageStatus.Brouillon) {
      return { success: false, error: "Seul un brouillon peut être publié" };
    }

    if (!sondage.questions.length) {
      return { success: false, error: "Ajoutez au moins une question avant publication" };
    }

    const dateError = validateSondageDates(sondage.dateDebut, sondage.dateFin);
    if (dateError) return { success: false, error: dateError };

    await db.sondage.update({
      where: { id: parsed.id },
      data: { status: SondageStatus.Ouvert },
    });

    const notify = await sendSondageInvitationsToActiveAdherents(sondage);
    const emailPart =
      notify.sentCount > 0
        ? ` — ${notify.sentCount} email(s) envoyé(s) aux adhérents actifs`
        : notify.failedCount > 0
          ? " — échec de l'envoi des emails"
          : "";

    return {
      success: true,
      message: `Sondage publié${emailPart}`,
      emailStats: {
        sentCount: notify.sentCount,
        failedCount: notify.failedCount,
      },
    };
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
 */
export async function closeSondage(sondageId: string) {
  try {
    const guard = await assertAdmin();
    if (!guard.ok) return { success: false, error: guard.error };

    const parsed = SondageIdSchema.parse({ id: sondageId });
    const sondage = await db.sondage.findUnique({
      where: { id: parsed.id },
      select: { id: true, status: true },
    });

    if (!sondage) {
      return { success: false, error: "Sondage introuvable" };
    }

    if (sondage.status === SondageStatus.Cloture) {
      return { success: false, error: "Ce sondage est déjà clôturé" };
    }

    await db.sondage.update({
      where: { id: parsed.id },
      data: { status: SondageStatus.Cloture },
    });

    return { success: true, message: "Sondage clôturé" };
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
      options: q.options.map((o) => ({
        ordre: o.ordre,
        libelle: o.libelle,
        permetTexteLibre: o.permetTexteLibre,
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
      message: "Sondage dupliqué en brouillon",
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

    return {
      success: true,
      data: {
        ...mapSondageDetail(sondage),
        modifiable: isSondageModifiable(sondage),
        maReponse: maReponse
          ? {
              id: maReponse.id,
              soumiseLe: maReponse.soumiseLe.toISOString(),
              modifieLe: maReponse.modifieLe.toISOString(),
              items: maReponse.items.map((item) => ({
                questionId: item.questionId,
                optionId: item.optionId,
                ligneMatriceId: item.ligneMatriceId,
                texteLibre: item.texteLibre,
              })),
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
