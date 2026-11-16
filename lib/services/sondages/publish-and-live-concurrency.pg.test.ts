/**
 * Concurrence PG — publish atomique, open×open, close quiz×submit, close question×submit.
 *
 * Lancement EXPLICITE uniquement :
 *   AMAKI_RUN_SONDAGES_PG_CONCURRENCY=1
 *   TEST_DATABASE_URL=…/amakifr_db (base DEV autorisée)
 *
 * Pas de fallback silencieux sur DATABASE_URL pour activer la suite.
 * Un `vitest run` standard (sans flag) ne charge pas Prisma ni les services DB.
 */
import { beforeAll, afterAll, afterEach, describe, expect, it } from "vitest";
import {
  SondageKind,
  SondageStatus,
  SondageQuestionLiveEtat,
  UserRole,
  UserStatus,
  type PrismaClient,
} from "@prisma/client";
import type { AuthContext } from "@/lib/auth-context";
import type { PublishSondageDeps } from "@/lib/services/sondages/publish-and-close-sondage";

const EXPLICIT_FLAG = process.env.AMAKI_RUN_SONDAGES_PG_CONCURRENCY === "1";
const testUrl = (process.env.TEST_DATABASE_URL || "").trim();
const dbAllowed = /\/amakifr_db(\?|$)/.test(testUrl);
const runPg = EXPLICIT_FLAG && dbAllowed;

const SUJET_PREFIX = "[CONC-PG]";

let prisma: PrismaClient | null = null;
let publishSondageService: typeof import("@/lib/services/sondages/publish-and-close-sondage").publishSondageService;
let closeSondageService: typeof import("@/lib/services/sondages/publish-and-close-sondage").closeSondageService;
let openLiveQuestion: typeof import("@/lib/services/sondages/live-pilot").openLiveQuestion;
let closeLiveQuestion: typeof import("@/lib/services/sondages/live-pilot").closeLiveQuestion;
let openNextLiveQuestion: typeof import("@/lib/services/sondages/live-pilot").openNextLiveQuestion;
let submitMySurveyAnswers: typeof import("@/lib/services/sondages/submit-my-survey-answers").submitMySurveyAnswers;

function pg(): PrismaClient {
  if (!prisma) {
    throw new Error("Client Prisma PG non initialisé (suite inactive)");
  }
  return prisma;
}

function membreActor(): AuthContext {
  return {
    userId: "user-conc-membre-quiz",
    role: "MEMBRE",
    status: "Actif",
    email: "membre.conc.quiz@example.test",
    name: "Membre Conc",
    sessionId: null,
    adminRoles: [],
    adherentId: null,
    channel: "mobile",
  };
}

function gate(): { wait: Promise<void>; release: () => void } {
  let release!: () => void;
  const wait = new Promise<void>((r) => {
    release = r;
  });
  return { wait, release };
}

async function ensureSeeds() {
  const db = pg();
  await db.user.upsert({
    where: { email: "admin.conc.quiz@example.test" },
    update: { status: UserStatus.Actif, role: UserRole.ADMIN },
    create: {
      id: "user-conc-admin-quiz",
      name: "Admin Conc Quiz",
      email: "admin.conc.quiz@example.test",
      password: "x",
      role: UserRole.ADMIN,
      status: UserStatus.Actif,
      emailVerified: new Date(),
    },
  });
  await db.user.upsert({
    where: { email: "membre.conc.quiz@example.test" },
    update: { status: UserStatus.Actif, role: UserRole.MEMBRE },
    create: {
      id: "user-conc-membre-quiz",
      name: "Membre Conc Quiz",
      email: "membre.conc.quiz@example.test",
      password: "x",
      role: UserRole.MEMBRE,
      status: UserStatus.Actif,
      emailVerified: new Date(),
    },
  });
  await db.adherent.upsert({
    where: { id: "adh-conc-membre" },
    update: {},
    create: {
      id: "adh-conc-membre",
      userId: "user-conc-membre-quiz",
      firstname: "Membre",
      lastname: "Conc",
      civility: "Monsieur",
    },
  });
}

async function cleanupConcQuizzes() {
  const db = pg();
  const rows = await db.sondage.findMany({
    where: { sujet: { startsWith: SUJET_PREFIX } },
    select: { id: true },
  });
  for (const row of rows) {
    const reponses = await db.sondageReponse.findMany({
      where: { sondageId: row.id },
      select: { id: true },
    });
    const reponseIds = reponses.map((r) => r.id);
    if (reponseIds.length) {
      await db.sondageReponseItem.deleteMany({
        where: { reponseId: { in: reponseIds } },
      });
    }
    await db.sondageReponse.deleteMany({ where: { sondageId: row.id } });
    await db.sondageOption.deleteMany({
      where: { Question: { sondageId: row.id } },
    });
    await db.sondageQuestion.deleteMany({ where: { sondageId: row.id } });
    await db.sondage.delete({ where: { id: row.id } });
  }
}

async function createLiveQuiz(opts: {
  sujetSuffix: string;
  questionCount: number;
  firstOpen?: boolean;
}) {
  const db = pg();
  const questions = Array.from({ length: opts.questionCount }, (_, i) => ({
    ordre: i,
    libelle: `Q${i + 1}`,
    type: "ChoixUnique" as const,
    obligatoire: true,
    liveEtat:
      opts.firstOpen && i === 0
        ? SondageQuestionLiveEtat.Ouverte
        : SondageQuestionLiveEtat.EnAttente,
    options: {
      create: [
        { ordre: 0, libelle: "Oui", estCorrecte: true },
        { ordre: 1, libelle: "Non", estCorrecte: false },
      ],
    },
  }));

  return db.sondage.create({
    data: {
      sujet: `${SUJET_PREFIX} ${opts.sujetSuffix} ${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      introduction: null,
      dateDebut: new Date(Date.now() - 3600000),
      dateFin: new Date(Date.now() + 86400000 * 7),
      status: SondageStatus.Ouvert,
      kind: SondageKind.Quiz,
      modeEnDirect: true,
      createdBy: "user-conc-admin-quiz",
      questions: { create: questions },
    },
    include: {
      questions: { include: { options: true }, orderBy: { ordre: "asc" } },
    },
  });
}

describe("garde lancement explicite PG concurrence sondages", () => {
  it("sans AMAKI_RUN_SONDAGES_PG_CONCURRENCY=1 + TEST_DATABASE_URL amakifr_db : suite inactive", () => {
    if (!EXPLICIT_FLAG || !dbAllowed) {
      expect(runPg).toBe(false);
      expect(prisma).toBeNull();
      return;
    }
    expect(runPg).toBe(true);
  });
});

describe.skipIf(!runPg)("concurrence PG publish + live (amakifr_db)", () => {
  beforeAll(async () => {
    // Aligner le singleton app AVANT import des services
    process.env.DATABASE_URL = testUrl;

    const { PrismaClient } = await import("@prisma/client");
    prisma = new PrismaClient({
      datasources: { db: { url: testUrl } },
    });

    const pub = await import(
      "@/lib/services/sondages/publish-and-close-sondage"
    );
    publishSondageService = pub.publishSondageService;
    closeSondageService = pub.closeSondageService;

    const live = await import("@/lib/services/sondages/live-pilot");
    openLiveQuestion = live.openLiveQuestion;
    closeLiveQuestion = live.closeLiveQuestion;
    openNextLiveQuestion = live.openNextLiveQuestion;

    const submit = await import(
      "@/lib/services/sondages/submit-my-survey-answers"
    );
    submitMySurveyAnswers = submit.submitMySurveyAnswers;

    await prisma.$connect();
    await ensureSeeds();
    await cleanupConcQuizzes();
  }, 60_000);

  afterEach(async () => {
    await cleanupConcQuizzes();
  });

  afterAll(async () => {
    if (prisma) {
      await cleanupConcQuizzes();
      await prisma.$disconnect();
      prisma = null;
    }
  });

  it("deux publishSondage concurrents → 1 transition, 1 appel/canal (email, in-app, push)", async () => {
    const draft = await pg().sondage.create({
      data: {
        sujet: `${SUJET_PREFIX} publish ${Date.now()}`,
        introduction: null,
        dateDebut: new Date(),
        dateFin: new Date(Date.now() + 86400000 * 7),
        status: SondageStatus.Brouillon,
        kind: SondageKind.Quiz,
        createdBy: "user-conc-admin-quiz",
        questions: {
          create: [
            {
              ordre: 0,
              libelle: "Q",
              type: "ChoixUnique",
              obligatoire: true,
              options: {
                create: [
                  { ordre: 0, libelle: "A", estCorrecte: true },
                  { ordre: 1, libelle: "B", estCorrecte: false },
                ],
              },
            },
          ],
        },
      },
    });

    const channels = { email: 0, inApp: 0, push: 0 };
    const deps: PublishSondageDeps = {
      sendInvitations: async () => {
        channels.email += 1;
        return { sentCount: 1, failedCount: 0, skippedCount: 0, errors: [] };
      },
      notifyInApp: async () => {
        channels.inApp += 1;
        channels.push += 1;
        return {
          createdCount: 1,
          skippedDuplicateCount: 0,
          skippedIneligibleCount: 0,
          recipientUserIds: ["user-conc-membre-quiz"],
        };
      },
    };

    const [a, b] = await Promise.all([
      publishSondageService(draft.id, deps),
      publishSondageService(draft.id, deps),
    ]);

    const winners = [a, b].filter((r) => r.success).length;
    const losers = [a, b].filter((r) => !r.success).length;
    const final = await pg().sondage.findUnique({ where: { id: draft.id } });

    expect(winners).toBe(1);
    expect(losers).toBe(1);
    expect(final?.status).toBe(SondageStatus.Ouvert);
    expect(channels).toEqual({ email: 1, inApp: 1, push: 1 });
  });

  it("barrière open×open : deux admins ouvrent Q1 et Q2 → au plus une ouverte", async () => {
    const quiz = await createLiveQuiz({
      sujetSuffix: "open-x-open",
      questionCount: 2,
      firstOpen: false,
    });
    const q1 = quiz.questions[0]!;
    const q2 = quiz.questions[1]!;

    const g = gate();
    const open1P = openLiveQuestion(null, quiz.id, q1.id, {
      afterQuestionsLocked: () => g.wait,
    });
    await new Promise((r) => setTimeout(r, 150));

    const open2P = openLiveQuestion(null, quiz.id, q2.id).then(
      (value) => ({ ok: true as const, value }),
      (error: unknown) => ({ ok: false as const, error })
    );
    await new Promise((r) => setTimeout(r, 200));
    g.release();

    await expect(open1P).resolves.toBeTruthy();
    const open2Res = await open2P;
    expect(open2Res.ok).toBe(false);
    if (!open2Res.ok) {
      expect(open2Res.error).toMatchObject({
        message: expect.stringMatching(/Fermez d’abord/i),
      });
    }

    const etats = await pg().sondageQuestion.findMany({
      where: { sondageId: quiz.id },
      orderBy: { ordre: "asc" },
      select: { id: true, liveEtat: true },
    });
    const ouvertes = etats.filter(
      (q) => q.liveEtat === SondageQuestionLiveEtat.Ouverte
    );
    expect(ouvertes).toHaveLength(1);
    expect(ouvertes[0]!.id).toBe(q1.id);
    expect(etats.find((q) => q.id === q2.id)?.liveEtat).toBe(
      SondageQuestionLiveEtat.EnAttente
    );
  });

  it("barrière closeSondage×submit : soumission d’abord → réponse conservée", async () => {
    const quiz = await createLiveQuiz({
      sujetSuffix: "quiz-close-submit-first",
      questionCount: 1,
      firstOpen: true,
    });
    const q = quiz.questions[0]!;
    const opt = q.options.find((o) => o.estCorrecte)!;
    const g = gate();

    const submitP = submitMySurveyAnswers(
      membreActor(),
      quiz.id,
      { items: [{ questionId: q.id, optionId: opt.id }], mode: "partial" },
      { afterLiveEtatLocked: () => g.wait }
    );
    await new Promise((r) => setTimeout(r, 150));

    const closeP = closeSondageService(quiz.id);
    await new Promise((r) => setTimeout(r, 200));
    g.release();

    await expect(submitP).resolves.toMatchObject({ id: expect.any(String) });
    await expect(closeP).resolves.toMatchObject({ success: true });

    const items = await pg().sondageReponseItem.count({
      where: { questionId: q.id },
    });
    const status = await pg().sondage.findUnique({
      where: { id: quiz.id },
      select: { status: true },
    });
    expect(items).toBe(1);
    expect(status?.status).toBe(SondageStatus.Cloture);
  });

  it("barrière closeSondage×submit : clôture d’abord → soumission refusée, 0 écriture", async () => {
    const quiz = await createLiveQuiz({
      sujetSuffix: "quiz-close-close-first",
      questionCount: 1,
      firstOpen: true,
    });
    const q = quiz.questions[0]!;
    const opt = q.options.find((o) => o.estCorrecte)!;
    const g = gate();

    const closeP = closeSondageService(quiz.id, {
      afterSondageLocked: () => g.wait,
    });
    await new Promise((r) => setTimeout(r, 150));

    const submitP = submitMySurveyAnswers(
      membreActor(),
      quiz.id,
      { items: [{ questionId: q.id, optionId: opt.id }], mode: "partial" }
    ).then(
      (value) => ({ ok: true as const, value }),
      (error: unknown) => ({ ok: false as const, error })
    );
    await new Promise((r) => setTimeout(r, 200));
    g.release();

    await expect(closeP).resolves.toMatchObject({ success: true });
    const submitRes = await submitP;
    expect(submitRes.ok).toBe(false);
    if (!submitRes.ok) {
      expect(submitRes.error).toMatchObject({
        code: "FORBIDDEN",
        message: expect.stringMatching(/clôturé/i),
      });
    }

    const items = await pg().sondageReponseItem.count({
      where: { questionId: q.id },
    });
    expect(items).toBe(0);
  });

  it("barrière closeLiveQuestion×submit : soumission d’abord → réponse conservée", async () => {
    const quiz = await createLiveQuiz({
      sujetSuffix: "live-close-submit-first",
      questionCount: 1,
      firstOpen: true,
    });
    const q = quiz.questions[0]!;
    const opt = q.options.find((o) => o.estCorrecte)!;
    const g = gate();

    const submitP = submitMySurveyAnswers(
      membreActor(),
      quiz.id,
      { items: [{ questionId: q.id, optionId: opt.id }], mode: "partial" },
      { afterLiveEtatLocked: () => g.wait }
    );
    await new Promise((r) => setTimeout(r, 150));

    const closeP = closeLiveQuestion(null, quiz.id, q.id);
    await new Promise((r) => setTimeout(r, 200));
    g.release();

    await expect(submitP).resolves.toMatchObject({ id: expect.any(String) });
    await expect(closeP).resolves.toBeTruthy();

    const items = await pg().sondageReponseItem.count({
      where: { questionId: q.id },
    });
    const etat = await pg().sondageQuestion.findUnique({ where: { id: q.id } });
    expect(items).toBe(1);
    expect(etat?.liveEtat).toBe(SondageQuestionLiveEtat.Fermee);
  });

  it("barrière closeLiveQuestion×submit : fermeture d’abord → soumission refusée, 0 écriture", async () => {
    const quiz = await createLiveQuiz({
      sujetSuffix: "live-close-close-first",
      questionCount: 1,
      firstOpen: true,
    });
    const q = quiz.questions[0]!;
    const opt = q.options.find((o) => o.estCorrecte)!;
    const g = gate();

    const closeP = closeLiveQuestion(null, quiz.id, q.id, {
      afterQuestionLocked: () => g.wait,
    });
    await new Promise((r) => setTimeout(r, 150));

    const submitP = submitMySurveyAnswers(
      membreActor(),
      quiz.id,
      { items: [{ questionId: q.id, optionId: opt.id }], mode: "partial" }
    ).then(
      (value) => ({ ok: true as const, value }),
      (error: unknown) => ({ ok: false as const, error })
    );
    await new Promise((r) => setTimeout(r, 200));
    g.release();

    await expect(closeP).resolves.toBeTruthy();
    const submitRes = await submitP;
    expect(submitRes.ok).toBe(false);
    if (!submitRes.ok) {
      expect(submitRes.error).toMatchObject({
        code: "FORBIDDEN",
        message: expect.stringMatching(/n’accepte plus/i),
      });
    }

    const items = await pg().sondageReponseItem.count({
      where: { questionId: q.id },
    });
    expect(items).toBe(0);
  });

  it("openNextLiveQuestion refuse si une question est encore ouverte (ne ferme pas)", async () => {
    const { ServiceError: SE } = await import("@/lib/service-error");
    const quiz = await createLiveQuiz({
      sujetSuffix: "open-next",
      questionCount: 2,
      firstOpen: true,
    });
    const q1 = quiz.questions[0]!;

    await expect(openNextLiveQuestion(null, quiz.id)).rejects.toBeInstanceOf(SE);
    await expect(openNextLiveQuestion(null, quiz.id)).rejects.toMatchObject({
      message: expect.stringMatching(/Fermez d’abord/i),
    });

    const still = await pg().sondageQuestion.findUnique({
      where: { id: q1.id },
    });
    expect(still?.liveEtat).toBe(SondageQuestionLiveEtat.Ouverte);

    await closeLiveQuestion(null, quiz.id, q1.id);
    const snap = await openNextLiveQuestion(null, quiz.id);
    expect(snap.questionActiveId).toBe(quiz.questions[1]!.id);
  });
});
