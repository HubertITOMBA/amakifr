import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const {
  outboxUpdateMany,
  outboxFindMany,
  outboxFindUnique,
  fileJobUpdateMany,
  fileJobFindMany,
  fileJobFindFirst,
} = vi.hoisted(() => ({
  outboxUpdateMany: vi.fn(),
  outboxFindMany: vi.fn(),
  outboxFindUnique: vi.fn(),
  fileJobUpdateMany: vi.fn(),
  fileJobFindMany: vi.fn(),
  fileJobFindFirst: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    noteFraisOutboxEvent: {
      updateMany: (...a: unknown[]) => outboxUpdateMany(...a),
      findMany: (...a: unknown[]) => outboxFindMany(...a),
      findUnique: (...a: unknown[]) => outboxFindUnique(...a),
    },
    noteFraisFileJob: {
      updateMany: (...a: unknown[]) => fileJobUpdateMany(...a),
      findMany: (...a: unknown[]) => fileJobFindMany(...a),
      findFirst: (...a: unknown[]) => fileJobFindFirst(...a),
    },
  },
}));

const sendPushToUsersDetailed = vi.fn();
vi.mock("@/lib/services/push/send-push", () => ({
  sendPushToUsersDetailed: (...a: unknown[]) => sendPushToUsersDetailed(...a),
}));

const moveFileDurable = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/frais-avances/storage", () => ({
  assertPathInsideStorageRoot: vi.fn((p: string) => p),
  moveFileDurable: (...a: unknown[]) => moveFileDurable(...a),
  unlinkQuiet: vi.fn().mockResolvedValue(undefined),
  hashIdForLog: (id: string) => id.slice(0, 8),
}));

import {
  LEASE_MS,
  processNoteFraisFileJobsOnce,
  processNoteFraisOutboxOnce,
  recoverExpiredFileJobLocks,
  recoverExpiredOutboxLocks,
} from "@/lib/services/frais-avances/note-frais-service";
import { unlinkQuiet } from "@/lib/frais-avances/storage";

describe("workers outbox / file jobs", () => {
  const prev = process.env.NOTES_FRAIS_ENABLED;

  beforeEach(() => {
    process.env.NOTES_FRAIS_ENABLED = "true";
    vi.clearAllMocks();
    outboxUpdateMany.mockResolvedValue({ count: 0 });
    fileJobUpdateMany.mockResolvedValue({ count: 0 });
    outboxFindMany.mockResolvedValue([]);
    fileJobFindMany.mockResolvedValue([]);
    fileJobFindFirst.mockResolvedValue(null);
    moveFileDurable.mockResolvedValue(undefined);
  });

  afterEach(() => {
    if (prev === undefined) delete process.env.NOTES_FRAIS_ENABLED;
    else process.env.NOTES_FRAIS_ENABLED = prev;
  });

  it("flag off : outbox no-op ; file jobs restent actifs (durabilité archive)", async () => {
    delete process.env.NOTES_FRAIS_ENABLED;
    expect(await processNoteFraisOutboxOnce()).toBe(0);
    expect(outboxFindMany).not.toHaveBeenCalled();
    expect(await processNoteFraisFileJobsOnce()).toBe(0);
    expect(fileJobFindMany).toHaveBeenCalled();
  });

  it("expire les leases PROCESSING → PENDING", async () => {
    outboxUpdateMany.mockResolvedValue({ count: 2 });
    fileJobUpdateMany.mockResolvedValue({ count: 1 });
    expect(await recoverExpiredOutboxLocks()).toBe(2);
    expect(await recoverExpiredFileJobLocks()).toBe(1);
    const outboxWhere = outboxUpdateMany.mock.calls[0][0].where;
    expect(outboxWhere.status).toBe("PROCESSING");
    expect(outboxWhere.lockedAt.lt).toBeInstanceOf(Date);
    expect(LEASE_MS).toBe(120_000);
  });

  it("claim unique : second claim ignoré", async () => {
    outboxFindMany.mockResolvedValue([
      {
        id: "e1",
        kind: "SUBMITTED",
        payload: { userIds: ["u1"], titre: "t", message: "m" },
        attempts: 0,
        maxAttempts: 8,
      },
    ]);
    outboxUpdateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 0 });
    expect(await processNoteFraisOutboxOnce()).toBe(0);
    expect(sendPushToUsersDetailed).not.toHaveBeenCalled();
  });

  it("succès partiel push → requeue", async () => {
    outboxFindMany.mockResolvedValue([
      {
        id: "e1",
        kind: "SUBMITTED",
        payload: { userIds: ["u1"], titre: "t", message: "m" },
        attempts: 0,
        maxAttempts: 8,
      },
    ]);
    outboxUpdateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 });
    outboxFindUnique.mockResolvedValue({ attempts: 1, maxAttempts: 8 });
    sendPushToUsersDetailed.mockResolvedValue({
      summary: "partial",
      attempted: 2,
      ok: 1,
      disabled: 0,
      details: [],
    });

    expect(await processNoteFraisOutboxOnce()).toBe(1);
    const requeue = outboxUpdateMany.mock.calls.find(
      (c) => c[0]?.data?.status === "PENDING" && c[0]?.data?.nextAttemptAt
    );
    expect(requeue).toBeTruthy();
  });

  it("REGLEMENT_COMPENSATION : chemin push normal → DONE", async () => {
    outboxFindMany.mockResolvedValue([
      {
        id: "e-reg",
        kind: "REGLEMENT_COMPENSATION",
        payload: {
          userIds: ["u1"],
          titre: "Règlement enregistré",
          message:
            "Un règlement a été enregistré sur votre note de frais. Consultez le détail pour en savoir plus.",
          lien: "/user/frais-avances/n1",
        },
        attempts: 0,
        maxAttempts: 8,
      },
    ]);
    outboxUpdateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 });
    sendPushToUsersDetailed.mockResolvedValue({
      summary: "success",
      attempted: 1,
      ok: 1,
      disabled: 0,
      details: [],
    });

    expect(await processNoteFraisOutboxOnce()).toBe(1);
    expect(sendPushToUsersDetailed).toHaveBeenCalledWith(
      ["u1"],
      expect.objectContaining({
        title: "Règlement enregistré",
        data: { url: "/user/frais-avances/n1" },
      })
    );
    const pushArg = sendPushToUsersDetailed.mock.calls[0]![1] as {
      title: string;
      body: string;
      data: Record<string, string>;
    };
    expect(JSON.stringify(pushArg)).not.toMatch(
      /montant|VIREMENT|référence|DETTE|motif/i
    );
    const done = outboxUpdateMany.mock.calls.find(
      (c) => c[0]?.data?.status === "DONE"
    );
    expect(done).toBeTruthy();
  });

  it("REGLEMENT_* partial → requeue ; FAILED après maxAttempts", async () => {
    outboxFindMany.mockResolvedValue([
      {
        id: "e-mix",
        kind: "REGLEMENT_MIXTE",
        payload: {
          userIds: ["u1"],
          titre: "Règlement enregistré",
          message: "Un règlement a été enregistré sur votre note de frais.",
          lien: "/user/frais-avances/n1",
        },
        attempts: 7,
        maxAttempts: 8,
      },
    ]);
    outboxUpdateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 });
    outboxFindUnique.mockResolvedValue({ attempts: 8, maxAttempts: 8 });
    sendPushToUsersDetailed.mockResolvedValue({
      summary: "all_failed_temporary",
      attempted: 1,
      ok: 0,
      disabled: 0,
      details: [],
    });

    expect(await processNoteFraisOutboxOnce()).toBe(1);
    const failed = outboxUpdateMany.mock.calls.find(
      (c) => c[0]?.data?.status === "FAILED"
    );
    expect(failed).toBeTruthy();
  });

  it("finish/requeue conditionnés PROCESSING+lockedBy : count 0 = no-op (claim RGPD)", async () => {
    outboxFindMany.mockResolvedValue([
      {
        id: "e-lost",
        kind: "REGLEMENT_COMPENSATION",
        payload: { userIds: ["u1"], titre: "t", message: "m", lien: "/x" },
        attempts: 0,
        maxAttempts: 8,
      },
    ]);
    // recover + claim OK + finish count 0 (archivage a pris la main)
    outboxUpdateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    sendPushToUsersDetailed.mockResolvedValue({
      summary: "success",
      attempted: 1,
      ok: 1,
      disabled: 0,
      details: [],
    });

    expect(await processNoteFraisOutboxOnce()).toBe(1);
    const finishCall = outboxUpdateMany.mock.calls.find(
      (c) =>
        c[0]?.where?.status === "PROCESSING" &&
        c[0]?.where?.lockedBy &&
        c[0]?.data?.status === "DONE"
    );
    expect(finishCall).toBeTruthy();
    expect(finishCall![0].where).toMatchObject({
      id: "e-lost",
      status: "PROCESSING",
    });
  });

  it("UNLINK job : assert path + unlink + DONE", async () => {
    fileJobFindMany.mockResolvedValue([
      {
        id: "j1",
        operation: "UNLINK",
        sourcePath: null,
        targetPath: "/tmp/amaki-notes-test-root/notes/n/a.pdf",
        attempts: 0,
        maxAttempts: 8,
      },
    ]);
    fileJobUpdateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 });

    expect(await processNoteFraisFileJobsOnce()).toBe(1);
    expect(unlinkQuiet).toHaveBeenCalled();
    const done = fileJobUpdateMany.mock.calls.find(
      (c) => c[0]?.data?.status === "DONE"
    );
    expect(done).toBeTruthy();
  });

  it("MOVE aborté si UNLINK pending (pas de recréation fichier)", async () => {
    fileJobFindMany.mockResolvedValue([
      {
        id: "mv1",
        operation: "MOVE",
        sourcePath: "/tmp/amaki-notes-test-root/tmp/a.pdf",
        targetPath: "/tmp/amaki-notes-test-root/notes/n/a.pdf",
        attempts: 0,
        maxAttempts: 8,
      },
    ]);
    // stillOurs → blockingUnlink
    fileJobFindFirst
      .mockResolvedValueOnce({ id: "mv1" })
      .mockResolvedValueOnce({ id: "ul1" });
    fileJobUpdateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 });

    expect(await processNoteFraisFileJobsOnce()).toBe(1);
    expect(moveFileDurable).not.toHaveBeenCalled();
    expect(unlinkQuiet).toHaveBeenCalledWith(
      "/tmp/amaki-notes-test-root/tmp/a.pdf"
    );
    expect(unlinkQuiet).toHaveBeenCalledWith(
      "/tmp/amaki-notes-test-root/notes/n/a.pdf"
    );
    const failed = fileJobUpdateMany.mock.calls.find(
      (c) => c[0]?.data?.lastError === "move_aborted_unlink_pending"
    );
    expect(failed).toBeTruthy();
  });

  it("suppression note : jobs sans FK restent traitables", async () => {
    fileJobFindMany.mockResolvedValue([
      {
        id: "orphan",
        operation: "UNLINK",
        noteFraisId: "deleted-note",
        sourcePath: null,
        targetPath: "/tmp/amaki-notes-test-root/notes/x.pdf",
        attempts: 0,
        maxAttempts: 8,
      },
    ]);
    fileJobUpdateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 });
    expect(await processNoteFraisFileJobsOnce()).toBe(1);
  });
});
