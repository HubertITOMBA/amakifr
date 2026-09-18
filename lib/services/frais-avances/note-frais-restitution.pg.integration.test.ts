/**
 * Tests PG — restitutions réelles notes de frais (lot 4.7).
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
  withRestantDuNotesFrais,
  withRestitutionsNotesFrais,
} from "@/lib/financial/synthese-charges";
import { computeEtatFinancierNoteFrais } from "@/lib/services/frais-avances/note-frais-remboursement-service";

const FIXTURE_EMAIL_SUFFIX = "@notes-frais-test.local";

describe("intégration PG restitutions notes-frais 4.7", () => {
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
        name: `nf-rest-${tag}`,
        role,
        status: "Actif",
        password: "x",
        adherent: {
          create: {
            firstname: "Rest",
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
        libelle: "rest-remb",
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
    await prisma.noteFraisChoixReglement.create({
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
      reference: "VIR-ORIG-REST",
      executeAt: new Date().toISOString(),
      client: prisma as never,
    });
    expect(exec.success).toBe(true);
    if (!exec.success) throw new Error("remb seed failed");
    const fresh = await prisma.noteFrais.findUniqueOrThrow({
      where: { id: note.id },
    });
    return { note: fresh, reglementId: exec.data.reglementId };
  }

  it("partielle puis totale ; état REGLEE → NON_REGLEE ; synthèse séparée", async () => {
    await wipe();
    const dem = await createUser("dem-pt", "MEMBRE");
    const tres = await createUser("tres-pt", "TRESOR");
    const { note, reglementId } = await seedRemb({
      dem,
      tres,
      montant: "50.00",
    });
    const { recordNoteFraisRestitution, aggregateRestitutionsMontant } =
      await import(
        "@/lib/services/frais-avances/note-frais-restitution-service"
      );
    const { aggregateCorrectionsMontantByReglementType } = await import(
      "@/lib/services/frais-avances/note-frais-correction-service"
    );

    const p1 = await recordNoteFraisRestitution({
      actorUserId: tres.id,
      noteId: note.id,
      reglementId,
      expectedNoteVersion: note.version,
      idempotencyKey: `rest-p1-${note.id}`.slice(0, 64),
      montant: "20.00",
      moyen: "VIREMENT",
      reference: "VIR-REST-20",
      dateRestitution: new Date().toISOString(),
      motif: "retour partiel",
      client: prisma as never,
    });
    expect(p1.success).toBe(true);

    const mid = await prisma.noteFraisChoixReglement.findFirstOrThrow({
      where: { noteFraisId: note.id, statut: "ACTIF" },
    });
    expect(mid.montantRembourseUtilise.toFixed(2)).toBe("30.00");
    const etatMid = computeEtatFinancierNoteFrais({
      montantAccepte: "50.00",
      montantRembourseUtilise: mid.montantRembourseUtilise,
      montantCompensationUtilise: 0,
    });
    expect(etatMid.etatFinancier).toBe("PARTIELLEMENT_REGLEE");

    const note2 = await prisma.noteFrais.findUniqueOrThrow({
      where: { id: note.id },
    });
    const p2 = await recordNoteFraisRestitution({
      actorUserId: tres.id,
      noteId: note.id,
      reglementId,
      expectedNoteVersion: note2.version,
      idempotencyKey: `rest-p2-${note.id}`.slice(0, 64),
      montant: "30.00",
      moyen: "ESPECES",
      reference: "CAISSE-REST-30",
      dateRestitution: new Date().toISOString(),
      motif: "retour solde",
      client: prisma as never,
    });
    expect(p2.success).toBe(true);

    const fin = await prisma.noteFraisChoixReglement.findFirstOrThrow({
      where: { noteFraisId: note.id, statut: "ACTIF" },
    });
    expect(fin.montantRembourseUtilise.toFixed(2)).toBe("0.00");
    const etatFin = computeEtatFinancierNoteFrais({
      montantAccepte: "50.00",
      montantRembourseUtilise: fin.montantRembourseUtilise,
      montantCompensationUtilise: 0,
    });
    expect(etatFin.etatFinancier).toBe("NON_REGLEE");

    const rembAgg = await prisma.noteFraisReglement.aggregate({
      where: { type: "REMBOURSEMENT", statut: "EXECUTE" },
      _sum: { montantTotal: true },
    });
    const corrAgg = await aggregateCorrectionsMontantByReglementType(
      prisma as never
    );
    const rembNet = new Prisma.Decimal(rembAgg._sum.montantTotal ?? 0)
      .plus(new Prisma.Decimal(corrAgg.remboursements))
      .toFixed(2);
    const restit = await aggregateRestitutionsMontant(prisma as never);
    expect(restit).toBe("50.00");
    const ind = withRestitutionsNotesFrais(
      withDecaissementsNotesFrais(
        withCompensationsNotesFrais(
          computeChargesFromDepensesValides([
            { montant: 50, origine: "FRAIS_AVANCE" },
          ]),
          "0.00"
        ),
        rembNet
      ),
      restit
    );
    expect(ind.decaissementsNotesFrais).toBe(50);
    expect(ind.restitutionsNotesFrais).toBe(50);
    expect(computeSoldeBancaireEstime(200, ind)).toBe(200);

    const reg = await prisma.noteFraisReglement.findUniqueOrThrow({
      where: { id: reglementId },
      include: { Lignes: { orderBy: { rang: "asc" } } },
    });
    expect(reg.montantTotal.toFixed(2)).toBe("50.00");
    expect(reg.moyen).toBe("VIREMENT");
    expect(reg.reference).toBe("VIR-ORIG-REST");
    expect(reg.referenceNormalisee).toBe("VIR-ORIG-REST");
    expect(reg.executeAt).toBeInstanceOf(Date);
    const lignesSnapshot = reg.Lignes.map((l) => ({
      rang: l.rang,
      montant: l.montant.toFixed(2),
      typeLigne: l.typeLigne,
    }));
    expect(lignesSnapshot).toEqual([
      { rang: 1, montant: "50.00", typeLigne: "REMBOURSEMENT" },
    ]);

    expect(
      await prisma.depense.count({ where: { noteFraisId: note.id } })
    ).toBe(1);
    expect(await prisma.paiementCotisation.count()).toBe(0);
    expect(await prisma.avoir.count()).toBe(0);
    expect(
      await prisma.utilisationAvoir.count({
        where: { noteFraisReglementLigneId: { not: null } },
      })
    ).toBe(0);
    expect(
      await prisma.noteFraisReglementCorrection.count({
        where: { reglementId },
      })
    ).toBe(0);
  });

  it("correction puis restitution ; restitution puis correction ; trop grande → rollback", async () => {
    await wipe();
    const dem = await createUser("dem-cx", "MEMBRE");
    const tres = await createUser("tres-cx", "TRESOR");
    const { note, reglementId } = await seedRemb({
      dem,
      tres,
      montant: "100.00",
    });
    const { correctNoteFraisReglement } = await import(
      "@/lib/services/frais-avances/note-frais-correction-service"
    );
    const { recordNoteFraisRestitution } = await import(
      "@/lib/services/frais-avances/note-frais-restitution-service"
    );

    const corr = await correctNoteFraisReglement({
      actorUserId: tres.id,
      noteId: note.id,
      reglementId,
      expectedNoteVersion: note.version,
      idempotencyKey: `corr-pre-${note.id}`.slice(0, 64),
      type: "MONTANT_NEGATIF",
      montantACorriger: "20.00",
      motif: "erreur saisie",
      preuveKind: "PV_TRESORERIE",
      preuveRef: "PV-CORR-0020",
      client: prisma as never,
    });
    expect(corr.success).toBe(true);

    const n2 = await prisma.noteFrais.findUniqueOrThrow({
      where: { id: note.id },
    });
    const rest = await recordNoteFraisRestitution({
      actorUserId: tres.id,
      noteId: note.id,
      reglementId,
      expectedNoteVersion: n2.version,
      idempotencyKey: `rest-after-${note.id}`.slice(0, 64),
      montant: "30.00",
      moyen: "VIREMENT",
      reference: "VIR-AFTER-30",
      dateRestitution: new Date().toISOString(),
      motif: "retour",
      client: prisma as never,
    });
    expect(rest.success).toBe(true);

    // Scénario 2 : restitution puis correction autorisée / trop grande
    await wipe();
    const dem2 = await createUser("dem-cx2", "MEMBRE");
    const tres2 = await createUser("tres-cx2", "TRESOR");
    const seed2 = await seedRemb({ dem: dem2, tres: tres2, montant: "100.00" });
    const r1 = await recordNoteFraisRestitution({
      actorUserId: tres2.id,
      noteId: seed2.note.id,
      reglementId: seed2.reglementId,
      expectedNoteVersion: seed2.note.version,
      idempotencyKey: `rest-first-${seed2.note.id}`.slice(0, 64),
      montant: "30.00",
      moyen: "VIREMENT",
      reference: "VIR-FIRST-30",
      dateRestitution: new Date().toISOString(),
      motif: "retour d'abord",
      client: prisma as never,
    });
    expect(r1.success).toBe(true);
    const nOk = await prisma.noteFrais.findUniqueOrThrow({
      where: { id: seed2.note.id },
    });
    const cOk = await correctNoteFraisReglement({
      actorUserId: tres2.id,
      noteId: seed2.note.id,
      reglementId: seed2.reglementId,
      expectedNoteVersion: nOk.version,
      idempotencyKey: `corr-ok-${seed2.note.id}`.slice(0, 64),
      type: "MONTANT_NEGATIF",
      montantACorriger: "50.00",
      motif: "corr dans limite",
      preuveKind: "PV_TRESORERIE",
      preuveRef: "PV-OK-0050",
      client: prisma as never,
    });
    expect(cOk.success).toBe(true);

    const nBad = await prisma.noteFrais.findUniqueOrThrow({
      where: { id: seed2.note.id },
    });
    const cBad = await correctNoteFraisReglement({
      actorUserId: tres2.id,
      noteId: seed2.note.id,
      reglementId: seed2.reglementId,
      expectedNoteVersion: nBad.version,
      idempotencyKey: `corr-bad-${seed2.note.id}`.slice(0, 64),
      type: "MONTANT_NEGATIF",
      montantACorriger: "30.00",
      motif: "trop après restit",
      preuveKind: "PV_TRESORERIE",
      preuveRef: "PV-BAD-0030",
      client: prisma as never,
    });
    expect(cBad.success).toBe(false);
    expect(
      await prisma.noteFraisReglementCorrection.count({
        where: { reglementId: seed2.reglementId },
      })
    ).toBe(1);
  });

  it("enfant MIXTE OK ; compensation / parent refusés ; SetNull ; RGPD ; notif×1", async () => {
    await wipe();
    const dem = await createUser("dem-mx", "MEMBRE");
    const tres = await createUser("tres-mx", "TRESOR");
    const actor = await createUser("actor-mx", "ADMIN");
    const decideeAt = new Date(Date.now() - 3600_000);
    await ensureTypeDepenseFraisAvanceForTests(prisma, tres.id);
    const dette = await prisma.detteInitiale.create({
      data: {
        adherentId: dem.adherent!.id,
        annee: 2021,
        montant: 80,
        montantPaye: 0,
        createdBy: tres.id,
      },
    });
    const note = await prisma.noteFrais.create({
      data: {
        adherentId: dem.adherent!.id,
        demandeurUserId: dem.id,
        libelle: "rest-mixte",
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
        libelle: "d",
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
        idempotencyKey: `choix-mx-${note.id}`.slice(0, 64),
        Cibles: {
          create: [
            {
              typeCible: "DETTE_INITIALE",
              cibleId: dette.id,
              montantAutorise: "60.00",
              montantUtilise: 0,
              montantRestantSnapshot: "80.00",
              libelleSnapshot: "dette",
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
      reference: "MIX-REST-REF",
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
    });
    const remb = enfants.find((e) => e.type === "REMBOURSEMENT")!;
    const comp = enfants.find((e) => e.type === "COMPENSATION")!;
    const noteV = await prisma.noteFrais.findUniqueOrThrow({
      where: { id: note.id },
    });
    const { recordNoteFraisRestitution } = await import(
      "@/lib/services/frais-avances/note-frais-restitution-service"
    );

    const ok = await recordNoteFraisRestitution({
      actorUserId: actor.id,
      noteId: note.id,
      reglementId: remb.id,
      expectedNoteVersion: noteV.version,
      idempotencyKey: `rest-mx-${note.id}`.slice(0, 64),
      montant: "15.00",
      moyen: "VIREMENT",
      reference: "VIR-MX-15",
      dateRestitution: new Date().toISOString(),
      motif: "enfant mixte",
      client: prisma as never,
    });
    expect(ok.success).toBe(true);

    const noteV2 = await prisma.noteFrais.findUniqueOrThrow({
      where: { id: note.id },
    });
    const refuseComp = await recordNoteFraisRestitution({
      actorUserId: tres.id,
      noteId: note.id,
      reglementId: comp.id,
      expectedNoteVersion: noteV2.version,
      idempotencyKey: `rest-comp-${note.id}`.slice(0, 64),
      montant: "10.00",
      moyen: "VIREMENT",
      reference: "VIR-NO",
      dateRestitution: new Date().toISOString(),
      motif: "comp",
      client: prisma as never,
    });
    expect(refuseComp.success).toBe(false);

    const refuseParent = await recordNoteFraisRestitution({
      actorUserId: tres.id,
      noteId: note.id,
      reglementId: mix.data.operationId,
      expectedNoteVersion: noteV2.version,
      idempotencyKey: `rest-op-${note.id}`.slice(0, 64),
      montant: "10.00",
      moyen: "VIREMENT",
      reference: "VIR-NO2",
      dateRestitution: new Date().toISOString(),
      motif: "parent",
      client: prisma as never,
    });
    expect(refuseParent.success).toBe(false);

    expect(
      await prisma.noteFraisOutboxEvent.count({
        where: { noteFraisId: note.id, kind: "RESTITUTION_ENREGISTREE" },
      })
    ).toBe(1);

    if (!ok.success) return;
    await prisma.user.delete({ where: { id: actor.id } });
    const after = await prisma.noteFraisRestitution.findUniqueOrThrow({
      where: { id: ok.data.restitutionId },
    });
    expect(after.actorUserId).toBeNull();

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
  });

  it("concurrence deux restitutions ; rollback afterNotify ; restantDu global", async () => {
    await wipe();
    const dem = await createUser("dem-race", "MEMBRE");
    const tres = await createUser("tres-race", "TRESOR");
    const { note, reglementId } = await seedRemb({
      dem,
      tres,
      montant: "60.00",
    });
    const { recordNoteFraisRestitution, computeRestantDuNotesFraisGlobal } =
      await import(
        "@/lib/services/frais-avances/note-frais-restitution-service"
      );

    const rolled = await recordNoteFraisRestitution({
      actorUserId: tres.id,
      noteId: note.id,
      reglementId,
      expectedNoteVersion: note.version,
      idempotencyKey: `rest-roll-${note.id}`.slice(0, 64),
      montant: "10.00",
      moyen: "VIREMENT",
      reference: "VIR-ROLL-10",
      dateRestitution: new Date().toISOString(),
      motif: "rollback notif",
      client: prisma as never,
      afterNotifyOutbox: async () => {
        throw new Error("force-rollback");
      },
    });
    expect(rolled.success).toBe(false);
    expect(
      await prisma.noteFraisRestitution.count({ where: { reglementId } })
    ).toBe(0);

    const n = await prisma.noteFrais.findUniqueOrThrow({
      where: { id: note.id },
    });
    const a = recordNoteFraisRestitution({
      actorUserId: tres.id,
      noteId: note.id,
      reglementId,
      expectedNoteVersion: n.version,
      idempotencyKey: `rest-a-${note.id}`.slice(0, 64),
      montant: "25.00",
      moyen: "VIREMENT",
      reference: "VIR-A-25",
      dateRestitution: new Date().toISOString(),
      motif: "race a",
      client: prisma as never,
    });
    const b = recordNoteFraisRestitution({
      actorUserId: tres.id,
      noteId: note.id,
      reglementId,
      expectedNoteVersion: n.version,
      idempotencyKey: `rest-b-${note.id}`.slice(0, 64),
      montant: "30.00",
      moyen: "VIREMENT",
      reference: "VIR-B-30",
      dateRestitution: new Date().toISOString(),
      motif: "race b",
      client: prisma as never,
    });
    const [ra, rb] = await Promise.all([a, b]);
    expect([ra, rb].filter((r) => r.success)).toHaveLength(1);
    expect([ra, rb].filter((r) => !r.success)).toHaveLength(1);

    const restant = await computeRestantDuNotesFraisGlobal(prisma as never);
    const ind = withRestantDuNotesFrais(
      computeChargesFromDepensesValides([]),
      restant
    );
    expect(ind.restantDuNotesFrais).toBeGreaterThan(0);
  });

  it("idempotence replay / conflit ; rollback afterRestitutionInsert", async () => {
    await wipe();
    const dem = await createUser("dem-idem", "MEMBRE");
    const tres = await createUser("tres-idem", "TRESOR");
    const { note, reglementId } = await seedRemb({
      dem,
      tres,
      montant: "80.00",
    });
    const { recordNoteFraisRestitution } = await import(
      "@/lib/services/frais-avances/note-frais-restitution-service"
    );
    const key = `rest-idem-${note.id}`.slice(0, 64);
    const dateIso = new Date().toISOString();
    const payload = {
      actorUserId: tres.id,
      noteId: note.id,
      reglementId,
      expectedNoteVersion: note.version,
      idempotencyKey: key,
      montant: "25.00",
      moyen: "VIREMENT" as const,
      reference: "VIR-IDEM-25",
      dateRestitution: dateIso,
      motif: "idempotent",
      client: prisma as never,
    };

    const fresh = await recordNoteFraisRestitution(payload);
    expect(fresh.success).toBe(true);
    if (!fresh.success) return;

    const afterFresh = await prisma.noteFrais.findUniqueOrThrow({
      where: { id: note.id },
    });
    const choixFresh = await prisma.noteFraisChoixReglement.findFirstOrThrow({
      where: { noteFraisId: note.id, statut: "ACTIF" },
    });
    const restitCount = await prisma.noteFraisRestitution.count({
      where: { reglementId },
    });
    const notifCount = await prisma.notification.count({
      where: {
        userId: dem.id,
        titre: "Restitution enregistrée",
      },
    });
    const outboxCount = await prisma.noteFraisOutboxEvent.count({
      where: { noteFraisId: note.id, kind: "RESTITUTION_ENREGISTREE" },
    });

    const replay = await recordNoteFraisRestitution({
      ...payload,
      expectedNoteVersion: afterFresh.version + 10,
    });
    expect(replay.success).toBe(true);
    if (replay.success) {
      expect(replay.data.alreadyRestituted).toBe(true);
      expect(replay.data.version).toBe(afterFresh.version);
    }
    expect(
      await prisma.noteFraisRestitution.count({ where: { reglementId } })
    ).toBe(restitCount);
    expect(
      (
        await prisma.noteFrais.findUniqueOrThrow({ where: { id: note.id } })
      ).version
    ).toBe(afterFresh.version);
    expect(
      (
        await prisma.noteFraisChoixReglement.findFirstOrThrow({
          where: { noteFraisId: note.id, statut: "ACTIF" },
        })
      ).montantRembourseUtilise.toFixed(2)
    ).toBe(choixFresh.montantRembourseUtilise.toFixed(2));
    expect(
      await prisma.notification.count({
        where: { userId: dem.id, titre: "Restitution enregistrée" },
      })
    ).toBe(notifCount);
    expect(
      await prisma.noteFraisOutboxEvent.count({
        where: { noteFraisId: note.id, kind: "RESTITUTION_ENREGISTREE" },
      })
    ).toBe(outboxCount);

    const conflict = await recordNoteFraisRestitution({
      ...payload,
      montant: "30.00",
      expectedNoteVersion: afterFresh.version,
    });
    expect(conflict.success).toBe(false);
    if (!conflict.success) expect(conflict.code).toBe("IDEMPOTENCY_CONFLICT");

    // Rollback après insert
    await wipe();
    const dem2 = await createUser("dem-rolli", "MEMBRE");
    const tres2 = await createUser("tres-rolli", "TRESOR");
    const seed2 = await seedRemb({ dem: dem2, tres: tres2, montant: "70.00" });
    const beforeChoix = await prisma.noteFraisChoixReglement.findFirstOrThrow({
      where: { noteFraisId: seed2.note.id, statut: "ACTIF" },
    });
    const beforeVersion = seed2.note.version;
    const beforeEtat = computeEtatFinancierNoteFrais({
      montantAccepte: "70.00",
      montantRembourseUtilise: beforeChoix.montantRembourseUtilise,
      montantCompensationUtilise: 0,
    });
    const rolled = await recordNoteFraisRestitution({
      actorUserId: tres2.id,
      noteId: seed2.note.id,
      reglementId: seed2.reglementId,
      expectedNoteVersion: seed2.note.version,
      idempotencyKey: `rest-insroll-${seed2.note.id}`.slice(0, 64),
      montant: "15.00",
      moyen: "VIREMENT",
      reference: "VIR-INS-ROLL",
      dateRestitution: new Date().toISOString(),
      motif: "rollback insert",
      client: prisma as never,
      afterRestitutionInsert: async () => {
        throw new Error("force-rollback-insert");
      },
    });
    expect(rolled.success).toBe(false);
    expect(
      await prisma.noteFraisRestitution.count({
        where: { reglementId: seed2.reglementId },
      })
    ).toBe(0);
    const afterChoix = await prisma.noteFraisChoixReglement.findFirstOrThrow({
      where: { noteFraisId: seed2.note.id, statut: "ACTIF" },
    });
    expect(afterChoix.montantRembourseUtilise.toFixed(2)).toBe(
      beforeChoix.montantRembourseUtilise.toFixed(2)
    );
    expect(
      (await prisma.noteFrais.findUniqueOrThrow({ where: { id: seed2.note.id } }))
        .version
    ).toBe(beforeVersion);
    expect(
      await prisma.notification.count({
        where: { userId: dem2.id, titre: "Restitution enregistrée" },
      })
    ).toBe(0);
    expect(
      await prisma.noteFraisOutboxEvent.count({
        where: {
          noteFraisId: seed2.note.id,
          kind: "RESTITUTION_ENREGISTREE",
        },
      })
    ).toBe(0);
    const afterEtat = computeEtatFinancierNoteFrais({
      montantAccepte: "70.00",
      montantRembourseUtilise: afterChoix.montantRembourseUtilise,
      montantCompensationUtilise: 0,
    });
    expect(afterEtat.etatFinancier).toBe(beforeEtat.etatFinancier);
  });

  it("concurrence déterministe restitution vs correction (2 ordres)", async () => {
    const { recordNoteFraisRestitution } = await import(
      "@/lib/services/frais-avances/note-frais-restitution-service"
    );
    const { correctNoteFraisReglement } = await import(
      "@/lib/services/frais-avances/note-frais-correction-service"
    );

    // A — restitution détient le verrou ; correction bloquée puis revalide le plafond
    await wipe();
    const demA = await createUser("dem-raceA", "MEMBRE");
    const tresA = await createUser("tres-raceA", "TRESOR");
    const seedA = await seedRemb({ dem: demA, tres: tresA, montant: "100.00" });
    const regBeforeA = await prisma.noteFraisReglement.findUniqueOrThrow({
      where: { id: seedA.reglementId },
    });

    let releaseHoldA!: () => void;
    const holdA = new Promise<void>((r) => {
      releaseHoldA = r;
    });
    let signalLockedA!: () => void;
    const lockedA = new Promise<void>((r) => {
      signalLockedA = r;
    });

    const restA = recordNoteFraisRestitution({
      actorUserId: tresA.id,
      noteId: seedA.note.id,
      reglementId: seedA.reglementId,
      expectedNoteVersion: seedA.note.version,
      idempotencyKey: `rest-win-${seedA.note.id}`.slice(0, 64),
      montant: "60.00",
      moyen: "VIREMENT",
      reference: "VIR-WIN-60",
      dateRestitution: new Date().toISOString(),
      motif: "restit gagne",
      client: prisma as never,
      afterDemandeurLock: async () => {
        signalLockedA();
        await holdA;
      },
    });
    await lockedA;
    const corrA = correctNoteFraisReglement({
      actorUserId: tresA.id,
      noteId: seedA.note.id,
      reglementId: seedA.reglementId,
      expectedNoteVersion: seedA.note.version,
      idempotencyKey: `corr-lose-${seedA.note.id}`.slice(0, 64),
      type: "MONTANT_NEGATIF",
      montantACorriger: "50.00",
      motif: "corr après restit",
      preuveKind: "PV_TRESORERIE",
      preuveRef: "PV-LOSE-0050",
      client: prisma as never,
    });
    await new Promise((r) => setTimeout(r, 80));
    releaseHoldA();
    const [rRestA, rCorrA] = await Promise.all([restA, corrA]);

    expect(rRestA.success).toBe(true);
    expect(rCorrA.success).toBe(false);
    expect(
      await prisma.noteFraisRestitution.count({
        where: { reglementId: seedA.reglementId },
      })
    ).toBe(1);
    expect(
      await prisma.noteFraisReglementCorrection.count({
        where: { reglementId: seedA.reglementId },
      })
    ).toBe(0);
    const noteA = await prisma.noteFrais.findUniqueOrThrow({
      where: { id: seedA.note.id },
    });
    expect(noteA.version).toBe(seedA.note.version + 1);
    expect(
      await prisma.noteFraisOutboxEvent.count({
        where: {
          noteFraisId: seedA.note.id,
          kind: "RESTITUTION_ENREGISTREE",
        },
      })
    ).toBe(1);
    expect(
      await prisma.noteFraisOutboxEvent.count({
        where: {
          noteFraisId: seedA.note.id,
          kind: "CORRECTION_MONTANT_NEGATIF",
        },
      })
    ).toBe(0);
    const choixA = await prisma.noteFraisChoixReglement.findFirstOrThrow({
      where: { noteFraisId: seedA.note.id, statut: "ACTIF" },
    });
    expect(choixA.montantRembourseUtilise.toFixed(2)).toBe("40.00");
    const regAfterA = await prisma.noteFraisReglement.findUniqueOrThrow({
      where: { id: seedA.reglementId },
    });
    expect(regAfterA.montantTotal.toFixed(2)).toBe(
      regBeforeA.montantTotal.toFixed(2)
    );
    expect(regAfterA.reference).toBe(regBeforeA.reference);
    expect(regAfterA.moyen).toBe(regBeforeA.moyen);
    expect(regAfterA.executeAt.getTime()).toBe(regBeforeA.executeAt.getTime());

    // B — correction détient le verrou ; restitution bloquée puis revalide resteRestituable
    await wipe();
    const demB = await createUser("dem-raceB", "MEMBRE");
    const tresB = await createUser("tres-raceB", "TRESOR");
    const seedB = await seedRemb({ dem: demB, tres: tresB, montant: "100.00" });
    const regBeforeB = await prisma.noteFraisReglement.findUniqueOrThrow({
      where: { id: seedB.reglementId },
    });

    let releaseHoldB!: () => void;
    const holdB = new Promise<void>((r) => {
      releaseHoldB = r;
    });
    let signalLockedB!: () => void;
    const lockedB = new Promise<void>((r) => {
      signalLockedB = r;
    });

    const corrB = correctNoteFraisReglement({
      actorUserId: tresB.id,
      noteId: seedB.note.id,
      reglementId: seedB.reglementId,
      expectedNoteVersion: seedB.note.version,
      idempotencyKey: `corr-win-${seedB.note.id}`.slice(0, 64),
      type: "MONTANT_NEGATIF",
      montantACorriger: "50.00",
      motif: "corr gagne",
      preuveKind: "PV_TRESORERIE",
      preuveRef: "PV-WIN-0050",
      client: prisma as never,
      afterDemandeurLock: async () => {
        signalLockedB();
        await holdB;
      },
    });
    await lockedB;
    const restB = recordNoteFraisRestitution({
      actorUserId: tresB.id,
      noteId: seedB.note.id,
      reglementId: seedB.reglementId,
      expectedNoteVersion: seedB.note.version,
      idempotencyKey: `rest-lose-${seedB.note.id}`.slice(0, 64),
      montant: "60.00",
      moyen: "VIREMENT",
      reference: "VIR-LOSE-60",
      dateRestitution: new Date().toISOString(),
      motif: "restit après corr",
      client: prisma as never,
    });
    await new Promise((r) => setTimeout(r, 80));
    releaseHoldB();
    const [rCorrB, rRestB] = await Promise.all([corrB, restB]);

    expect(rCorrB.success).toBe(true);
    expect(rRestB.success).toBe(false);
    expect(
      await prisma.noteFraisReglementCorrection.count({
        where: { reglementId: seedB.reglementId },
      })
    ).toBe(1);
    expect(
      await prisma.noteFraisRestitution.count({
        where: { reglementId: seedB.reglementId },
      })
    ).toBe(0);
    const noteB = await prisma.noteFrais.findUniqueOrThrow({
      where: { id: seedB.note.id },
    });
    expect(noteB.version).toBe(seedB.note.version + 1);
    expect(
      await prisma.noteFraisOutboxEvent.count({
        where: {
          noteFraisId: seedB.note.id,
          kind: "CORRECTION_MONTANT_NEGATIF",
        },
      })
    ).toBe(1);
    expect(
      await prisma.noteFraisOutboxEvent.count({
        where: {
          noteFraisId: seedB.note.id,
          kind: "RESTITUTION_ENREGISTREE",
        },
      })
    ).toBe(0);
    const choixB = await prisma.noteFraisChoixReglement.findFirstOrThrow({
      where: { noteFraisId: seedB.note.id, statut: "ACTIF" },
    });
    expect(choixB.montantRembourseUtilise.toFixed(2)).toBe("50.00");
    const regAfterB = await prisma.noteFraisReglement.findUniqueOrThrow({
      where: { id: seedB.reglementId },
    });
    expect(regAfterB.montantTotal.toFixed(2)).toBe(
      regBeforeB.montantTotal.toFixed(2)
    );
    expect(regAfterB.reference).toBe(regBeforeB.reference);
    expect(regAfterB.moyen).toBe(regBeforeB.moyen);
    expect(regAfterB.executeAt.getTime()).toBe(regBeforeB.executeAt.getTime());
  }, 90_000);
});
