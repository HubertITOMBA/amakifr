/**
 * Tests PG — notifications de règlement (lot 4.5).
 * Allowlist : 127.0.0.1:55432 / amaki_notes_frais_test / amaki_test.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { resolveAuthorizedNotesFraisPgTestUrl } from "@/lib/frais-avances/pg-test-allowlist";
import { wipeNotesFraisPgFixtures } from "@/lib/frais-avances/pg-test-wipe";

const FIXTURE_EMAIL_SUFFIX = "@notes-frais-test.local";

describe("intégration PG notifications règlement (4.5)", () => {
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
    role: "ADMIN" | "TRESOR" | "MEMBRE" = "MEMBRE"
  ) {
    const id = randomUUID().replace(/-/g, "").slice(0, 24);
    return prisma.user.create({
      data: {
        id,
        email: `${tag}.${id}${FIXTURE_EMAIL_SUFFIX}`,
        name: `nf-notify-${tag}`,
        role,
        status: "Actif",
        password: "x",
        adherent: {
          create: {
            firstname: "Notify",
            lastname: tag,
            civility: "Monsieur",
          },
        },
      },
      include: { adherent: true },
    });
  }

  async function seedRembNote(params: {
    dem: Awaited<ReturnType<typeof createUser>>;
    tres: Awaited<ReturnType<typeof createUser>>;
    libelle: string;
  }) {
    const decideeAt = new Date(Date.now() - 3600_000);
    const note = await prisma.noteFrais.create({
      data: {
        adherentId: params.dem.adherent!.id,
        demandeurUserId: params.dem.id,
        libelle: params.libelle,
        dateDepense: new Date(),
        montantDemande: 50,
        montantAccepte: 50,
        statut: "VALIDEE",
        soumiseAt: decideeAt,
        decideeAt,
        decideurUserId: params.tres.id,
        decisionIdempotencyKey: `dec-${randomUUID().slice(0, 12)}`,
        version: 3,
      },
    });
    await prisma.noteFraisChoixReglement.create({
      data: {
        noteFraisId: note.id,
        mode: "REMBOURSEMENT",
        statut: "ACTIF",
        montantReference: 50,
        montantRemboursement: 50,
        montantCompensation: 0,
        idempotencyKey: `choix-${randomUUID().slice(0, 12)}`,
        choisiAt: new Date(),
      },
    });
    return { note, decideeAt };
  }

  it("remboursement : +1 notif/+1 outbox ; payload sans sensible ; worker PENDING→DONE", async () => {
    await wipe();
    const dem = await createUser("dem-w", "MEMBRE");
    const tres = await createUser("tres-w", "TRESOR");
    const { note, decideeAt } = await seedRembNote({
      dem,
      tres,
      libelle: "notify-worker",
    });

    const { executeNoteFraisRemboursement } = await import(
      "@/lib/services/frais-avances/note-frais-remboursement-service"
    );
    const res = await executeNoteFraisRemboursement({
      actorUserId: tres.id,
      noteId: note.id,
      expectedNoteVersion: 3,
      idempotencyKey: "notify-pg-remb-01",
      montant: "25.00",
      moyen: "VIREMENT",
      reference: "SENSITIVE-REF-001",
      executeAt: new Date(decideeAt.getTime() + 60_000).toISOString(),
      client: prisma,
    });
    expect(res.success).toBe(true);
    if (!res.success) return;

    const outbox = await prisma.noteFraisOutboxEvent.findFirstOrThrow({
      where: { noteFraisId: note.id, kind: "REGLEMENT_REMBOURSEMENT" },
    });
    expect(outbox.status).toBe("PENDING");
    expect(outbox.eventKey).toBe(
      `note:${note.id}:reglement:${res.data.reglementId}:remboursement`
    );
    const dumped = JSON.stringify(outbox.payload);
    expect(dumped).not.toMatch(/25\.00|VIREMENT|SENSITIVE-REF/i);
    expect(dumped).toContain("Règlement enregistré");

    expect(
      await prisma.notification.count({
        where: {
          userId: dem.id,
          lien: `/user/frais-avances/${note.id}`,
        },
      })
    ).toBe(1);

    const choixBeforeWorker = await prisma.noteFraisChoixReglement.findFirstOrThrow(
      {
        where: { noteFraisId: note.id, statut: "ACTIF" },
      }
    );
    const regsBefore = await prisma.noteFraisReglement.count({
      where: { noteFraisId: note.id },
    });

    // Worker utilise le singleton @/lib/db → brancher DATABASE_URL allowlistée.
    const testUrl = resolveAuthorizedNotesFraisPgTestUrl(process.env);
    process.env.NOTES_FRAIS_ENABLED = "true";
    process.env.DATABASE_URL = testUrl;
    // @ts-expect-error reset cache test
    globalThis.prisma = undefined;
    vi.resetModules();
    const { processNoteFraisOutboxOnce } = await import(
      "@/lib/services/frais-avances/note-frais-service"
    );
    // Pas de token → summary no_tokens → DONE (sans Expo)
    expect(await processNoteFraisOutboxOnce(10)).toBeGreaterThanOrEqual(1);

    const outboxAfter = await prisma.noteFraisOutboxEvent.findUniqueOrThrow({
      where: { id: outbox.id },
    });
    expect(outboxAfter.status).toBe("DONE");

    const choixAfterWorker = await prisma.noteFraisChoixReglement.findFirstOrThrow(
      {
        where: { noteFraisId: note.id, statut: "ACTIF" },
      }
    );
    expect(choixAfterWorker.montantRembourseUtilise.toFixed(2)).toBe(
      choixBeforeWorker.montantRembourseUtilise.toFixed(2)
    );
    expect(
      await prisma.noteFraisReglement.count({ where: { noteFraisId: note.id } })
    ).toBe(regsBefore);
  }, 60_000);

  it("flag worker off : événement reste PENDING ; finance inchangée", async () => {
    await wipe();
    const dem = await createUser("dem-flag", "MEMBRE");
    const tres = await createUser("tres-flag", "TRESOR");
    const { note, decideeAt } = await seedRembNote({
      dem,
      tres,
      libelle: "notify-flag",
    });
    const { executeNoteFraisRemboursement } = await import(
      "@/lib/services/frais-avances/note-frais-remboursement-service"
    );
    const res = await executeNoteFraisRemboursement({
      actorUserId: tres.id,
      noteId: note.id,
      expectedNoteVersion: 3,
      idempotencyKey: "notify-pg-flag-01",
      montant: "10.00",
      moyen: "ESPECES",
      reference: "FLAG-REF",
      executeAt: new Date(decideeAt.getTime() + 60_000).toISOString(),
      client: prisma,
    });
    expect(res.success).toBe(true);

    const outbox = await prisma.noteFraisOutboxEvent.findFirstOrThrow({
      where: { noteFraisId: note.id, kind: "REGLEMENT_REMBOURSEMENT" },
    });
    expect(outbox.status).toBe("PENDING");

    process.env.NOTES_FRAIS_ENABLED = "false";
    vi.resetModules();
    const { processNoteFraisOutboxOnce } = await import(
      "@/lib/services/frais-avances/note-frais-service"
    );
    expect(await processNoteFraisOutboxOnce()).toBe(0);

    const still = await prisma.noteFraisOutboxEvent.findUniqueOrThrow({
      where: { id: outbox.id },
    });
    expect(still.status).toBe("PENDING");
    process.env.NOTES_FRAIS_ENABLED = "true";
    vi.resetModules();
  }, 60_000);

  it("rollback afterNotifyOutbox remboursement : zéro écriture", async () => {
    await wipe();
    const dem = await createUser("dem-rb", "MEMBRE");
    const tres = await createUser("tres-rb", "TRESOR");
    const { note, decideeAt } = await seedRembNote({
      dem,
      tres,
      libelle: "notify-rb",
    });
    const { executeNoteFraisRemboursement } = await import(
      "@/lib/services/frais-avances/note-frais-remboursement-service"
    );
    const fail = await executeNoteFraisRemboursement({
      actorUserId: tres.id,
      noteId: note.id,
      expectedNoteVersion: 3,
      idempotencyKey: "notify-pg-rb-01",
      montant: "15.00",
      moyen: "VIREMENT",
      reference: "RB-REF",
      executeAt: new Date(decideeAt.getTime() + 60_000).toISOString(),
      client: prisma,
      afterNotifyOutbox: async () => {
        throw new Error("forced-notify-rollback");
      },
    });
    expect(fail.success).toBe(false);
    expect(
      await prisma.noteFraisReglement.count({ where: { noteFraisId: note.id } })
    ).toBe(0);
    expect(
      await prisma.noteFraisOutboxEvent.count({
        where: { noteFraisId: note.id },
      })
    ).toBe(0);
    expect(
      await prisma.notification.count({
        where: { lien: `/user/frais-avances/${note.id}` },
      })
    ).toBe(0);
    const noteAfter = await prisma.noteFrais.findUniqueOrThrow({
      where: { id: note.id },
    });
    expect(noteAfter.version).toBe(3);
  }, 60_000);

  it("replay remboursement : compteurs notif/outbox inchangés", async () => {
    await wipe();
    const dem = await createUser("dem-rp", "MEMBRE");
    const tres = await createUser("tres-rp", "TRESOR");
    const admin = await createUser("admin-rp", "ADMIN");
    const { note, decideeAt } = await seedRembNote({
      dem,
      tres,
      libelle: "notify-replay",
    });
    const { executeNoteFraisRemboursement } = await import(
      "@/lib/services/frais-avances/note-frais-remboursement-service"
    );
    const payload = {
      noteId: note.id,
      expectedNoteVersion: 3,
      idempotencyKey: "notify-pg-replay-01",
      montant: "20.00" as const,
      moyen: "VIREMENT" as const,
      reference: "REPLAY-REF",
      executeAt: new Date(decideeAt.getTime() + 60_000).toISOString(),
      client: prisma,
    };
    const first = await executeNoteFraisRemboursement({
      ...payload,
      actorUserId: tres.id,
    });
    expect(first.success).toBe(true);
    const n1 = await prisma.notification.count({
      where: { lien: `/user/frais-avances/${note.id}` },
    });
    const o1 = await prisma.noteFraisOutboxEvent.count({
      where: { noteFraisId: note.id },
    });
    expect(n1).toBe(1);
    expect(o1).toBe(1);

    const second = await executeNoteFraisRemboursement({
      ...payload,
      actorUserId: admin.id,
      expectedNoteVersion: 3,
    });
    expect(second.success).toBe(true);
    if (second.success) expect(second.data.alreadyExecuted).toBe(true);
    expect(
      await prisma.notification.count({
        where: { lien: `/user/frais-avances/${note.id}` },
      })
    ).toBe(n1);
    expect(
      await prisma.noteFraisOutboxEvent.count({
        where: { noteFraisId: note.id },
      })
    ).toBe(o1);
  }, 60_000);
});
