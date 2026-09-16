/**
 * Tests PG — remboursement notes de frais (lot 4.2).
 * Allowlist : 127.0.0.1:55432 / amaki_notes_frais_test / amaki_test.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { resolveAuthorizedNotesFraisPgTestUrl } from "@/lib/frais-avances/pg-test-allowlist";
import { ensureTypeDepenseFraisAvanceForTests } from "@/lib/frais-avances/type-depense-frais-avance";
import {
  computeChargesFromDepensesValides,
  computeSoldeBancaireEstime,
  withCompensationsNotesFrais,
  withDecaissementsNotesFrais,
} from "@/lib/financial/synthese-charges";
import { enrichNoteFraisFinancierDto, toNoteFraisPublicDto } from "@/lib/frais-avances/dto";

const FIXTURE_EMAIL_SUFFIX = "@notes-frais-test.local";

describe("intégration PG remboursement notes-frais", () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    process.env.NOTES_FRAIS_ENABLED = "true";
    vi.resetModules();
    const url = resolveAuthorizedNotesFraisPgTestUrl(process.env);
    prisma = new PrismaClient({ datasources: { db: { url } } });
    await prisma.$connect();
  }, 60_000);

  afterAll(async () => {
    await wipe();
    await prisma.$disconnect();
  });

  async function wipe() {
    await prisma.utilisationAvoir.deleteMany({
      where: { noteFraisReglementLigneId: { not: null } },
    });
    await prisma.avoir.deleteMany({
      where: {
        OR: [
          { noteFraisReglementLigneId: { not: null } },
          { origine: "COMPENSATION_NOTE_FRAIS" },
        ],
      },
    });
    await prisma.noteFraisReglementLigne.deleteMany({});
    await prisma.noteFraisReglement.deleteMany({});
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
    await prisma.userAdminRole.deleteMany({
      where: { user: { email: { endsWith: FIXTURE_EMAIL_SUFFIX } } },
    });
    await prisma.user.deleteMany({
      where: { email: { endsWith: FIXTURE_EMAIL_SUFFIX } },
    });
  }

  async function createUser(
    tag: string,
    role: "ADMIN" | "TRESOR" | "MEMBRE" | "PRESID" | "COMCPT" | "SECRET" = "MEMBRE"
  ) {
    const id = randomUUID().replace(/-/g, "").slice(0, 24);
    return prisma.user.create({
      data: {
        id,
        email: `${tag}.${id}${FIXTURE_EMAIL_SUFFIX}`,
        name: `nf-remb-${tag}`,
        role,
        status: "Actif",
        password: "x",
        adherent: {
          create: {
            firstname: "Remb",
            lastname: tag,
            civility: "Monsieur",
          },
        },
      },
      include: { adherent: true },
    });
  }

  async function seedValideeWithChoix(opts: {
    dem: Awaited<ReturnType<typeof createUser>>;
    tres: Awaited<ReturnType<typeof createUser>>;
    mode: "REMBOURSEMENT" | "MIXTE";
    montantAccepte: number;
    montantRemboursement: number;
    montantCompensation?: number;
  }) {
    const decideeAt = new Date(Date.now() - 3600_000);
    const note = await prisma.noteFrais.create({
      data: {
        adherentId: opts.dem.adherent!.id,
        demandeurUserId: opts.dem.id,
        libelle: `remb-${opts.mode}`,
        dateDepense: new Date(),
        montantDemande: opts.montantAccepte,
        montantAccepte: opts.montantAccepte,
        statut: "VALIDEE",
        soumiseAt: decideeAt,
        decideeAt,
        decideurUserId: opts.tres.id,
        decisionIdempotencyKey: `dec-${randomUUID().slice(0, 12)}`,
        version: 3,
      },
    });
    await ensureTypeDepenseFraisAvanceForTests(prisma, opts.tres.id);
    await prisma.depense.create({
      data: {
        libelle: "d",
        montant: opts.montantAccepte,
        dateDepense: note.dateDepense,
        statut: "Valide",
        origine: "FRAIS_AVANCE",
        noteFraisId: note.id,
        createdBy: opts.tres.id,
        validatedBy: opts.tres.id,
      },
    });
    const comp = opts.montantCompensation ?? 0;
    const choix = await prisma.noteFraisChoixReglement.create({
      data: {
        noteFraisId: note.id,
        mode: opts.mode,
        statut: "ACTIF",
        montantReference: opts.montantAccepte,
        montantRemboursement: opts.montantRemboursement,
        montantCompensation: comp,
        idempotencyKey: `choix-${randomUUID().slice(0, 12)}`,
        choisiAt: new Date(),
      },
    });
    return { note, choix, decideeAt };
  }

  it("REMBOURSEMENT partiel+complément ; ligne sans cible ; synthèse banque", async () => {
    await wipe();
    const dem = await createUser("demR", "MEMBRE");
    const tres = await createUser("tresR", "TRESOR");
    const { note, decideeAt } = await seedValideeWithChoix({
      dem,
      tres,
      mode: "REMBOURSEMENT",
      montantAccepte: 100,
      montantRemboursement: 100,
    });

    const { executeNoteFraisRemboursement } = await import(
      "@/lib/services/frais-avances/note-frais-remboursement-service"
    );

    const notifBefore = await prisma.notification.count();
    const payBefore = await prisma.paiementCotisation.count();
    const depBefore = await prisma.depense.count({
      where: { noteFraisId: note.id },
    });
    const execAt = new Date(decideeAt.getTime() + 60_000).toISOString();

    const p1 = await executeNoteFraisRemboursement({
      actorUserId: tres.id,
      noteId: note.id,
      expectedNoteVersion: 3,
      idempotencyKey: "remb-pg-p1",
      montant: 40,
      moyen: "VIREMENT",
      reference: "VIR-001",
      executeAt: execAt,
      client: prisma,
    });
    expect(p1.success).toBe(true);

    const p2 = await executeNoteFraisRemboursement({
      actorUserId: tres.id,
      noteId: note.id,
      expectedNoteVersion: 4,
      idempotencyKey: "remb-pg-p2",
      montant: 60,
      moyen: "ESPECES",
      reference: "REC-002",
      executeAt: new Date(decideeAt.getTime() + 120_000).toISOString(),
      client: prisma,
    });
    expect(p2.success).toBe(true);

    const choix = await prisma.noteFraisChoixReglement.findFirstOrThrow({
      where: { noteFraisId: note.id, statut: "ACTIF" },
    });
    expect(Number(choix.montantRembourseUtilise)).toBe(100);
    const noteAfter = await prisma.noteFrais.findUniqueOrThrow({
      where: { id: note.id },
    });
    expect(noteAfter.version).toBe(5);

    const lignes = await prisma.noteFraisReglementLigne.findMany({
      where: { Reglement: { noteFraisId: note.id, type: "REMBOURSEMENT" } },
    });
    expect(lignes).toHaveLength(2);
    for (const l of lignes) {
      expect(l.typeLigne).toBe("REMBOURSEMENT");
      expect(l.typeCible).toBeNull();
      expect(l.cibleId).toBeNull();
      expect(l.rang).toBe(1);
    }
    expect(
      await prisma.avoir.count({
        where: { origine: "COMPENSATION_NOTE_FRAIS" },
      })
    ).toBe(0);
    expect(await prisma.notification.count()).toBe(notifBefore);
    expect(await prisma.paiementCotisation.count()).toBe(payBefore);
    expect(
      await prisma.depense.count({ where: { noteFraisId: note.id } })
    ).toBe(depBefore);

    const regs = await prisma.noteFraisReglement.findMany({
      where: { type: "REMBOURSEMENT", statut: "EXECUTE" },
    });
    const sumRemb = regs.reduce((s, r) => s + Number(r.montantTotal), 0);
    const ind = withDecaissementsNotesFrais(
      withCompensationsNotesFrais(
        computeChargesFromDepensesValides([
          { montant: 100, origine: "FRAIS_AVANCE" },
        ]),
        0
      ),
      sumRemb
    );
    expect(ind.decaissementsNotesFrais).toBeGreaterThan(0);
    expect(ind.totalCharges).toBe(100);
    expect(computeSoldeBancaireEstime(500, ind)).toBe(500 - sumRemb);
  });

  it("MIXTE part remb ; compensation antérieure dans restant dû ; DTO ref ACL", async () => {
    await wipe();
    const dem = await createUser("demM", "MEMBRE");
    const tres = await createUser("tresM", "TRESOR");
    const presid = await createUser("presM", "PRESID");
    const { note, choix, decideeAt } = await seedValideeWithChoix({
      dem,
      tres,
      mode: "MIXTE",
      montantAccepte: 80,
      montantRemboursement: 50,
      montantCompensation: 30,
    });
    await prisma.noteFraisChoixReglement.update({
      where: { id: choix.id },
      data: { montantCompensationUtilise: 30 },
    });

    const { executeNoteFraisRemboursement, computeEtatFinancierNoteFrais } =
      await import(
        "@/lib/services/frais-avances/note-frais-remboursement-service"
      );

    const res = await executeNoteFraisRemboursement({
      actorUserId: tres.id,
      noteId: note.id,
      expectedNoteVersion: 3,
      idempotencyKey: "remb-mixte-01",
      montant: 50,
      moyen: "VIREMENT",
      reference: "MIX-REF",
      executeAt: new Date(decideeAt.getTime() + 30_000).toISOString(),
      client: prisma,
    });
    expect(res.success).toBe(true);

    const choixAfter = await prisma.noteFraisChoixReglement.findUniqueOrThrow({
      where: { id: choix.id },
    });
    const etat = computeEtatFinancierNoteFrais({
      montantAccepte: 80,
      montantRembourseUtilise: choixAfter.montantRembourseUtilise,
      montantCompensationUtilise: choixAfter.montantCompensationUtilise,
    });
    expect(etat.etatFinancier).toBe("REGLEE");
    expect(etat.restantDu).toBe("0.00");

    const regs = await prisma.noteFraisReglement.findMany({
      where: { noteFraisId: note.id, type: "REMBOURSEMENT" },
    });
    const noteRow = await prisma.noteFrais.findUniqueOrThrow({
      where: { id: note.id },
      include: {
        ChoixReglements: { where: { statut: "ACTIF" }, include: { Cibles: true } },
        Justificatifs: true,
      },
    });
    const dtoMembre = enrichNoteFraisFinancierDto(toNoteFraisPublicDto(noteRow), {
      includeReference: false,
      remboursements: regs,
    });
    expect(dtoMembre.Remboursements?.[0]?.reference).toBeUndefined();

    const dtoTresor = enrichNoteFraisFinancierDto(toNoteFraisPublicDto(noteRow), {
      includeReference: true,
      remboursements: regs,
    });
    expect(dtoTresor.Remboursements?.[0]?.reference).toBe("MIX-REF");

    const { canUserReadNoteFraisRemboursementReference } = await import(
      "@/lib/frais-avances/authz"
    );
    expect(await canUserReadNoteFraisRemboursementReference(presid.id, prisma)).toBe(
      false
    );
    expect(await canUserReadNoteFraisRemboursementReference(tres.id, prisma)).toBe(
      true
    );
  });

  it("idempotence, concurrence, rollback après insert", async () => {
    await wipe();
    const dem = await createUser("demC", "MEMBRE");
    const t1 = await createUser("t1r", "TRESOR");
    const t2 = await createUser("t2r", "ADMIN");
    const { note, decideeAt } = await seedValideeWithChoix({
      dem,
      tres: t1,
      mode: "REMBOURSEMENT",
      montantAccepte: 30,
      montantRemboursement: 30,
    });

    const { executeNoteFraisRemboursement } = await import(
      "@/lib/services/frais-avances/note-frais-remboursement-service"
    );
    const execAt = new Date(decideeAt.getTime() + 10_000).toISOString();

    const first = await executeNoteFraisRemboursement({
      actorUserId: t1.id,
      noteId: note.id,
      expectedNoteVersion: 3,
      idempotencyKey: "remb-idem-01",
      montant: 15,
      moyen: "VIREMENT",
      reference: "IDEM-1",
      executeAt: execAt,
      client: prisma,
    });
    expect(first.success).toBe(true);

    const replay = await executeNoteFraisRemboursement({
      actorUserId: t1.id,
      noteId: note.id,
      expectedNoteVersion: 3,
      idempotencyKey: "remb-idem-01",
      montant: 15,
      moyen: "VIREMENT",
      reference: "IDEM-1",
      executeAt: execAt,
      client: prisma,
    });
    expect(replay.success).toBe(true);
    if (replay.success) expect(replay.data.alreadyExecuted).toBe(true);

    const conflict = await executeNoteFraisRemboursement({
      actorUserId: t1.id,
      noteId: note.id,
      expectedNoteVersion: 4,
      idempotencyKey: "remb-idem-01",
      montant: 10,
      moyen: "VIREMENT",
      reference: "IDEM-1",
      executeAt: execAt,
      client: prisma,
    });
    expect(conflict.success).toBe(false);
    if (!conflict.success) expect(conflict.code).toBe("IDEMPOTENCY_CONFLICT");

    // Concurrence plafond restant 15
    const note2 = await seedValideeWithChoix({
      dem,
      tres: t1,
      mode: "REMBOURSEMENT",
      montantAccepte: 20,
      montantRemboursement: 20,
    });
    const [r1, r2] = await Promise.all([
      executeNoteFraisRemboursement({
        actorUserId: t1.id,
        noteId: note2.note.id,
        expectedNoteVersion: 3,
        idempotencyKey: "remb-race-a",
        montant: 20,
        moyen: "ESPECES",
        reference: "RACE-A",
        executeAt: new Date(note2.decideeAt.getTime() + 5_000).toISOString(),
        client: prisma,
      }),
      executeNoteFraisRemboursement({
        actorUserId: t2.id,
        noteId: note2.note.id,
        expectedNoteVersion: 3,
        idempotencyKey: "remb-race-b",
        montant: 20,
        moyen: "ESPECES",
        reference: "RACE-B",
        executeAt: new Date(note2.decideeAt.getTime() + 5_000).toISOString(),
        client: prisma,
      }),
    ]);
    expect([r1, r2].filter((r) => r.success)).toHaveLength(1);
    expect(
      await prisma.noteFraisReglement.count({
        where: { noteFraisId: note2.note.id },
      })
    ).toBe(1);

    // Rollback après insert
    const note3 = await seedValideeWithChoix({
      dem,
      tres: t1,
      mode: "REMBOURSEMENT",
      montantAccepte: 25,
      montantRemboursement: 25,
    });
    const fail = await executeNoteFraisRemboursement({
      actorUserId: t1.id,
      noteId: note3.note.id,
      expectedNoteVersion: 3,
      idempotencyKey: "remb-rollback-01",
      montant: 25,
      moyen: "VIREMENT",
      reference: "ROLL-1",
      executeAt: new Date(note3.decideeAt.getTime() + 5_000).toISOString(),
      client: prisma,
      afterReglementInsert: async () => {
        throw new Error("INJECTED_AFTER_INSERT");
      },
    });
    expect(fail.success).toBe(false);
    expect(
      await prisma.noteFraisReglement.count({
        where: { noteFraisId: note3.note.id },
      })
    ).toBe(0);
    const n3 = await prisma.noteFrais.findUniqueOrThrow({
      where: { id: note3.note.id },
    });
    expect(n3.version).toBe(3);
    const ch3 = await prisma.noteFraisChoixReglement.findFirstOrThrow({
      where: { noteFraisId: note3.note.id, statut: "ACTIF" },
    });
    expect(Number(ch3.montantRembourseUtilise)).toBe(0);
  });
});
