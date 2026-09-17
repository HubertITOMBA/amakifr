/**
 * Tests d'intégration PostgreSQL — frais avancés RGPD.
 *
 * Autorisation STRICTE (allowlist) :
 *   127.0.0.1:55432 / amaki_notes_frais_test / amaki_test
 * Un nom contenant « test » ne suffit PAS.
 *
 * Aucun fallback vers DATABASE_URL.
 * Client Prisma de test injecté explicitement.
 *
 * Init / exécution / cleanup : voir docs/frais-avances/GUIDE.md
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PrismaClient, TypeNotification } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { access, constants as fsConstants, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { resolveAuthorizedNotesFraisPgTestUrl } from "@/lib/frais-avances/pg-test-allowlist";

const STORAGE = "/tmp/amaki-notes-frais-pg-test-storage";
const FIXTURE_EMAIL_SUFFIX = "@notes-frais-test.local";

type MoveBarrier = {
  entered: Promise<void>;
  signalEntered: () => void;
  release: Promise<void>;
  signalRelease: () => void;
};

const moveBarrierRef: { current: MoveBarrier | null } = { current: null };

function createBarrier(): MoveBarrier {
  let signalEntered!: () => void;
  let signalRelease!: () => void;
  const entered = new Promise<void>((r) => {
    signalEntered = r;
  });
  const release = new Promise<void>((r) => {
    signalRelease = r;
  });
  return { entered, signalEntered, release, signalRelease };
}

vi.mock("@/lib/frais-avances/storage", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/frais-avances/storage")
  >("@/lib/frais-avances/storage");
  return {
    ...actual,
    moveFileDurable: async (sourcePath: string, targetPath: string) => {
      const b = moveBarrierRef.current;
      if (b) {
        b.signalEntered();
        await b.release;
      }
      return actual.moveFileDurable(sourcePath, targetPath);
    },
  };
});

let authorizedUrl: string | null = null;
try {
  authorizedUrl = resolveAuthorizedNotesFraisPgTestUrl(process.env);
} catch (e) {
  console.warn(
    "[notes-frais][pg-int] suite skippée:",
    e instanceof Error ? e.message : e
  );
}

const describePg = authorizedUrl ? describe : describe.skip;

describe("garde allowlist PG (toujours exécuté)", () => {
  it("sans TEST_DATABASE_URL allowlistée : pas de client Prisma test", () => {
    if (!process.env.TEST_DATABASE_URL?.trim()) {
      expect(authorizedUrl).toBeNull();
      return;
    }
    if (!authorizedUrl) {
      expect(() =>
        resolveAuthorizedNotesFraisPgTestUrl(process.env)
      ).toThrow();
      return;
    }
    expect(authorizedUrl).toContain("amaki_notes_frais_test");
  });
});

describePg("intégration PG notes-frais RGPD (base Docker allowlistée)", () => {
  let prisma: PrismaClient;
  const testUrl = authorizedUrl!;

  beforeAll(async () => {
    process.env.NOTES_FRAIS_STORAGE_ROOT = STORAGE;
    process.env.NOTES_FRAIS_ENABLED = "true";
    delete process.env.NOTES_FRAIS_SUBMITTED_JUSTIFICATIF_RETENTION;

    prisma = new PrismaClient({
      datasources: { db: { url: testUrl } },
      log: ["error"],
    });

    const id = await prisma.$queryRaw<
      Array<{ db: string; usr: string }>
    >`SELECT current_database() AS db, current_user AS usr`;
    expect(id[0]?.db).toBe("amaki_notes_frais_test");
    expect(id[0]?.usr).toBe("amaki_test");

    await mkdir(path.join(STORAGE, "tmp"), { recursive: true });
    await mkdir(path.join(STORAGE, "notes"), { recursive: true });
  });

  afterAll(async () => {
    try {
      await wipeFixtures(prisma);
    } catch {
      /* ignore */
    }
    await prisma.$disconnect();
  });

  async function wipeFixtures(client: PrismaClient) {
    await client.utilisationAvoir.deleteMany({
      where: { noteFraisReglementLigneId: { not: null } },
    });
    await client.avoir.deleteMany({
      where: { noteFraisReglementLigneId: { not: null } },
    });
    await client.noteFraisReglementLigne.deleteMany({});
    await client.noteFraisReglement.deleteMany({});
    await client.noteFraisReglementOperation.deleteMany({});
    await client.depense.deleteMany({ where: { noteFraisId: { not: null } } });
    await client.noteFraisFileJob.deleteMany({});
    await client.noteFraisArchiveAccessLog.deleteMany({});
    await client.justificatifNoteFraisArchive.deleteMany({});
    await client.noteFraisArchive.deleteMany({});
    await client.noteFraisDecision.deleteMany({});
    await client.noteFraisOutboxEvent.deleteMany({});
    await client.justificatifNoteFrais.deleteMany({});
    await client.noteFrais.deleteMany({});
    await client.notification.deleteMany({
      where: {
        OR: [
          { lien: { contains: "/admin/frais-avances/" } },
          { lien: { contains: "/user/frais-avances/" } },
        ],
      },
    });
    await client.userAdminRole.deleteMany({
      where: { user: { email: { endsWith: FIXTURE_EMAIL_SUFFIX } } },
    });
    await client.user.deleteMany({
      where: { email: { endsWith: FIXTURE_EMAIL_SUFFIX } },
    });
  }

  async function assertFileAbsent(p: string) {
    try {
      await access(p, fsConstants.F_OK);
      throw new Error(`fichier encore présent: ${p}`);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return;
      throw e;
    }
  }

  async function createUser(tag: string) {
    const id = randomUUID().replace(/-/g, "").slice(0, 24);
    const email = `${tag}.${id}${FIXTURE_EMAIL_SUFFIX}`;
    return prisma.user.create({
      data: {
        id,
        email,
        name: `nf-test-${tag}-${id}`,
        role: "MEMBRE",
        status: "Actif",
        password: "x",
        adherent: {
          create: {
            firstname: "Test",
            lastname: tag,
            civility: "Monsieur",
          },
        },
      },
      include: { adherent: true },
    });
  }

  async function createDraft(
    user: Awaited<ReturnType<typeof createUser>>,
    withFile: boolean
  ) {
    const note = await prisma.noteFrais.create({
      data: {
        adherentId: user.adherent!.id,
        demandeurUserId: user.id,
        libelle: "brouillon-test",
        dateDepense: new Date("2026-01-15"),
        montantDemande: 12.5,
        statut: "BROUILLON",
        version: 1,
      },
    });
    let abs: string | null = null;
    if (withFile) {
      const rel = `notes/${note.id}/piece.pdf`;
      abs = path.join(STORAGE, rel);
      await mkdir(path.dirname(abs), { recursive: true });
      await writeFile(abs, Buffer.from("%PDF-1.4 test"), { mode: 0o600 });
      await prisma.justificatifNoteFrais.create({
        data: {
          noteFraisId: note.id,
          nomFichierOrig: "piece.pdf",
          cheminRelatif: rel,
          typeMime: "application/pdf",
          taille: 12,
          statut: "READY",
          uploadedBy: user.id,
        },
      });
    }
    return { note, abs };
  }

  function restoreNotesSchema() {
    execFileSync(
      "npx",
      ["prisma", "db", "push", "--accept-data-loss", "--skip-generate"],
      {
        cwd: "/soft/dev/nextjs/amakifr",
        env: {
          ...process.env,
          DATABASE_URL: testUrl,
          TEST_DATABASE_URL: testUrl,
        },
        stdio: "pipe",
      }
    );
  }

  it(
    "1 — schéma frais absent : suppression compte via client injecté",
    async () => {
    // Timeout local uniquement (restauration schéma via db push) — pas de hausse globale.
    const {
      deleteUserAtomicallyWithNotesFraisRgpd,
      isNotesFraisSchemaPresent,
    } = await import("@/lib/services/frais-avances/rgpd-account-deletion");

    await wipeFixtures(prisma);
    await prisma.$executeRawUnsafe(
      "DROP TABLE IF EXISTS notes_frais_file_jobs CASCADE"
    );
    await prisma.$executeRawUnsafe(
      "DROP TABLE IF EXISTS notes_frais_outbox_events CASCADE"
    );
    await prisma.$executeRawUnsafe(
      "DROP TABLE IF EXISTS justificatifs_note_frais CASCADE"
    );
    await prisma.$executeRawUnsafe("DROP TABLE IF EXISTS notes_frais CASCADE");

    expect(await isNotesFraisSchemaPresent(prisma)).toBe(false);
    const user = await createUser("s1");
    const res = await deleteUserAtomicallyWithNotesFraisRgpd(user.id, prisma);
    expect(res.notesFrais.skippedSchemaAbsent).toBe(true);
    expect(await prisma.user.findUnique({ where: { id: user.id } })).toBeNull();

    restoreNotesSchema();
    expect(await isNotesFraisSchemaPresent(prisma)).toBe(true);
    },
    60_000
  );

  it("2 — brouillon + pièces : delete atomique + UNLINK survivants", async () => {
    const { deleteUserAtomicallyWithNotesFraisRgpd } = await import(
      "@/lib/services/frais-avances/rgpd-account-deletion"
    );
    const { processNoteFraisFileJobsOnce } = await import(
      "@/lib/services/frais-avances/note-frais-service"
    );

    await wipeFixtures(prisma);
    const user = await createUser("s2");
    const { note, abs } = await createDraft(user, true);
    await deleteUserAtomicallyWithNotesFraisRgpd(user.id, prisma);

    expect(await prisma.noteFrais.findUnique({ where: { id: note.id } })).toBeNull();
    expect(await prisma.user.findUnique({ where: { id: user.id } })).toBeNull();
    const unlinks = await prisma.noteFraisFileJob.findMany({
      where: { operation: "UNLINK" },
    });
    expect(unlinks.length).toBeGreaterThanOrEqual(1);

    await processNoteFraisFileJobsOnce(20, prisma);
    if (abs) await assertFileAbsent(abs);
  });

  it("3 — échec user.delete : rollback notes + notifs + outbox + jobs", async () => {
    await wipeFixtures(prisma);
    const user = await createUser("s3");
    const admin = await createUser("s3admin");
    const { note } = await createDraft(user, true);
    const lien = `/admin/frais-avances/${note.id}`;

    await prisma.notification.create({
      data: {
        userId: admin.id,
        type: TypeNotification.Action,
        titre: "test-notif",
        message: "rollback",
        lien,
        lue: false,
      },
    });
    await prisma.noteFraisOutboxEvent.create({
      data: {
        noteFraisId: note.id,
        eventKey: `note:${note.id}:submitted-test-rollback`,
        kind: "SUBMITTED",
        payload: { userIds: [admin.id] },
        status: "PENDING",
      },
    });

    await expect(
      prisma.$transaction(async (tx) => {
        const { prepareNotesFraisForAccountDeletion } = await import(
          "@/lib/services/frais-avances/rgpd-account-deletion"
        );
        await prepareNotesFraisForAccountDeletion(tx as never, user.id);
        throw new Error("simulated user.delete failure");
      })
    ).rejects.toThrow(/simulated user.delete failure/);

    expect(await prisma.noteFrais.findUnique({ where: { id: note.id } })).not.toBeNull();
    expect(await prisma.noteFraisFileJob.count()).toBe(0);
    expect(
      await prisma.noteFraisOutboxEvent.count({
        where: { noteFraisId: note.id, status: "PENDING" },
      })
    ).toBe(1);
    expect(await prisma.notification.count({ where: { lien } })).toBe(1);
    expect(await prisma.user.findUnique({ where: { id: user.id } })).not.toBeNull();
  });

  it("4 — SOUMISE sans politique : refus sans écritures partielles", async () => {
    const { deleteUserAtomicallyWithNotesFraisRgpd, NotesFraisRgpdBlockError } =
      await import("@/lib/services/frais-avances/rgpd-account-deletion");

    await wipeFixtures(prisma);
    delete process.env.NOTES_FRAIS_SUBMITTED_JUSTIFICATIF_RETENTION;
    const user = await createUser("s4");
    const { note } = await createDraft(user, true);
    await prisma.noteFrais.update({
      where: { id: note.id },
      data: { statut: "SOUMISE", soumiseAt: new Date() },
    });
    const beforeJobs = await prisma.noteFraisFileJob.count();

    await expect(
      deleteUserAtomicallyWithNotesFraisRgpd(user.id, prisma)
    ).rejects.toBeInstanceOf(NotesFraisRgpdBlockError);

    expect(
      (await prisma.noteFrais.findUnique({ where: { id: note.id } }))?.statut
    ).toBe("SOUMISE");
    expect(await prisma.user.findUnique({ where: { id: user.id } })).not.toBeNull();
    expect(await prisma.noteFraisFileJob.count()).toBe(beforeJobs);
  });

  it("5 — flag off + données : protection RGPD maintenue", async () => {
    const { deleteUserAtomicallyWithNotesFraisRgpd, NotesFraisRgpdBlockError } =
      await import("@/lib/services/frais-avances/rgpd-account-deletion");

    await wipeFixtures(prisma);
    process.env.NOTES_FRAIS_ENABLED = "false";
    const user = await createUser("s5");
    const { note } = await createDraft(user, true);
    await prisma.noteFrais.update({
      where: { id: note.id },
      data: { statut: "SOUMISE", soumiseAt: new Date() },
    });

    await expect(
      deleteUserAtomicallyWithNotesFraisRgpd(user.id, prisma)
    ).rejects.toBeInstanceOf(NotesFraisRgpdBlockError);
    expect(await prisma.user.findUnique({ where: { id: user.id } })).not.toBeNull();
    process.env.NOTES_FRAIS_ENABLED = "true";
  });

  it("6a — course déterministe : suppression gagnante (barrières)", async () => {
    const { deleteUserAtomicallyWithNotesFraisRgpd } = await import(
      "@/lib/services/frais-avances/rgpd-account-deletion"
    );
    const { submitNoteFrais } = await import(
      "@/lib/services/frais-avances/note-frais-service"
    );

    await wipeFixtures(prisma);
    process.env.NOTES_FRAIS_ENABLED = "true";
    const admin = await createUser("s6a-admin");
    await prisma.user.update({
      where: { id: admin.id },
      data: { role: "ADMIN", status: "Actif" },
    });
    const user = await createUser("s6a");
    const { note } = await createDraft(user, true);
    const lien = `/admin/frais-avances/${note.id}`;

    const holder = createBarrier();
    const contenderReady = createBarrier();

    const deleteP = deleteUserAtomicallyWithNotesFraisRgpd(user.id, prisma, {
      afterUserLock: async () => {
        holder.signalEntered();
        await holder.release;
      },
    }).then(
      (r) => ({ ok: true as const, r }),
      (e) => ({ ok: false as const, e })
    );

    await holder.entered;

    const submitP = submitNoteFrais({
      userId: user.id,
      noteId: note.id,
      idempotencyKey: `idem-s6a-${note.id}`.slice(0, 64),
      expectedVersion: 1,
      client: prisma,
      beforeUserLock: async () => {
        contenderReady.signalEntered();
      },
    });

    await contenderReady.entered;
    holder.signalRelease();

    const [submitRes, deleteRes] = await Promise.all([submitP, deleteP]);

    expect(deleteRes.ok).toBe(true);
    if (deleteRes.ok) {
      expect(deleteRes.r.notesFrais.draftsRemoved).toBe(1);
      expect(deleteRes.r.notesFrais.unlinkJobsEnqueued).toBeGreaterThanOrEqual(1);
    }

    expect(submitRes.success).toBe(false);

    expect(await prisma.user.findUnique({ where: { id: user.id } })).toBeNull();
    expect(await prisma.noteFrais.findUnique({ where: { id: note.id } })).toBeNull();
    expect(
      await prisma.justificatifNoteFrais.count({ where: { noteFraisId: note.id } })
    ).toBe(0);
    expect(await prisma.noteFrais.count({ where: { demandeurUserId: user.id } })).toBe(
      0
    );
    expect(await prisma.notification.count({ where: { lien } })).toBe(0);
    expect(
      await prisma.noteFraisOutboxEvent.count({
        where: {
          OR: [
            { noteFraisId: note.id },
            { eventKey: { contains: note.id } },
          ],
          kind: { in: ["SUBMITTED", "SUBMITTED_NO_RECIPIENT"] },
          status: { in: ["PENDING", "PROCESSING", "DONE"] },
        },
      })
    ).toBe(0);

    const cleanupJobs = await prisma.noteFraisFileJob.findMany({
      where: { operation: "UNLINK", status: "PENDING" },
    });
    expect(cleanupJobs.length).toBeGreaterThanOrEqual(1);
  });

  it("6b — course déterministe : soumission gagnante (barrières)", async () => {
    const { deleteUserAtomicallyWithNotesFraisRgpd, NotesFraisRgpdBlockError } =
      await import("@/lib/services/frais-avances/rgpd-account-deletion");
    const { submitNoteFrais } = await import(
      "@/lib/services/frais-avances/note-frais-service"
    );

    await wipeFixtures(prisma);
    process.env.NOTES_FRAIS_ENABLED = "true";
    delete process.env.NOTES_FRAIS_SUBMITTED_JUSTIFICATIF_RETENTION;

    const admin = await createUser("s6b-admin");
    await prisma.user.update({
      where: { id: admin.id },
      data: { role: "ADMIN", status: "Actif" },
    });
    const user = await createUser("s6b");
    const { note } = await createDraft(user, true);
    const lien = `/admin/frais-avances/${note.id}`;
    const justifsBefore = await prisma.justificatifNoteFrais.count({
      where: { noteFraisId: note.id },
    });
    expect(justifsBefore).toBe(1);
    const jobsBefore = await prisma.noteFraisFileJob.count();

    const holder = createBarrier();
    const contenderReady = createBarrier();

    const submitP = submitNoteFrais({
      userId: user.id,
      noteId: note.id,
      idempotencyKey: `idem-s6b-${note.id}`.slice(0, 64),
      expectedVersion: 1,
      client: prisma,
      afterUserLock: async () => {
        holder.signalEntered();
        await holder.release;
      },
    });

    await holder.entered;

    const deleteP = deleteUserAtomicallyWithNotesFraisRgpd(user.id, prisma, {
      beforeUserLock: async () => {
        contenderReady.signalEntered();
      },
    }).then(
      (r) => ({ ok: true as const, r }),
      (e) => ({ ok: false as const, e })
    );

    await contenderReady.entered;
    holder.signalRelease();

    const [submitRes, deleteRes] = await Promise.all([submitP, deleteP]);

    expect(submitRes.success).toBe(true);
    if (submitRes.success) {
      expect(submitRes.data.alreadySubmitted).toBe(false);
      expect(submitRes.data.recipientCount).toBeGreaterThanOrEqual(1);
    }

    expect(deleteRes.ok).toBe(false);
    if (!deleteRes.ok) {
      expect(deleteRes.e).toBeInstanceOf(NotesFraisRgpdBlockError);
    }

    expect(await prisma.user.findUnique({ where: { id: user.id } })).not.toBeNull();
    const noteLeft = await prisma.noteFrais.findUnique({ where: { id: note.id } });
    expect(noteLeft?.statut).toBe("SOUMISE");
    expect(
      await prisma.justificatifNoteFrais.count({
        where: { noteFraisId: note.id, statut: "READY" },
      })
    ).toBe(justifsBefore);

    const notifs = await prisma.notification.findMany({ where: { lien } });
    expect(notifs.length).toBeGreaterThanOrEqual(1);
    expect(notifs.some((n) => n.userId === admin.id)).toBe(true);
    expect(
      notifs.every((n) => n.titre === "Nouvelle note de frais soumise")
    ).toBe(true);

    expect(await prisma.noteFraisFileJob.count()).toBe(jobsBefore);
    expect(
      await prisma.noteFraisOutboxEvent.count({
        where: {
          noteFraisId: note.id,
          lastError: "rgpd_account_deletion_cancelled",
        },
      })
    ).toBe(0);
    expect(
      await prisma.noteFraisOutboxEvent.count({
        where: {
          noteFraisId: note.id,
          kind: { in: ["SUBMITTED", "SUBMITTED_NO_RECIPIENT"] },
          status: "PENDING",
        },
      })
    ).toBe(1);
  });

  it("7 — course MOVE en cours / UNLINK (barrières) puis workers : aucun fichier final", async () => {
    const { deleteUserAtomicallyWithNotesFraisRgpd } = await import(
      "@/lib/services/frais-avances/rgpd-account-deletion"
    );
    const { processNoteFraisFileJobsOnce } = await import(
      "@/lib/services/frais-avances/note-frais-service"
    );

    await wipeFixtures(prisma);
    process.env.NOTES_FRAIS_ENABLED = "true";
    process.env.NOTES_FRAIS_STORAGE_ROOT = STORAGE;

    const user = await createUser("s7");
    const { note } = await createDraft(user, false);
    const tmp = path.join(STORAGE, "tmp", `${randomUUID()}.pdf`);
    const finalAbs = path.join(STORAGE, "notes", note.id, "j.pdf");
    await writeFile(tmp, Buffer.from("%PDF-1.4 barrier"), { mode: 0o600 });
    await mkdir(path.dirname(finalAbs), { recursive: true });

    await prisma.justificatifNoteFrais.create({
      data: {
        noteFraisId: note.id,
        nomFichierOrig: "j.pdf",
        cheminRelatif: `notes/${note.id}/j.pdf`,
        typeMime: "application/pdf",
        taille: 8,
        statut: "PENDING",
        uploadedBy: user.id,
      },
    });
    await prisma.noteFraisFileJob.create({
      data: {
        noteFraisId: note.id,
        operation: "MOVE",
        sourcePath: tmp,
        targetPath: finalAbs,
        status: "PENDING",
      },
    });

    const barrier = createBarrier();
    moveBarrierRef.current = barrier;

    const workerP = processNoteFraisFileJobsOnce(5, prisma);
    await barrier.entered;

    const deleteP = deleteUserAtomicallyWithNotesFraisRgpd(user.id, prisma);
    await deleteP;

    barrier.signalRelease();
    await workerP;

    // Reprise workers : UNLINK + éventuels restes
    await processNoteFraisFileJobsOnce(20, prisma);
    await processNoteFraisFileJobsOnce(20, prisma);

    moveBarrierRef.current = null;

    await assertFileAbsent(tmp);
    await assertFileAbsent(finalAbs);

    const pendingMoves = await prisma.noteFraisFileJob.count({
      where: {
        operation: "MOVE",
        status: { in: ["PENDING", "PROCESSING"] },
      },
    });
    expect(pendingMoves).toBe(0);
  });

  it("8 — FK Restrict empêche user.delete direct silencieux", async () => {
    await wipeFixtures(prisma);
    const user = await createUser("s8");
    const { note } = await createDraft(user, true);
    await prisma.noteFrais.update({
      where: { id: note.id },
      data: { statut: "SOUMISE", soumiseAt: new Date() },
    });

    let blocked = false;
    try {
      await prisma.user.delete({ where: { id: user.id } });
    } catch (e) {
      const err = e as { code?: string; message?: string };
      if (
        err.code === "P2003" ||
        String(err.message || "")
          .toLowerCase()
          .includes("foreign key")
      ) {
        blocked = true;
      } else {
        throw e;
      }
    }
    expect(blocked).toBe(true);
    expect(await prisma.user.findUnique({ where: { id: user.id } })).not.toBeNull();
    expect(await prisma.noteFrais.findUnique({ where: { id: note.id } })).not.toBeNull();
  });
});
