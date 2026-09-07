import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const {
  transaction,
  queryRaw,
  findUniqueCandidacy,
  deleteCandidacy,
  countVote,
} = vi.hoisted(() => ({
  transaction: vi.fn(),
  queryRaw: vi.fn(),
  findUniqueCandidacy: vi.fn(),
  deleteCandidacy: vi.fn(),
  countVote: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    $transaction: transaction,
    candidacy: {
      findUnique: findUniqueCandidacy,
      delete: deleteCandidacy,
    },
    vote: { count: countVote },
    $queryRaw: queryRaw,
  },
}));

import { hardDeleteCandidacyGuardingVotes } from "@/lib/services/elections/hard-delete-candidacy";

function mockTx() {
  transaction.mockImplementation(async (fn: any) =>
    fn({
      $queryRaw: queryRaw,
      candidacy: {
        findUnique: findUniqueCandidacy,
        delete: deleteCandidacy,
      },
      vote: { count: countVote },
    })
  );
}

describe("hardDeleteCandidacyGuardingVotes", () => {
  beforeEach(() => {
    transaction.mockReset();
    queryRaw.mockReset();
    findUniqueCandidacy.mockReset();
    deleteCandidacy.mockReset();
    countVote.mockReset();
    mockTx();
    queryRaw.mockResolvedValue([{ id: "c1" }]);
  });

  it("supprime si aucun vote", async () => {
    findUniqueCandidacy.mockResolvedValue({ id: "c1" });
    countVote.mockResolvedValue(0);
    deleteCandidacy.mockResolvedValue({});
    await expect(hardDeleteCandidacyGuardingVotes("c1")).resolves.toEqual({
      deleted: true,
    });
    expect(deleteCandidacy).toHaveBeenCalledWith({ where: { id: "c1" } });
  });

  it("refuse si vote existant (anti SET NULL)", async () => {
    findUniqueCandidacy.mockResolvedValue({ id: "c1" });
    countVote.mockResolvedValue(3);
    await expect(hardDeleteCandidacyGuardingVotes("c1")).rejects.toMatchObject({
      code: "CONFLICT",
      message: expect.stringMatching(/votes/),
    });
    expect(deleteCandidacy).not.toHaveBeenCalled();
  });

  it("NOT_FOUND si candidature absente", async () => {
    findUniqueCandidacy.mockResolvedValue(null);
    countVote.mockResolvedValue(0);
    await expect(hardDeleteCandidacyGuardingVotes("c-x")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("P2003 → CONFLICT métier", async () => {
    findUniqueCandidacy.mockResolvedValue({ id: "c1" });
    countVote.mockResolvedValue(0);
    deleteCandidacy.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("fk", {
        code: "P2003",
        clientVersion: "test",
      })
    );
    await expect(hardDeleteCandidacyGuardingVotes("c1")).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });
});
