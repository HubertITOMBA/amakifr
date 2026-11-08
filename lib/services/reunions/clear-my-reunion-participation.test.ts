import { beforeEach, describe, expect, it, vi } from "vitest";

const { findUniqueAdherent, transactionMock, deleteManyParticipation, queryRaw, findUniqueReunionTx } =
  vi.hoisted(() => ({
    findUniqueAdherent: vi.fn(),
    transactionMock: vi.fn(),
    deleteManyParticipation: vi.fn(),
    queryRaw: vi.fn(),
    findUniqueReunionTx: vi.fn(),
  }));

vi.mock("@/lib/db", () => ({
  db: {
    adherent: { findUnique: findUniqueAdherent },
    $transaction: transactionMock,
  },
}));

import { clearMyReunionParticipation } from "@/lib/services/reunions/clear-my-reunion-participation";

const futureDate = new Date("2027-07-01T12:00:00.000Z");
const pastDate = new Date("2026-01-01T12:00:00.000Z");

function mockWritableTx(reunionOverrides: Record<string, unknown> = {}) {
  queryRaw.mockImplementation(async (strings: TemplateStringsArray) => {
    const sql = strings.join("?");
    if (sql.includes("reunions_mensuelles")) return [{ id: "r1" }];
    return [];
  });
  findUniqueReunionTx.mockResolvedValue({
    id: "r1",
    statut: "DateConfirmee",
    dateReunion: futureDate,
    ...reunionOverrides,
  });
  deleteManyParticipation.mockResolvedValue({ count: 1 });
  transactionMock.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
    return fn({
      $queryRaw: queryRaw,
      reunionMensuelle: { findUnique: findUniqueReunionTx },
      participationReunion: { deleteMany: deleteManyParticipation },
    });
  });
}

describe("clearMyReunionParticipation — verrou commun", () => {
  beforeEach(() => {
    findUniqueAdherent.mockReset();
    transactionMock.mockReset();
    deleteManyParticipation.mockReset();
    queryRaw.mockReset();
    findUniqueReunionTx.mockReset();
    findUniqueAdherent.mockResolvedValue({ id: "adh-1" });
  });

  it("UNAUTHENTICATED si userId absent", async () => {
    await expect(
      clearMyReunionParticipation({ userId: "" } as never, "r1")
    ).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  });

  it("FORBIDDEN si réunion passée sous verrou", async () => {
    mockWritableTx({ dateReunion: pastDate });
    await expect(
      clearMyReunionParticipation({ userId: "u1" }, "r1")
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(deleteManyParticipation).not.toHaveBeenCalled();
  });

  it("FORBIDDEN si Annulee sous verrou", async () => {
    mockWritableTx({ statut: "Annulee" });
    await expect(
      clearMyReunionParticipation({ userId: "u1" }, "r1")
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(deleteManyParticipation).not.toHaveBeenCalled();
  });

  it("supprime la ligne → participationStatus null", async () => {
    mockWritableTx();
    const res = await clearMyReunionParticipation({ userId: "u1" }, "r1");
    expect(res).toEqual({
      participationStatus: null,
      cleared: true,
      alreadyClear: false,
    });
  });

  it("idempotent si aucune ligne", async () => {
    mockWritableTx();
    deleteManyParticipation.mockResolvedValue({ count: 0 });
    const res = await clearMyReunionParticipation({ userId: "u1" }, "r1");
    expect(res.alreadyClear).toBe(true);
  });

  it("anti-IDOR adhérent résolu serveur", async () => {
    mockWritableTx();
    findUniqueAdherent.mockResolvedValue({ id: "adh-owner" });
    await clearMyReunionParticipation({ userId: "u1" }, "r1");
    expect(deleteManyParticipation).toHaveBeenCalledWith({
      where: { reunionId: "r1", adherentId: "adh-owner" },
    });
  });
});
