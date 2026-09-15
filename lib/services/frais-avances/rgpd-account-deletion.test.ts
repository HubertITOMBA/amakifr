import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const {
  $transaction,
  $executeRaw,
  $queryRaw,
  noteFindFirst,
  noteFindMany,
  noteDeleteMany,
  justifFindMany,
  justifDeleteMany,
  fileJobCreate,
  fileJobFindMany,
  fileJobUpdateMany,
  fileJobCount,
  outboxUpdateMany,
  notificationDeleteMany,
  userDelete,
} = vi.hoisted(() => ({
  $transaction: vi.fn(),
  $executeRaw: vi.fn(),
  $queryRaw: vi.fn(),
  noteFindFirst: vi.fn(),
  noteFindMany: vi.fn(),
  noteDeleteMany: vi.fn(),
  justifFindMany: vi.fn(),
  justifDeleteMany: vi.fn(),
  fileJobCreate: vi.fn(),
  fileJobFindMany: vi.fn(),
  fileJobUpdateMany: vi.fn(),
  fileJobCount: vi.fn(),
  outboxUpdateMany: vi.fn(),
  notificationDeleteMany: vi.fn(),
  userDelete: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    $transaction: (...a: unknown[]) => $transaction(...a),
    $executeRaw: (...a: unknown[]) => $executeRaw(...a),
    $queryRaw: (...a: unknown[]) => $queryRaw(...a),
    noteFrais: {
      findFirst: (...a: unknown[]) => noteFindFirst(...a),
      findMany: (...a: unknown[]) => noteFindMany(...a),
      deleteMany: (...a: unknown[]) => noteDeleteMany(...a),
    },
    justificatifNoteFrais: {
      findMany: (...a: unknown[]) => justifFindMany(...a),
      deleteMany: (...a: unknown[]) => justifDeleteMany(...a),
    },
    noteFraisFileJob: {
      create: (...a: unknown[]) => fileJobCreate(...a),
      findMany: (...a: unknown[]) => fileJobFindMany(...a),
      updateMany: (...a: unknown[]) => fileJobUpdateMany(...a),
      count: (...a: unknown[]) => fileJobCount(...a),
    },
    noteFraisOutboxEvent: {
      updateMany: (...a: unknown[]) => outboxUpdateMany(...a),
    },
    notification: {
      deleteMany: (...a: unknown[]) => notificationDeleteMany(...a),
    },
    user: {
      delete: (...a: unknown[]) => userDelete(...a),
    },
  },
}));

vi.mock("@/lib/frais-avances/storage", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/frais-avances/storage")
  >("@/lib/frais-avances/storage");
  return {
    ...actual,
    absoluteFromRelative: (rel: string) =>
      `/tmp/amaki-notes-test-root/${rel}`,
    hashIdForLog: (id: string) => id.slice(0, 8),
  };
});

import {
  NotesFraisRgpdBlockError,
  cancelPendingMovesAndEnqueueUnlinks,
  deleteUserAtomicallyWithNotesFraisRgpd,
  isNotesFraisSchemaPresent,
  isNotesFraisTableMissingError,
  prepareNotesFraisForAccountDeletion,
} from "@/lib/services/frais-avances/rgpd-account-deletion";
import {
  hasValidatedSubmittedRetentionPolicy,
  resolveEffectiveArchiveRetention,
  resolveSubmittedJustificatifRetentionPolicy,
} from "@/lib/frais-avances/retention-policy";

function makeTx(overrides: Record<string, unknown> = {}) {
  return {
    $executeRaw: $executeRaw,
    noteFrais: {
      findFirst: noteFindFirst,
      findMany: noteFindMany,
      deleteMany: noteDeleteMany,
    },
    justificatifNoteFrais: {
      findMany: justifFindMany,
      deleteMany: justifDeleteMany,
    },
    noteFraisFileJob: {
      create: fileJobCreate,
      findMany: fileJobFindMany,
      updateMany: fileJobUpdateMany,
      count: fileJobCount,
    },
    noteFraisOutboxEvent: { updateMany: outboxUpdateMany },
    notification: { deleteMany: notificationDeleteMany },
    user: { delete: userDelete },
    ...overrides,
  };
}

describe("retention policy", () => {
  it("aucune politique validée par défaut", () => {
    expect(hasValidatedSubmittedRetentionPolicy({})).toBe(false);
    expect(resolveSubmittedJustificatifRetentionPolicy({}).status).toBe(
      "absent"
    );
  });

  it("valeur d'env non listée = non validée", () => {
    expect(
      resolveSubmittedJustificatifRetentionPolicy({
        NOTES_FRAIS_SUBMITTED_JUSTIFICATIF_RETENTION: "PURGE",
      }).status
    ).toBe("unvalidated");
  });

  it("injection test : validated_injected ; env seul reste non validé", () => {
    expect(
      resolveEffectiveArchiveRetention({
        injected: { durationMs: 3_600_000, startsAt: "archivedAt" },
      }).status
    ).toBe("validated_injected");
    expect(resolveEffectiveArchiveRetention({}).status).toBe("absent");
    expect(hasValidatedSubmittedRetentionPolicy({})).toBe(false);
  });
});

describe("isNotesFraisTableMissingError", () => {
  it("P2021 sans meta.table → false (pas de faux positif)", () => {
    expect(isNotesFraisTableMissingError({ code: "P2021" })).toBe(false);
  });

  it("P2021 notes_frais → true", () => {
    expect(
      isNotesFraisTableMissingError({
        code: "P2021",
        meta: { table: "public.notes_frais" },
      })
    ).toBe(true);
  });
});

describe("isNotesFraisSchemaPresent (to_regclass)", () => {
  beforeEach(() => {
    $queryRaw.mockReset();
  });

  it("true si to_regclass non null", async () => {
    $queryRaw.mockResolvedValue([{ present: true }]);
    expect(await isNotesFraisSchemaPresent()).toBe(true);
  });

  it("false si to_regclass null", async () => {
    $queryRaw.mockResolvedValue([{ present: false }]);
    expect(await isNotesFraisSchemaPresent()).toBe(false);
  });
});

describe("cancelPendingMovesAndEnqueueUnlinks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fileJobFindMany.mockResolvedValue([
      {
        id: "m1",
        noteFraisId: "b1",
        sourcePath: "/tmp/amaki-notes-test-root/tmp/a.pdf",
        targetPath: "/tmp/amaki-notes-test-root/notes/b1/j1.pdf",
      },
    ]);
    fileJobUpdateMany.mockResolvedValue({ count: 1 });
    fileJobCreate.mockResolvedValue({ id: "u" });
  });

  it("annule MOVE et crée UNLINK source+cible", async () => {
    const n = await cancelPendingMovesAndEnqueueUnlinks(makeTx() as never, [
      "b1",
    ]);
    expect(n).toBe(2);
    expect(fileJobUpdateMany).toHaveBeenCalled();
    expect(fileJobCreate).toHaveBeenCalledTimes(2);
    expect(fileJobCreate.mock.calls[0][0].data.operation).toBe("UNLINK");
  });
});

describe("prepareNotesFraisForAccountDeletion", () => {
  const prevFlag = process.env.NOTES_FRAIS_ENABLED;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.NOTES_FRAIS_ENABLED;
    $executeRaw.mockResolvedValue(undefined);
    noteFindMany.mockResolvedValue([]);
    justifFindMany.mockResolvedValue([]);
    fileJobFindMany.mockResolvedValue([]);
    fileJobCount.mockResolvedValue(0);
    fileJobCreate.mockResolvedValue({ id: "fj" });
    fileJobUpdateMany.mockResolvedValue({ count: 0 });
    outboxUpdateMany.mockResolvedValue({ count: 0 });
    notificationDeleteMany.mockResolvedValue({ count: 0 });
    noteDeleteMany.mockResolvedValue({ count: 0 });
    justifDeleteMany.mockResolvedValue({ count: 0 });
  });

  afterEach(() => {
    if (prevFlag === undefined) delete process.env.NOTES_FRAIS_ENABLED;
    else process.env.NOTES_FRAIS_ENABLED = prevFlag;
  });

  it("module désactivé : protection maintenue", async () => {
    noteFindMany.mockResolvedValue([{ id: "s1", statut: "SOUMISE" }]);
    await expect(
      prepareNotesFraisForAccountDeletion(makeTx() as never, "u1")
    ).rejects.toBeInstanceOf(NotesFraisRgpdBlockError);
    expect(noteDeleteMany).not.toHaveBeenCalled();
  });

  it("compte sans notes : no-op", async () => {
    const res = await prepareNotesFraisForAccountDeletion(
      makeTx() as never,
      "u1"
    );
    expect(res.draftsRemoved).toBe(0);
  });

  it("SOUMISE : refus sans écriture", async () => {
    noteFindMany.mockResolvedValue([
      { id: "b1", statut: "BROUILLON" },
      { id: "s1", statut: "SOUMISE" },
    ]);
    await expect(
      prepareNotesFraisForAccountDeletion(makeTx() as never, "u1")
    ).rejects.toBeInstanceOf(NotesFraisRgpdBlockError);
    expect(fileJobCreate).not.toHaveBeenCalled();
    expect(noteDeleteMany).not.toHaveBeenCalled();
  });

  it("brouillons : delete + UNLINK + cancel MOVE", async () => {
    noteFindMany.mockResolvedValue([{ id: "b1", statut: "BROUILLON" }]);
    fileJobCount.mockResolvedValue(1);
    fileJobFindMany.mockResolvedValue([
      {
        id: "m1",
        noteFraisId: "b1",
        sourcePath: "/tmp/amaki-notes-test-root/tmp/x.pdf",
        targetPath: "/tmp/amaki-notes-test-root/notes/b1/j1.pdf",
      },
    ]);
    justifFindMany.mockResolvedValue([
      {
        id: "j1",
        noteFraisId: "b1",
        cheminRelatif: "notes/b1/j1.pdf",
      },
    ]);
    noteDeleteMany.mockResolvedValue({ count: 1 });
    outboxUpdateMany.mockResolvedValue({ count: 1 });

    const res = await prepareNotesFraisForAccountDeletion(
      makeTx() as never,
      "u1"
    );
    expect(res.draftsRemoved).toBe(1);
    expect(res.movesCancelled).toBe(1);
    expect(res.unlinkJobsEnqueued).toBeGreaterThanOrEqual(2);
    expect(justifDeleteMany).toHaveBeenCalled();
  });
});

describe("deleteUserAtomicallyWithNotesFraisRgpd", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("schéma absent (to_regclass) : user.delete hors TX notes", async () => {
    $queryRaw.mockResolvedValue([{ present: false }]);
    userDelete.mockResolvedValue({});
    const res = await deleteUserAtomicallyWithNotesFraisRgpd("u1");
    expect(res.notesFrais.skippedSchemaAbsent).toBe(true);
    expect(userDelete).toHaveBeenCalledWith({ where: { id: "u1" } });
    expect($transaction).not.toHaveBeenCalled();
  });

  it("schéma présent : prepare + user.delete même TX", async () => {
    $queryRaw.mockResolvedValue([{ present: true }]);
    $transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
      noteFindMany.mockResolvedValue([]);
      fileJobCount.mockResolvedValue(0);
      fileJobFindMany.mockResolvedValue([]);
      return fn(makeTx());
    });
    userDelete.mockResolvedValue({});
    await deleteUserAtomicallyWithNotesFraisRgpd("u1");
    expect($transaction).toHaveBeenCalledTimes(1);
    expect(userDelete).toHaveBeenCalled();
  });

  it("échec user.delete → rollback simulé", async () => {
    $queryRaw.mockResolvedValue([{ present: true }]);
    let createdJobs = 0;
    $transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
      const tx = makeTx({
        noteFraisFileJob: {
          create: async () => {
            createdJobs += 1;
            return { id: "fj" };
          },
          findMany: async () => [],
          updateMany: async () => ({ count: 0 }),
          count: async () => 0,
        },
        user: {
          delete: async () => {
            throw new Error("user delete failed");
          },
        },
      });
      noteFindMany.mockResolvedValue([{ id: "b1", statut: "BROUILLON" }]);
      justifFindMany.mockResolvedValue([
        { id: "j1", noteFraisId: "b1", cheminRelatif: "notes/b1/j1.pdf" },
      ]);
      noteDeleteMany.mockResolvedValue({ count: 1 });
      justifDeleteMany.mockResolvedValue({ count: 1 });
      outboxUpdateMany.mockResolvedValue({ count: 0 });
      notificationDeleteMany.mockResolvedValue({ count: 0 });
      try {
        return await fn(tx);
      } catch (e) {
        createdJobs = 0;
        throw e;
      }
    });

    await expect(deleteUserAtomicallyWithNotesFraisRgpd("u1")).rejects.toThrow(
      /user delete failed/
    );
    expect(createdJobs).toBe(0);
  });

  it("SOUMISE bloque avant user.delete", async () => {
    $queryRaw.mockResolvedValue([{ present: true }]);
    $transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
      noteFindMany.mockResolvedValue([{ id: "s1", statut: "SOUMISE" }]);
      return fn(makeTx());
    });
    await expect(
      deleteUserAtomicallyWithNotesFraisRgpd("u1")
    ).rejects.toBeInstanceOf(NotesFraisRgpdBlockError);
    expect(userDelete).not.toHaveBeenCalled();
  });
});
