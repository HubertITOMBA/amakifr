/**
 * Tests PG — choix de règlement notes de frais (lot 3).
 * Allowlist : 127.0.0.1:55432 / amaki_notes_frais_test / amaki_test.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { resolveAuthorizedNotesFraisPgTestUrl } from "@/lib/frais-avances/pg-test-allowlist";

const FIXTURE_EMAIL_SUFFIX = "@notes-frais-choix-test.local";

describe("intégration PG choix règlement notes-frais", () => {
  let prisma: PrismaClient;
  let url: string;

  beforeAll(async () => {
    process.env.NOTES_FRAIS_ENABLED = "true";
    vi.resetModules();
    url = resolveAuthorizedNotesFraisPgTestUrl(process.env);
    prisma = new PrismaClient({ datasources: { db: { url } } });
    await prisma.$connect();
  }, 60_000);

  afterAll(async () => {
    await wipe();
    await prisma.$disconnect();
  });

  async function wipe() {
    await prisma.depense.deleteMany({ where: { noteFraisId: { not: null } } });
    await prisma.noteFraisChoixReglementCible.deleteMany({});
    await prisma.noteFraisChoixReglement.deleteMany({});
    await prisma.noteFraisDecision.deleteMany({});
    await prisma.noteFraisOutboxEvent.deleteMany({});
    await prisma.justificatifNoteFrais.deleteMany({});
    await prisma.noteFrais.deleteMany({});
    await prisma.cotisationMensuelle.deleteMany({
      where: {
        Adherent: { User: { email: { endsWith: FIXTURE_EMAIL_SUFFIX } } },
      },
    });
    await prisma.detteInitiale.deleteMany({
      where: {
        Adherent: { User: { email: { endsWith: FIXTURE_EMAIL_SUFFIX } } },
      },
    });
    await prisma.typeCotisationMensuelle.deleteMany({
      where: { nom: { startsWith: "nf-choix-" } },
    });
    await prisma.userAdminRole.deleteMany({
      where: { user: { email: { endsWith: FIXTURE_EMAIL_SUFFIX } } },
    });
    await prisma.user.deleteMany({
      where: { email: { endsWith: FIXTURE_EMAIL_SUFFIX } },
    });
  }

  async function createUser(
    tag: string,
    role: "ADMIN" | "TRESOR" | "MEMBRE" = "MEMBRE"
  ) {
    const id = randomUUID().replace(/-/g, "").slice(0, 24);
    const email = `${tag}.${id}${FIXTURE_EMAIL_SUFFIX}`;
    return prisma.user.create({
      data: {
        id,
        email,
        name: `nf-choix-${tag}-${id}`,
        role,
        status: "Actif",
        password: "x",
        adherent: {
          create: {
            firstname: "Choix",
            lastname: tag,
            civility: "Monsieur",
          },
        },
      },
      include: { adherent: true },
    });
  }

  async function createValidatedNote(
    user: Awaited<ReturnType<typeof createUser>>,
    montant = 100
  ) {
    return prisma.noteFrais.create({
      data: {
        adherentId: user.adherent!.id,
        demandeurUserId: user.id,
        libelle: "Note choix PG",
        dateDepense: new Date("2026-04-01"),
        montantDemande: montant,
        montantAccepte: montant,
        statut: "VALIDEE",
        soumiseAt: new Date(),
        decideeAt: new Date(),
        decideurUserId: user.id,
        version: 3,
        Decision: {
          create: {
            decisionIdempotencyKey: `dec-${randomUUID().slice(0, 12)}`,
            statutFinal: "VALIDEE",
            montantDemande: montant,
            montantAccepte: montant,
            decideeAt: new Date(),
            decideurUserId: user.id,
          },
        },
      },
    });
  }

  async function createForfaitType(createdBy: string) {
    return prisma.typeCotisationMensuelle.create({
      data: {
        nom: `nf-choix-forfait-${randomUUID().slice(0, 8)}`,
        montant: 30,
        obligatoire: true,
        categorie: "ForfaitMensuel",
        aBeneficiaire: false,
        createdBy,
      },
    });
  }

  async function createAssistanceType(createdBy: string) {
    return prisma.typeCotisationMensuelle.create({
      data: {
        nom: `nf-choix-assist-${randomUUID().slice(0, 8)}`,
        montant: 50,
        obligatoire: false,
        categorie: "Assistance",
        aBeneficiaire: true,
        createdBy,
      },
    });
  }

  it("compensation exacte + exclusion assistance/bénéficiaire + IDOR", async () => {
    await wipe();
    const owner = await createUser("own", "MEMBRE");
    const other = await createUser("oth", "MEMBRE");
    const admin = await createUser("adm", "ADMIN");
    const note = await createValidatedNote(owner, 100);

    const forfait = await createForfaitType(admin.id);
    const assist = await createAssistanceType(admin.id);

    const dette = await prisma.detteInitiale.create({
      data: {
        adherentId: owner.adherent!.id,
        annee: 2025,
        montant: 60,
        montantPaye: 10,
        montantRestant: 50,
        createdBy: admin.id,
      },
    });

    const cmOk = await prisma.cotisationMensuelle.create({
      data: {
        periode: "2026-01",
        annee: 2026,
        mois: 1,
        typeCotisationId: forfait.id,
        adherentId: owner.adherent!.id,
        montantAttendu: 40,
        montantPaye: 0,
        montantRestant: 40,
        dateEcheance: new Date("2026-01-31"),
        statut: "EnAttente",
        createdBy: admin.id,
      },
    });

    // Assistance — doit être exclue
    await prisma.cotisationMensuelle.create({
      data: {
        periode: "2026-02",
        annee: 2026,
        mois: 2,
        typeCotisationId: assist.id,
        adherentId: owner.adherent!.id,
        montantAttendu: 50,
        montantPaye: 0,
        montantRestant: 50,
        dateEcheance: new Date("2026-02-28"),
        statut: "EnAttente",
        createdBy: admin.id,
      },
    });

    // CM avec bénéficiaire — exclue
    await prisma.cotisationMensuelle.create({
      data: {
        periode: "2026-03",
        annee: 2026,
        mois: 3,
        typeCotisationId: forfait.id,
        adherentId: owner.adherent!.id,
        adherentBeneficiaireId: other.adherent!.id,
        montantAttendu: 30,
        montantPaye: 0,
        montantRestant: 30,
        dateEcheance: new Date("2026-03-31"),
        statut: "EnAttente",
        createdBy: admin.id,
      },
    });

    // Dette d'un autre adhérent — IDOR
    const detteOther = await prisma.detteInitiale.create({
      data: {
        adherentId: other.adherent!.id,
        annee: 2024,
        montant: 20,
        montantPaye: 0,
        montantRestant: 20,
        createdBy: admin.id,
      },
    });

    const {
      listCiblesCompensationEligibles,
      setChoixReglement,
    } = await import(
      "@/lib/services/frais-avances/note-frais-choix-reglement-service"
    );

    const listed = await listCiblesCompensationEligibles({
      actorUserId: owner.id,
      noteId: note.id,
      client: prisma,
    });
    expect(listed.success).toBe(true);
    if (listed.success) {
      const ids = listed.data.map((c) => c.cibleId);
      expect(ids).toContain(dette.id);
      expect(ids).toContain(cmOk.id);
      expect(ids).not.toContain(detteOther.id);
      expect(listed.data.every((c) => !c.libelle.includes("assist"))).toBe(
        true
      );
    }

    const idor = await setChoixReglement({
      actorUserId: owner.id,
      noteId: note.id,
      expectedNoteVersion: 3,
      idempotencyKey: "choix-idor-01",
      mode: "COMPENSATION",
      montantRemboursement: 0,
      montantCompensation: 20,
      cibles: [
        {
          typeCible: "DETTE_INITIALE",
          cibleId: detteOther.id,
          montantAutorise: 20,
          rang: 0,
        },
      ],
      client: prisma,
    });
    expect(idor.success).toBe(false);

    const ok = await setChoixReglement({
      actorUserId: owner.id,
      noteId: note.id,
      expectedNoteVersion: 3,
      idempotencyKey: "choix-comp-ok-01",
      mode: "MIXTE",
      montantRemboursement: 10,
      montantCompensation: 90,
      cibles: [
        {
          typeCible: "DETTE_INITIALE",
          cibleId: dette.id,
          montantAutorise: 50,
          rang: 0,
        },
        {
          typeCible: "COTISATION_MENSUELLE",
          cibleId: cmOk.id,
          montantAutorise: 40,
          rang: 1,
        },
      ],
      client: prisma,
    });
    expect(ok.success).toBe(true);
    if (ok.success) {
      expect(ok.data.choix.statut).toBe("ACTIF");
      expect(ok.data.choix.Cibles).toHaveLength(2);
    }

    const actifs = await prisma.noteFraisChoixReglement.count({
      where: { noteFraisId: note.id, statut: "ACTIF" },
    });
    expect(actifs).toBe(1);
  });

  it("remplacement, idempotence, refresh si restant insuffisant, concurrence", async () => {
    await wipe();
    const owner = await createUser("rep", "MEMBRE");
    const admin = await createUser("adm2", "ADMIN");
    const note = await createValidatedNote(owner, 80);
    const forfait = await createForfaitType(admin.id);
    const cm = await prisma.cotisationMensuelle.create({
      data: {
        periode: "2026-05",
        annee: 2026,
        mois: 5,
        typeCotisationId: forfait.id,
        adherentId: owner.adherent!.id,
        montantAttendu: 80,
        montantPaye: 0,
        montantRestant: 80,
        dateEcheance: new Date("2026-05-31"),
        statut: "EnAttente",
        createdBy: admin.id,
      },
    });

    const { setChoixReglement } = await import(
      "@/lib/services/frais-avances/note-frais-choix-reglement-service"
    );

    const first = await setChoixReglement({
      actorUserId: owner.id,
      noteId: note.id,
      expectedNoteVersion: 3,
      idempotencyKey: "choix-first-01",
      mode: "COMPENSATION",
      montantRemboursement: 0,
      montantCompensation: 80,
      cibles: [
        {
          typeCible: "COTISATION_MENSUELLE",
          cibleId: cm.id,
          montantAutorise: 80,
          rang: 0,
        },
      ],
      client: prisma,
    });
    expect(first.success).toBe(true);

    const same = await setChoixReglement({
      actorUserId: owner.id,
      noteId: note.id,
      expectedNoteVersion: 4,
      idempotencyKey: "choix-first-01",
      mode: "COMPENSATION",
      montantRemboursement: 0,
      montantCompensation: 80,
      cibles: [
        {
          typeCible: "COTISATION_MENSUELLE",
          cibleId: cm.id,
          montantAutorise: 80,
          rang: 0,
        },
      ],
      client: prisma,
    });
    expect(same.success).toBe(true);

    const conflict = await setChoixReglement({
      actorUserId: owner.id,
      noteId: note.id,
      expectedNoteVersion: 4,
      idempotencyKey: "choix-first-01",
      mode: "REMBOURSEMENT",
      montantRemboursement: 80,
      montantCompensation: 0,
      cibles: [],
      client: prisma,
    });
    expect(conflict.success).toBe(false);
    if (!conflict.success) {
      expect(conflict.code).toBe("IDEMPOTENCY_CONFLICT");
    }

    const noteAfter = await prisma.noteFrais.findUniqueOrThrow({
      where: { id: note.id },
    });
    const replace = await setChoixReglement({
      actorUserId: owner.id,
      noteId: note.id,
      expectedNoteVersion: noteAfter.version,
      idempotencyKey: "choix-replace-01",
      mode: "REMBOURSEMENT",
      montantRemboursement: 80,
      montantCompensation: 0,
      cibles: [],
      client: prisma,
    });
    expect(replace.success).toBe(true);
    if (replace.success) {
      expect(replace.data.replaced).toBe(true);
    }
    const remplaces = await prisma.noteFraisChoixReglement.count({
      where: { noteFraisId: note.id, statut: "REMPLACE" },
    });
    expect(remplaces).toBe(1);
    expect(
      await prisma.noteFraisChoixReglement.count({
        where: { noteFraisId: note.id, statut: "ACTIF" },
      })
    ).toBe(1);

    // Divergence restants : baisser le restant CM puis tenter compensation trop haute
    await prisma.cotisationMensuelle.update({
      where: { id: cm.id },
      data: { montantRestant: 10, montantPaye: 70, statut: "PartiellementPaye" },
    });
    const note2 = await prisma.noteFrais.findUniqueOrThrow({
      where: { id: note.id },
    });
    const refresh = await setChoixReglement({
      actorUserId: owner.id,
      noteId: note.id,
      expectedNoteVersion: note2.version,
      idempotencyKey: "choix-refresh-01",
      mode: "COMPENSATION",
      montantRemboursement: 0,
      montantCompensation: 80,
      cibles: [
        {
          typeCible: "COTISATION_MENSUELLE",
          cibleId: cm.id,
          montantAutorise: 80,
          rang: 0,
        },
      ],
      client: prisma,
    });
    expect(refresh.success).toBe(false);
    if (!refresh.success) {
      expect(refresh.code).toBe("REFRESH_REQUIRED");
    }

    // Concurrence : deux set avec même version — un seul ACTIF final
    await prisma.cotisationMensuelle.update({
      where: { id: cm.id },
      data: { montantRestant: 80, montantPaye: 0, statut: "EnAttente" },
    });
    const note3 = await prisma.noteFrais.findUniqueOrThrow({
      where: { id: note.id },
    });
    const [r1, r2] = await Promise.all([
      setChoixReglement({
        actorUserId: owner.id,
        noteId: note.id,
        expectedNoteVersion: note3.version,
        idempotencyKey: "choix-race-a",
        mode: "REMBOURSEMENT",
        montantRemboursement: 80,
        montantCompensation: 0,
        cibles: [],
        client: prisma,
      }),
      setChoixReglement({
        actorUserId: owner.id,
        noteId: note.id,
        expectedNoteVersion: note3.version,
        idempotencyKey: "choix-race-b",
        mode: "COMPENSATION",
        montantRemboursement: 0,
        montantCompensation: 80,
        cibles: [
          {
            typeCible: "COTISATION_MENSUELLE",
            cibleId: cm.id,
            montantAutorise: 80,
            rang: 0,
          },
        ],
        client: prisma,
      }),
    ]);
    const successes = [r1, r2].filter((r) => r.success);
    expect(successes.length).toBe(1);
    expect(
      await prisma.noteFraisChoixReglement.count({
        where: { noteFraisId: note.id, statut: "ACTIF" },
      })
    ).toBe(1);
  });

  it("aucune écriture financière après choix", async () => {
    await wipe();
    const owner = await createUser("fin", "MEMBRE");
    const note = await createValidatedNote(owner, 25);
    const beforeAvoir = await prisma.avoir.count();
    const beforeUtil = await prisma.utilisationAvoir.count();
    const beforePay = await prisma.paiementCotisation.count({
      where: { adherentId: owner.adherent!.id },
    });
    const beforeDep = await prisma.depense.count();

    const { setChoixReglement } = await import(
      "@/lib/services/frais-avances/note-frais-choix-reglement-service"
    );
    const res = await setChoixReglement({
      actorUserId: owner.id,
      noteId: note.id,
      expectedNoteVersion: 3,
      idempotencyKey: "choix-no-fin-01",
      mode: "REMBOURSEMENT",
      montantRemboursement: 25,
      montantCompensation: 0,
      cibles: [],
      client: prisma,
    });
    expect(res.success).toBe(true);
    expect(await prisma.avoir.count()).toBe(beforeAvoir);
    expect(await prisma.utilisationAvoir.count()).toBe(beforeUtil);
    expect(
      await prisma.paiementCotisation.count({
        where: { adherentId: owner.adherent!.id },
      })
    ).toBe(beforePay);
    expect(await prisma.depense.count()).toBe(beforeDep);
  });
});
