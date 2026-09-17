/**
 * Tests unitaires — purge RGPD outbox à l'archivage (correctif 4.5).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { outboxUpdateMany } = vi.hoisted(() => ({
  outboxUpdateMany: vi.fn(),
}));

import {
  NOTES_FRAIS_OUTBOX_RGPD_PURGED_PAYLOAD,
  purgeNoteFraisOutboxEventsForArchiveInTx,
} from "@/lib/services/frais-avances/note-frais-archive-service";

describe("purgeNoteFraisOutboxEventsForArchiveInTx", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    outboxUpdateMany.mockResolvedValue({ count: 1 });
  });

  it("PENDING/PROCESSING → FAILED + payload purgé ; DONE/FAILED payload purgé", async () => {
    const tx = {
      noteFraisOutboxEvent: {
        updateMany: (...a: unknown[]) => outboxUpdateMany(...a),
      },
    };

    await purgeNoteFraisOutboxEventsForArchiveInTx(tx as never, "note-1");

    expect(outboxUpdateMany).toHaveBeenCalledTimes(2);

    const active = outboxUpdateMany.mock.calls[0]![0] as {
      where: { noteFraisId: string; status: { in: string[] } };
      data: Record<string, unknown>;
    };
    expect(active.where.noteFraisId).toBe("note-1");
    expect(active.where.status.in).toEqual(["PENDING", "PROCESSING"]);
    expect(active.data.status).toBe("FAILED");
    expect(active.data.lastError).toBe("rgpd_account_archived");
    expect(active.data.lockedAt).toBeNull();
    expect(active.data.lockedBy).toBeNull();
    expect(active.data.payload).toEqual(NOTES_FRAIS_OUTBOX_RGPD_PURGED_PAYLOAD);

    const terminal = outboxUpdateMany.mock.calls[1]![0] as {
      where: { status: { in: string[] } };
      data: Record<string, unknown>;
    };
    expect(terminal.where.status.in).toEqual(["DONE", "FAILED"]);
    expect(terminal.data).toEqual({
      payload: NOTES_FRAIS_OUTBOX_RGPD_PURGED_PAYLOAD,
    });
    expect(terminal.data).not.toHaveProperty("status");
    expect(NOTES_FRAIS_OUTBOX_RGPD_PURGED_PAYLOAD).toEqual({ userIds: [] });
  });
});
