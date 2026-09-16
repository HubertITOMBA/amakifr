/**
 * Tests PG — archive privée notes de frais.
 * Allowlist stricte 127.0.0.1:55432 / amaki_notes_frais_test / amaki_test.
 * Politique injectée uniquement (aucune durée produit).
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { access, constants as fsConstants, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { resolveAuthorizedNotesFraisPgTestUrl } from "@/lib/frais-avances/pg-test-allowlist";
import { ARCHIVE_REIDENTIFIABILITY_NOTICE } from "@/lib/frais-avances/retention-policy";

const STORAGE = "/tmp/amaki-notes-frais-pg-archive-storage";
const FIXTURE_EMAIL_SUFFIX = "@notes-frais-test.local";

type Barrier = {
  entered: Promise<void>;
  signalEntered: () => void;
  release: Promise<void>;
  signalRelease: () => void;
};

const moveBarrierRef: { current: Barrier | null } = { current: null };

function createBarrier(): Barrier {
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
    "[notes-frais][pg-archive] skip:",
    e instanceof Error ? e.message : e
  );
}

const describePg = authorizedUrl ? describe : describe.skip;

describePg("intégration PG archive privée notes-frais", () => {
  let prisma: PrismaClient;
  const testUrl = authorizedUrl!;
  const injectedRetention = {
    durationMs: 60_000,
    startsAt: "archivedAt" as const,
  };

  beforeAll(async () => {
    process.env.NOTES_FRAIS_STORAGE_ROOT = STORAGE;
    process.env.NOTES_FRAIS_ENABLED = "true";
    delete process.env.NOTES_FRAIS_SUBMITTED_JUSTIFICATIF_RETENTION;

    // Garantir le schéma (évite la course avec le scénario DROP du fichier RGPD).
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
    await mkdir(path.join(STORAGE, "archive"), { recursive: true });
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

  async function assertAbsent(p: string) {
    try {
      await access(p, fsConstants.F_OK);
      throw new Error(`fichier encore présent: ${p}`);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return;
      throw e;
    }
  }

  async function createUser(
    tag: string,
    role: "MEMBRE" | "ADMIN" | "TRESOR" | "COMCPT" | "SECRET" | "PRESID" = "MEMBRE",
    status: "Actif" | "Inactif" = "Actif"
  ) {
    const id = randomUUID().replace(/-/g, "").slice(0, 24);
    return prisma.user.create({
      data: {
        id,
        email: `${tag}.${id}${FIXTURE_EMAIL_SUFFIX}`,
        name: `nf-arch-${tag}-${id}`,
        role,
        status,
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

  async function grantAdditionalRole(
    userId: string,
    role: "ADMIN" | "TRESOR" | "COMCPT",
    createdBy: string
  ) {
    await prisma.userAdminRole.create({
      data: { userId, role, createdBy },
    });
  }

  async function createSoumiseWithFile(
    user: Awaited<ReturnType<typeof createUser>>
  ) {
    const note = await prisma.noteFrais.create({
      data: {
        adherentId: user.adherent!.id,
        demandeurUserId: user.id,
        libelle: "soumise-archive",
        dateDepense: new Date("2026-02-01"),
        montantDemande: 42.5,
        statut: "SOUMISE",
        soumiseAt: new Date("2026-02-02"),
        version: 2,
      },
    });
    const rel = `notes/${note.id}/piece.pdf`;
    const abs = path.join(STORAGE, rel);
    await mkdir(path.dirname(abs), { recursive: true });
    await writeFile(abs, Buffer.from("%PDF-1.4 archive-test"), { mode: 0o600 });
    await prisma.justificatifNoteFrais.create({
      data: {
        noteFraisId: note.id,
        nomFichierOrig: "piece.pdf",
        cheminRelatif: rel,
        typeMime: "application/pdf",
        taille: 20,
        statut: "READY",
        uploadedBy: user.id,
      },
    });
    return { note, abs, rel };
  }

  it("sans politique injectée : SOUMISE bloque toujours", async () => {
    const { deleteUserAtomicallyWithNotesFraisRgpd, NotesFraisRgpdBlockError } =
      await import("@/lib/services/frais-avances/rgpd-account-deletion");
    await wipe();
    const user = await createUser("block");
    await createSoumiseWithFile(user);
    await expect(
      deleteUserAtomicallyWithNotesFraisRgpd(user.id, prisma)
    ).rejects.toBeInstanceOf(NotesFraisRgpdBlockError);
    expect(await prisma.noteFraisArchive.count()).toBe(0);
    expect(await prisma.user.findUnique({ where: { id: user.id } })).not.toBeNull();
  });

  it("archivage atomique + MOVE → READY + download", async () => {
    const { deleteUserAtomicallyWithNotesFraisRgpd } = await import(
      "@/lib/services/frais-avances/rgpd-account-deletion"
    );
    const { processNoteFraisFileJobsOnce } = await import(
      "@/lib/services/frais-avances/note-frais-service"
    );
    const {
      downloadNotesFraisArchiveJustificatif,
      listNotesFraisArchives,
    } = await import("@/lib/services/frais-avances/note-frais-archive-service");
    const { canUserReadNotesFraisArchive } = await import(
      "@/lib/frais-avances/authz"
    );

    await wipe();
    const reader = await createUser("reader", "COMCPT");
    const user = await createUser("arch");
    const { note, abs } = await createSoumiseWithFile(user);

    const res = await deleteUserAtomicallyWithNotesFraisRgpd(user.id, prisma, {
      injectedRetention,
    });
    expect(res.notesFrais.archivesCreated).toBe(1);
    expect(res.notesFrais.archiveMoveJobs).toBe(1);
    expect(await prisma.user.findUnique({ where: { id: user.id } })).toBeNull();
    expect(await prisma.noteFrais.findUnique({ where: { id: note.id } })).toBeNull();

    const archive = await prisma.noteFraisArchive.findFirst({
      include: { Justificatifs: true },
    });
    expect(archive).not.toBeNull();
    expect(archive!.reidentifiabilityNotice).toBe(ARCHIVE_REIDENTIFIABILITY_NOTICE);
    expect(archive!.Justificatifs[0]?.statut).toBe("PENDING");

    await processNoteFraisFileJobsOnce(10, prisma);
    const justif = await prisma.justificatifNoteFraisArchive.findFirst({
      where: { archiveId: archive!.id },
    });
    expect(justif?.statut).toBe("READY");
    await assertAbsent(abs);
    const targetAbs = path.join(STORAGE, justif!.cheminRelatif);
    // source live absente ; cible archive présente (READY)
    const { access: fsAccess, constants: c } = await import("node:fs/promises");
    await fsAccess(targetAbs, c.F_OK);

    expect(await canUserReadNotesFraisArchive(reader.id, prisma)).toBe(true);
    const membre = await createUser("membre", "MEMBRE");
    expect(await canUserReadNotesFraisArchive(membre.id, prisma)).toBe(false);

    const list = await listNotesFraisArchives({
      userId: reader.id,
      client: prisma,
    });
    expect(list.success).toBe(true);
    if (list.success) {
      expect(list.data[0]).not.toHaveProperty("cheminRelatif");
      expect(JSON.stringify(list.data)).not.toContain("cheminRelatif");
    }

    const dlPending = await downloadNotesFraisArchiveJustificatif({
      userId: reader.id,
      justificatifId: justif!.id,
      client: prisma,
    });
    // already READY after worker
    expect(dlPending.success).toBe(true);

    const refused = await downloadNotesFraisArchiveJustificatif({
      userId: membre.id,
      justificatifId: justif!.id,
      client: prisma,
    });
    expect(refused.success).toBe(false);
  });

  it("rollback si user.delete échoue après insert archive", async () => {
    await wipe();
    const user = await createUser("rb");
    await createSoumiseWithFile(user);

    await expect(
      prisma.$transaction(async (tx) => {
        const { prepareNotesFraisForAccountDeletion } = await import(
          "@/lib/services/frais-avances/rgpd-account-deletion"
        );
        await prepareNotesFraisForAccountDeletion(tx as never, user.id, {
          injectedRetention,
        });
        throw new Error("simulated user.delete failure");
      })
    ).rejects.toThrow(/simulated user.delete failure/);

    expect(await prisma.noteFraisArchive.count()).toBe(0);
    expect(await prisma.justificatifNoteFraisArchive.count()).toBe(0);
    expect(
      await prisma.noteFrais.count({ where: { demandeurUserId: user.id } })
    ).toBe(1);
    expect(await prisma.user.findUnique({ where: { id: user.id } })).not.toBeNull();
  });

  it("journaux d'accès : SetNull ne bloque pas delete admin", async () => {
    await wipe();
    const admin = await createUser("logadmin", "ADMIN");
    const archive = await prisma.noteFraisArchive.create({
      data: {
        dateDepense: new Date(),
        montantDemande: 1,
        soumiseAt: new Date(),
        statutFinal: "SOUMISE",
        archivedAt: new Date(),
        retentionEndsAt: new Date(Date.now() + 60_000),
        reidentifiabilityNotice: ARCHIVE_REIDENTIFIABILITY_NOTICE,
      },
    });
    await prisma.noteFraisArchiveAccessLog.create({
      data: {
        archiveId: archive.id,
        actorUserId: admin.id,
        action: "VIEW",
      },
    });
    await prisma.user.delete({ where: { id: admin.id } });
    const log = await prisma.noteFraisArchiveAccessLog.findFirst({
      where: { archiveId: archive.id },
    });
    expect(log?.actorUserId).toBeNull();
  });

  it("purge pendant MOVE : source ET cible absentes (barrières)", async () => {
    const { deleteUserAtomicallyWithNotesFraisRgpd } = await import(
      "@/lib/services/frais-avances/rgpd-account-deletion"
    );
    const { processNoteFraisFileJobsOnce } = await import(
      "@/lib/services/frais-avances/note-frais-service"
    );
    const { processNoteFraisArchivePurgeOnce } = await import(
      "@/lib/services/frais-avances/note-frais-archive-service"
    );

    await wipe();
    const user = await createUser("purge");
    const { abs: sourceAbs } = await createSoumiseWithFile(user);

    await deleteUserAtomicallyWithNotesFraisRgpd(user.id, prisma, {
      injectedRetention: { durationMs: 1, startsAt: "archivedAt" },
    });

    const moveJob = await prisma.noteFraisFileJob.findFirst({
      where: { operation: "MOVE", status: "PENDING" },
    });
    expect(moveJob?.sourcePath).toBeTruthy();
    expect(moveJob?.targetPath).toBeTruthy();
    const targetAbs = moveJob!.targetPath!;

    const barrier = createBarrier();
    moveBarrierRef.current = barrier;
    const workerP = processNoteFraisFileJobsOnce(5, prisma);
    await barrier.entered;

    await processNoteFraisArchivePurgeOnce(10, prisma, new Date());

    barrier.signalRelease();
    await workerP;
    await processNoteFraisFileJobsOnce(20, prisma);
    moveBarrierRef.current = null;

    expect(await prisma.noteFraisArchive.count()).toBe(0);
    expect(await prisma.justificatifNoteFraisArchive.count()).toBe(0);
    await assertAbsent(sourceAbs);
    await assertAbsent(targetAbs);
    await assertAbsent(moveJob!.sourcePath!);
  });

  it("ordre déterministe A : UNLINK pending avant MOVE FS → abort, aucun fichier", async () => {
    const { processNoteFraisFileJobsOnce } = await import(
      "@/lib/services/frais-avances/note-frais-service"
    );
    await wipe();
    const sourceAbs = path.join(STORAGE, "tmp", `${randomUUID()}.pdf`);
    const targetAbs = path.join(STORAGE, "archive", "ordA", "x.pdf");
    await mkdir(path.dirname(sourceAbs), { recursive: true });
    await mkdir(path.dirname(targetAbs), { recursive: true });
    await writeFile(sourceAbs, Buffer.from("%PDF-1.4 ordA"), { mode: 0o600 });

    // MOVE créé avant UNLINK → traité en premier (orderBy createdAt) alors qu'UNLINK est encore PENDING
    await prisma.noteFraisFileJob.create({
      data: {
        archiveJustificatifId: "ordA-j",
        operation: "MOVE",
        sourcePath: sourceAbs,
        targetPath: targetAbs,
        status: "PENDING",
      },
    });
    await prisma.noteFraisFileJob.create({
      data: {
        archiveJustificatifId: "ordA-j",
        operation: "UNLINK",
        targetPath: targetAbs,
        status: "PENDING",
      },
    });
    await prisma.noteFraisFileJob.create({
      data: {
        archiveJustificatifId: "ordA-j",
        operation: "UNLINK",
        targetPath: sourceAbs,
        status: "PENDING",
      },
    });

    moveBarrierRef.current = null;
    await processNoteFraisFileJobsOnce(20, prisma);

    const move = await prisma.noteFraisFileJob.findFirst({
      where: { archiveJustificatifId: "ordA-j", operation: "MOVE" },
    });
    expect(move?.status).toBe("FAILED");
    expect(move?.lastError).toBe("move_aborted_unlink_pending");
    await assertAbsent(sourceAbs);
    await assertAbsent(targetAbs);
  });

  it("ordre déterministe B : MOVE terminé puis purge/UNLINK → aucun fichier", async () => {
    const { processNoteFraisFileJobsOnce } = await import(
      "@/lib/services/frais-avances/note-frais-service"
    );
    const { processNoteFraisArchivePurgeOnce } = await import(
      "@/lib/services/frais-avances/note-frais-archive-service"
    );
    await wipe();

    const archive = await prisma.noteFraisArchive.create({
      data: {
        dateDepense: new Date(),
        montantDemande: 9,
        soumiseAt: new Date(),
        statutFinal: "SOUMISE",
        archivedAt: new Date(),
        retentionEndsAt: new Date(Date.now() - 1000),
        reidentifiabilityNotice: ARCHIVE_REIDENTIFIABILITY_NOTICE,
      },
    });
    const justifId = randomUUID().replace(/-/g, "").slice(0, 24);
    const rel = `archive/${archive.id}/${justifId}.pdf`;
    const targetAbs = path.join(STORAGE, rel);
    const sourceAbs = path.join(STORAGE, "tmp", `${justifId}.pdf`);
    await mkdir(path.dirname(sourceAbs), { recursive: true });
    await mkdir(path.dirname(targetAbs), { recursive: true });
    await writeFile(sourceAbs, Buffer.from("%PDF-1.4 ordB"), { mode: 0o600 });

    await prisma.justificatifNoteFraisArchive.create({
      data: {
        id: justifId,
        archiveId: archive.id,
        nomFichierOrig: "ordB.pdf",
        cheminRelatif: rel,
        typeMime: "application/pdf",
        taille: 12,
        statut: "PENDING",
      },
    });
    await prisma.noteFraisFileJob.create({
      data: {
        archiveJustificatifId: justifId,
        operation: "MOVE",
        sourcePath: sourceAbs,
        targetPath: targetAbs,
        status: "PENDING",
      },
    });

    moveBarrierRef.current = null;
    await processNoteFraisFileJobsOnce(5, prisma);
    const ready = await prisma.justificatifNoteFraisArchive.findUnique({
      where: { id: justifId },
    });
    expect(ready?.statut).toBe("READY");
    await assertAbsent(sourceAbs);

    await processNoteFraisArchivePurgeOnce(10, prisma, new Date());
    await processNoteFraisFileJobsOnce(20, prisma);

    expect(await prisma.noteFraisArchive.count()).toBe(0);
    await assertAbsent(sourceAbs);
    await assertAbsent(targetAbs);
  });

  it("rôles additionnels ADMIN/TRESOR/COMCPT OK ; inactif et non habilité refusés", async () => {
    const { canUserReadNotesFraisArchive } = await import(
      "@/lib/frais-avances/authz"
    );
    await wipe();
    const grantor = await createUser("grantor", "ADMIN");

    for (const role of ["ADMIN", "TRESOR", "COMCPT"] as const) {
      const u = await createUser(`add-${role}`, "MEMBRE", "Actif");
      await grantAdditionalRole(u.id, role, grantor.id);
      expect(await canUserReadNotesFraisArchive(u.id, prisma)).toBe(true);
    }

    const inactive = await createUser("inact", "ADMIN", "Inactif");
    expect(await canUserReadNotesFraisArchive(inactive.id, prisma)).toBe(false);

    const secret = await createUser("secret", "SECRET", "Actif");
    expect(await canUserReadNotesFraisArchive(secret.id, prisma)).toBe(false);

    const presid = await createUser("presid", "PRESID", "Actif");
    expect(await canUserReadNotesFraisArchive(presid.id, prisma)).toBe(false);

    const membre = await createUser("plain", "MEMBRE", "Actif");
    expect(await canUserReadNotesFraisArchive(membre.id, prisma)).toBe(false);
  });

  it("download refuse PENDING", async () => {
    const { downloadNotesFraisArchiveJustificatif } = await import(
      "@/lib/services/frais-avances/note-frais-archive-service"
    );
    await wipe();
    const reader = await createUser("dl", "TRESOR");
    const archive = await prisma.noteFraisArchive.create({
      data: {
        dateDepense: new Date(),
        montantDemande: 5,
        soumiseAt: new Date(),
        statutFinal: "SOUMISE",
        archivedAt: new Date(),
        retentionEndsAt: new Date(Date.now() + 3600_000),
        reidentifiabilityNotice: ARCHIVE_REIDENTIFIABILITY_NOTICE,
      },
    });
    const j = await prisma.justificatifNoteFraisArchive.create({
      data: {
        archiveId: archive.id,
        nomFichierOrig: "x.pdf",
        cheminRelatif: `archive/${archive.id}/x.pdf`,
        typeMime: "application/pdf",
        taille: 1,
        statut: "PENDING",
      },
    });
    const res = await downloadNotesFraisArchiveJustificatif({
      userId: reader.id,
      justificatifId: j.id,
      client: prisma,
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toMatch(/READY/);
    }
  });
});
