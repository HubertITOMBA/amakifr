import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { ParticipationConflictError } from "@/lib/services/reunions/admin-apply-participation-delta";
import { ReunionParticipationNotWritableError } from "@/lib/services/reunions/reunion-row-lock";

const {
  authMock,
  canWriteMock,
  transactionMock,
  logModificationMock,
} = vi.hoisted(() => ({
  authMock: vi.fn(),
  canWriteMock: vi.fn(),
  transactionMock: vi.fn(),
  logModificationMock: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: authMock }));
vi.mock("@/lib/dynamic-permissions", () => ({
  canWrite: canWriteMock,
  canRead: vi.fn(),
}));
vi.mock("@/lib/activity-logger", () => ({
  logCreation: vi.fn(),
  logModification: logModificationMock,
  logDeletion: vi.fn(),
}));
vi.mock("@/lib/mail", () => ({ sendEmail: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    $transaction: transactionMock,
  },
}));

import { adminSetParticipationsReunion } from "@/actions/reunions-mensuelles/index";

const futureDate = new Date("2027-07-01T12:00:00.000Z");

function makeTxHandlers(handlers: {
  reunion?: { id: string; statut: string; dateReunion: Date | null };
  updateMany?: ReturnType<typeof vi.fn>;
  deleteMany?: ReturnType<typeof vi.fn>;
  create?: ReturnType<typeof vi.fn>;
  findUniquePart?: ReturnType<typeof vi.fn>;
}) {
  const reunion = handlers.reunion ?? {
    id: "r1",
    statut: "DateConfirmee",
    dateReunion: futureDate,
  };
  const updateMany =
    handlers.updateMany ?? vi.fn().mockResolvedValue({ count: 1 });
  const deleteMany =
    handlers.deleteMany ?? vi.fn().mockResolvedValue({ count: 1 });
  const create = handlers.create ?? vi.fn().mockResolvedValue({});
  const findUniquePart =
    handlers.findUniquePart ?? vi.fn().mockResolvedValue(null);

  return {
    updateMany,
    deleteMany,
    create,
    findUniquePart,
    tx: {
      $queryRaw: vi.fn(async (strings: TemplateStringsArray) => {
        const sql = strings.join("?");
        if (sql.includes("reunions_mensuelles")) return [{ id: reunion.id }];
        return [];
      }),
      reunionMensuelle: {
        findUnique: vi.fn().mockResolvedValue(reunion),
      },
      participationReunion: {
        findUnique: findUniquePart,
        updateMany,
        deleteMany,
        create,
      },
    },
  };
}

describe("adminSetParticipationsReunion — verrou + écritures conditionnelles", () => {
  beforeEach(() => {
    authMock.mockReset();
    canWriteMock.mockReset();
    transactionMock.mockReset();
    logModificationMock.mockReset();
    authMock.mockResolvedValue({ user: { id: "admin-1" } });
    canWriteMock.mockResolvedValue(true);
  });

  it("CONFLICT si expected absent + create P2002", async () => {
    const { tx, create } = makeTxHandlers({
      create: vi.fn().mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("unique", {
          code: "P2002",
          clientVersion: "test",
          meta: { target: ["reunionId", "adherentId"] },
        })
      ),
    });
    transactionMock.mockImplementation(async (fn: (t: unknown) => Promise<void>) => {
      await fn(tx);
    });

    const result = await adminSetParticipationsReunion({
      reunionId: "r1",
      participations: [
        {
          adherentId: "adh-1",
          statut: "Absent",
          expected: { kind: "absent" },
        },
      ],
    });

    expect(result.success).toBe(false);
    expect((result as { code?: string }).code).toBe("CONFLICT");
    expect(create).toHaveBeenCalled();
    expect(logModificationMock).not.toHaveBeenCalled();
  });

  it("CONFLICT si expected absent + create P2002 plain object (sans instanceof)", async () => {
    const { tx, create } = makeTxHandlers({
      create: vi.fn().mockRejectedValue({
        code: "P2002",
        meta: { target: ["reunionId", "adherentId"] },
      }),
    });
    transactionMock.mockImplementation(async (fn: (t: unknown) => Promise<void>) => {
      await fn(tx);
    });

    const result = await adminSetParticipationsReunion({
      reunionId: "r1",
      participations: [
        {
          adherentId: "adh-1",
          statut: "Absent",
          expected: { kind: "absent" },
        },
      ],
    });

    expect(result.success).toBe(false);
    expect((result as { code?: string }).code).toBe("CONFLICT");
    expect(result.error).toMatch(/changé|Rechargez/i);
    expect(create).toHaveBeenCalled();
    expect(logModificationMock).not.toHaveBeenCalled();
  });

  it("P2002 autre contrainte unique → erreur technique (pas CONFLICT)", async () => {
    const { tx } = makeTxHandlers({
      create: vi.fn().mockRejectedValue({
        code: "P2002",
        meta: { target: ["email"] },
      }),
    });
    transactionMock.mockImplementation(async (fn: (t: unknown) => Promise<void>) => {
      await fn(tx);
    });

    const result = await adminSetParticipationsReunion({
      reunionId: "r1",
      participations: [
        {
          adherentId: "adh-1",
          statut: "Present",
          expected: { kind: "absent" },
        },
      ],
    });

    expect(result.success).toBe(false);
    expect((result as { code?: string }).code).toBeUndefined();
    expect(result.error).toBe("Erreur interne du serveur");
  });

  it("updateMany si expected row (count 1)", async () => {
    const { tx, updateMany } = makeTxHandlers({});
    transactionMock.mockImplementation(async (fn: (t: unknown) => Promise<void>) => {
      await fn(tx);
    });

    const result = await adminSetParticipationsReunion({
      reunionId: "r1",
      participations: [
        {
          adherentId: "adh-1",
          statut: "Excuse",
          justificatifFournit: true,
          expected: {
            kind: "row",
            statut: "Present",
            justificatifFournit: false,
          },
        },
      ],
    });

    expect(result.success).toBe(true);
    expect(updateMany).toHaveBeenCalled();
  });

  it("absent+NonRepondu n'appelle aucun create/delete", async () => {
    const { tx, create, deleteMany, findUniquePart } = makeTxHandlers({
      findUniquePart: vi.fn().mockResolvedValue(null),
    });
    transactionMock.mockImplementation(async (fn: (t: unknown) => Promise<void>) => {
      await fn(tx);
    });

    const result = await adminSetParticipationsReunion({
      reunionId: "r1",
      participations: [
        {
          adherentId: "adh-1",
          statut: "NonRepondu",
          expected: { kind: "absent" },
        },
      ],
    });

    expect(result.success).toBe(true);
    expect(findUniquePart).toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    expect(deleteMany).not.toHaveBeenCalled();
  });

  it("annulation sous verrou avant geste → refus (pas CONFLICT)", async () => {
    const { tx } = makeTxHandlers({
      reunion: {
        id: "r1",
        statut: "Annulee",
        dateReunion: futureDate,
      },
    });
    transactionMock.mockImplementation(async (fn: (t: unknown) => Promise<void>) => {
      await fn(tx);
    });

    const result = await adminSetParticipationsReunion({
      reunionId: "r1",
      participations: [
        {
          adherentId: "adh-1",
          statut: "Present",
          expected: { kind: "absent" },
        },
      ],
    });

    expect(result.success).toBe(false);
    expect((result as { code?: string }).code).toBeUndefined();
    expect(result.error).toMatch(/annulée|confirmée|passée/i);
  });

  it("conflit 2ᵉ ligne → lot entièrement annulé (pas de logModification)", async () => {
    const updateMany = vi
      .fn()
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    const { tx } = makeTxHandlers({ updateMany });
    transactionMock.mockImplementation(async (fn: (t: unknown) => Promise<void>) => {
      await fn(tx);
    });

    const result = await adminSetParticipationsReunion({
      reunionId: "r1",
      participations: [
        {
          adherentId: "adh-2",
          statut: "Excuse",
          expected: { kind: "row", statut: "Present", justificatifFournit: false },
        },
        {
          adherentId: "adh-1",
          statut: "Absent",
          expected: { kind: "row", statut: "Present", justificatifFournit: false },
        },
      ],
    });

    expect(result.success).toBe(false);
    expect((result as { code?: string }).code).toBe("CONFLICT");
    expect(logModificationMock).not.toHaveBeenCalled();
    // ordre déterministe : adh-1 puis adh-2 — conflit sur 2ᵉ update (adh-2)
    expect(updateMany).toHaveBeenCalledTimes(2);
  });

  it("erreur SQL non-conflit n'est pas CONFLICT", async () => {
    transactionMock.mockImplementation(async () => {
      throw new Prisma.PrismaClientKnownRequestError("fk", {
        code: "P2003",
        clientVersion: "test",
      });
    });

    const result = await adminSetParticipationsReunion({
      reunionId: "r1",
      participations: [
        {
          adherentId: "adh-1",
          statut: "Present",
          expected: { kind: "absent" },
        },
      ],
    });

    expect(result.success).toBe(false);
    expect((result as { code?: string }).code).toBeUndefined();
  });

  it("ParticipationConflictError → CONFLICT", async () => {
    transactionMock.mockRejectedValue(new ParticipationConflictError());

    const result = await adminSetParticipationsReunion({
      reunionId: "r1",
      participations: [
        {
          adherentId: "adh-1",
          statut: "Present",
          expected: { kind: "absent" },
        },
      ],
    });

    expect((result as { code?: string }).code).toBe("CONFLICT");
  });

  it("ReunionParticipationNotWritableError hors TX → refus", async () => {
    transactionMock.mockRejectedValue(
      new ReunionParticipationNotWritableError("Cette réunion est passée.")
    );

    const result = await adminSetParticipationsReunion({
      reunionId: "r1",
      participations: [
        {
          adherentId: "adh-1",
          statut: "Present",
          expected: { kind: "absent" },
        },
      ],
    });

    expect(result.success).toBe(false);
    expect((result as { code?: string }).code).toBeUndefined();
    expect(result.error).toMatch(/passée/);
  });
});
