import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import {
  applyAdminParticipationDeltaItem,
  isParticipationUniqueViolation,
  PARTICIPATION_REUNION_ADHERENT_UNIQUE_INDEX,
  ParticipationConflictError,
} from "@/lib/services/reunions/admin-apply-participation-delta";

function makeTx(overrides: Partial<{
  findUnique: ReturnType<typeof vi.fn>;
  updateMany: ReturnType<typeof vi.fn>;
  deleteMany: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
}> = {}) {
  return {
    participationReunion: {
      findUnique: overrides.findUnique ?? vi.fn().mockResolvedValue(null),
      updateMany: overrides.updateMany ?? vi.fn().mockResolvedValue({ count: 1 }),
      deleteMany: overrides.deleteMany ?? vi.fn().mockResolvedValue({ count: 1 }),
      create: overrides.create ?? vi.fn().mockResolvedValue({}),
    },
  };
}

describe("isParticipationUniqueViolation", () => {
  it("reconnaît plain object P2002 sans instanceof (paire de champs)", () => {
    const err = {
      code: "P2002",
      meta: { target: ["reunionId", "adherentId"] },
    };
    expect(err instanceof Prisma.PrismaClientKnownRequestError).toBe(false);
    expect(isParticipationUniqueViolation(err)).toBe(true);
  });

  it("reconnaît paire de champs ordre inverse", () => {
    expect(
      isParticipationUniqueViolation({
        code: "P2002",
        meta: { target: ["adherentId", "reunionId"] },
      })
    ).toBe(true);
  });

  it("reconnaît PrismaClientKnownRequestError sur paire de champs", () => {
    const err = new Prisma.PrismaClientKnownRequestError("unique", {
      code: "P2002",
      clientVersion: "test",
      meta: { target: ["reunionId", "adherentId"] },
    });
    expect(isParticipationUniqueViolation(err)).toBe(true);
  });

  it("reconnaît nom exact d'index (tableau à 1 élément)", () => {
    expect(
      isParticipationUniqueViolation({
        code: "P2002",
        meta: { target: [PARTICIPATION_REUNION_ADHERENT_UNIQUE_INDEX] },
      })
    ).toBe(true);
  });

  it("reconnaît nom exact d'index (string)", () => {
    expect(
      isParticipationUniqueViolation({
        code: "P2002",
        meta: { target: PARTICIPATION_REUNION_ADHERENT_UNIQUE_INDEX },
      })
    ).toBe(true);
  });

  it("refuse target absent", () => {
    expect(
      isParticipationUniqueViolation({ code: "P2002", meta: {} })
    ).toBe(false);
    expect(
      isParticipationUniqueViolation({ code: "P2002", meta: { modelName: "X" } })
    ).toBe(false);
  });

  it("refuse meta absente ou malformée", () => {
    expect(isParticipationUniqueViolation({ code: "P2002" })).toBe(false);
    expect(
      isParticipationUniqueViolation({ code: "P2002", meta: null })
    ).toBe(false);
    expect(
      isParticipationUniqueViolation({
        code: "P2002",
        meta: { target: 42 },
      })
    ).toBe(false);
    expect(
      isParticipationUniqueViolation({
        code: "P2002",
        meta: { target: ["reunionId", "adherentId", "extra"] },
      })
    ).toBe(false);
  });

  it("ne traite pas P2002 d'une autre contrainte unique", () => {
    expect(
      isParticipationUniqueViolation({
        code: "P2002",
        meta: { target: ["email"] },
      })
    ).toBe(false);
    expect(
      isParticipationUniqueViolation({
        code: "P2002",
        meta: { target: ["participations_reunion_pkey"] },
      })
    ).toBe(false);
  });

  it("ne masque pas une autre erreur SQL / non-objet", () => {
    expect(
      isParticipationUniqueViolation(
        new Prisma.PrismaClientKnownRequestError("fk", {
          code: "P2003",
          clientVersion: "test",
        })
      )
    ).toBe(false);
    expect(isParticipationUniqueViolation(new Error("boom"))).toBe(false);
    expect(isParticipationUniqueViolation(null)).toBe(false);
    expect(isParticipationUniqueViolation(undefined)).toBe(false);
  });
});

describe("applyAdminParticipationDeltaItem — écritures conditionnelles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("expected row + réponse → updateMany ; count ≠ 1 → conflit", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 0 });
    const tx = makeTx({ updateMany });

    await expect(
      applyAdminParticipationDeltaItem(tx, "r1", {
        adherentId: "a1",
        statut: "Excuse",
        justificatifFournit: true,
        expected: { kind: "row", statut: "Present", justificatifFournit: false },
      })
    ).rejects.toBeInstanceOf(ParticipationConflictError);

    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          reunionId: "r1",
          adherentId: "a1",
          statut: "Present",
          justificatifFournit: false,
        }),
      })
    );
  });

  it("expected row + NonRepondu → deleteMany filtré ; count 1 OK", async () => {
    const deleteMany = vi.fn().mockResolvedValue({ count: 1 });
    const tx = makeTx({ deleteMany });

    await applyAdminParticipationDeltaItem(tx, "r1", {
      adherentId: "a1",
      statut: "NonRepondu",
      expected: { kind: "row", statut: "Absent", justificatifFournit: true },
    });

    expect(deleteMany).toHaveBeenCalledWith({
      where: {
        reunionId: "r1",
        adherentId: "a1",
        statut: "Absent",
        justificatifFournit: true,
      },
    });
  });

  it("expected absent + réponse → create seul (jamais upsert)", async () => {
    const create = vi.fn().mockResolvedValue({});
    const tx = makeTx({ create });

    await applyAdminParticipationDeltaItem(tx, "r1", {
      adherentId: "a1",
      statut: "Present",
      expected: { kind: "absent" },
    });

    expect(create).toHaveBeenCalled();
    expect(tx.participationReunion.updateMany).not.toHaveBeenCalled();
  });

  it("expected absent + create P2002 plain → ParticipationConflictError", async () => {
    const create = vi.fn().mockRejectedValue({
      code: "P2002",
      meta: { target: ["reunionId", "adherentId"] },
    });
    const tx = makeTx({ create });

    await expect(
      applyAdminParticipationDeltaItem(tx, "r1", {
        adherentId: "a1",
        statut: "Absent",
        expected: { kind: "absent" },
      })
    ).rejects.toBeInstanceOf(ParticipationConflictError);
  });

  it("expected absent + create P2002 nom d'index → conflit", async () => {
    const create = vi.fn().mockRejectedValue({
      code: "P2002",
      meta: { target: PARTICIPATION_REUNION_ADHERENT_UNIQUE_INDEX },
    });
    const tx = makeTx({ create });

    await expect(
      applyAdminParticipationDeltaItem(tx, "r1", {
        adherentId: "a1",
        statut: "Absent",
        expected: { kind: "absent" },
      })
    ).rejects.toBeInstanceOf(ParticipationConflictError);
  });

  it("expected absent + create P2002 autre contrainte → erreur technique non CONFLICT", async () => {
    const create = vi.fn().mockRejectedValue({
      code: "P2002",
      meta: { target: ["email"] },
    });
    const tx = makeTx({ create });

    await expect(
      applyAdminParticipationDeltaItem(tx, "r1", {
        adherentId: "a1",
        statut: "Present",
        expected: { kind: "absent" },
      })
    ).rejects.toMatchObject({ code: "P2002", meta: { target: ["email"] } });
  });

  it("expected absent + NonRepondu : absence → no-op sans create/delete", async () => {
    const findUnique = vi.fn().mockResolvedValue(null);
    const create = vi.fn();
    const deleteMany = vi.fn();
    const tx = makeTx({ findUnique, create, deleteMany });

    await applyAdminParticipationDeltaItem(tx, "r1", {
      adherentId: "a1",
      statut: "NonRepondu",
      expected: { kind: "absent" },
    });

    expect(findUnique).toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    expect(deleteMany).not.toHaveBeenCalled();
  });

  it("expected absent + NonRepondu : ligne apparue → conflit sans suppression", async () => {
    const findUnique = vi.fn().mockResolvedValue({ adherentId: "a1" });
    const create = vi.fn();
    const deleteMany = vi.fn();
    const tx = makeTx({ findUnique, create, deleteMany });

    await expect(
      applyAdminParticipationDeltaItem(tx, "r1", {
        adherentId: "a1",
        statut: "NonRepondu",
        expected: { kind: "absent" },
      })
    ).rejects.toBeInstanceOf(ParticipationConflictError);

    expect(create).not.toHaveBeenCalled();
    expect(deleteMany).not.toHaveBeenCalled();
  });

  it("autre erreur SQL (P2003) n'est pas transformée en conflit", async () => {
    const create = vi.fn().mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("fk", {
        code: "P2003",
        clientVersion: "test",
      })
    );
    const tx = makeTx({ create });

    await expect(
      applyAdminParticipationDeltaItem(tx, "r1", {
        adherentId: "a1",
        statut: "Present",
        expected: { kind: "absent" },
      })
    ).rejects.toMatchObject({ code: "P2003" });
  });

  it("lot multi-lignes : 2ᵉ conflit laisse la 1ʳᵉ updateMany appelée puis throw (TX Prisma rollback)", async () => {
    const updateMany = vi
      .fn()
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    const tx = makeTx({ updateMany });

    await applyAdminParticipationDeltaItem(tx, "r1", {
      adherentId: "a1",
      statut: "Excuse",
      expected: { kind: "row", statut: "Present", justificatifFournit: false },
    });

    await expect(
      applyAdminParticipationDeltaItem(tx, "r1", {
        adherentId: "a2",
        statut: "Absent",
        expected: { kind: "row", statut: "Present", justificatifFournit: false },
      })
    ).rejects.toBeInstanceOf(ParticipationConflictError);

    expect(updateMany).toHaveBeenCalledTimes(2);
  });
});
