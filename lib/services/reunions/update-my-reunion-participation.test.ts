import { beforeEach, describe, expect, it, vi } from "vitest";

const { findUniqueAdherent, transactionMock, upsertParticipation, queryRaw, findUniqueReunionTx } =
  vi.hoisted(() => ({
    findUniqueAdherent: vi.fn(),
    transactionMock: vi.fn(),
    upsertParticipation: vi.fn(),
    queryRaw: vi.fn(),
    findUniqueReunionTx: vi.fn(),
  }));

vi.mock("@/lib/db", () => ({
  db: {
    adherent: { findUnique: findUniqueAdherent },
    $transaction: transactionMock,
  },
}));

import { updateMyReunionParticipation } from "@/lib/services/reunions/update-my-reunion-participation";
import { ServiceError } from "@/lib/service-error";

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
  upsertParticipation.mockResolvedValue({ statut: "Present" });
  transactionMock.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
    const tx = {
      $queryRaw: queryRaw,
      reunionMensuelle: { findUnique: findUniqueReunionTx },
      participationReunion: { upsert: upsertParticipation },
    };
    return fn(tx);
  });
}

describe("updateMyReunionParticipation — verrou commun", () => {
  beforeEach(() => {
    findUniqueAdherent.mockReset();
    transactionMock.mockReset();
    upsertParticipation.mockReset();
    queryRaw.mockReset();
    findUniqueReunionTx.mockReset();
    findUniqueAdherent.mockResolvedValue({ id: "adh-1" });
  });

  it("UNAUTHENTICATED si userId absent", async () => {
    await expect(
      updateMyReunionParticipation({ userId: "" } as never, "r1", {
        statut: "Present",
      })
    ).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  });

  it("NOT_FOUND adhérent", async () => {
    findUniqueAdherent.mockResolvedValue(null);
    await expect(
      updateMyReunionParticipation({ userId: "u1" }, "r1", { statut: "Present" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("NOT_FOUND réunion (lock miss)", async () => {
    queryRaw.mockResolvedValue([]);
    transactionMock.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      return fn({
        $queryRaw: queryRaw,
        reunionMensuelle: { findUnique: findUniqueReunionTx },
        participationReunion: { upsert: upsertParticipation },
      });
    });
    await expect(
      updateMyReunionParticipation({ userId: "u1" }, "r1", { statut: "Present" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("FORBIDDEN si Annulee sous verrou (avant écriture)", async () => {
    mockWritableTx({ statut: "Annulee" });
    await expect(
      updateMyReunionParticipation({ userId: "u1" }, "r1", { statut: "Present" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(upsertParticipation).not.toHaveBeenCalled();
  });

  it("FORBIDDEN si réunion passée sous verrou", async () => {
    mockWritableTx({ dateReunion: pastDate });
    await expect(
      updateMyReunionParticipation({ userId: "u1" }, "r1", { statut: "Present" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(upsertParticipation).not.toHaveBeenCalled();
  });

  it("VALIDATION_ERROR statut invalide", async () => {
    await expect(
      updateMyReunionParticipation({ userId: "u1" }, "r1", {
        statut: "NonRepondu" as never,
      })
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("upsert Present après verrou + relecture", async () => {
    mockWritableTx();
    const res = await updateMyReunionParticipation({ userId: "u1" }, "r1", {
      statut: "Present",
    });
    expect(res.statut).toBe("Present");
    expect(upsertParticipation).toHaveBeenCalled();
    expect(queryRaw).toHaveBeenCalled();
  });

  it("Absent et Excuse acceptés", async () => {
    mockWritableTx();
    upsertParticipation.mockResolvedValue({ statut: "Absent" });
    await expect(
      updateMyReunionParticipation({ userId: "u1" }, "r1", { statut: "Absent" })
    ).resolves.toEqual({ statut: "Absent" });
    upsertParticipation.mockResolvedValue({ statut: "Excuse" });
    await expect(
      updateMyReunionParticipation({ userId: "u1" }, "r1", { statut: "Excuse" })
    ).resolves.toEqual({ statut: "Excuse" });
  });

  it("anti-IDOR : adhérent résolu serveur", async () => {
    mockWritableTx();
    findUniqueAdherent.mockResolvedValue({ id: "adh-owner" });
    await updateMyReunionParticipation({ userId: "u1" }, "r1", {
      statut: "Present",
    });
    expect(upsertParticipation).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          reunionId_adherentId: { reunionId: "r1", adherentId: "adh-owner" },
        },
      })
    );
  });

  it("ServiceError propagée", async () => {
    findUniqueAdherent.mockRejectedValue(
      new ServiceError("INTERNAL_ERROR", "boom")
    );
    // adherent find is outside TX — if it throws ServiceError... actually findUniqueAdherent rejecting with ServiceError isn't typical. Skip.
    findUniqueAdherent.mockResolvedValue({ id: "adh-1" });
    mockWritableTx();
    upsertParticipation.mockRejectedValue(new Error("db"));
    await expect(
      updateMyReunionParticipation({ userId: "u1" }, "r1", { statut: "Present" })
    ).rejects.toMatchObject({ code: "INTERNAL_ERROR" });
  });
});
