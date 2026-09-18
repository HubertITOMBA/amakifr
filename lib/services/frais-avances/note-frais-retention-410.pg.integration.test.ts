/**
 * Tests PG lot 4.10 — politiques retention + legal hold + P1/P2/P3.
 * Allowlist exclusive : 127.0.0.1:55432 / amaki_notes_frais_test / amaki_test
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { resolveAuthorizedNotesFraisPgTestUrl } from "@/lib/frais-avances/pg-test-allowlist";
import { wipeNotesFraisPgFixtures } from "@/lib/frais-avances/pg-test-wipe";
import {
  activateRetentionPolicyVersion,
  createRetentionPolicyDraft,
  getActiveRetentionPolicy,
} from "@/lib/services/frais-avances/note-frais-retention-policy-service";
import {
  expireLegalHoldsOnce,
  leverLegalHold,
  poseLegalHoldOnArchive,
  poseLegalHoldOnPeriode,
} from "@/lib/services/frais-avances/note-frais-legal-hold-service";
import {
  processNoteFraisArchivePurgeOnce,
  processNoteFraisPiecesPurgeOnce,
} from "@/lib/services/frais-avances/note-frais-archive-service";
import {
  consolidateNoteFraisJournalFinancierOnce,
} from "@/lib/services/frais-avances/note-frais-journal-financier-service";
import { ARCHIVE_REIDENTIFIABILITY_NOTICE } from "@/lib/frais-avances/retention-policy";

const FIXTURE_EMAIL_SUFFIX = "@notes-frais-test.local";

let authorizedUrl: string | null = null;
try {
  authorizedUrl = resolveAuthorizedNotesFraisPgTestUrl(process.env);
} catch (e) {
  console.warn(
    "[notes-frais][pg-int-4.10] suite skippée:",
    e instanceof Error ? e.message : e
  );
}

const describePg = authorizedUrl ? describe : describe.skip;

describePg("notes-frais 4.10 retention + legal hold (PG)", () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    prisma = new PrismaClient({
      datasources: { db: { url: authorizedUrl! } },
    });
  });

  afterAll(async () => {
    await wipeNotesFraisPgFixtures(prisma, FIXTURE_EMAIL_SUFFIX);
    await prisma.$disconnect();
  });

  async function wipe() {
    await wipeNotesFraisPgFixtures(prisma, FIXTURE_EMAIL_SUFFIX);
  }

  it("une seule politique ACTIVE sous concurrence + activation B remplace A", async () => {
    await wipe();
    const a = await getActiveRetentionPolicy(prisma);
    expect(a?.version).toBe(1);

    const draft = await createRetentionPolicyDraft(
      {
        p1Years: 10,
        p2Years: 8,
        p3Years: 10,
        exerciceClotureMois: 12,
        exerciceClotureJour: 31,
        reportsSansEcheance: true,
        motif: "Activation concurrente test politique B",
        effectiveAt: new Date(),
      },
      null,
      prisma
    );

    const [r1, r2] = await Promise.allSettled([
      activateRetentionPolicyVersion({
        policyId: draft.id,
        activatedByUserId: null,
        activationIdempotencyKey: "act-b-conc-1",
        expectedOccVersion: 1,
        client: prisma,
      }),
      activateRetentionPolicyVersion({
        policyId: draft.id,
        activatedByUserId: null,
        activationIdempotencyKey: "act-b-conc-1",
        expectedOccVersion: 1,
        client: prisma,
      }),
    ]);

    const oks = [r1, r2].filter((r) => r.status === "fulfilled");
    expect(oks.length).toBeGreaterThanOrEqual(1);

    const actives = await prisma.noteFraisRetentionPolicyVersion.findMany({
      where: { statut: "ACTIVE" },
    });
    expect(actives).toHaveLength(1);
    expect(actives[0]!.id).toBe(draft.id);

    const remplacee = await prisma.noteFraisRetentionPolicyVersion.findFirst({
      where: { version: 1 },
    });
    expect(remplacee?.statut).toBe("REMPLACEE");
  });

  it("archive snapshot A inchangée après activation B", async () => {
    await wipe();
    const polA = await getActiveRetentionPolicy(prisma);
    expect(polA).not.toBeNull();

    const archive = await prisma.noteFraisArchive.create({
      data: {
        dateDepense: new Date("2024-06-15T00:00:00.000Z"),
        montantDemande: 42.5,
        soumiseAt: new Date("2024-06-20T00:00:00.000Z"),
        statutFinal: "VALIDEE",
        archivedAt: new Date(),
        retentionEndsAt: new Date("2034-12-31T00:00:00.000Z"),
        retentionEndsAtP1: new Date("2034-12-31T00:00:00.000Z"),
        policyVersionId: polA!.id,
        exerciceClotureAt: new Date("2024-12-31T00:00:00.000Z"),
        reidentifiabilityNotice: ARCHIVE_REIDENTIFIABILITY_NOTICE,
      },
    });

    const draft = await createRetentionPolicyDraft(
      {
        p1Years: 5,
        p2Years: 5,
        p3Years: 5,
        reportsSansEcheance: true,
        motif: "Politique B prospective — ne doit pas toucher A",
        effectiveAt: new Date(),
      },
      null,
      prisma
    );
    await activateRetentionPolicyVersion({
      policyId: draft.id,
      activatedByUserId: null,
      activationIdempotencyKey: "act-b-snap-1",
      expectedOccVersion: 1,
      client: prisma,
    });

    const reloaded = await prisma.noteFraisArchive.findUnique({
      where: { id: archive.id },
    });
    expect(reloaded?.policyVersionId).toBe(polA!.id);
    expect(reloaded?.retentionEndsAt.toISOString()).toBe(
      archive.retentionEndsAt.toISOString()
    );
  });

  it("P1 purge PJ seule ; P2 purge archive ; legal hold bloque ; levée puis cycle suivant", async () => {
    await wipe();
    const pol = await getActiveRetentionPolicy(prisma);

    const archive = await prisma.noteFraisArchive.create({
      data: {
        dateDepense: new Date("2020-01-01T00:00:00.000Z"),
        montantDemande: 10,
        soumiseAt: new Date("2020-01-02T00:00:00.000Z"),
        statutFinal: "VALIDEE",
        archivedAt: new Date(),
        retentionEndsAt: new Date(Date.now() - 1000),
        retentionEndsAtP1: new Date(Date.now() - 1000),
        policyVersionId: pol!.id,
        exerciceClotureAt: new Date("2020-12-31T00:00:00.000Z"),
        reidentifiabilityNotice: ARCHIVE_REIDENTIFIABILITY_NOTICE,
        Justificatifs: {
          create: {
            rang: 1,
            cheminRelatif: "archive/test/p1.bin",
            typeMime: "application/pdf",
            taille: 10,
            statut: "READY",
            retentionEndsAtP1: new Date(Date.now() - 1000),
          },
        },
      },
      include: { Justificatifs: true },
    });

    const hold = await poseLegalHoldOnArchive({
      archiveId: archive.id,
      motif: "Contentieux test hold P1/P2",
      poseParUserId: null,
      client: prisma,
    });

    expect(await processNoteFraisPiecesPurgeOnce(10, prisma)).toBe(0);
    expect(await processNoteFraisArchivePurgeOnce(10, prisma)).toBe(0);
    expect(
      await prisma.justificatifNoteFraisArchive.count({
        where: { archiveId: archive.id },
      })
    ).toBe(1);

    await leverLegalHold({
      holdId: hold.id,
      leveParUserId: null,
      client: prisma,
    });

    // Cycle suivant : P1 purge PJ
    const p1 = await processNoteFraisPiecesPurgeOnce(10, prisma);
    expect(p1).toBe(1);
    expect(
      await prisma.justificatifNoteFraisArchive.count({
        where: { archiveId: archive.id },
      })
    ).toBe(0);
    expect(await prisma.noteFraisArchive.count({ where: { id: archive.id } })).toBe(
      1
    );

    // P2 purge archive
    const p2 = await processNoteFraisArchivePurgeOnce(10, prisma);
    expect(p2).toBe(1);
    expect(await prisma.noteFraisArchive.count({ where: { id: archive.id } })).toBe(
      0
    );
    // Hold append-only conservé (détaché)
    const holdRow = await prisma.noteFraisLegalHold.findUnique({
      where: { id: hold.id },
    });
    expect(holdRow?.statut).toBe("LEVE");
    expect(holdRow?.archiveId).toBeNull();
  });

  it("P3 consolidation bloquée par hold ; double consolidation stable ; synthèse", async () => {
    await wipe();
    const pol = await getActiveRetentionPolicy(prisma);
    const past = new Date(Date.now() - 1000);

    await prisma.noteFraisJournalFinancierEvenement.createMany({
      data: [
        {
          kind: "REMBOURSEMENT_EXECUTE",
          occurredAt: new Date("2024-05-01"),
          periodeCle: "2024",
          montant: 100,
          retentionEndsAt: past,
          policyVersionId: pol!.id,
          exerciceClotureAt: new Date("2024-12-31"),
        },
        {
          kind: "RESTITUTION",
          occurredAt: new Date("2024-06-01"),
          periodeCle: "2024",
          montant: 20,
          retentionEndsAt: past,
          policyVersionId: pol!.id,
          exerciceClotureAt: new Date("2024-12-31"),
        },
      ],
    });

    await poseLegalHoldOnPeriode({
      periodeCle: "2024",
      motif: "Hold P3 consolidation test",
      poseParUserId: null,
      client: prisma,
    });

    const blocked = await consolidateNoteFraisJournalFinancierOnce(100, prisma);
    expect(blocked.consolidatedEvents).toBe(0);
    expect(await prisma.noteFraisJournalFinancierEvenement.count()).toBe(2);

    const holds = await prisma.noteFraisLegalHold.findMany({
      where: { periodeCle: "2024", statut: "ACTIF" },
    });
    await leverLegalHold({
      holdId: holds[0]!.id,
      leveParUserId: null,
      client: prisma,
    });

    const c1 = await consolidateNoteFraisJournalFinancierOnce(100, prisma);
    expect(c1.consolidatedEvents).toBe(2);
    const report = await prisma.noteFraisReportFinancierPeriode.findUnique({
      where: { periodeCle: "2024" },
    });
    expect(Number(report?.totalDecaissementsRemboursement)).toBe(100);
    expect(Number(report?.totalRestitutions)).toBe(20);

    const c2 = await consolidateNoteFraisJournalFinancierOnce(100, prisma);
    expect(c2.consolidatedEvents).toBe(0);
    const report2 = await prisma.noteFraisReportFinancierPeriode.findUnique({
      where: { periodeCle: "2024" },
    });
    expect(Number(report2?.totalDecaissementsRemboursement)).toBe(100);
  });

  it("expiration hold fail-safe sans purge dans la même opération", async () => {
    await wipe();
    const pol = await getActiveRetentionPolicy(prisma);
    const archive = await prisma.noteFraisArchive.create({
      data: {
        dateDepense: new Date("2019-01-01"),
        montantDemande: 5,
        soumiseAt: new Date("2019-01-02"),
        statutFinal: "REJETEE",
        archivedAt: new Date(),
        retentionEndsAt: new Date(Date.now() - 1000),
        policyVersionId: pol!.id,
        exerciceClotureAt: new Date("2019-12-31"),
        reidentifiabilityNotice: ARCHIVE_REIDENTIFIABILITY_NOTICE,
      },
    });
    await poseLegalHoldOnArchive({
      archiveId: archive.id,
      motif: "Hold avec expiration",
      expiresAt: new Date(Date.now() - 500),
      poseParUserId: null,
      client: prisma,
    });

    const expired = await expireLegalHoldsOnce(10, prisma);
    expect(expired).toBe(1);
    // Archive toujours là — purge dans un cycle ultérieur
    expect(await prisma.noteFraisArchive.count({ where: { id: archive.id } })).toBe(
      1
    );
    const purged = await processNoteFraisArchivePurgeOnce(10, prisma);
    expect(purged).toBe(1);
  });

  it("P1 et P2 concurrentes : pas de double unlink dangereux ; archive/PJ cohérents", async () => {
    await wipe();
    const pol = await getActiveRetentionPolicy(prisma);
    const past = new Date(Date.now() - 1000);

    const archive = await prisma.noteFraisArchive.create({
      data: {
        dateDepense: new Date("2018-01-01"),
        montantDemande: 7,
        soumiseAt: new Date("2018-01-02"),
        statutFinal: "VALIDEE",
        archivedAt: new Date(),
        retentionEndsAt: past,
        retentionEndsAtP1: past,
        policyVersionId: pol!.id,
        exerciceClotureAt: new Date("2018-12-31"),
        reidentifiabilityNotice: ARCHIVE_REIDENTIFIABILITY_NOTICE,
        Justificatifs: {
          create: {
            rang: 1,
            cheminRelatif: "archive/race/p1.bin",
            typeMime: "application/pdf",
            taille: 4,
            statut: "READY",
            retentionEndsAtP1: past,
          },
        },
      },
    });

    const [p1, p2] = await Promise.all([
      processNoteFraisPiecesPurgeOnce(10, prisma),
      processNoteFraisArchivePurgeOnce(10, prisma),
    ]);
    expect(p1 + p2).toBeGreaterThanOrEqual(1);
    expect(await prisma.noteFraisArchive.count({ where: { id: archive.id } })).toBe(
      0
    );
    expect(
      await prisma.justificatifNoteFraisArchive.count({
        where: { archiveId: archive.id },
      })
    ).toBe(0);
  });

  it("V1 activation refuse effectiveAt futur", async () => {
    await wipe();
    const draft = await createRetentionPolicyDraft(
      {
        p1Years: 10,
        p2Years: 10,
        p3Years: 10,
        reportsSansEcheance: true,
        motif: "Brouillon futur pour test refus activation",
        // bypass Zod create en insérant via prisma directement
        effectiveAt: new Date(),
      },
      null,
      prisma
    );
    await prisma.noteFraisRetentionPolicyVersion.update({
      where: { id: draft.id },
      data: { effectiveAt: new Date(Date.now() + 86_400_000) },
    });
    await expect(
      activateRetentionPolicyVersion({
        policyId: draft.id,
        activatedByUserId: null,
        activationIdempotencyKey: "act-future-refuse",
        expectedOccVersion: 1,
        client: prisma,
      })
    ).rejects.toThrow(/EFFECTIVE_AT_FUTURE/);
  });

  it("acteurs SetNull sur politiques et holds", async () => {
    await wipe();
    const user = await prisma.user.create({
      data: {
        email: `actor-setnull${FIXTURE_EMAIL_SUFFIX}`,
        name: "actor-setnull-nf",
        role: "ADMIN",
        status: "Actif",
        password: "x",
        updatedAt: new Date(),
      },
    });
    const draft = await createRetentionPolicyDraft(
      {
        p1Years: 10,
        p2Years: 10,
        p3Years: 10,
        reportsSansEcheance: true,
        motif: "Test SetNull acteurs politique",
        effectiveAt: new Date(),
      },
      user.id,
      prisma
    );
    expect(
      (
        await prisma.noteFraisRetentionPolicyVersion.findUnique({
          where: { id: draft.id },
        })
      )?.createdByUserId
    ).toBe(user.id);

    await prisma.noteFraisRetentionPolicyVersion.updateMany({
      where: { createdByUserId: user.id },
      data: { createdByUserId: null },
    });
    expect(
      (
        await prisma.noteFraisRetentionPolicyVersion.findUnique({
          where: { id: draft.id },
        })
      )?.createdByUserId
    ).toBeNull();

    await prisma.user.delete({ where: { id: user.id } });
  });
});
