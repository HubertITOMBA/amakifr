/**
 * Tests PG — annulation double validation notes de frais (lot 4.8).
 * Allowlist : 127.0.0.1:55432 / amaki_notes_frais_test / amaki_test.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PrismaClient, Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { resolveAuthorizedNotesFraisPgTestUrl } from "@/lib/frais-avances/pg-test-allowlist";
import { ensureTypeDepenseFraisAvanceForTests } from "@/lib/frais-avances/type-depense-frais-avance";
import {
  computeChargesFromDepensesValides,
  computeSoldeBancaireEstime,
  withCompensationsNotesFrais,
  withDecaissementsNotesFrais,
  withRestantDuNotesFrais,
} from "@/lib/financial/synthese-charges";
import { NOTES_FRAIS_FINANCIAL_HISTORY_ARCHIVE_REQUIRED } from "@/lib/services/frais-avances/note-frais-archive-service";
import { computeEtatFinancierNoteFrais } from "@/lib/services/frais-avances/note-frais-remboursement-service";
import { NOTES_FRAIS_ANNULATION_TTL_MS } from "@/lib/services/frais-avances/note-frais-annulation-service";

const FIXTURE_EMAIL_SUFFIX = "@notes-frais-test.local";
const DAY_MS = 24 * 60 * 60 * 1000;

describe("intégration PG annulation notes-frais 4.8", () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    process.env.NOTES_FRAIS_ENABLED = "true";
    vi.resetModules();
    const url = resolveAuthorizedNotesFraisPgTestUrl(process.env);
    prisma = new PrismaClient({ datasources: { db: { url } } });
    await prisma.$connect();
  }, 60_000);

  afterAll(async () => {
    if (!prisma) return;
    try {
      await wipe();
    } finally {
      await prisma.$disconnect();
    }
  });

  async function wipe() {
    await prisma.noteFraisAnnulationInverseCible.deleteMany({});
    await prisma.noteFraisCorrectionInverseCible.deleteMany({});
    await prisma.noteFraisReglementAnnulationDemande.deleteMany({});
    await prisma.noteFraisRestitution.deleteMany({});
    await prisma.noteFraisReglementCorrection.deleteMany({});
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
    await prisma.noteFraisReglementOperation.deleteMany({});
    await prisma.depense.deleteMany({ where: { noteFraisId: { not: null } } });
    await prisma.noteFraisChoixReglementCible.deleteMany({});
    await prisma.noteFraisChoixReglement.deleteMany({});
    await prisma.noteFraisDecision.deleteMany({});
    await prisma.noteFraisOutboxEvent.deleteMany({});
    await prisma.notification.deleteMany({
      where: { User: { email: { endsWith: FIXTURE_EMAIL_SUFFIX } } },
    });
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
      where: { nom: { startsWith: "nf-ann-" } },
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
    role: "ADMIN" | "TRESOR" | "MEMBRE" | "COMCPT" = "MEMBRE"
  ) {
    const id = randomUUID().replace(/-/g, "").slice(0, 24);
    return prisma.user.create({
      data: {
        id,
        email: `${tag}.${id}${FIXTURE_EMAIL_SUFFIX}`,
        name: `nf-ann-${tag}`,
        role,
        status: "Actif",
        password: "x",
        adherent: {
          create: {
            firstname: "Ann",
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
        libelle: "ann-remb",
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
      reference: "VIR-ORIG-ANN",
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

  async function seedComp(opts: {
    dem: Awaited<ReturnType<typeof createUser>>;
    tres: Awaited<ReturnType<typeof createUser>>;
    detteMontant?: number;
    cmMontant?: number;
  }) {
    const decideeAt = new Date(Date.now() - 3600_000);
    await ensureTypeDepenseFraisAvanceForTests(prisma, opts.tres.id);
    const detteAmt = opts.detteMontant ?? 50;
    const cmAmt = opts.cmMontant ?? 30;
    const total = detteAmt + cmAmt;
    const dette = await prisma.detteInitiale.create({
      data: {
        adherentId: opts.dem.adherent!.id,
        annee: 2024,
        montant: 100,
        montantPaye: 0,
        createdBy: opts.tres.id,
      },
    });
    const typeCm = await prisma.typeCotisationMensuelle.create({
      data: {
        nom: `nf-ann-ord-${randomUUID().slice(0, 6)}`,
        montant: cmAmt,
        categorie: "ForfaitMensuel",
        createdBy: opts.tres.id,
      },
    });
    const cm = await prisma.cotisationMensuelle.create({
      data: {
        periode: "2026-01",
        annee: 2026,
        mois: 1,
        typeCotisationId: typeCm.id,
        adherentId: opts.dem.adherent!.id,
        montantAttendu: cmAmt,
        montantPaye: 0,
        montantRestant: cmAmt,
        dateEcheance: new Date("2026-01-31"),
        statut: "EnAttente",
        createdBy: opts.tres.id,
      },
    });
    const note = await prisma.noteFrais.create({
      data: {
        adherentId: opts.dem.adherent!.id,
        demandeurUserId: opts.dem.id,
        libelle: "ann-comp",
        dateDepense: new Date(),
        montantDemande: String(total),
        montantAccepte: String(total),
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
        montant: String(total),
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
        mode: "COMPENSATION",
        statut: "ACTIF",
        montantReference: String(total),
        montantRemboursement: 0,
        montantCompensation: String(total),
        montantRembourseUtilise: 0,
        montantCompensationUtilise: 0,
        choisiAt: new Date(),
        idempotencyKey: `choix-c-${note.id}`.slice(0, 64),
        Cibles: {
          create: [
            {
              typeCible: "DETTE_INITIALE",
              cibleId: dette.id,
              montantAutorise: String(detteAmt),
              montantUtilise: 0,
              montantRestantSnapshot: "100.00",
              libelleSnapshot: "dette",
              rang: 1,
            },
            {
              typeCible: "COTISATION_MENSUELLE",
              cibleId: cm.id,
              montantAutorise: String(cmAmt),
              montantUtilise: 0,
              montantRestantSnapshot: String(cmAmt),
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
      actorUserId: opts.tres.id,
      noteId: note.id,
      expectedNoteVersion: 1,
      idempotencyKey: `comp-${note.id}`.slice(0, 64),
      lignes: [
        {
          typeCible: "DETTE_INITIALE",
          cibleId: dette.id,
          montant: String(detteAmt),
          rang: 1,
        },
        {
          typeCible: "COTISATION_MENSUELLE",
          cibleId: cm.id,
          montant: String(cmAmt),
          rang: 2,
        },
      ],
      client: prisma as never,
    });
    expect(exec.success).toBe(true);
    if (!exec.success) throw new Error("comp seed failed");
    const fresh = await prisma.noteFrais.findUniqueOrThrow({
      where: { id: note.id },
    });
    return {
      note: fresh,
      reglementId: exec.data.reglementId,
      dette,
      cm,
      detteAmt,
      cmAmt,
    };
  }

  async function seedMixte(opts: {
    dem: Awaited<ReturnType<typeof createUser>>;
    tres: Awaited<ReturnType<typeof createUser>>;
  }) {
    const decideeAt = new Date(Date.now() - 3600_000);
    await ensureTypeDepenseFraisAvanceForTests(prisma, opts.tres.id);
    const dette = await prisma.detteInitiale.create({
      data: {
        adherentId: opts.dem.adherent!.id,
        annee: 2021,
        montant: 80,
        montantPaye: 0,
        createdBy: opts.tres.id,
      },
    });
    const note = await prisma.noteFrais.create({
      data: {
        adherentId: opts.dem.adherent!.id,
        demandeurUserId: opts.dem.id,
        libelle: "ann-mixte",
        dateDepense: new Date(),
        montantDemande: "100.00",
        montantAccepte: "100.00",
        statut: "VALIDEE",
        soumiseAt: decideeAt,
        decideeAt,
        decideurUserId: opts.tres.id,
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
        createdBy: opts.tres.id,
        validatedBy: opts.tres.id,
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
      actorUserId: opts.tres.id,
      noteId: note.id,
      expectedNoteVersion: 3,
      idempotencyKey: `mix-${note.id}`.slice(0, 64),
      montantRembourse: "40.00",
      moyen: "VIREMENT",
      reference: "MIX-ANN-REF",
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
    if (!mix.success) throw new Error("mixte seed failed");
    const fresh = await prisma.noteFrais.findUniqueOrThrow({
      where: { id: note.id },
    });
    const enfants = await prisma.noteFraisReglement.findMany({
      where: { operationId: mix.data.operationId },
    });
    return {
      note: fresh,
      operationId: mix.data.operationId,
      remb: enfants.find((e) => e.type === "REMBOURSEMENT")!,
      comp: enfants.find((e) => e.type === "COMPENSATION")!,
      dette,
    };
  }

  it("demande / refus / expiration sans finance", async () => {
    await wipe();
    const dem = await createUser("dem-drf", "MEMBRE");
    const tresReq = await createUser("tres-req-drf", "TRESOR");
    const tresConf = await createUser("tres-conf-drf", "TRESOR");
    const { note, reglementId } = await seedRemb({
      dem,
      tres: tresReq,
      montant: "50.00",
    });
    const choixBefore = await prisma.noteFraisChoixReglement.findFirstOrThrow({
      where: { noteFraisId: note.id, statut: "ACTIF" },
    });
    const {
      requestNoteFraisReglementAnnulation,
      refuseNoteFraisReglementAnnulation,
      expirePendingCancellationRequests,
    } = await import(
      "@/lib/services/frais-avances/note-frais-annulation-service"
    );

    const t0 = new Date("2026-04-01T10:00:00.000Z");
    const req = await requestNoteFraisReglementAnnulation({
      actorUserId: tresReq.id,
      noteId: note.id,
      reglementId,
      idempotencyKey: `ann-req-${note.id}`.slice(0, 64),
      motif: "virement non crédité",
      preuveKind: "REJET_BANQUE",
      preuveRef: "BNQ-ANN-DRF01",
      clock: { now: () => t0 },
      client: prisma as never,
    });
    expect(req.success).toBe(true);
    if (!req.success) return;

    const choixMid = await prisma.noteFraisChoixReglement.findFirstOrThrow({
      where: { noteFraisId: note.id, statut: "ACTIF" },
    });
    expect(choixMid.montantRembourseUtilise.toFixed(2)).toBe(
      choixBefore.montantRembourseUtilise.toFixed(2)
    );
    const regMid = await prisma.noteFraisReglement.findUniqueOrThrow({
      where: { id: reglementId },
    });
    expect(regMid.statut).toBe("EXECUTE");

    const refuse = await refuseNoteFraisReglementAnnulation({
      actorUserId: tresConf.id,
      noteId: note.id,
      demandeId: req.data.demandeId,
      decisionIdempotencyKey: `ann-ref-${note.id}`.slice(0, 64),
      decisionMotif: "preuve insuffisante",
      clock: { now: () => new Date(t0.getTime() + DAY_MS) },
      client: prisma as never,
    });
    expect(refuse.success).toBe(true);
    if (refuse.success) expect(refuse.data.statut).toBe("REFUSEE");

    const req2 = await requestNoteFraisReglementAnnulation({
      actorUserId: tresReq.id,
      noteId: note.id,
      reglementId,
      idempotencyKey: `ann-req2-${note.id}`.slice(0, 64),
      motif: "deuxième demande",
      preuveKind: "ANNULATION_VIREMENT",
      preuveRef: "BNQ-ANN-DRF02",
      clock: { now: () => new Date(t0.getTime() + 2 * DAY_MS) },
      client: prisma as never,
    });
    expect(req2.success).toBe(true);
    if (!req2.success) return;

    const expiresAt = new Date(
      new Date(t0.getTime() + 2 * DAY_MS).getTime() + NOTES_FRAIS_ANNULATION_TTL_MS
    );
    const j29 = new Date(expiresAt.getTime() - DAY_MS);
    expect(
      await expirePendingCancellationRequests({
        now: j29,
        reglementId,
        client: prisma as never,
      })
    ).toBe(0);
    const still = await prisma.noteFraisReglementAnnulationDemande.findUniqueOrThrow({
      where: { id: req2.data.demandeId },
    });
    expect(still.statut).toBe("DEMANDEE");

    expect(
      await expirePendingCancellationRequests({
        now: expiresAt,
        reglementId,
        client: prisma as never,
      })
    ).toBe(1);
    const expired = await prisma.noteFraisReglementAnnulationDemande.findUniqueOrThrow({
      where: { id: req2.data.demandeId },
    });
    expect(expired.statut).toBe("EXPIREE");

    const choixFin = await prisma.noteFraisChoixReglement.findFirstOrThrow({
      where: { noteFraisId: note.id, statut: "ACTIF" },
    });
    expect(choixFin.montantRembourseUtilise.toFixed(2)).toBe(
      choixBefore.montantRembourseUtilise.toFixed(2)
    );
    expect(
      (
        await prisma.noteFraisReglement.findUniqueOrThrow({
          where: { id: reglementId },
        })
      ).statut
    ).toBe("EXECUTE");
  });

  it("confirm remb / comp / MIXTE parent ; enfant MIXTE refusé ; compteurs / synthèse ; Avoir/UA immuables ; zéro PaiementCotisation", async () => {
    await wipe();
    const dem = await createUser("dem-ok", "MEMBRE");
    const tresReq = await createUser("tres-req-ok", "TRESOR");
    const tresConf = await createUser("tres-conf-ok", "ADMIN");

    // --- Remboursement ---
    const rembSeed = await seedRemb({ dem, tres: tresReq, montant: "40.00" });
    const {
      requestNoteFraisReglementAnnulation,
      confirmNoteFraisReglementAnnulation,
    } = await import(
      "@/lib/services/frais-avances/note-frais-annulation-service"
    );
    const reqR = await requestNoteFraisReglementAnnulation({
      actorUserId: tresReq.id,
      noteId: rembSeed.note.id,
      reglementId: rembSeed.reglementId,
      idempotencyKey: `ann-remb-${rembSeed.note.id}`.slice(0, 64),
      motif: "rejet banque",
      preuveKind: "REJET_BANQUE",
      preuveRef: "BNQ-OK-REMB01",
      client: prisma as never,
    });
    expect(reqR.success).toBe(true);
    if (!reqR.success) return;
    const confR = await confirmNoteFraisReglementAnnulation({
      actorUserId: tresConf.id,
      noteId: rembSeed.note.id,
      demandeId: reqR.data.demandeId,
      expectedNoteVersion: rembSeed.note.version,
      decisionIdempotencyKey: `ann-crmb-${rembSeed.note.id}`.slice(0, 64),
      attestation: true,
      client: prisma as never,
    });
    expect(confR.success).toBe(true);
    const choixR = await prisma.noteFraisChoixReglement.findFirstOrThrow({
      where: { noteFraisId: rembSeed.note.id, statut: "ACTIF" },
    });
    expect(choixR.montantRembourseUtilise.toFixed(2)).toBe("0.00");
    expect(
      (
        await prisma.noteFraisReglement.findUniqueOrThrow({
          where: { id: rembSeed.reglementId },
        })
      ).statut
    ).toBe("ANNULE");
    const etatR = computeEtatFinancierNoteFrais({
      montantAccepte: "40.00",
      montantRembourseUtilise: choixR.montantRembourseUtilise,
      montantCompensationUtilise: 0,
    });
    expect(etatR.etatFinancier).toBe("NON_REGLEE");

    // --- Compensation ---
    const dem2 = await createUser("dem-comp-ok", "MEMBRE");
    const compSeed = await seedComp({ dem: dem2, tres: tresReq });
    const lignesBefore = await prisma.noteFraisReglementLigne.findMany({
      where: { reglementId: compSeed.reglementId },
      orderBy: { rang: "asc" },
    });
    const avoirBefore = await prisma.avoir.findMany({
      where: {
        noteFraisReglementLigneId: { in: lignesBefore.map((l) => l.id) },
      },
      orderBy: { id: "asc" },
    });
    const uaBefore = await prisma.utilisationAvoir.findMany({
      where: {
        noteFraisReglementLigneId: { in: lignesBefore.map((l) => l.id) },
      },
      orderBy: { id: "asc" },
    });
    const detteBefore = await prisma.detteInitiale.findUniqueOrThrow({
      where: { id: compSeed.dette.id },
    });
    const cmBefore = await prisma.cotisationMensuelle.findUniqueOrThrow({
      where: { id: compSeed.cm.id },
    });

    const reqC = await requestNoteFraisReglementAnnulation({
      actorUserId: tresReq.id,
      noteId: compSeed.note.id,
      reglementId: compSeed.reglementId,
      idempotencyKey: `ann-comp-${compSeed.note.id}`.slice(0, 64),
      motif: "compensation erronée",
      preuveKind: "PV_TRESORERIE",
      preuveRef: "PV-ANN-COMP01",
      client: prisma as never,
    });
    expect(reqC.success).toBe(true);
    if (!reqC.success) return;
    const confC = await confirmNoteFraisReglementAnnulation({
      actorUserId: tresConf.id,
      noteId: compSeed.note.id,
      demandeId: reqC.data.demandeId,
      expectedNoteVersion: compSeed.note.version,
      decisionIdempotencyKey: `ann-ccomp-${compSeed.note.id}`.slice(0, 64),
      attestation: true,
      client: prisma as never,
    });
    expect(confC.success).toBe(true);

    const detteAfter = await prisma.detteInitiale.findUniqueOrThrow({
      where: { id: compSeed.dette.id },
    });
    const cmAfter = await prisma.cotisationMensuelle.findUniqueOrThrow({
      where: { id: compSeed.cm.id },
    });
    expect(Number(detteAfter.montantPaye)).toBe(
      Number(detteBefore.montantPaye) - compSeed.detteAmt
    );
    expect(Number(cmAfter.montantPaye)).toBe(
      Number(cmBefore.montantPaye) - compSeed.cmAmt
    );
    expect(cmAfter.statut).toBe("EnAttente");

    const avoirAfter = await prisma.avoir.findMany({
      where: {
        noteFraisReglementLigneId: { in: lignesBefore.map((l) => l.id) },
      },
      orderBy: { id: "asc" },
    });
    expect(avoirAfter.map((a) => a.id)).toEqual(avoirBefore.map((a) => a.id));
    expect(avoirAfter.map((a) => a.montant.toFixed(2))).toEqual(
      avoirBefore.map((a) => a.montant.toFixed(2))
    );
    const uaAfter = await prisma.utilisationAvoir.findMany({
      where: {
        noteFraisReglementLigneId: { in: lignesBefore.map((l) => l.id) },
      },
      orderBy: { id: "asc" },
    });
    expect(uaAfter.map((u) => u.id)).toEqual(uaBefore.map((u) => u.id));

    const choixC = await prisma.noteFraisChoixReglement.findFirstOrThrow({
      where: { noteFraisId: compSeed.note.id, statut: "ACTIF" },
    });
    expect(choixC.montantCompensationUtilise.toFixed(2)).toBe("0.00");
    expect(
      (
        await prisma.noteFraisReglement.findUniqueOrThrow({
          where: { id: compSeed.reglementId },
        })
      ).statut
    ).toBe("ANNULE");
    expect(
      await prisma.noteFraisAnnulationInverseCible.count({
        where: { demandeId: reqC.data.demandeId },
      })
    ).toBe(2);

    // --- MIXTE parent OK ; enfant refusé ---
    const dem3 = await createUser("dem-mx-ok", "MEMBRE");
    const mx = await seedMixte({ dem: dem3, tres: tresReq });
    const refuseEnfant = await requestNoteFraisReglementAnnulation({
      actorUserId: tresReq.id,
      noteId: mx.note.id,
      reglementId: mx.remb.id,
      idempotencyKey: `ann-enfant-${mx.note.id}`.slice(0, 64),
      motif: "enfant interdit",
      preuveKind: "REJET_BANQUE",
      preuveRef: "BNQ-ENFANT-01",
      client: prisma as never,
    });
    expect(refuseEnfant.success).toBe(false);
    if (!refuseEnfant.success)
      expect(refuseEnfant.code).toBe("MIXTE_PARENT_REQUIRED");

    const reqM = await requestNoteFraisReglementAnnulation({
      actorUserId: tresReq.id,
      noteId: mx.note.id,
      operationId: mx.operationId,
      idempotencyKey: `ann-mx-${mx.note.id}`.slice(0, 64),
      motif: "annul mixte parent",
      preuveKind: "ANNULATION_VIREMENT",
      preuveRef: "BNQ-MX-PARENT1",
      client: prisma as never,
    });
    expect(reqM.success).toBe(true);
    if (!reqM.success) return;
    const confM = await confirmNoteFraisReglementAnnulation({
      actorUserId: tresConf.id,
      noteId: mx.note.id,
      demandeId: reqM.data.demandeId,
      expectedNoteVersion: mx.note.version,
      decisionIdempotencyKey: `ann-cmx-${mx.note.id}`.slice(0, 64),
      attestation: true,
      client: prisma as never,
    });
    expect(confM.success).toBe(true);
    const op = await prisma.noteFraisReglementOperation.findUniqueOrThrow({
      where: { id: mx.operationId },
    });
    expect(op.statut).toBe("ANNULEE");
    const enfants = await prisma.noteFraisReglement.findMany({
      where: { operationId: mx.operationId },
    });
    expect(enfants.every((e) => e.statut === "ANNULE")).toBe(true);
    const choixM = await prisma.noteFraisChoixReglement.findFirstOrThrow({
      where: { noteFraisId: mx.note.id, statut: "ACTIF" },
    });
    expect(choixM.montantRembourseUtilise.toFixed(2)).toBe("0.00");
    expect(choixM.montantCompensationUtilise.toFixed(2)).toBe("0.00");

    // Synthèse : décaissements EXECUTE seulement ; solde neutre après annulation remb
    const rembAgg = await prisma.noteFraisReglement.aggregate({
      where: { type: "REMBOURSEMENT", statut: "EXECUTE" },
      _sum: { montantTotal: true },
    });
    const rembNet = new Prisma.Decimal(rembAgg._sum.montantTotal ?? 0).toFixed(2);
    const ind = withDecaissementsNotesFrais(
      withCompensationsNotesFrais(
        computeChargesFromDepensesValides([
          { montant: 40, origine: "FRAIS_AVANCE" },
          { montant: 80, origine: "FRAIS_AVANCE" },
          { montant: 100, origine: "FRAIS_AVANCE" },
        ]),
        "0.00"
      ),
      rembNet
    );
    expect(ind.decaissementsNotesFrais).toBe(0);
    expect(computeSoldeBancaireEstime(200, ind)).toBe(200);

    expect(
      await prisma.paiementCotisation.count({
        where: {
          Adherent: { User: { email: { endsWith: FIXTURE_EMAIL_SUFFIX } } },
        },
      })
    ).toBe(0);
  });

  it("mouvement postérieur ; rollback 2e cible ; corr/restit existante", async () => {
    await wipe();
    const dem = await createUser("dem-mv", "MEMBRE");
    const tresReq = await createUser("tres-req-mv", "TRESOR");
    const tresConf = await createUser("tres-conf-mv", "ADMIN");
    const {
      requestNoteFraisReglementAnnulation,
      confirmNoteFraisReglementAnnulation,
    } = await import(
      "@/lib/services/frais-avances/note-frais-annulation-service"
    );

    const comp = await seedComp({ dem, tres: tresReq });
    await prisma.detteInitiale.update({
      where: { id: comp.dette.id },
      data: { montantPaye: { decrement: 5 } },
    });
    const reqMv = await requestNoteFraisReglementAnnulation({
      actorUserId: tresReq.id,
      noteId: comp.note.id,
      reglementId: comp.reglementId,
      idempotencyKey: `ann-mv-${comp.note.id}`.slice(0, 64),
      motif: "après mouvement",
      preuveKind: "JUSTIFICATIF_INTERNE",
      preuveRef: "JI-ANN-MV-001",
      client: prisma as never,
    });
    expect(reqMv.success).toBe(true);
    if (!reqMv.success) return;
    const confMv = await confirmNoteFraisReglementAnnulation({
      actorUserId: tresConf.id,
      noteId: comp.note.id,
      demandeId: reqMv.data.demandeId,
      expectedNoteVersion: comp.note.version,
      decisionIdempotencyKey: `ann-cmv-${comp.note.id}`.slice(0, 64),
      attestation: true,
      client: prisma as never,
    });
    expect(confMv.success).toBe(false);
    if (!confMv.success) expect(confMv.code).toBe("CIBLE_MOUVEMENTS_POSTERIEURS");
    expect(
      (
        await prisma.noteFraisReglementAnnulationDemande.findUniqueOrThrow({
          where: { id: reqMv.data.demandeId },
        })
      ).statut
    ).toBe("DEMANDEE");

    // rollback 2e cible
    await wipe();
    const dem2 = await createUser("dem-rb2", "MEMBRE");
    const tresReq2 = await createUser("tres-req-rb2", "TRESOR");
    const tresConf2 = await createUser("tres-conf-rb2", "ADMIN");
    const comp2 = await seedComp({ dem: dem2, tres: tresReq2 });
    const reqRb = await requestNoteFraisReglementAnnulation({
      actorUserId: tresReq2.id,
      noteId: comp2.note.id,
      reglementId: comp2.reglementId,
      idempotencyKey: `ann-rb2-${comp2.note.id}`.slice(0, 64),
      motif: "rollback 2e",
      preuveKind: "PV_TRESORERIE",
      preuveRef: "PV-ANN-RB2-01",
      client: prisma as never,
    });
    expect(reqRb.success).toBe(true);
    if (!reqRb.success) return;
    const payeBefore = (
      await prisma.detteInitiale.findUniqueOrThrow({
        where: { id: comp2.dette.id },
      })
    ).montantPaye.toFixed(2);
    const rolled = await confirmNoteFraisReglementAnnulation({
      actorUserId: tresConf2.id,
      noteId: comp2.note.id,
      demandeId: reqRb.data.demandeId,
      expectedNoteVersion: comp2.note.version,
      decisionIdempotencyKey: `ann-crb2-${comp2.note.id}`.slice(0, 64),
      attestation: true,
      client: prisma as never,
      beforeApplyInverse: async (index) => {
        if (index === 1) throw new Error("force-rollback-2e");
      },
    });
    expect(rolled.success).toBe(false);
    expect(
      (
        await prisma.detteInitiale.findUniqueOrThrow({
          where: { id: comp2.dette.id },
        })
      ).montantPaye.toFixed(2)
    ).toBe(payeBefore);
    expect(
      (
        await prisma.noteFraisReglementAnnulationDemande.findUniqueOrThrow({
          where: { id: reqRb.data.demandeId },
        })
      ).statut
    ).toBe("DEMANDEE");
    expect(
      await prisma.noteFraisAnnulationInverseCible.count({
        where: { demandeId: reqRb.data.demandeId },
      })
    ).toBe(0);

    // corr / restit bloquent
    await wipe();
    const dem3 = await createUser("dem-cr", "MEMBRE");
    const tres = await createUser("tres-cr", "TRESOR");
    const remb = await seedRemb({ dem: dem3, tres, montant: "60.00" });
    const { correctNoteFraisReglement } = await import(
      "@/lib/services/frais-avances/note-frais-correction-service"
    );
    const corr = await correctNoteFraisReglement({
      actorUserId: tres.id,
      noteId: remb.note.id,
      reglementId: remb.reglementId,
      expectedNoteVersion: remb.note.version,
      idempotencyKey: `corr-blk-${remb.note.id}`.slice(0, 64),
      type: "REFERENCE",
      referenceApres: "VIR-CORR-BLK",
      motif: "typo",
      client: prisma as never,
    });
    expect(corr.success).toBe(true);
    const blkCorr = await requestNoteFraisReglementAnnulation({
      actorUserId: tres.id,
      noteId: remb.note.id,
      reglementId: remb.reglementId,
      idempotencyKey: `ann-blkc-${remb.note.id}`.slice(0, 64),
      motif: "blocked corr",
      preuveKind: "REJET_BANQUE",
      preuveRef: "BNQ-BLK-CORR1",
      client: prisma as never,
    });
    expect(blkCorr.success).toBe(false);
    if (!blkCorr.success)
      expect(blkCorr.code).toBe("REGLEMENT_HAS_CORRECTIONS");

    await wipe();
    const dem4 = await createUser("dem-rs", "MEMBRE");
    const tres2 = await createUser("tres-rs", "TRESOR");
    const remb2 = await seedRemb({ dem: dem4, tres: tres2, montant: "70.00" });
    const { recordNoteFraisRestitution } = await import(
      "@/lib/services/frais-avances/note-frais-restitution-service"
    );
    const rest = await recordNoteFraisRestitution({
      actorUserId: tres2.id,
      noteId: remb2.note.id,
      reglementId: remb2.reglementId,
      expectedNoteVersion: remb2.note.version,
      idempotencyKey: `rest-blk-${remb2.note.id}`.slice(0, 64),
      montant: "10.00",
      moyen: "VIREMENT",
      reference: "VIR-REST-BLK",
      dateRestitution: new Date().toISOString(),
      motif: "partiel",
      client: prisma as never,
    });
    expect(rest.success).toBe(true);
    const blkRest = await requestNoteFraisReglementAnnulation({
      actorUserId: tres2.id,
      noteId: remb2.note.id,
      reglementId: remb2.reglementId,
      idempotencyKey: `ann-blkr-${remb2.note.id}`.slice(0, 64),
      motif: "blocked restit",
      preuveKind: "REJET_BANQUE",
      preuveRef: "BNQ-BLK-REST1",
      client: prisma as never,
    });
    expect(blkRest.success).toBe(false);
    if (!blkRest.success)
      expect(blkRest.code).toBe("REGLEMENT_HAS_RESTITUTIONS");
  });

  it("même acteur request/confirm/refuse ; confirm vs expire ; deux confirms concurrentes", async () => {
    await wipe();
    const dem = await createUser("dem-act", "MEMBRE");
    const tresSame = await createUser("tres-same", "TRESOR");
    const tresOther = await createUser("tres-oth", "ADMIN");
    const { note, reglementId } = await seedRemb({
      dem,
      tres: tresSame,
      montant: "55.00",
    });
    const {
      requestNoteFraisReglementAnnulation,
      confirmNoteFraisReglementAnnulation,
      refuseNoteFraisReglementAnnulation,
      expirePendingCancellationRequests,
    } = await import(
      "@/lib/services/frais-avances/note-frais-annulation-service"
    );

    const req = await requestNoteFraisReglementAnnulation({
      actorUserId: tresSame.id,
      noteId: note.id,
      reglementId,
      idempotencyKey: `ann-same-${note.id}`.slice(0, 64),
      motif: "même acteur",
      preuveKind: "REJET_BANQUE",
      preuveRef: "BNQ-SAME-ACT1",
      client: prisma as never,
    });
    expect(req.success).toBe(true);
    if (!req.success) return;

    const sameConf = await confirmNoteFraisReglementAnnulation({
      actorUserId: tresSame.id,
      noteId: note.id,
      demandeId: req.data.demandeId,
      expectedNoteVersion: note.version,
      decisionIdempotencyKey: `ann-csame-${note.id}`.slice(0, 64),
      attestation: true,
      client: prisma as never,
    });
    expect(sameConf.success).toBe(false);
    if (!sameConf.success) {
      expect(sameConf.error).toMatch(/distinct|auteur de la demande/i);
    }

    const sameRef = await refuseNoteFraisReglementAnnulation({
      actorUserId: tresSame.id,
      noteId: note.id,
      demandeId: req.data.demandeId,
      decisionIdempotencyKey: `ann-rsame-${note.id}`.slice(0, 64),
      decisionMotif: "auto refus",
      client: prisma as never,
    });
    expect(sameRef.success).toBe(false);
    if (!sameRef.success) {
      expect(sameRef.error).toMatch(/distinct|auteur de la demande/i);
    }

    // confirm vs expire — ordre A : expire gagne
    await wipe();
    const demA = await createUser("dem-expa", "MEMBRE");
    const tresReqA = await createUser("tres-req-expa", "TRESOR");
    const tresConfA = await createUser("tres-conf-expa", "ADMIN");
    const seedA = await seedRemb({ dem: demA, tres: tresReqA, montant: "45.00" });
    const t0 = new Date("2026-05-01T08:00:00.000Z");
    const reqA = await requestNoteFraisReglementAnnulation({
      actorUserId: tresReqA.id,
      noteId: seedA.note.id,
      reglementId: seedA.reglementId,
      idempotencyKey: `ann-expa-${seedA.note.id}`.slice(0, 64),
      motif: "expire first",
      preuveKind: "REJET_BANQUE",
      preuveRef: "BNQ-EXP-A-001",
      clock: { now: () => t0 },
      client: prisma as never,
    });
    expect(reqA.success).toBe(true);
    if (!reqA.success) return;
    const expiresAt = new Date(t0.getTime() + NOTES_FRAIS_ANNULATION_TTL_MS);
    await expirePendingCancellationRequests({
      now: expiresAt,
      reglementId: seedA.reglementId,
      client: prisma as never,
    });
    const confAfterExp = await confirmNoteFraisReglementAnnulation({
      actorUserId: tresConfA.id,
      noteId: seedA.note.id,
      demandeId: reqA.data.demandeId,
      expectedNoteVersion: seedA.note.version,
      decisionIdempotencyKey: `ann-cexp-${seedA.note.id}`.slice(0, 64),
      attestation: true,
      clock: { now: () => expiresAt },
      client: prisma as never,
    });
    expect(confAfterExp.success).toBe(false);
    if (!confAfterExp.success)
      expect(confAfterExp.code).toBe("ANNULATION_EXPIRED");

    // confirm vs expire — ordre B : confirm avant frontière
    await wipe();
    const demB = await createUser("dem-expb", "MEMBRE");
    const tresReqB = await createUser("tres-req-expb", "TRESOR");
    const tresConfB = await createUser("tres-conf-expb", "ADMIN");
    const seedB = await seedRemb({ dem: demB, tres: tresReqB, montant: "48.00" });
    const t1 = new Date("2026-05-02T08:00:00.000Z");
    const reqB = await requestNoteFraisReglementAnnulation({
      actorUserId: tresReqB.id,
      noteId: seedB.note.id,
      reglementId: seedB.reglementId,
      idempotencyKey: `ann-expb-${seedB.note.id}`.slice(0, 64),
      motif: "confirm first",
      preuveKind: "REJET_BANQUE",
      preuveRef: "BNQ-EXP-B-001",
      clock: { now: () => t1 },
      client: prisma as never,
    });
    expect(reqB.success).toBe(true);
    if (!reqB.success) return;
    const j29 = new Date(t1.getTime() + NOTES_FRAIS_ANNULATION_TTL_MS - DAY_MS);
    const confB = await confirmNoteFraisReglementAnnulation({
      actorUserId: tresConfB.id,
      noteId: seedB.note.id,
      demandeId: reqB.data.demandeId,
      expectedNoteVersion: seedB.note.version,
      decisionIdempotencyKey: `ann-cexb-${seedB.note.id}`.slice(0, 64),
      attestation: true,
      clock: { now: () => j29 },
      client: prisma as never,
    });
    expect(confB.success).toBe(true);
    const expAfterConf = await expirePendingCancellationRequests({
      now: new Date(t1.getTime() + NOTES_FRAIS_ANNULATION_TTL_MS + DAY_MS),
      reglementId: seedB.reglementId,
      client: prisma as never,
    });
    expect(expAfterConf).toBe(0);
    expect(
      (
        await prisma.noteFraisReglementAnnulationDemande.findUniqueOrThrow({
          where: { id: reqB.data.demandeId },
        })
      ).statut
    ).toBe("CONFIRMEE");

    // deux confirms concurrentes
    await wipe();
    const demR = await createUser("dem-race", "MEMBRE");
    const tresReqR = await createUser("tres-req-race", "TRESOR");
    const conf1 = await createUser("tres-c1-race", "ADMIN");
    const conf2 = await createUser("tres-c2-race", "TRESOR");
    const seedR = await seedRemb({ dem: demR, tres: tresReqR, montant: "52.00" });
    const reqR = await requestNoteFraisReglementAnnulation({
      actorUserId: tresReqR.id,
      noteId: seedR.note.id,
      reglementId: seedR.reglementId,
      idempotencyKey: `ann-race-${seedR.note.id}`.slice(0, 64),
      motif: "race confirm",
      preuveKind: "REJET_BANQUE",
      preuveRef: "BNQ-RACE-001",
      client: prisma as never,
    });
    expect(reqR.success).toBe(true);
    if (!reqR.success) return;
    const [a, b] = await Promise.all([
      confirmNoteFraisReglementAnnulation({
        actorUserId: conf1.id,
        noteId: seedR.note.id,
        demandeId: reqR.data.demandeId,
        expectedNoteVersion: seedR.note.version,
        decisionIdempotencyKey: `ann-race-a-${seedR.note.id}`.slice(0, 64),
        attestation: true,
        client: prisma as never,
      }),
      confirmNoteFraisReglementAnnulation({
        actorUserId: conf2.id,
        noteId: seedR.note.id,
        demandeId: reqR.data.demandeId,
        expectedNoteVersion: seedR.note.version,
        decisionIdempotencyKey: `ann-race-b-${seedR.note.id}`.slice(0, 64),
        attestation: true,
        client: prisma as never,
      }),
    ]);
    const freshConfirms = [a, b].filter(
      (r) => r.success && r.data.alreadyDecided === false
    );
    expect(freshConfirms).toHaveLength(1);
    // L'autre : échec (claim perdu) OU succès alreadyDecided (lecture post-commit)
    expect(
      [a, b].filter(
        (r) =>
          !r.success || (r.success && r.data.alreadyDecided === true)
      )
    ).toHaveLength(1);
    expect(
      await prisma.noteFraisReglement.count({
        where: { id: seedR.reglementId, statut: "ANNULE" },
      })
    ).toBe(1);
    expect(
      (
        await prisma.noteFrais.findUniqueOrThrow({
          where: { id: seedR.note.id },
        })
      ).version
    ).toBe(seedR.note.version + 1);
  });

  it("replay / conflits ; rollback hooks claim / inversion / notif ; notifs uniques ; SetNull ; RGPD", async () => {
    await wipe();
    const dem = await createUser("dem-idem", "MEMBRE");
    const tresExec = await createUser("tres-exec-idem", "TRESOR");
    const tresReq = await createUser("tres-req-idem", "TRESOR");
    const tresConf = await createUser("tres-conf-idem", "ADMIN");
    const { note, reglementId } = await seedRemb({
      dem,
      tres: tresExec,
      montant: "65.00",
    });
    const {
      requestNoteFraisReglementAnnulation,
      confirmNoteFraisReglementAnnulation,
    } = await import(
      "@/lib/services/frais-avances/note-frais-annulation-service"
    );

    const key = `ann-idem-${note.id}`.slice(0, 64);
    const payload = {
      actorUserId: tresReq.id,
      noteId: note.id,
      reglementId,
      idempotencyKey: key,
      motif: "idempotent demande",
      preuveKind: "REJET_BANQUE" as const,
      preuveRef: "BNQ-IDEM-0001",
      client: prisma as never,
    };
    const fresh = await requestNoteFraisReglementAnnulation(payload);
    expect(fresh.success).toBe(true);
    if (!fresh.success) return;
    const replay = await requestNoteFraisReglementAnnulation(payload);
    expect(replay.success).toBe(true);
    if (replay.success) expect(replay.data.alreadyRequested).toBe(true);
    expect(
      await prisma.noteFraisReglementAnnulationDemande.count({
        where: { reglementId },
      })
    ).toBe(1);

    const conflict = await requestNoteFraisReglementAnnulation({
      ...payload,
      motif: "contenu différent",
    });
    expect(conflict.success).toBe(false);
    if (!conflict.success) expect(conflict.code).toBe("IDEMPOTENCY_CONFLICT");

    // rollback afterClaim
    const rolledClaim = await confirmNoteFraisReglementAnnulation({
      actorUserId: tresConf.id,
      noteId: note.id,
      demandeId: fresh.data.demandeId,
      expectedNoteVersion: note.version,
      decisionIdempotencyKey: `ann-rclaim-${note.id}`.slice(0, 64),
      attestation: true,
      client: prisma as never,
      afterClaim: async () => {
        throw new Error("force-rollback-claim");
      },
    });
    expect(rolledClaim.success).toBe(false);
    expect(
      (
        await prisma.noteFraisReglementAnnulationDemande.findUniqueOrThrow({
          where: { id: fresh.data.demandeId },
        })
      ).statut
    ).toBe("DEMANDEE");
    expect(
      (
        await prisma.noteFraisReglement.findUniqueOrThrow({
          where: { id: reglementId },
        })
      ).statut
    ).toBe("EXECUTE");

    // rollback afterNotifyOutbox
    const rolledNotif = await confirmNoteFraisReglementAnnulation({
      actorUserId: tresConf.id,
      noteId: note.id,
      demandeId: fresh.data.demandeId,
      expectedNoteVersion: note.version,
      decisionIdempotencyKey: `ann-rnotif-${note.id}`.slice(0, 64),
      attestation: true,
      client: prisma as never,
      afterNotifyOutbox: async () => {
        throw new Error("force-rollback-notif");
      },
    });
    expect(rolledNotif.success).toBe(false);
    expect(
      (
        await prisma.noteFraisReglementAnnulationDemande.findUniqueOrThrow({
          where: { id: fresh.data.demandeId },
        })
      ).statut
    ).toBe("DEMANDEE");
    expect(
      await prisma.noteFraisOutboxEvent.count({
        where: { noteFraisId: note.id, kind: "ANNULATION_CONFIRMEE" },
      })
    ).toBe(0);

    // confirm OK + notifs uniques + SetNull acteurs + RGPD
    const conf = await confirmNoteFraisReglementAnnulation({
      actorUserId: tresConf.id,
      noteId: note.id,
      demandeId: fresh.data.demandeId,
      expectedNoteVersion: note.version,
      decisionIdempotencyKey: `ann-ok-${note.id}`.slice(0, 64),
      attestation: true,
      client: prisma as never,
    });
    expect(conf.success).toBe(true);

    const dKey = `ann-ok-${note.id}`.slice(0, 64);
    const replayConf = await confirmNoteFraisReglementAnnulation({
      actorUserId: tresConf.id,
      noteId: note.id,
      demandeId: fresh.data.demandeId,
      expectedNoteVersion: 999,
      decisionIdempotencyKey: dKey,
      attestation: true,
      client: prisma as never,
    });
    expect(replayConf.success).toBe(true);
    if (replayConf.success) expect(replayConf.data.alreadyDecided).toBe(true);

    expect(
      await prisma.noteFraisOutboxEvent.count({
        where: { noteFraisId: note.id, kind: "ANNULATION_DEMANDEE" },
      })
    ).toBe(1);
    expect(
      await prisma.noteFraisOutboxEvent.count({
        where: { noteFraisId: note.id, kind: "ANNULATION_CONFIRMEE" },
      })
    ).toBe(2);
    expect(
      await prisma.notification.count({
        where: {
          userId: dem.id,
          titre: "Annulation de règlement confirmée",
          lien: `/user/frais-avances/${note.id}`,
        },
      })
    ).toBe(1);
    expect(
      await prisma.notification.count({
        where: {
          userId: tresReq.id,
          titre: "Annulation de règlement confirmée",
          lien: `/admin/frais-avances/${note.id}`,
        },
      })
    ).toBe(1);
    const confKeys = (
      await prisma.noteFraisOutboxEvent.findMany({
        where: { noteFraisId: note.id, kind: "ANNULATION_CONFIRMEE" },
        select: { eventKey: true },
      })
    ).map((e) => e.eventKey);
    expect(confKeys.some((k) => k.endsWith(":confirmee:user"))).toBe(true);
    expect(confKeys.some((k) => k.endsWith(":confirmee:admin"))).toBe(true);

    // Acteurs annulation distincts de l'exécuteur (Restrict) → SetNull OK
    await prisma.user.delete({ where: { id: tresReq.id } });
    await prisma.user.delete({ where: { id: tresConf.id } });
    const afterActors =
      await prisma.noteFraisReglementAnnulationDemande.findUniqueOrThrow({
        where: { id: fresh.data.demandeId },
      });
    expect(afterActors.demandeurUserId).toBeNull();
    expect(afterActors.confirmateurUserId).toBeNull();

    const { archiveSubmittedNotesInTransaction } = await import(
      "@/lib/services/frais-avances/note-frais-archive-service"
    );
    await expect(
      prisma.$transaction(async (tx) => {
        await archiveSubmittedNotesInTransaction(tx as never, [note.id], {
          status: "validated_injected",
          injected: {
            durationMs: 365 * 24 * 3600 * 1000,
            startsAt: "archivedAt",
          },
        });
      })
    ).rejects.toThrow(NOTES_FRAIS_FINANCIAL_HISTORY_ARCHIVE_REQUIRED);
    expect(await prisma.noteFrais.count({ where: { id: note.id } })).toBe(1);

    const { computeRestantDuNotesFraisGlobal } = await import(
      "@/lib/services/frais-avances/note-frais-restitution-service"
    );
    const restant = await computeRestantDuNotesFraisGlobal(prisma as never);
    const ind = withRestantDuNotesFrais(
      computeChargesFromDepensesValides([]),
      restant
    );
    expect(ind.restantDuNotesFrais).toBeGreaterThan(0);
  });

  it("deux demandes concurrentes (règlement + MIXTE) ; confirm vs refus ; compteur insuffisant ; courses annul↔corr/comp", async () => {
    const {
      requestNoteFraisReglementAnnulation,
      confirmNoteFraisReglementAnnulation,
      refuseNoteFraisReglementAnnulation,
    } = await import(
      "@/lib/services/frais-avances/note-frais-annulation-service"
    );

    // --- deux demandes concurrentes sur même règlement ---
    await wipe();
    const demR = await createUser("dem-2req", "MEMBRE");
    const t1 = await createUser("t1-2req", "TRESOR");
    const t2 = await createUser("t2-2req", "ADMIN");
    const remb = await seedRemb({ dem: demR, tres: t1, montant: "50.00" });
    let releaseBoth!: () => void;
    const go = new Promise<void>((r) => {
      releaseBoth = r;
    });
    let s1!: () => void;
    let s2!: () => void;
    const bothAtLock = Promise.all([
      new Promise<void>((r) => {
        s1 = r;
      }),
      new Promise<void>((r) => {
        s2 = r;
      }),
    ]);
    const pReq1 = requestNoteFraisReglementAnnulation({
      actorUserId: t1.id,
      noteId: remb.note.id,
      reglementId: remb.reglementId,
      idempotencyKey: `ann-2r-a-${remb.note.id}`.slice(0, 64),
      motif: "demande concurrente A",
      preuveKind: "REJET_BANQUE",
      preuveRef: "BNQ-2REQ-A01",
      client: prisma as never,
      beforeDemandeurLock: async () => {
        s1();
        await go;
      },
    });
    const pReq2 = requestNoteFraisReglementAnnulation({
      actorUserId: t2.id,
      noteId: remb.note.id,
      reglementId: remb.reglementId,
      idempotencyKey: `ann-2r-b-${remb.note.id}`.slice(0, 64),
      motif: "demande concurrente B",
      preuveKind: "REJET_BANQUE",
      preuveRef: "BNQ-2REQ-B01",
      client: prisma as never,
      beforeDemandeurLock: async () => {
        s2();
        await go;
      },
    });
    await bothAtLock;
    releaseBoth();
    const [rA, rB] = await Promise.all([pReq1, pReq2]);
    const okReqs = [rA, rB].filter((r) => r.success);
    const failReqs = [rA, rB].filter((r) => !r.success);
    expect(okReqs).toHaveLength(1);
    expect(failReqs).toHaveLength(1);
    if (!failReqs[0]!.success) {
      expect(failReqs[0]!.code).toBe("ANNULATION_ALREADY_PENDING");
    }
    expect(
      await prisma.noteFraisReglementAnnulationDemande.count({
        where: { reglementId: remb.reglementId, statut: "DEMANDEE" },
      })
    ).toBe(1);
    expect(
      await prisma.noteFraisOutboxEvent.count({
        where: { noteFraisId: remb.note.id, kind: "ANNULATION_DEMANDEE" },
      })
    ).toBe(1);
    expect(
      (
        await prisma.noteFraisReglement.findUniqueOrThrow({
          where: { id: remb.reglementId },
        })
      ).statut
    ).toBe("EXECUTE");

    // --- deux demandes concurrentes sur MIXTE parent ---
    await wipe();
    const demM = await createUser("dem-2mix", "MEMBRE");
    const tm1 = await createUser("tm1-2mix", "TRESOR");
    const tm2 = await createUser("tm2-2mix", "ADMIN");
    const mix = await seedMixte({ dem: demM, tres: tm1 });
    let releaseM!: () => void;
    const goM = new Promise<void>((r) => {
      releaseM = r;
    });
    let sm1!: () => void;
    let sm2!: () => void;
    const bothM = Promise.all([
      new Promise<void>((r) => {
        sm1 = r;
      }),
      new Promise<void>((r) => {
        sm2 = r;
      }),
    ]);
    const pm1 = requestNoteFraisReglementAnnulation({
      actorUserId: tm1.id,
      noteId: mix.note.id,
      operationId: mix.operationId,
      idempotencyKey: `ann-2m-a-${mix.note.id}`.slice(0, 64),
      motif: "mix concurrente A",
      preuveKind: "REJET_BANQUE",
      preuveRef: "BNQ-2MIX-A01",
      client: prisma as never,
      beforeDemandeurLock: async () => {
        sm1();
        await goM;
      },
    });
    const pm2 = requestNoteFraisReglementAnnulation({
      actorUserId: tm2.id,
      noteId: mix.note.id,
      operationId: mix.operationId,
      idempotencyKey: `ann-2m-b-${mix.note.id}`.slice(0, 64),
      motif: "mix concurrente B",
      preuveKind: "ANNULATION_VIREMENT",
      preuveRef: "VIR-2MIX-B01",
      client: prisma as never,
      beforeDemandeurLock: async () => {
        sm2();
        await goM;
      },
    });
    await bothM;
    releaseM();
    const [mA, mB] = await Promise.all([pm1, pm2]);
    expect([mA, mB].filter((r) => r.success)).toHaveLength(1);
    expect([mA, mB].filter((r) => !r.success)).toHaveLength(1);
    expect(
      await prisma.noteFraisReglementAnnulationDemande.count({
        where: { operationId: mix.operationId, statut: "DEMANDEE" },
      })
    ).toBe(1);

    // --- A. confirm gagne vs refus ---
    await wipe();
    {
      const demCr = await createUser("dem-cr", "MEMBRE");
      const tresReqCr = await createUser("tres-req-cr", "TRESOR");
      const tresConfCr = await createUser("tres-conf-cr", "ADMIN");
      const tresRefCr = await createUser("tres-ref-cr", "TRESOR");
      const rembCr = await seedRemb({
        dem: demCr,
        tres: tresReqCr,
        montant: "40.00",
      });
      const reqCr = await requestNoteFraisReglementAnnulation({
        actorUserId: tresReqCr.id,
        noteId: rembCr.note.id,
        reglementId: rembCr.reglementId,
        idempotencyKey: `ann-cr-${rembCr.note.id}`.slice(0, 64),
        motif: "confirm vs refus",
        preuveKind: "REJET_BANQUE",
        preuveRef: "BNQ-CR-VS-RF",
        client: prisma as never,
      });
      expect(reqCr.success).toBe(true);
      if (!reqCr.success) return;
      let confirmClaimed!: () => void;
      const afterConfirmClaim = new Promise<void>((r) => {
        confirmClaimed = r;
      });
      const noteVCr = await prisma.noteFrais.findUniqueOrThrow({
        where: { id: rembCr.note.id },
      });
      const choixBefore = await prisma.noteFraisChoixReglement.findFirstOrThrow({
        where: { noteFraisId: rembCr.note.id, statut: "ACTIF" },
      });
      const notifBefore = await prisma.notification.count();
      const pConf = confirmNoteFraisReglementAnnulation({
        actorUserId: tresConfCr.id,
        noteId: rembCr.note.id,
        demandeId: reqCr.data.demandeId,
        expectedNoteVersion: noteVCr.version,
        decisionIdempotencyKey: `ann-cr-win-${rembCr.note.id}`.slice(0, 64),
        attestation: true,
        client: prisma as never,
        afterClaim: async () => {
          confirmClaimed();
        },
      });
      const pRef = refuseNoteFraisReglementAnnulation({
        actorUserId: tresRefCr.id,
        noteId: rembCr.note.id,
        demandeId: reqCr.data.demandeId,
        decisionIdempotencyKey: `ann-rf-lose-${rembCr.note.id}`.slice(0, 64),
        decisionMotif: "refus concurrent perdu",
        client: prisma as never,
        beforeClaim: async () => {
          await afterConfirmClaim;
        },
      });
      const [cRes, rRes] = await Promise.all([pConf, pRef]);
      expect(cRes.success).toBe(true);
      expect(rRes.success).toBe(false);
      const demRow =
        await prisma.noteFraisReglementAnnulationDemande.findUniqueOrThrow({
          where: { id: reqCr.data.demandeId },
        });
      expect(demRow.statut).toBe("CONFIRMEE");
      expect(demRow.statut).not.toBe("DEMANDEE");
      expect(
        (
          await prisma.noteFraisReglement.findUniqueOrThrow({
            where: { id: rembCr.reglementId },
          })
        ).statut
      ).toBe("ANNULE");
      const choixAfter = await prisma.noteFraisChoixReglement.findUniqueOrThrow({
        where: { id: choixBefore.id },
      });
      expect(choixAfter.montantRembourseUtilise.toFixed(2)).toBe("0.00");
      expect(
        await prisma.noteFraisOutboxEvent.count({
          where: { noteFraisId: rembCr.note.id, kind: "ANNULATION_REFUSEE" },
        })
      ).toBe(0);
      expect(
        await prisma.noteFraisOutboxEvent.count({
          where: { noteFraisId: rembCr.note.id, kind: "ANNULATION_CONFIRMEE" },
        })
      ).toBe(2);
      expect(await prisma.notification.count()).toBeGreaterThan(notifBefore);
    }

    // --- B. refus gagne vs confirm ---
    await wipe();
    {
      const demRf = await createUser("dem-rf", "MEMBRE");
      const tresReqRf = await createUser("tres-req-rf", "TRESOR");
      const tresConfRf = await createUser("tres-conf-rf", "ADMIN");
      const tresRefRf = await createUser("tres-ref-rf", "TRESOR");
      const rembRf = await seedRemb({
        dem: demRf,
        tres: tresReqRf,
        montant: "40.00",
      });
      const reqRf = await requestNoteFraisReglementAnnulation({
        actorUserId: tresReqRf.id,
        noteId: rembRf.note.id,
        reglementId: rembRf.reglementId,
        idempotencyKey: `ann-rf-${rembRf.note.id}`.slice(0, 64),
        motif: "refus vs confirm",
        preuveKind: "REJET_BANQUE",
        preuveRef: "BNQ-RF-VS-CR",
        client: prisma as never,
      });
      expect(reqRf.success).toBe(true);
      if (!reqRf.success) return;
      let refuseDone!: () => void;
      const afterRefuse = new Promise<void>((r) => {
        refuseDone = r;
      });
      const noteVRf = await prisma.noteFrais.findUniqueOrThrow({
        where: { id: rembRf.note.id },
      });
      const pRefWin = refuseNoteFraisReglementAnnulation({
        actorUserId: tresRefRf.id,
        noteId: rembRf.note.id,
        demandeId: reqRf.data.demandeId,
        decisionIdempotencyKey: `ann-rf-win-${rembRf.note.id}`.slice(0, 64),
        decisionMotif: "refus gagne",
        client: prisma as never,
        afterNotifyOutbox: async () => {
          refuseDone();
        },
      });
      const pConfLose = confirmNoteFraisReglementAnnulation({
        actorUserId: tresConfRf.id,
        noteId: rembRf.note.id,
        demandeId: reqRf.data.demandeId,
        expectedNoteVersion: noteVRf.version,
        decisionIdempotencyKey: `ann-cr-lose-${rembRf.note.id}`.slice(0, 64),
        attestation: true,
        client: prisma as never,
        beforeDemandeurLock: async () => {
          await afterRefuse;
        },
      });
      const [refRes, confRes] = await Promise.all([pRefWin, pConfLose]);
      expect(refRes.success).toBe(true);
      expect(confRes.success).toBe(false);
      const demRfRow =
        await prisma.noteFraisReglementAnnulationDemande.findUniqueOrThrow({
          where: { id: reqRf.data.demandeId },
        });
      expect(demRfRow.statut).toBe("REFUSEE");
      expect(
        (
          await prisma.noteFraisReglement.findUniqueOrThrow({
            where: { id: rembRf.reglementId },
          })
        ).statut
      ).toBe("EXECUTE");
      expect(
        await prisma.noteFraisAnnulationInverseCible.count({
          where: { demandeId: reqRf.data.demandeId },
        })
      ).toBe(0);
      expect(
        await prisma.noteFraisOutboxEvent.count({
          where: { noteFraisId: rembRf.note.id, kind: "ANNULATION_CONFIRMEE" },
        })
      ).toBe(0);
      expect(
        await prisma.noteFraisOutboxEvent.count({
          where: { noteFraisId: rembRf.note.id, kind: "ANNULATION_REFUSEE" },
        })
      ).toBe(1);
    }

    // --- compteur insuffisant ---
    await wipe();
    {
      const demPl = await createUser("dem-pl", "MEMBRE");
      const tresReqPl = await createUser("tres-req-pl", "TRESOR");
      const tresConfPl = await createUser("tres-conf-pl", "ADMIN");
      const rembPl = await seedRemb({
        dem: demPl,
        tres: tresReqPl,
        montant: "50.00",
      });
      const reqPl = await requestNoteFraisReglementAnnulation({
        actorUserId: tresReqPl.id,
        noteId: rembPl.note.id,
        reglementId: rembPl.reglementId,
        idempotencyKey: `ann-pl-${rembPl.note.id}`.slice(0, 64),
        motif: "plafond",
        preuveKind: "REJET_BANQUE",
        preuveRef: "BNQ-PLAFOND-01",
        client: prisma as never,
      });
      expect(reqPl.success).toBe(true);
      if (!reqPl.success) return;
      const choixPl = await prisma.noteFraisChoixReglement.findFirstOrThrow({
        where: { noteFraisId: rembPl.note.id, statut: "ACTIF" },
      });
      await prisma.noteFraisChoixReglement.update({
        where: { id: choixPl.id },
        data: { montantRembourseUtilise: "10.00" },
      });
      const noteVPl = await prisma.noteFrais.findUniqueOrThrow({
        where: { id: rembPl.note.id },
      });
      const notifPl = await prisma.notification.count();
      const outPl = await prisma.noteFraisOutboxEvent.count({
        where: { noteFraisId: rembPl.note.id },
      });
      const confPl = await confirmNoteFraisReglementAnnulation({
        actorUserId: tresConfPl.id,
        noteId: rembPl.note.id,
        demandeId: reqPl.data.demandeId,
        expectedNoteVersion: noteVPl.version,
        decisionIdempotencyKey: `ann-pl-c-${rembPl.note.id}`.slice(0, 64),
        attestation: true,
        client: prisma as never,
      });
      expect(confPl.success).toBe(false);
      if (!confPl.success) expect(confPl.code).toBe("PLAFOND_DEPASSE");
      expect(
        (
          await prisma.noteFraisReglementAnnulationDemande.findUniqueOrThrow({
            where: { id: reqPl.data.demandeId },
          })
        ).statut
      ).toBe("DEMANDEE");
      expect(
        (
          await prisma.noteFraisReglement.findUniqueOrThrow({
            where: { id: rembPl.reglementId },
          })
        ).statut
      ).toBe("EXECUTE");
      expect(
        await prisma.noteFraisAnnulationInverseCible.count({
          where: { demandeId: reqPl.data.demandeId },
        })
      ).toBe(0);
      expect(
        (
          await prisma.noteFrais.findUniqueOrThrow({
            where: { id: rembPl.note.id },
          })
        ).version
      ).toBe(noteVPl.version);
      expect(await prisma.notification.count()).toBe(notifPl);
      expect(
        await prisma.noteFraisOutboxEvent.count({
          where: { noteFraisId: rembPl.note.id },
        })
      ).toBe(outPl);
    }

    // --- annulation compensation vs correction (pas de deadlock, une issue) ---
    await wipe();
    {
      const demAc = await createUser("dem-ac", "MEMBRE");
      const tresReqAc = await createUser("tres-req-ac", "TRESOR");
      const tresConfAc = await createUser("tres-conf-ac", "ADMIN");
      const tresCorrAc = await createUser("tres-corr-ac", "TRESOR");
      const compAc = await seedComp({ dem: demAc, tres: tresReqAc });
      const reqAc = await requestNoteFraisReglementAnnulation({
        actorUserId: tresReqAc.id,
        noteId: compAc.note.id,
        reglementId: compAc.reglementId,
        idempotencyKey: `ann-ac-${compAc.note.id}`.slice(0, 64),
        motif: "vs correction",
        preuveKind: "PV_TRESORERIE",
        preuveRef: "PV-VS-CORR-01",
        client: prisma as never,
      });
      expect(reqAc.success).toBe(true);
      if (!reqAc.success) return;
      const ligneAc = await prisma.noteFraisReglementLigne.findFirstOrThrow({
        where: { reglementId: compAc.reglementId, typeLigne: "COMPENSATION" },
      });
      const noteVAc = await prisma.noteFrais.findUniqueOrThrow({
        where: { id: compAc.note.id },
      });
      const { correctNoteFraisReglement } = await import(
        "@/lib/services/frais-avances/note-frais-correction-service"
      );
      const [annRes, corrRes] = await Promise.all([
        confirmNoteFraisReglementAnnulation({
          actorUserId: tresConfAc.id,
          noteId: compAc.note.id,
          demandeId: reqAc.data.demandeId,
          expectedNoteVersion: noteVAc.version,
          decisionIdempotencyKey: `ann-ac-c-${compAc.note.id}`.slice(0, 64),
          attestation: true,
          client: prisma as never,
        }),
        correctNoteFraisReglement({
          actorUserId: tresCorrAc.id,
          noteId: compAc.note.id,
          reglementId: compAc.reglementId,
          expectedNoteVersion: noteVAc.version,
          idempotencyKey: `corr-vs-ann-${compAc.note.id}`.slice(0, 64),
          type: "MONTANT_NEGATIF",
          montantACorriger: "10.00",
          allocations: [
            { reglementLigneId: ligneAc.id, montantARestaurer: "10.00" },
          ],
          motif: "corr concurrente",
          preuveKind: "JUSTIFICATIF_INTERNE",
          preuveRef: "JI-VS-ANN-10",
          client: prisma as never,
        }),
      ]);
      const winners = [annRes, corrRes].filter((r) => r.success);
      expect(winners.length).toBeGreaterThanOrEqual(1);
      expect(winners.length).toBeLessThanOrEqual(2);
      // Au moins une issue cohérente ; jamais compteur négatif
      const choixAc = await prisma.noteFraisChoixReglement.findFirstOrThrow({
        where: { noteFraisId: compAc.note.id, statut: "ACTIF" },
      });
      expect(choixAc.montantCompensationUtilise.gte(0)).toBe(true);
      const detteAc = await prisma.detteInitiale.findUniqueOrThrow({
        where: { id: compAc.dette.id },
      });
      expect(detteAc.montantPaye.gte(0)).toBe(true);
    }

    // --- annulation compensation vs nouvelle compensation (plafond restant) ---
    await wipe();
    {
      const demNc = await createUser("dem-nc", "MEMBRE");
      const tresReqNc = await createUser("tres-req-nc", "TRESOR");
      const tresConfNc = await createUser("tres-conf-nc", "ADMIN");
      const tresExecNc = await createUser("tres-exec-nc", "TRESOR");
      // seedComp total 80 (40 dette + 40 cm) — exécuter seulement 40 sur dette, reste 40 CM
      const decideeAt = new Date(Date.now() - 3600_000);
      await ensureTypeDepenseFraisAvanceForTests(prisma, tresReqNc.id);
      const detteNc = await prisma.detteInitiale.create({
        data: {
          adherentId: demNc.adherent!.id,
          annee: 2024,
          montant: 100,
          montantPaye: 0,
          createdBy: tresReqNc.id,
        },
      });
      const typeCmNc = await prisma.typeCotisationMensuelle.create({
        data: {
          nom: `nf-ann-nc-${randomUUID().slice(0, 6)}`,
          montant: 40,
          categorie: "ForfaitMensuel",
          createdBy: tresReqNc.id,
        },
      });
      const cmNc = await prisma.cotisationMensuelle.create({
        data: {
          periode: "2026-02",
          annee: 2026,
          mois: 2,
          typeCotisationId: typeCmNc.id,
          adherentId: demNc.adherent!.id,
          montantAttendu: 40,
          montantPaye: 0,
          montantRestant: 40,
          dateEcheance: new Date("2026-02-28"),
          statut: "EnAttente",
          createdBy: tresReqNc.id,
        },
      });
      const noteNc = await prisma.noteFrais.create({
        data: {
          adherentId: demNc.adherent!.id,
          demandeurUserId: demNc.id,
          libelle: "ann-vs-comp",
          dateDepense: new Date(),
          montantDemande: "80",
          montantAccepte: "80",
          statut: "VALIDEE",
          soumiseAt: decideeAt,
          decideeAt,
          decideurUserId: tresReqNc.id,
          version: 1,
        },
      });
      await prisma.depense.create({
        data: {
          libelle: "d",
          montant: "80",
          dateDepense: noteNc.dateDepense,
          statut: "Valide",
          origine: "FRAIS_AVANCE",
          noteFraisId: noteNc.id,
          createdBy: tresReqNc.id,
          validatedBy: tresReqNc.id,
        },
      });
      await prisma.noteFraisChoixReglement.create({
        data: {
          noteFraisId: noteNc.id,
          mode: "COMPENSATION",
          statut: "ACTIF",
          montantReference: "80",
          montantRemboursement: 0,
          montantCompensation: "80",
          montantRembourseUtilise: 0,
          montantCompensationUtilise: 0,
          choisiAt: new Date(),
          idempotencyKey: `choix-nc-${noteNc.id}`.slice(0, 64),
          Cibles: {
            create: [
              {
                typeCible: "DETTE_INITIALE",
                cibleId: detteNc.id,
                montantAutorise: "40",
                montantUtilise: 0,
                montantRestantSnapshot: "100.00",
                libelleSnapshot: "dette",
                rang: 1,
              },
              {
                typeCible: "COTISATION_MENSUELLE",
                cibleId: cmNc.id,
                montantAutorise: "40",
                montantUtilise: 0,
                montantRestantSnapshot: "40.00",
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
      const first = await executeNoteFraisCompensation({
        actorUserId: tresExecNc.id,
        noteId: noteNc.id,
        expectedNoteVersion: 1,
        idempotencyKey: `comp-nc1-${noteNc.id}`.slice(0, 64),
        lignes: [
          {
            typeCible: "DETTE_INITIALE",
            cibleId: detteNc.id,
            montant: "40.00",
            rang: 1,
          },
        ],
        client: prisma as never,
      });
      expect(first.success).toBe(true);
      if (!first.success) return;
      const regNc = first.data.reglementId;
      const reqNc = await requestNoteFraisReglementAnnulation({
        actorUserId: tresReqNc.id,
        noteId: noteNc.id,
        reglementId: regNc,
        idempotencyKey: `ann-nc-${noteNc.id}`.slice(0, 64),
        motif: "vs nouvelle comp",
        preuveKind: "PV_TRESORERIE",
        preuveRef: "PV-VS-COMP-01",
        client: prisma as never,
      });
      expect(reqNc.success).toBe(true);
      if (!reqNc.success) return;
      const noteVNc = await prisma.noteFrais.findUniqueOrThrow({
        where: { id: noteNc.id },
      });
      const [annNc, compNc] = await Promise.all([
        confirmNoteFraisReglementAnnulation({
          actorUserId: tresConfNc.id,
          noteId: noteNc.id,
          demandeId: reqNc.data.demandeId,
          expectedNoteVersion: noteVNc.version,
          decisionIdempotencyKey: `ann-nc-c-${noteNc.id}`.slice(0, 64),
          attestation: true,
          client: prisma as never,
        }),
        executeNoteFraisCompensation({
          actorUserId: tresExecNc.id,
          noteId: noteNc.id,
          expectedNoteVersion: noteVNc.version,
          idempotencyKey: `comp-nc2-${noteNc.id}`.slice(0, 64),
          lignes: [
            {
              typeCible: "COTISATION_MENSUELLE",
              cibleId: cmNc.id,
              montant: "40.00",
              rang: 1,
            },
          ],
          client: prisma as never,
        }),
      ]);
      expect([annNc, compNc].some((r) => r.success)).toBe(true);
      const choixNc = await prisma.noteFraisChoixReglement.findFirstOrThrow({
        where: { noteFraisId: noteNc.id, statut: "ACTIF" },
      });
      expect(choixNc.montantCompensationUtilise.gte(0)).toBe(true);
      expect(
        choixNc.montantCompensationUtilise.lte(choixNc.montantCompensation)
      ).toBe(true);
    }
  });
});
