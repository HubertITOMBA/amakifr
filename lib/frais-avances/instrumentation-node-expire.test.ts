/**
 * Tick expiration annulation — flag off/on + non-chevauchement.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const processOutbox = vi.fn().mockResolvedValue(0);
const processFiles = vi.fn().mockResolvedValue(0);
const processArchive = vi.fn().mockResolvedValue(0);
const processPieces = vi.fn().mockResolvedValue(0);
const consolidateJournal = vi.fn().mockResolvedValue({ consolidatedEvents: 0 });
const expireHolds = vi.fn().mockResolvedValue(0);
const expirePending = vi.fn().mockResolvedValue(0);

vi.mock("@/lib/services/frais-avances/note-frais-service", () => ({
  processNoteFraisOutboxOnce: (...a: unknown[]) => processOutbox(...a),
  processNoteFraisFileJobsOnce: (...a: unknown[]) => processFiles(...a),
}));

vi.mock("@/lib/services/frais-avances/note-frais-archive-service", () => ({
  processNoteFraisArchivePurgeOnce: (...a: unknown[]) => processArchive(...a),
  processNoteFraisPiecesPurgeOnce: (...a: unknown[]) => processPieces(...a),
}));

vi.mock("@/lib/services/frais-avances/note-frais-journal-financier-service", () => ({
  consolidateNoteFraisJournalFinancierOnce: (...a: unknown[]) =>
    consolidateJournal(...a),
}));

vi.mock("@/lib/services/frais-avances/note-frais-legal-hold-service", () => ({
  expireLegalHoldsOnce: (...a: unknown[]) => expireHolds(...a),
}));

vi.mock("@/lib/services/frais-avances/note-frais-annulation-service", () => ({
  expirePendingCancellationRequests: (...a: unknown[]) => expirePending(...a),
}));

vi.mock("@/lib/frais-avances/storage", () => ({
  hashIdForLog: (id: string) => `h:${id.slice(0, 8)}`,
}));

describe("instrumentation-node expire tick", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    processOutbox.mockClear().mockResolvedValue(0);
    processFiles.mockClear().mockResolvedValue(0);
    processArchive.mockClear().mockResolvedValue(0);
    processPieces.mockClear().mockResolvedValue(0);
    consolidateJournal.mockClear().mockResolvedValue({ consolidatedEvents: 0 });
    expireHolds.mockClear().mockResolvedValue(0);
    expirePending.mockClear().mockResolvedValue(0);
  });

  afterEach(async () => {
    try {
      const { __resetNotesFraisWorkersForTests } = await import(
        "../../instrumentation-node"
      );
      __resetNotesFraisWorkersForTests();
    } catch {
      /* ignore */
    }
    vi.useRealTimers();
  });

  it("flag off : register no-op (pas de tick)", async () => {
    delete process.env.NOTES_FRAIS_ENABLED;
    process.env.NEXT_RUNTIME = "nodejs";
    const { register } = await import("../../instrumentation");
    await register();
    expect(expirePending).not.toHaveBeenCalled();
  });

  it("tick appelle expirePending ; second tick concurrent sauté", async () => {
    let release!: () => void;
    const hold = new Promise<void>((r) => {
      release = r;
    });
    expirePending.mockImplementation(async () => {
      await hold;
      return 1;
    });

    const mod = await import("../../instrumentation-node");
    mod.__resetNotesFraisWorkersForTests();
    await mod.startNotesFraisWorkers();

    await vi.waitFor(() => {
      expect(expirePending).toHaveBeenCalledTimes(1);
    });

    // Pendant running : tick interval sauté
    await vi.advanceTimersByTimeAsync(60_000);
    expect(expirePending).toHaveBeenCalledTimes(1);

    release();
    await Promise.resolve();
    await Promise.resolve();
  });
});
