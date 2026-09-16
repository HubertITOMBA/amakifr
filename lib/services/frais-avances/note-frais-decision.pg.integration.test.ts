/**
 * Tests PG — décision notes de frais (lot 2).
 * Allowlist : 127.0.0.1:55432 / amaki_notes_frais_test / amaki_test.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { resolveAuthorizedNotesFraisPgTestUrl } from "@/lib/frais-avances/pg-test-allowlist";

const STORAGE = "/tmp/amaki-notes-frais-pg-decision-storage";
const FIXTURE_EMAIL_SUFFIX = "@notes-frais-test.local";

describe("intégration PG décision notes-frais", () => {
  let prisma: PrismaClient;
  let url: string;

  beforeAll(async () => {
    process.env.NOTES_FRAIS_ENABLED = "true";
    process.env.NOTES_FRAIS_STORAGE_ROOT = STORAGE;
    vi.resetModules();
    url = resolveAuthorizedNotesFraisPgTestUrl(process.env);
    prisma = new PrismaClient({ datasources: { db: { url } } });
    await prisma.$connect();
    await mkdir(STORAGE, { recursive: true });
  }, 60_000);

  afterAll(async () => {
    await wipe();
    await prisma.$disconnect();
  });

  async function wipe() {
    await prisma.noteFraisFileJob.deleteMany({});
    await prisma.noteFraisArchiveAccessLog.deleteMany({});
    await prisma.justificatifNoteFraisArchive.deleteMany({});
    await prisma.noteFraisArchive.deleteMany({});
    await prisma.noteFraisDecision.deleteMany({});
    await prisma.noteFraisOutboxEvent.deleteMany({});
    await prisma.justificatifNoteFrais.deleteMany({});
    await prisma.noteFrais.deleteMany({});
    await prisma.notification.deleteMany({
      where: {
        OR: [
          { lien: { contains: "/admin/frais-avances/" } },
          { lien: { contains: "/user/frais-avances/" } },
        ],
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
    role: "ADMIN" | "TRESOR" | "PRESID" | "SECRET" | "COMCPT" | "MEMBRE",
    status: "Actif" | "Inactif" = "Actif"
  ) {
    const id = randomUUID().replace(/-/g, "").slice(0, 24);
    const email = `${tag}.${id}${FIXTURE_EMAIL_SUFFIX}`;
    return prisma.user.create({
      data: {
        id,
        email,
        name: `nf-dec-${tag}-${id}`,
        role,
        status,
        password: "x",
        adherent: {
          create: {
            firstname: "Dec",
            lastname: tag,
            civility: "Monsieur",
          },
        },
      },
      include: { adherent: true },
    });
  }

  async function createSubmittedNote(
    user: Awaited<ReturnType<typeof createUser>>,
    montant = 80
  ) {
    const note = await prisma.noteFrais.create({
      data: {
        adherentId: user.adherent!.id,
        demandeurUserId: user.id,
        libelle: "Note décision PG",
        dateDepense: new Date("2026-03-01"),
        montantDemande: montant,
        statut: "SOUMISE",
        soumiseAt: new Date(),
        submitIdempotencyKey: `sub-${randomUUID().slice(0, 12)}`,
        version: 2,
      },
    });
    const rel = `notes/${note.id}/j.pdf`;
    const abs = path.join(STORAGE, rel);
    await mkdir(path.dirname(abs), { recursive: true });
    await writeFile(abs, Buffer.from("%PDF-1.4 dec"), { mode: 0o600 });
    await prisma.justificatifNoteFrais.create({
      data: {
        noteFraisId: note.id,
        nomFichierOrig: "j.pdf",
        cheminRelatif: rel,
        typeMime: "application/pdf",
        taille: 12,
        statut: "READY",
        uploadedBy: user.id,
      },
    });
    return note;
  }

  it("validation totale : journal + notif + outbox atomiques", async () => {
    await wipe();
    const dem = await createUser("dem", "MEMBRE");
    const tres = await createUser("tres", "TRESOR");
    const note = await createSubmittedNote(dem, 80);

    const { decideNoteFrais } = await import(
      "@/lib/services/frais-avances/note-frais-decision-service"
    );
    const res = await decideNoteFrais({
      actorUserId: tres.id,
      noteId: note.id,
      expectedVersion: 2,
      idempotencyKey: "decide-ok-total-01",
      outcome: "VALIDEE",
      montantAccepte: 80,
      client: prisma,
    });
    expect(res.success).toBe(true);

    const updated = await prisma.noteFrais.findUniqueOrThrow({
      where: { id: note.id },
      include: { Decision: true },
    });
    expect(updated.statut).toBe("VALIDEE");
    expect(updated.Decision?.statutFinal).toBe("VALIDEE");
    expect(Number(updated.montantAccepte)).toBe(80);

    const notifs = await prisma.notification.findMany({
      where: { userId: dem.id, lien: `/user/frais-avances/${note.id}` },
    });
    expect(notifs).toHaveLength(1);

    const outbox = await prisma.noteFraisOutboxEvent.findMany({
      where: { eventKey: `note:${note.id}:decided` },
    });
    expect(outbox).toHaveLength(1);
    expect(outbox[0]?.kind).toBe("DECIDED");
  });

  it("deux décisions concurrentes : une seule effective", async () => {
    await wipe();
    const dem = await createUser("demc", "MEMBRE");
    const t1 = await createUser("t1", "TRESOR");
    const t2 = await createUser("t2", "ADMIN");
    const note = await createSubmittedNote(dem, 50);

    const { decideNoteFrais } = await import(
      "@/lib/services/frais-avances/note-frais-decision-service"
    );

    const [r1, r2] = await Promise.all([
      decideNoteFrais({
        actorUserId: t1.id,
        noteId: note.id,
        expectedVersion: 2,
        idempotencyKey: "decide-race-a",
        outcome: "VALIDEE",
        montantAccepte: 50,
        client: prisma,
      }),
      decideNoteFrais({
        actorUserId: t2.id,
        noteId: note.id,
        expectedVersion: 2,
        idempotencyKey: "decide-race-b",
        outcome: "REJETEE",
        motif: "trop tard",
        client: prisma,
      }),
    ]);

    const successes = [r1, r2].filter((r) => r.success);
    const failures = [r1, r2].filter((r) => !r.success);
    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);

    const final = await prisma.noteFrais.findUniqueOrThrow({
      where: { id: note.id },
    });
    expect(["VALIDEE", "REJETEE"]).toContain(final.statut);
    expect(
      await prisma.noteFraisDecision.count({ where: { noteFraisId: note.id } })
    ).toBe(1);
    expect(
      await prisma.noteFraisOutboxEvent.count({
        where: { eventKey: `note:${note.id}:decided` },
      })
    ).toBe(1);
  });

  it("rollback TX si échec après claim : note reste SOUMISE", async () => {
    await wipe();
    const dem = await createUser("demr", "MEMBRE");
    const tres = await createUser("tresr", "TRESOR");
    const note = await createSubmittedNote(dem, 30);

    const { decideNoteFrais } = await import(
      "@/lib/services/frais-avances/note-frais-decision-service"
    );

    // Force échec en injectant un client dont noteFraisDecision.create throw
    // après updateMany — via proxy sur $transaction interne impossible ;
    // on simule via motif invalide post-lock n'est pas possible.
    // Approche : outbox eventKey unique pré-insérée pour faire échouer create outbox.
    await prisma.noteFraisOutboxEvent.create({
      data: {
        noteFraisId: note.id,
        eventKey: `note:${note.id}:decided`,
        kind: "DECIDED",
        payload: {},
        status: "DONE",
      },
    });

    const res = await decideNoteFrais({
      actorUserId: tres.id,
      noteId: note.id,
      expectedVersion: 2,
      idempotencyKey: "decide-rollback-01",
      outcome: "VALIDEE",
      montantAccepte: 30,
      client: prisma,
    });
    expect(res.success).toBe(false);

    const still = await prisma.noteFrais.findUniqueOrThrow({
      where: { id: note.id },
    });
    expect(still.statut).toBe("SOUMISE");
    expect(await prisma.noteFraisDecision.count({ where: { noteFraisId: note.id } })).toBe(0);
    expect(
      await prisma.notification.count({
        where: { userId: dem.id, lien: `/user/frais-avances/${note.id}` },
      })
    ).toBe(0);
  });

  it("rôles : additionnel TRESOR OK ; PRESID/inactif/auto refusés", async () => {
    await wipe();
    const dem = await createUser("demrole", "MEMBRE");
    const membre = await createUser("membrole", "MEMBRE");
    await prisma.userAdminRole.create({
      data: { userId: membre.id, role: "TRESOR", createdBy: dem.id },
    });
    const presid = await createUser("pres", "PRESID");
    const inactive = await createUser("inact", "TRESOR", "Inactif");
    const note = await createSubmittedNote(dem, 20);

    const { decideNoteFrais } = await import(
      "@/lib/services/frais-avances/note-frais-decision-service"
    );

    const ok = await decideNoteFrais({
      actorUserId: membre.id,
      noteId: note.id,
      expectedVersion: 2,
      idempotencyKey: "decide-add-tresor",
      outcome: "VALIDEE",
      montantAccepte: 20,
      client: prisma,
    });
    expect(ok.success).toBe(true);

    const note2 = await createSubmittedNote(dem, 21);
    const badPres = await decideNoteFrais({
      actorUserId: presid.id,
      noteId: note2.id,
      expectedVersion: 2,
      idempotencyKey: "decide-pres-no",
      outcome: "VALIDEE",
      montantAccepte: 21,
      client: prisma,
    });
    expect(badPres.success).toBe(false);

    const badInact = await decideNoteFrais({
      actorUserId: inactive.id,
      noteId: note2.id,
      expectedVersion: 2,
      idempotencyKey: "decide-inact-no",
      outcome: "VALIDEE",
      montantAccepte: 21,
      client: prisma,
    });
    expect(badInact.success).toBe(false);

    const auto = await decideNoteFrais({
      actorUserId: dem.id,
      noteId: note2.id,
      expectedVersion: 2,
      idempotencyKey: "decide-auto-no",
      outcome: "VALIDEE",
      montantAccepte: 21,
      client: prisma,
    });
    expect(auto.success).toBe(false);
    if (!auto.success) expect(auto.code).toBe("AUTO_DECISION_FORBIDDEN");
  });

  it("REJETEE immuable + correction + RGPD refuse sans politique", async () => {
    await wipe();
    const dem = await createUser("demrej", "MEMBRE");
    const tres = await createUser("tresrej", "TRESOR");
    const note = await createSubmittedNote(dem, 15);

    const {
      decideNoteFrais,
      createCorrectedNoteFraisDraft,
    } = await import(
      "@/lib/services/frais-avances/note-frais-decision-service"
    );
    const { deleteUserAtomicallyWithNotesFraisRgpd } = await import(
      "@/lib/services/frais-avances/rgpd-account-deletion"
    );

    const rej = await decideNoteFrais({
      actorUserId: tres.id,
      noteId: note.id,
      expectedVersion: 2,
      idempotencyKey: "decide-reject-01",
      outcome: "REJETEE",
      motif: "Pièce illisible",
      client: prisma,
    });
    expect(rej.success).toBe(true);

    const corr = await createCorrectedNoteFraisDraft({
      userId: dem.id,
      corrigeNoteFraisId: note.id,
      client: prisma,
    });
    expect(corr.success).toBe(true);
    if (corr.success) {
      const draft = await prisma.noteFrais.findUniqueOrThrow({
        where: { id: corr.data.id },
      });
      expect(draft.statut).toBe("BROUILLON");
      expect(draft.corrigeNoteFraisId).toBe(note.id);
    }

    await expect(
      deleteUserAtomicallyWithNotesFraisRgpd(dem.id, prisma)
    ).rejects.toMatchObject({ code: "NOTES_FRAIS_SUBMITTED_RETENTION_REQUIRED" });

    // Avec politique injectée : archive REJETEE + purge brouillon correction
    await deleteUserAtomicallyWithNotesFraisRgpd(dem.id, prisma, {
      injectedRetention: { durationMs: 60_000, startsAt: "archivedAt" },
    });
    expect(await prisma.noteFrais.count({ where: { demandeurUserId: dem.id } })).toBe(0);
    const arch = await prisma.noteFraisArchive.findFirst({
      where: { statutFinal: "REJETEE" },
    });
    expect(arch).not.toBeNull();
    expect(await prisma.user.findUnique({ where: { id: dem.id } })).toBeNull();
  });
});
