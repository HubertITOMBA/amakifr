/**
 * Tests PG — corrections append-only notes de frais (lot 4.6).
 * Allowlist : 127.0.0.1:55432 / amaki_notes_frais_test / amaki_test.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PrismaClient, Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { resolveAuthorizedNotesFraisPgTestUrl } from "@/lib/frais-avances/pg-test-allowlist";
import { wipeNotesFraisPgFixtures } from "@/lib/frais-avances/pg-test-wipe";
import { ensureTypeDepenseFraisAvanceForTests } from "@/lib/frais-avances/type-depense-frais-avance";
import {
  computeChargesFromDepensesValides,
  computeSoldeBancaireEstime,
  withCompensationsNotesFrais,
  withDecaissementsNotesFrais,
} from "@/lib/financial/synthese-charges";

const FIXTURE_EMAIL_SUFFIX = "@notes-frais-test.local";

describe("intégration PG corrections notes-frais 4.6", () => {
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
    await wipeNotesFraisPgFixtures(prisma);
  }

  async function createUser(
    tag: string,
    role: "ADMIN" | "TRESOR" | "MEMBRE" | "COMCPT" = "MEMBRE"
  ) {
    const id = randomUUID().replace(/-/g, "").slice(0, 24);
    return prisma.user.create({
      data: {
        id,
        email: `${tag}.${id}${FIXTURE_EMAIL_SUFFIX}`,
        name: `nf-corr-${tag}`,
        role,
        status: "Actif",
        password: "x",
        adherent: {
          create: {
            firstname: "Corr",
            lastname: tag,
            civility: "Monsieur",
          },
        },
      },
      include: { adherent: true },
    });
  }

  async function seedRemb(opts: {
    dem: Awaited<ReturnType<typeof createUser>>;
    tres: Awaited<ReturnType<typeof createUser>>;
    montant: string;
  }) {
    const decideeAt = new Date(Date.now() - 3600_000);
    await ensureTypeDepenseFraisAvanceForTests(prisma, opts.tres.id);
    const note = await prisma.noteFrais.create({
      data: {
        adherentId: opts.dem.adherent!.id,
        demandeurUserId: opts.dem.id,
        libelle: "corr-remb",
        dateDepense: new Date(),
        montantDemande: opts.montant,
        montantAccepte: opts.montant,
        statut: "VALIDEE",
        soumiseAt: decideeAt,
        decideeAt,
        decideurUserId: opts.tres.id,
        version: 1,
      },
    });
    await prisma.depense.create({
      data: {
        libelle: "d",
        montant: opts.montant,
        dateDepense: note.dateDepense,
        statut: "Valide",
        origine: "FRAIS_AVANCE",
        noteFraisId: note.id,
        createdBy: opts.tres.id,
        validatedBy: opts.tres.id,
      },
    });
    const choix = await prisma.noteFraisChoixReglement.create({
      data: {
        noteFraisId: note.id,
        mode: "REMBOURSEMENT",
        statut: "ACTIF",
        montantReference: opts.montant,
        montantRemboursement: opts.montant,
        montantCompensation: 0,
        montantRembourseUtilise: 0,
        montantCompensationUtilise: 0,
        choisiAt: new Date(),
        idempotencyKey: `choix-${note.id}`.slice(0, 64),
      },
    });
    const { executeNoteFraisRemboursement } = await import(
      "@/lib/services/frais-avances/note-frais-remboursement-service"
    );
    const exec = await executeNoteFraisRemboursement({
      actorUserId: opts.tres.id,
      noteId: note.id,
      expectedNoteVersion: 1,
      idempotencyKey: `remb-${note.id}`.slice(0, 64),
      montant: opts.montant,
      moyen: "VIREMENT",
      reference: "VIR-ORIG-001",
      executeAt: new Date().toISOString(),
      client: prisma as never,
    });
    expect(exec.success).toBe(true);
    if (!exec.success) throw new Error("remb seed failed");
    const fresh = await prisma.noteFrais.findUniqueOrThrow({
      where: { id: note.id },
    });
    return { note: fresh, choix, reglementId: exec.data.reglementId };
  }

  it("REFERENCE simple puis seconde en chaîne", async () => {
    await wipe();
    const dem = await createUser("dem-ref", "MEMBRE");
    const tres = await createUser("tres-ref", "TRESOR");
    const { note, reglementId } = await seedRemb({
      dem,
      tres,
      montant: "40.00",
    });
    const { correctNoteFraisReglement } = await import(
      "@/lib/services/frais-avances/note-frais-correction-service"
    );
    const c1 = await correctNoteFraisReglement({
      actorUserId: tres.id,
      noteId: note.id,
      reglementId,
      expectedNoteVersion: note.version,
      idempotencyKey: `corr-ref-1-${note.id}`.slice(0, 64),
      type: "REFERENCE",
      referenceApres: "VIR-CORR-001",
      motif: "typo initiale",
      client: prisma as never,
    });
    expect(c1.success).toBe(true);
    const reg = await prisma.noteFraisReglement.findUniqueOrThrow({
      where: { id: reglementId },
    });
    expect(reg.reference).toBe("VIR-ORIG-001");
    expect(reg.referenceNormalisee).toBe("VIR-ORIG-001");

    const note2 = await prisma.noteFrais.findUniqueOrThrow({
      where: { id: note.id },
    });
    const c2 = await correctNoteFraisReglement({
      actorUserId: tres.id,
      noteId: note.id,
      reglementId,
      expectedNoteVersion: note2.version,
      idempotencyKey: `corr-ref-2-${note.id}`.slice(0, 64),
      type: "REFERENCE",
      referenceApres: "VIR-CORR-002",
      motif: "deuxième correction",
      client: prisma as never,
    });
    expect(c2.success).toBe(true);
    if (!c2.success) return;
    const corr2 = await prisma.noteFraisReglementCorrection.findUniqueOrThrow({
      where: { id: c2.data.correctionId },
    });
    expect(corr2.referenceAvantNorm).toBe("VIR-CORR-001");
    expect(corr2.referenceApresNorm).toBe("VIR-CORR-002");

    const notifs = await prisma.notification.findMany({
      where: { userId: dem.id },
    });
    expect(notifs.some((n) => n.titre.includes("Correction"))).toBe(true);
    const outboxes = await prisma.noteFraisOutboxEvent.findMany({
      where: { noteFraisId: note.id, kind: "CORRECTION_REFERENCE" },
    });
    expect(outboxes).toHaveLength(2);
    expect(JSON.stringify(outboxes[0]!.payload)).not.toContain("VIR-CORR");
  });

  it("montant négatif remboursement + synthèse nette + compteurs", async () => {
    await wipe();
    const dem = await createUser("dem-mnt", "MEMBRE");
    const tres = await createUser("tres-mnt", "TRESOR");
    const { note, reglementId, choix } = await seedRemb({
      dem,
      tres,
      montant: "50.00",
    });
    const { correctNoteFraisReglement, aggregateCorrectionsMontantByReglementType } =
      await import(
        "@/lib/services/frais-avances/note-frais-correction-service"
      );
    const res = await correctNoteFraisReglement({
      actorUserId: tres.id,
      noteId: note.id,
      reglementId,
      expectedNoteVersion: note.version,
      idempotencyKey: `corr-mnt-${note.id}`.slice(0, 64),
      type: "MONTANT_NEGATIF",
      montantACorriger: "15.00",
      motif: "erreur enregistrement montant",
      preuveKind: "PV_TRESORERIE",
      preuveRef: "PV-TEST-00015",
      client: prisma as never,
    });
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.montant).toBe("-15.00");

    const choixAfter = await prisma.noteFraisChoixReglement.findUniqueOrThrow({
      where: { id: choix.id },
    });
    expect(choixAfter.montantRembourseUtilise.toFixed(2)).toBe("35.00");

    const rembAgg = await prisma.noteFraisReglement.aggregate({
      where: { type: "REMBOURSEMENT", statut: "EXECUTE" },
      _sum: { montantTotal: true },
    });
    const corrAgg = await aggregateCorrectionsMontantByReglementType(
      prisma as never
    );
    const { Prisma } = await import("@prisma/client");
    const rembNet = new Prisma.Decimal(rembAgg._sum.montantTotal ?? 0)
      .plus(new Prisma.Decimal(corrAgg.remboursements))
      .toFixed(2);
    const ind = withDecaissementsNotesFrais(
      withCompensationsNotesFrais(
        computeChargesFromDepensesValides([
          { montant: 50, origine: "FRAIS_AVANCE" },
        ]),
        corrAgg.compensations
      ),
      rembNet
    );
    expect(ind.decaissementsNotesFrais).toBe(35);
    expect(ind.restitutionsNotesFrais).toBe(0);
    expect(computeSoldeBancaireEstime(100, ind)).toBe(65);

    const depCount = await prisma.depense.count({
      where: { noteFraisId: note.id },
    });
    expect(depCount).toBe(1);
    const paiements = await prisma.paiementCotisation.count({
      where: {
        Adherent: { User: { email: { endsWith: FIXTURE_EMAIL_SUFFIX } } },
      },
    });
    expect(paiements).toBe(0);
  });

  it("compensation une ligne + multilignes + mouvement postérieur refusé", async () => {
    await wipe();
    const dem = await createUser("dem-comp", "MEMBRE");
    const tres = await createUser("tres-comp", "TRESOR");
    const decideeAt = new Date(Date.now() - 3600_000);
    await ensureTypeDepenseFraisAvanceForTests(prisma, tres.id);
    const dette = await prisma.detteInitiale.create({
      data: {
        adherentId: dem.adherent!.id,
        annee: 2024,
        montant: 100,
        montantPaye: 0,
        createdBy: tres.id,
      },
    });
    const typeCm = await prisma.typeCotisationMensuelle.create({
      data: {
        nom: `nf-corr-ord-${randomUUID().slice(0, 6)}`,
        montant: 50,
        categorie: "ForfaitMensuel",
        createdBy: tres.id,
      },
    });
    const cm = await prisma.cotisationMensuelle.create({
      data: {
        periode: "2026-01",
        annee: 2026,
        mois: 1,
        typeCotisationId: typeCm.id,
        adherentId: dem.adherent!.id,
        montantAttendu: 50,
        montantPaye: 0,
        montantRestant: 50,
        dateEcheance: new Date("2026-01-31"),
        statut: "EnAttente",
        createdBy: tres.id,
      },
    });
    const note = await prisma.noteFrais.create({
      data: {
        adherentId: dem.adherent!.id,
        demandeurUserId: dem.id,
        libelle: "corr-comp",
        dateDepense: new Date(),
        montantDemande: "80.00",
        montantAccepte: "80.00",
        statut: "VALIDEE",
        soumiseAt: decideeAt,
        decideeAt,
        decideurUserId: tres.id,
        version: 1,
      },
    });
    await prisma.depense.create({
      data: {
        libelle: "d",
        montant: "80.00",
        dateDepense: note.dateDepense,
        statut: "Valide",
        origine: "FRAIS_AVANCE",
        noteFraisId: note.id,
        createdBy: tres.id,
        validatedBy: tres.id,
      },
    });
    const choix = await prisma.noteFraisChoixReglement.create({
      data: {
        noteFraisId: note.id,
        mode: "COMPENSATION",
        statut: "ACTIF",
        montantReference: "80.00",
        montantRemboursement: 0,
        montantCompensation: "80.00",
        montantRembourseUtilise: 0,
        montantCompensationUtilise: 0,
        choisiAt: new Date(),
        idempotencyKey: `choix-c-${note.id}`.slice(0, 64),
        Cibles: {
          create: [
            {
              typeCible: "DETTE_INITIALE",
              cibleId: dette.id,
              montantAutorise: "50.00",
              montantUtilise: 0,
              montantRestantSnapshot: "100.00",
              libelleSnapshot: "dette",
              rang: 1,
            },
            {
              typeCible: "COTISATION_MENSUELLE",
              cibleId: cm.id,
              montantAutorise: "30.00",
              montantUtilise: 0,
              montantRestantSnapshot: "50.00",
              libelleSnapshot: "cm",
              rang: 2,
            },
          ],
        },
      },
      include: { Cibles: true },
    });
    const { executeNoteFraisCompensation } = await import(
      "@/lib/services/frais-avances/note-frais-compensation-service"
    );
    const exec = await executeNoteFraisCompensation({
      actorUserId: tres.id,
      noteId: note.id,
      expectedNoteVersion: 1,
      idempotencyKey: `comp-${note.id}`.slice(0, 64),
      lignes: [
        {
          typeCible: "DETTE_INITIALE",
          cibleId: dette.id,
          montant: "50.00",
          rang: 1,
        },
        {
          typeCible: "COTISATION_MENSUELLE",
          cibleId: cm.id,
          montant: "30.00",
          rang: 2,
        },
      ],
      client: prisma as never,
    });
    expect(exec.success).toBe(true);
    if (!exec.success) return;
    const reglementId = exec.data.reglementId;
    const lignes = await prisma.noteFraisReglementLigne.findMany({
      where: { reglementId },
      orderBy: { rang: "asc" },
    });
    expect(lignes).toHaveLength(2);
    const avoirBefore = await prisma.avoir.findMany({
      where: { noteFraisReglementLigneId: { in: lignes.map((l) => l.id) } },
      orderBy: { id: "asc" },
    });
    expect(avoirBefore).toHaveLength(2);

    const noteV = await prisma.noteFrais.findUniqueOrThrow({
      where: { id: note.id },
    });
    const { correctNoteFraisReglement } = await import(
      "@/lib/services/frais-avances/note-frais-correction-service"
    );
    const partial = await correctNoteFraisReglement({
      actorUserId: tres.id,
      noteId: note.id,
      reglementId,
      expectedNoteVersion: noteV.version,
      idempotencyKey: `corr-c1-${note.id}`.slice(0, 64),
      type: "MONTANT_NEGATIF",
      montantACorriger: "20.00",
      allocations: [
        { reglementLigneId: lignes[0]!.id, montantARestaurer: "20.00" },
      ],
      motif: "erreur partielle dette",
      preuveKind: "JUSTIFICATIF_INTERNE",
      preuveRef: "JI-CORR-00020",
      client: prisma as never,
    });
    expect(partial.success).toBe(true);

    const detteMid = await prisma.detteInitiale.findUniqueOrThrow({
      where: { id: dette.id },
    });
    expect(Number(detteMid.montantPaye)).toBe(30);
    const avoirAfter = await prisma.avoir.findMany({
      where: { noteFraisReglementLigneId: { in: lignes.map((l) => l.id) } },
      orderBy: { id: "asc" },
    });
    expect(avoirAfter.map((a) => a.id)).toEqual(avoirBefore.map((a) => a.id));
    expect(avoirAfter.map((a) => a.montant.toFixed(2))).toEqual(
      avoirBefore.map((a) => a.montant.toFixed(2))
    );

    const noteV2 = await prisma.noteFrais.findUniqueOrThrow({
      where: { id: note.id },
    });
    const multi = await correctNoteFraisReglement({
      actorUserId: tres.id,
      noteId: note.id,
      reglementId,
      expectedNoteVersion: noteV2.version,
      idempotencyKey: `corr-c2-${note.id}`.slice(0, 64),
      type: "MONTANT_NEGATIF",
      montantACorriger: "40.00",
      allocations: [
        { reglementLigneId: lignes[0]!.id, montantARestaurer: "20.00" },
        { reglementLigneId: lignes[1]!.id, montantARestaurer: "20.00" },
      ],
      motif: "erreur multilignes",
      preuveKind: "AUTRE_TRACE",
      preuveRef: "AT-CORR-00040",
      client: prisma as never,
    });
    expect(multi.success).toBe(true);

    await prisma.detteInitiale.update({
      where: { id: dette.id },
      data: { montantPaye: { increment: 5 } },
    });
    const noteV3 = await prisma.noteFrais.findUniqueOrThrow({
      where: { id: note.id },
    });
    const refused = await correctNoteFraisReglement({
      actorUserId: tres.id,
      noteId: note.id,
      reglementId,
      expectedNoteVersion: noteV3.version,
      idempotencyKey: `corr-c3-${note.id}`.slice(0, 64),
      type: "MONTANT_NEGATIF",
      montantACorriger: "5.00",
      allocations: [
        { reglementLigneId: lignes[0]!.id, montantARestaurer: "5.00" },
      ],
      motif: "doit refuser",
      preuveKind: "PV_TRESORERIE",
      preuveRef: "PV-REFUSE-0005",
      client: prisma as never,
    });
    expect(refused.success).toBe(false);
    if (!refused.success) {
      expect(refused.code).toBe("CIBLE_MOUVEMENTS_POSTERIEURS");
    }

    const choixFinal = await prisma.noteFraisChoixReglement.findUniqueOrThrow({
      where: { id: choix.id },
    });
    expect(choixFinal.montantCompensationUtilise.toFixed(2)).toBe("20.00");
  });

  it("dépassement rollback ; replay ; conflit contenu ; RGPD refus historique", async () => {
    await wipe();
    const dem = await createUser("dem-rb", "MEMBRE");
    const tres = await createUser("tres-rb", "TRESOR");
    const { note, reglementId } = await seedRemb({
      dem,
      tres,
      montant: "25.00",
    });
    const { correctNoteFraisReglement } = await import(
      "@/lib/services/frais-avances/note-frais-correction-service"
    );
    const over = await correctNoteFraisReglement({
      actorUserId: tres.id,
      noteId: note.id,
      reglementId,
      expectedNoteVersion: note.version,
      idempotencyKey: `corr-over-${note.id}`.slice(0, 64),
      type: "MONTANT_NEGATIF",
      montantACorriger: "30.00",
      motif: "trop",
      preuveKind: "PV_TRESORERIE",
      preuveRef: "PV-OVER-00030",
      client: prisma as never,
    });
    expect(over.success).toBe(false);
    expect(
      await prisma.noteFraisReglementCorrection.count({
        where: { reglementId },
      })
    ).toBe(0);

    const ok = await correctNoteFraisReglement({
      actorUserId: tres.id,
      noteId: note.id,
      reglementId,
      expectedNoteVersion: note.version,
      idempotencyKey: `corr-ok-${note.id}`.slice(0, 64),
      type: "MONTANT_NEGATIF",
      montantACorriger: "5.00",
      motif: "ok",
      preuveKind: "PV_TRESORERIE",
      preuveRef: "PV-OKAY-00005",
      client: prisma as never,
    });
    expect(ok.success).toBe(true);
    const replay = await correctNoteFraisReglement({
      actorUserId: tres.id,
      noteId: note.id,
      reglementId,
      expectedNoteVersion: note.version + 10,
      idempotencyKey: `corr-ok-${note.id}`.slice(0, 64),
      type: "MONTANT_NEGATIF",
      montantACorriger: "5.00",
      motif: "ok",
      preuveKind: "PV_TRESORERIE",
      preuveRef: "PV-OKAY-00005",
      client: prisma as never,
    });
    expect(replay.success).toBe(true);
    if (replay.success) expect(replay.data.alreadyCorrected).toBe(true);

    const conflict = await correctNoteFraisReglement({
      actorUserId: tres.id,
      noteId: note.id,
      reglementId,
      expectedNoteVersion: 99,
      idempotencyKey: `corr-ok-${note.id}`.slice(0, 64),
      type: "MONTANT_NEGATIF",
      montantACorriger: "6.00",
      motif: "autre",
      preuveKind: "PV_TRESORERIE",
      preuveRef: "PV-OKAY-00006",
      client: prisma as never,
    });
    expect(conflict.success).toBe(false);
    if (!conflict.success) expect(conflict.code).toBe("IDEMPOTENCY_CONFLICT");

    const { archiveSubmittedNotesInTransaction } = await import(
      "@/lib/services/frais-avances/note-frais-archive-service"
    );
    await prisma.$transaction(async (tx) => {
      await archiveSubmittedNotesInTransaction(tx as never, [note.id], {
        status: "validated_injected",
        injected: {
          durationMs: 365 * 24 * 3600 * 1000,
          startsAt: "archivedAt",
        },
      });
    });
    expect(await prisma.noteFrais.count({ where: { id: note.id } })).toBe(0);
    expect(
      await prisma.noteFraisJournalFinancierEvenement.count()
    ).toBeGreaterThan(0);
    expect(await prisma.noteFraisArchive.count()).toBeGreaterThan(0);
  });

  it("rollback afterNotifyOutbox ; concurrence déterministe", async () => {
    await wipe();
    const dem = await createUser("dem-conc", "MEMBRE");
    const tres = await createUser("tres-conc", "TRESOR");
    const { note, reglementId } = await seedRemb({
      dem,
      tres,
      montant: "60.00",
    });
    const { correctNoteFraisReglement } = await import(
      "@/lib/services/frais-avances/note-frais-correction-service"
    );
    const rolled = await correctNoteFraisReglement({
      actorUserId: tres.id,
      noteId: note.id,
      reglementId,
      expectedNoteVersion: note.version,
      idempotencyKey: `corr-roll-${note.id}`.slice(0, 64),
      type: "MONTANT_NEGATIF",
      montantACorriger: "10.00",
      motif: "rollback test",
      preuveKind: "EMAIL_TRACE",
      preuveRef: "TRACE-ROLL-0010",
      client: prisma as never,
      afterNotifyOutbox: async () => {
        throw new Error("force-rollback");
      },
    });
    expect(rolled.success).toBe(false);
    expect(
      await prisma.noteFraisReglementCorrection.count({
        where: { reglementId },
      })
    ).toBe(0);
    expect(
      await prisma.noteFraisOutboxEvent.count({
        where: { noteFraisId: note.id, kind: "CORRECTION_MONTANT_NEGATIF" },
      })
    ).toBe(0);

    const n = await prisma.noteFrais.findUniqueOrThrow({
      where: { id: note.id },
    });
    const a = correctNoteFraisReglement({
      actorUserId: tres.id,
      noteId: note.id,
      reglementId,
      expectedNoteVersion: n.version,
      idempotencyKey: `corr-race-a-${note.id}`.slice(0, 64),
      type: "MONTANT_NEGATIF",
      montantACorriger: "20.00",
      motif: "race a",
      preuveKind: "PV_TRESORERIE",
      preuveRef: "PV-RACE-A-0020",
      client: prisma as never,
    });
    const b = correctNoteFraisReglement({
      actorUserId: tres.id,
      noteId: note.id,
      reglementId,
      expectedNoteVersion: n.version,
      idempotencyKey: `corr-race-b-${note.id}`.slice(0, 64),
      type: "MONTANT_NEGATIF",
      montantACorriger: "25.00",
      motif: "race b",
      preuveKind: "PV_TRESORERIE",
      preuveRef: "PV-RACE-B-0025",
      client: prisma as never,
    });
    const [ra, rb] = await Promise.all([a, b]);
    const oks = [ra, rb].filter((r) => r.success);
    const fails = [ra, rb].filter((r) => !r.success);
    expect(oks.length).toBe(1);
    expect(fails.length).toBe(1);
    const choix = await prisma.noteFraisChoixReglement.findFirstOrThrow({
      where: { noteFraisId: note.id, statut: "ACTIF" },
    });
    expect(Number(choix.montantRembourseUtilise)).toBeGreaterThanOrEqual(15);
    expect(Number(choix.montantRembourseUtilise)).toBeLessThanOrEqual(40);
  });

  it("MIXTE : correction des deux enfants remb + comp", async () => {
    await wipe();
    const dem = await createUser("dem-mix", "MEMBRE");
    const tres = await createUser("tres-mix", "TRESOR");
    const comcpt = await createUser("com-mix", "COMCPT");
    const decideeAt = new Date(Date.now() - 3600_000);
    await ensureTypeDepenseFraisAvanceForTests(prisma, tres.id);
    const dette = await prisma.detteInitiale.create({
      data: {
        adherentId: dem.adherent!.id,
        annee: 2023,
        montant: 80,
        montantPaye: 0,
        createdBy: tres.id,
      },
    });
    const note = await prisma.noteFrais.create({
      data: {
        adherentId: dem.adherent!.id,
        demandeurUserId: dem.id,
        libelle: "corr-mixte",
        dateDepense: new Date(),
        montantDemande: "100.00",
        montantAccepte: "100.00",
        statut: "VALIDEE",
        soumiseAt: decideeAt,
        decideeAt,
        decideurUserId: tres.id,
        version: 3,
      },
    });
    await prisma.depense.create({
      data: {
        libelle: "d-mix",
        montant: "100.00",
        dateDepense: note.dateDepense,
        statut: "Valide",
        origine: "FRAIS_AVANCE",
        noteFraisId: note.id,
        createdBy: tres.id,
        validatedBy: tres.id,
      },
    });
    await prisma.noteFraisChoixReglement.create({
      data: {
        noteFraisId: note.id,
        mode: "MIXTE",
        statut: "ACTIF",
        montantReference: "100.00",
        montantRemboursement: "40.00",
        montantCompensation: "60.00",
        montantRembourseUtilise: 0,
        montantCompensationUtilise: 0,
        choisiAt: decideeAt,
        idempotencyKey: `choix-mix-${note.id}`.slice(0, 64),
        Cibles: {
          create: [
            {
              typeCible: "DETTE_INITIALE",
              cibleId: dette.id,
              montantAutorise: "60.00",
              montantUtilise: 0,
              montantRestantSnapshot: "80.00",
              libelleSnapshot: "dette-mix",
              rang: 1,
            },
          ],
        },
      },
    });
    const { executeNoteFraisReglementMixte } = await import(
      "@/lib/services/frais-avances/note-frais-mixte-service"
    );
    const mix = await executeNoteFraisReglementMixte({
      actorUserId: tres.id,
      noteId: note.id,
      expectedNoteVersion: 3,
      idempotencyKey: `mix-${note.id}`.slice(0, 64),
      montantRembourse: "40.00",
      moyen: "VIREMENT",
      reference: "MIX-CORR-REF",
      executeAt: new Date(decideeAt.getTime() + 60_000).toISOString(),
      lignesCompensation: [
        {
          typeCible: "DETTE_INITIALE",
          cibleId: dette.id,
          montant: "60.00",
          rang: 1,
        },
      ],
      client: prisma as never,
    });
    expect(mix.success).toBe(true);
    if (!mix.success) return;

    const enfants = await prisma.noteFraisReglement.findMany({
      where: { operationId: mix.data.operationId },
      orderBy: { type: "asc" },
    });
    expect(enfants).toHaveLength(2);
    const rembEnfant = enfants.find((e) => e.type === "REMBOURSEMENT")!;
    const compEnfant = enfants.find((e) => e.type === "COMPENSATION")!;
    const compLigne = await prisma.noteFraisReglementLigne.findFirstOrThrow({
      where: { reglementId: compEnfant.id },
    });

    const { correctNoteFraisReglement } = await import(
      "@/lib/services/frais-avances/note-frais-correction-service"
    );
    const noteV = await prisma.noteFrais.findUniqueOrThrow({
      where: { id: note.id },
    });
    const corrRemb = await correctNoteFraisReglement({
      actorUserId: tres.id,
      noteId: note.id,
      reglementId: rembEnfant.id,
      expectedNoteVersion: noteV.version,
      idempotencyKey: `corr-mix-r-${note.id}`.slice(0, 64),
      type: "MONTANT_NEGATIF",
      montantACorriger: "10.00",
      motif: "corr enfant remb",
      preuveKind: "PV_TRESORERIE",
      preuveRef: "PV-MIX-REMB-10",
      client: prisma as never,
    });
    expect(corrRemb.success).toBe(true);

    const noteV2 = await prisma.noteFrais.findUniqueOrThrow({
      where: { id: note.id },
    });
    const corrComp = await correctNoteFraisReglement({
      actorUserId: tres.id,
      noteId: note.id,
      reglementId: compEnfant.id,
      expectedNoteVersion: noteV2.version,
      idempotencyKey: `corr-mix-c-${note.id}`.slice(0, 64),
      type: "MONTANT_NEGATIF",
      montantACorriger: "15.00",
      allocations: [
        { reglementLigneId: compLigne.id, montantARestaurer: "15.00" },
      ],
      motif: "corr enfant comp",
      preuveKind: "JUSTIFICATIF_INTERNE",
      preuveRef: "JI-MIX-COMP-15",
      client: prisma as never,
    });
    expect(corrComp.success).toBe(true);

    const detteAfter = await prisma.detteInitiale.findUniqueOrThrow({
      where: { id: dette.id },
    });
    expect(detteAfter.montantPaye.toFixed(2)).toBe("45.00");

    const { getNoteFraisFinancialView } = await import(
      "@/lib/services/frais-avances/note-frais-financial-view-service"
    );
    const fin = await getNoteFraisFinancialView({
      userId: comcpt.id,
      noteId: note.id,
      client: prisma as never,
    });
    expect(fin.success).toBe(true);
    if (!fin.success) return;
    const rembDto = fin.data.remboursements.find((r) => r.id === rembEnfant.id)!;
    expect(rembDto.montantTotal).toBe("30.00");
    expect(rembDto.reference).toBeUndefined();
    expect(JSON.stringify(fin.data)).not.toMatch(/motif|preuve|acteur|MIX-CORR/i);
    const op = fin.data.operationsMixte?.[0];
    expect(op?.remboursement.montantTotal).toBe("30.00");
    expect(op?.compensation.montantTotal).toBe("45.00");
    expect(op?.remboursement.reference).toBeUndefined();
  });

  it("rollback PG si échec sur la 2e cible (beforeApplyInverse)", async () => {
    await wipe();
    const dem = await createUser("dem-inv2", "MEMBRE");
    const tres = await createUser("tres-inv2", "TRESOR");
    const decideeAt = new Date(Date.now() - 3600_000);
    await ensureTypeDepenseFraisAvanceForTests(prisma, tres.id);
    const dette = await prisma.detteInitiale.create({
      data: {
        adherentId: dem.adherent!.id,
        annee: 2022,
        montant: 100,
        montantPaye: 0,
        createdBy: tres.id,
      },
    });
    const typeCm = await prisma.typeCotisationMensuelle.create({
      data: {
        nom: `nf-corr-inv2-${randomUUID().slice(0, 6)}`,
        montant: 50,
        categorie: "ForfaitMensuel",
        createdBy: tres.id,
      },
    });
    const cm = await prisma.cotisationMensuelle.create({
      data: {
        periode: "2026-02",
        annee: 2026,
        mois: 2,
        typeCotisationId: typeCm.id,
        adherentId: dem.adherent!.id,
        montantAttendu: 50,
        montantPaye: 0,
        montantRestant: 50,
        dateEcheance: new Date("2026-02-28"),
        statut: "EnAttente",
        createdBy: tres.id,
      },
    });
    const note = await prisma.noteFrais.create({
      data: {
        adherentId: dem.adherent!.id,
        demandeurUserId: dem.id,
        libelle: "corr-inv2",
        dateDepense: new Date(),
        montantDemande: "80.00",
        montantAccepte: "80.00",
        statut: "VALIDEE",
        soumiseAt: decideeAt,
        decideeAt,
        decideurUserId: tres.id,
        version: 1,
      },
    });
    await prisma.depense.create({
      data: {
        libelle: "d",
        montant: "80.00",
        dateDepense: note.dateDepense,
        statut: "Valide",
        origine: "FRAIS_AVANCE",
        noteFraisId: note.id,
        createdBy: tres.id,
        validatedBy: tres.id,
      },
    });
    await prisma.noteFraisChoixReglement.create({
      data: {
        noteFraisId: note.id,
        mode: "COMPENSATION",
        statut: "ACTIF",
        montantReference: "80.00",
        montantRemboursement: 0,
        montantCompensation: "80.00",
        montantRembourseUtilise: 0,
        montantCompensationUtilise: 0,
        choisiAt: new Date(),
        idempotencyKey: `choix-inv2-${note.id}`.slice(0, 64),
        Cibles: {
          create: [
            {
              typeCible: "DETTE_INITIALE",
              cibleId: dette.id,
              montantAutorise: "50.00",
              montantUtilise: 0,
              montantRestantSnapshot: "100.00",
              libelleSnapshot: "dette",
              rang: 1,
            },
            {
              typeCible: "COTISATION_MENSUELLE",
              cibleId: cm.id,
              montantAutorise: "30.00",
              montantUtilise: 0,
              montantRestantSnapshot: "50.00",
              libelleSnapshot: "cm",
              rang: 2,
            },
          ],
        },
      },
    });
    const { executeNoteFraisCompensation } = await import(
      "@/lib/services/frais-avances/note-frais-compensation-service"
    );
    const exec = await executeNoteFraisCompensation({
      actorUserId: tres.id,
      noteId: note.id,
      expectedNoteVersion: 1,
      idempotencyKey: `comp-inv2-${note.id}`.slice(0, 64),
      lignes: [
        {
          typeCible: "DETTE_INITIALE",
          cibleId: dette.id,
          montant: "50.00",
          rang: 1,
        },
        {
          typeCible: "COTISATION_MENSUELLE",
          cibleId: cm.id,
          montant: "30.00",
          rang: 2,
        },
      ],
      client: prisma as never,
    });
    expect(exec.success).toBe(true);
    if (!exec.success) return;
    const reglementId = exec.data.reglementId;
    const lignes = await prisma.noteFraisReglementLigne.findMany({
      where: { reglementId },
      orderBy: { rang: "asc" },
    });
    const detteBefore = await prisma.detteInitiale.findUniqueOrThrow({
      where: { id: dette.id },
    });
    const cmBefore = await prisma.cotisationMensuelle.findUniqueOrThrow({
      where: { id: cm.id },
    });
    const ciblesBefore = await prisma.noteFraisChoixReglementCible.findMany({
      where: { Choix: { noteFraisId: note.id } },
      orderBy: { rang: "asc" },
    });

    const noteV = await prisma.noteFrais.findUniqueOrThrow({
      where: { id: note.id },
    });
    const { correctNoteFraisReglement } = await import(
      "@/lib/services/frais-avances/note-frais-correction-service"
    );
    const rolled = await correctNoteFraisReglement({
      actorUserId: tres.id,
      noteId: note.id,
      reglementId,
      expectedNoteVersion: noteV.version,
      idempotencyKey: `corr-inv2-${note.id}`.slice(0, 64),
      type: "MONTANT_NEGATIF",
      montantACorriger: "40.00",
      allocations: [
        { reglementLigneId: lignes[0]!.id, montantARestaurer: "20.00" },
        { reglementLigneId: lignes[1]!.id, montantARestaurer: "20.00" },
      ],
      motif: "force fail 2e cible",
      preuveKind: "AUTRE_TRACE",
      preuveRef: "AT-INV2-0040",
      client: prisma as never,
      beforeApplyInverse: async (index) => {
        if (index === 1) throw new Error("force-fail-second-cible");
      },
    });
    expect(rolled.success).toBe(false);
    expect(
      await prisma.noteFraisReglementCorrection.count({
        where: { reglementId },
      })
    ).toBe(0);
    expect(
      await prisma.noteFraisCorrectionInverseCible.count({
        where: { reglementLigneId: { in: lignes.map((l) => l.id) } },
      })
    ).toBe(0);

    const detteAfter = await prisma.detteInitiale.findUniqueOrThrow({
      where: { id: dette.id },
    });
    const cmAfter = await prisma.cotisationMensuelle.findUniqueOrThrow({
      where: { id: cm.id },
    });
    expect(detteAfter.montantPaye.toFixed(2)).toBe(
      detteBefore.montantPaye.toFixed(2)
    );
    expect(cmAfter.montantPaye.toFixed(2)).toBe(cmBefore.montantPaye.toFixed(2));
    const ciblesAfter = await prisma.noteFraisChoixReglementCible.findMany({
      where: { Choix: { noteFraisId: note.id } },
      orderBy: { rang: "asc" },
    });
    expect(ciblesAfter.map((c) => c.montantUtilise.toFixed(2))).toEqual(
      ciblesBefore.map((c) => c.montantUtilise.toFixed(2))
    );
  });

  it("actorUserId SetNull à la suppression de l'acteur", async () => {
    await wipe();
    const dem = await createUser("dem-sn", "MEMBRE");
    const tres = await createUser("tres-sn", "TRESOR");
    const actor = await createUser("actor-sn", "ADMIN");
    const { note, reglementId } = await seedRemb({
      dem,
      tres,
      montant: "20.00",
    });
    const { correctNoteFraisReglement } = await import(
      "@/lib/services/frais-avances/note-frais-correction-service"
    );
    const corr = await correctNoteFraisReglement({
      actorUserId: actor.id,
      noteId: note.id,
      reglementId,
      expectedNoteVersion: note.version,
      idempotencyKey: `corr-sn-${note.id}`.slice(0, 64),
      type: "REFERENCE",
      referenceApres: "VIR-SETNULL-001",
      motif: "acteur jetable",
      client: prisma as never,
    });
    expect(corr.success).toBe(true);
    if (!corr.success) return;
    const before = await prisma.noteFraisReglementCorrection.findUniqueOrThrow({
      where: { id: corr.data.correctionId },
    });
    expect(before.actorUserId).toBe(actor.id);

    await prisma.user.delete({ where: { id: actor.id } });
    const after = await prisma.noteFraisReglementCorrection.findUniqueOrThrow({
      where: { id: corr.data.correctionId },
    });
    expect(after.actorUserId).toBeNull();
    expect(after.motif).toBe("acteur jetable");
  });
});
