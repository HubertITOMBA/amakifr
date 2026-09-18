/**
 * Tests PG lot 4.9 — archivage financier RGPD (journal + reports + détachement).
 * Allowlist exclusive : 127.0.0.1:55432 / amaki_notes_frais_test / amaki_test
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Prisma, PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { resolveAuthorizedNotesFraisPgTestUrl } from "@/lib/frais-avances/pg-test-allowlist";
import { wipeNotesFraisPgFixtures } from "@/lib/frais-avances/pg-test-wipe";
import {
  DESCRIPTION_AVOIR_COMPENSATION_ARCHIVEE,
  LIBELLE_DEPENSE_FRAIS_AVANCE_ARCHIVEE,
} from "@/lib/frais-avances/retention-policy";
import { ensureTypeDepenseFraisAvanceForTests } from "@/lib/frais-avances/type-depense-frais-avance";
import {
  aggregateJournalFinancierForSynthese,
  aggregateReportsFinancierForSynthese,
  consolidateNoteFraisJournalFinancierOnce,
} from "@/lib/services/frais-avances/note-frais-journal-financier-service";
import { processNoteFraisArchivePurgeOnce } from "@/lib/services/frais-avances/note-frais-archive-service";
import { deleteUserAtomicallyWithNotesFraisRgpd } from "@/lib/services/frais-avances/rgpd-account-deletion";
import {
  computeChargesFromDepensesValides,
  computeSoldeBancaireEstime,
  withCompensationsNotesFrais,
  withDecaissementsNotesFrais,
  withRestitutionsNotesFrais,
} from "@/lib/financial/synthese-charges";

const FIXTURE_EMAIL_SUFFIX = "@notes-frais-test.local";

let authorizedUrl: string | null = null;
try {
  authorizedUrl = resolveAuthorizedNotesFraisPgTestUrl(process.env);
} catch (e) {
  console.warn(
    "[notes-frais][pg-int-4.9] suite skippée:",
    e instanceof Error ? e.message : e
  );
}

const describePg = authorizedUrl ? describe : describe.skip;

async function syntheseNotesIndicators(client: PrismaClient) {
  const remboursementsAgg = await client.noteFraisReglement.aggregate({
    where: { type: "REMBOURSEMENT", statut: "EXECUTE" },
    _sum: { montantTotal: true },
  });
  const compensationsAgg = await client.noteFraisReglement.aggregate({
    where: { type: "COMPENSATION", statut: "EXECUTE" },
    _sum: { montantTotal: true },
  });
  const { aggregateCorrectionsMontantByReglementType } = await import(
    "@/lib/services/frais-avances/note-frais-correction-service"
  );
  const { aggregateRestitutionsMontant } = await import(
    "@/lib/services/frais-avances/note-frais-restitution-service"
  );
  const corrAgg = await aggregateCorrectionsMontantByReglementType(
    client as never
  );
  const rembLive = new Prisma.Decimal(
    remboursementsAgg._sum.montantTotal ?? 0
  ).plus(corrAgg.remboursements);
  const compLive = new Prisma.Decimal(
    compensationsAgg._sum.montantTotal ?? 0
  ).plus(corrAgg.compensations);
  const restitLive = new Prisma.Decimal(
    await aggregateRestitutionsMontant(client as never)
  );
  const journal = await aggregateJournalFinancierForSynthese(client as never);
  const reports = await aggregateReportsFinancierForSynthese(client as never);
  const remb = rembLive
    .plus(journal.totalDecaissementsRemboursement)
    .plus(reports.totalDecaissementsRemboursement)
    .toFixed(2);
  const comp = compLive
    .plus(journal.totalCompensationsNettes)
    .plus(reports.totalCompensationsNettes)
    .toFixed(2);
  const restit = restitLive
    .plus(journal.totalRestitutions)
    .plus(reports.totalRestitutions)
    .toFixed(2);
  const depenses = await client.depense.findMany({
    where: { statut: "Valide" },
    select: { montant: true, origine: true },
  });
  const base = computeChargesFromDepensesValides(
    depenses.map((d) => ({
      montant: Number(d.montant),
      origine: d.origine as "ORDINAIRE" | "FRAIS_AVANCE",
    }))
  );
  const ind = withRestitutionsNotesFrais(
    withDecaissementsNotesFrais(
      withCompensationsNotesFrais(base, comp),
      remb
    ),
    restit
  );
  return { ...ind, solde: computeSoldeBancaireEstime(0, ind) };
}

describePg("intégration PG lot 4.9 archivage financier RGPD", () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    process.env.NOTES_FRAIS_ENABLED = "true";
    delete process.env.NOTES_FRAIS_P1_FILES_RETENTION;
    delete process.env.NOTES_FRAIS_P2_ARCHIVE_PRIVEE_RETENTION;
    delete process.env.NOTES_FRAIS_P3_JOURNAL_FINANCIER_RETENTION;
    const url = resolveAuthorizedNotesFraisPgTestUrl(process.env);
    prisma = new PrismaClient({ datasources: { db: { url } } });
    await prisma.$connect();
    const id = await prisma.$queryRaw<Array<{ db: string; usr: string }>>`
      SELECT current_database() AS db, current_user AS usr
    `;
    expect(id[0]?.db).toBe("amaki_notes_frais_test");
    expect(id[0]?.usr).toBe("amaki_test");
  }, 60_000);

  afterAll(async () => {
    try {
      await wipe();
    } catch {
      /* ignore */
    }
    await prisma.$disconnect();
  });

  async function wipe() {
    await wipeNotesFraisPgFixtures(prisma);
  }

  async function createUser(
    tag: string,
    role: "ADMIN" | "TRESOR" | "MEMBRE" = "MEMBRE"
  ) {
    const id = randomUUID().replace(/-/g, "").slice(0, 24);
    return prisma.user.create({
      data: {
        id,
        email: `${tag}.${id}${FIXTURE_EMAIL_SUFFIX}`,
        name: `nf49-${tag}`,
        role,
        status: "Actif",
        password: "x",
        adherent: {
          create: {
            firstname: "Lot49",
            lastname: tag,
            civility: "Monsieur",
          },
        },
      },
      include: { adherent: true },
    });
  }

  it("VALIDEE sans règlement : Depense détachée ; synthèse stable après purge archive", async () => {
    await wipe();
    const dem = await createUser("dem-val");
    const tres = await createUser("tres-val", "TRESOR");
    const type = await ensureTypeDepenseFraisAvanceForTests(prisma, tres.id);
    const note = await prisma.noteFrais.create({
      data: {
        adherentId: dem.adherent!.id,
        demandeurUserId: dem.id,
        libelle: "charge seule",
        dateDepense: new Date("2026-01-10"),
        montantDemande: 40,
        montantAccepte: 40,
        statut: "VALIDEE",
        soumiseAt: new Date(),
        decideeAt: new Date(),
        decideurUserId: tres.id,
      },
    });
    await prisma.depense.create({
      data: {
        libelle: "ancienne charge nominative",
        montant: 40,
        dateDepense: note.dateDepense,
        statut: "Valide",
        origine: "FRAIS_AVANCE",
        noteFraisId: note.id,
        typeDepenseId: type.id,
        createdBy: tres.id,
        validatedBy: tres.id,
      },
    });

    const before = await syntheseNotesIndicators(prisma);
    await deleteUserAtomicallyWithNotesFraisRgpd(dem.id, prisma as never, {
      injectedRetention: { durationMs: 60_000, startsAt: "archivedAt" },
    });

    expect(await prisma.user.count({ where: { id: dem.id } })).toBe(0);
    const dep = await prisma.depense.findFirst({
      where: { origine: "FRAIS_AVANCE" },
    });
    expect(dep?.noteFraisId).toBeNull();
    expect(dep?.libelle).toBe(LIBELLE_DEPENSE_FRAIS_AVANCE_ARCHIVEE);
    expect(dep?.description).toBeNull();

    const after = await syntheseNotesIndicators(prisma);
    expect(after.totalCharges).toBe(before.totalCharges);
    expect(after.solde).toBe(before.solde);

    await prisma.noteFraisArchive.updateMany({
      data: { retentionEndsAt: new Date(Date.now() - 1000) },
    });
    await processNoteFraisArchivePurgeOnce(50, prisma);
    expect(await prisma.noteFraisArchive.count()).toBe(0);
    const afterPurge = await syntheseNotesIndicators(prisma);
    expect(afterPurge.solde).toBe(before.solde);
  });

  it("remboursement : avant==après==purge==consolidation", async () => {
    await wipe();
    const dem = await createUser("dem-remb");
    const tres = await createUser("tres-remb", "TRESOR");
    const type = await ensureTypeDepenseFraisAvanceForTests(prisma, tres.id);
    const note = await prisma.noteFrais.create({
      data: {
        adherentId: dem.adherent!.id,
        demandeurUserId: dem.id,
        libelle: "remb",
        dateDepense: new Date(),
        montantDemande: 50,
        montantAccepte: 50,
        statut: "VALIDEE",
        soumiseAt: new Date(),
        decideeAt: new Date(),
        decideurUserId: tres.id,
      },
    });
    await prisma.depense.create({
      data: {
        libelle: "x",
        montant: 50,
        dateDepense: note.dateDepense,
        statut: "Valide",
        origine: "FRAIS_AVANCE",
        noteFraisId: note.id,
        typeDepenseId: type.id,
        createdBy: tres.id,
      },
    });
    const choix = await prisma.noteFraisChoixReglement.create({
      data: {
        noteFraisId: note.id,
        mode: "REMBOURSEMENT",
        statut: "ACTIF",
        montantReference: 50,
        montantRemboursement: 50,
        montantCompensation: 0,
        montantRembourseUtilise: 50,
        montantCompensationUtilise: 0,
        idempotencyKey: `ch-${note.id}`.slice(0, 64),
        choisiAt: new Date(),
      },
    });
    await prisma.noteFraisReglement.create({
      data: {
        noteFraisId: note.id,
        choixId: choix.id,
        type: "REMBOURSEMENT",
        statut: "EXECUTE",
        montantTotal: 50,
        moyen: "VIREMENT",
        reference: "VIR-49",
        referenceNormalisee: "VIR49",
        idempotencyKey: `rg-${note.id}`.slice(0, 64),
        executeurUserId: tres.id,
        executeAt: new Date(),
      },
    });

    const before = await syntheseNotesIndicators(prisma);
    expect(before.decaissementsNotesFrais).toBe(50);

    await deleteUserAtomicallyWithNotesFraisRgpd(dem.id, prisma as never, {
      injectedRetention: { durationMs: 1000, startsAt: "archivedAt" },
    });
    expect(await prisma.noteFraisReglement.count()).toBe(0);
    expect(
      await prisma.noteFraisJournalFinancierEvenement.count()
    ).toBeGreaterThan(0);
    const after = await syntheseNotesIndicators(prisma);
    expect(after.decaissementsNotesFrais).toBe(50);
    expect(after.solde).toBe(before.solde);

    await prisma.noteFraisArchive.updateMany({
      data: { retentionEndsAt: new Date(Date.now() - 1000) },
    });
    await processNoteFraisArchivePurgeOnce(50, prisma);
    expect(
      (await syntheseNotesIndicators(prisma)).decaissementsNotesFrais
    ).toBe(50);

    await prisma.noteFraisJournalFinancierEvenement.updateMany({
      data: { retentionEndsAt: new Date(Date.now() - 1000) },
    });
    const cons = await consolidateNoteFraisJournalFinancierOnce(100, prisma);
    expect(cons.consolidatedEvents).toBeGreaterThan(0);
    expect(await prisma.noteFraisJournalFinancierEvenement.count()).toBe(0);
    expect(await prisma.noteFraisReportFinancierPeriode.count()).toBe(1);
    const afterCons = await syntheseNotesIndicators(prisma);
    expect(afterCons.decaissementsNotesFrais).toBe(50);
    expect(afterCons.solde).toBe(before.solde);
  });

  it("compensation : Avoir/UA survivent ; texts techniques ; synthèse stable", async () => {
    await wipe();
    const dem = await createUser("dem-comp");
    const tres = await createUser("tres-comp", "TRESOR");
    const type = await ensureTypeDepenseFraisAvanceForTests(prisma, tres.id);
    const dette = await prisma.detteInitiale.create({
      data: {
        adherentId: dem.adherent!.id,
        annee: 2024,
        montant: 80,
        montantPaye: 0,
        createdBy: tres.id,
      },
    });
    const note = await prisma.noteFrais.create({
      data: {
        adherentId: dem.adherent!.id,
        demandeurUserId: dem.id,
        libelle: "comp",
        dateDepense: new Date(),
        montantDemande: 30,
        montantAccepte: 30,
        statut: "VALIDEE",
        soumiseAt: new Date(),
        decideeAt: new Date(),
        decideurUserId: tres.id,
      },
    });
    await prisma.depense.create({
      data: {
        libelle: "x",
        montant: 30,
        dateDepense: note.dateDepense,
        statut: "Valide",
        origine: "FRAIS_AVANCE",
        noteFraisId: note.id,
        typeDepenseId: type.id,
        createdBy: tres.id,
      },
    });
    const choix = await prisma.noteFraisChoixReglement.create({
      data: {
        noteFraisId: note.id,
        mode: "COMPENSATION",
        statut: "ACTIF",
        montantReference: 30,
        montantRemboursement: 0,
        montantCompensation: 30,
        montantRembourseUtilise: 0,
        montantCompensationUtilise: 30,
        idempotencyKey: `chc-${note.id}`.slice(0, 64),
        choisiAt: new Date(),
      },
    });
    const reg = await prisma.noteFraisReglement.create({
      data: {
        noteFraisId: note.id,
        choixId: choix.id,
        type: "COMPENSATION",
        statut: "EXECUTE",
        montantTotal: 30,
        idempotencyKey: `rgc-${note.id}`.slice(0, 64),
        executeurUserId: tres.id,
        executeAt: new Date(),
      },
    });
    const ligne = await prisma.noteFraisReglementLigne.create({
      data: {
        reglementId: reg.id,
        typeLigne: "COMPENSATION",
        typeCible: "DETTE_INITIALE",
        cibleId: dette.id,
        rang: 1,
        montant: 30,
        montantRestantCibleAvant: 80,
        montantRestantCibleApres: 50,
        montantAutoriseRestantAvant: 30,
      },
    });
    const avoir = await prisma.avoir.create({
      data: {
        adherentId: dem.adherent!.id,
        montant: 30,
        montantUtilise: 30,
        montantRestant: 0,
        origine: "COMPENSATION_NOTE_FRAIS",
        statut: "Utilise",
        description: "libellé note nominatif",
        noteFraisReglementLigneId: ligne.id,
      },
    });
    await prisma.utilisationAvoir.create({
      data: {
        avoirId: avoir.id,
        montant: 30,
        detteInitialeId: dette.id,
        description: "ua nominative",
        noteFraisReglementLigneId: ligne.id,
      },
    });

    const before = await syntheseNotesIndicators(prisma);
    await deleteUserAtomicallyWithNotesFraisRgpd(dem.id, prisma as never, {
      injectedRetention: { durationMs: 60_000, startsAt: "archivedAt" },
    });

    const av = await prisma.avoir.findFirst({
      where: { id: avoir.id },
    });
    expect(av).toBeTruthy();
    expect(av?.adherentId).toBeNull();
    expect(av?.noteFraisReglementLigneId).toBeNull();
    expect(av?.statut).toBe("Utilise");
    expect(av?.origine).toBe("COMPENSATION_NOTE_FRAIS");
    expect(av?.description).toBe(DESCRIPTION_AVOIR_COMPENSATION_ARCHIVEE);
    const ua = await prisma.utilisationAvoir.findFirst({
      where: { avoirId: avoir.id },
    });
    expect(ua?.noteFraisReglementLigneId).toBeNull();

    const after = await syntheseNotesIndicators(prisma);
    expect(after.compensationsNotesFrais).toBe(before.compensationsNotesFrais);
    expect(after.solde).toBe(before.solde);
  });

  it("fail-closed sans politique ACTIVE ; exécuteur tiers SetNull", async () => {
    await wipe();
    await prisma.noteFraisRetentionPolicyVersion.deleteMany({});
    const dem = await createUser("dem-fc");
    const tres = await createUser("tres-fc", "TRESOR");
    await ensureTypeDepenseFraisAvanceForTests(prisma, tres.id);
    await prisma.noteFrais.create({
      data: {
        adherentId: dem.adherent!.id,
        demandeurUserId: dem.id,
        libelle: "fc",
        dateDepense: new Date(),
        montantDemande: 10,
        statut: "SOUMISE",
        soumiseAt: new Date(),
      },
    });

    await expect(
      deleteUserAtomicallyWithNotesFraisRgpd(dem.id, prisma as never)
    ).rejects.toThrow();
    expect(await prisma.user.count({ where: { id: dem.id } })).toBe(1);

    await deleteUserAtomicallyWithNotesFraisRgpd(tres.id, prisma as never, {
      injectedRetention: { durationMs: 60_000, startsAt: "archivedAt" },
    });
    const typeAfter = await prisma.typeDepense.findFirst({
      where: { code: "FRAIS_AVANCE" },
    });
    expect(typeAfter?.createdBy).toBeNull();
    expect(await prisma.noteFrais.count({ where: { demandeurUserId: dem.id } })).toBe(
      1
    );
  });
});
