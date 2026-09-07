import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContext } from "@/lib/auth-context";
import { Prisma } from "@prisma/client";

const {
  findUniqueAdherent,
  findUniqueElection,
  findFirstPosition,
  findFirstCandidacy,
  createCandidacy,
  deleteCandidacy,
  countVote,
  transaction,
  queryRaw,
  findUniqueCandidacy,
} = vi.hoisted(() => ({
  findUniqueAdherent: vi.fn(),
  findUniqueElection: vi.fn(),
  findFirstPosition: vi.fn(),
  findFirstCandidacy: vi.fn(),
  createCandidacy: vi.fn(),
  deleteCandidacy: vi.fn(),
  countVote: vi.fn(),
  transaction: vi.fn(),
  queryRaw: vi.fn(),
  findUniqueCandidacy: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    adherent: { findUnique: findUniqueAdherent },
    election: { findUnique: findUniqueElection },
    position: { findFirst: findFirstPosition },
    candidacy: {
      findFirst: findFirstCandidacy,
      findUnique: findUniqueCandidacy,
      create: createCandidacy,
      delete: deleteCandidacy,
    },
    vote: { count: countVote },
    $transaction: transaction,
    $queryRaw: queryRaw,
  },
}));

import {
  submitMyCandidacy,
  withdrawMyCandidacy,
} from "@/lib/services/elections/submit-my-candidacy";

const actor = (): AuthContext =>
  ({
    userId: "u1",
    email: "a@b.com",
    role: "MEMBRE",
    status: "Actif",
    adminRoles: [],
    adherentId: null,
    name: "Ada",
    sessionId: null,
    channel: "mobile",
  }) as AuthContext;

function eligibleAdherent() {
  return {
    id: "ad1",
    Adresse: [{ street1: "1 rue", city: "Paris", codepost: "75001" }],
    Telephones: [],
  };
}

function openCandidacyElection() {
  const now = Date.now();
  return {
    id: "e1",
    status: "Ouverte",
    dateOuverture: new Date(now - 86_400_000),
    dateClotureCandidature: new Date(now + 86_400_000),
  };
}

function electionBeforeScrutin() {
  const now = Date.now();
  return {
    id: "e1",
    status: "Ouverte",
    dateScrutin: new Date(now + 86_400_000),
  };
}

function electionAfterScrutin() {
  const now = Date.now();
  return {
    id: "e1",
    status: "Ouverte",
    dateScrutin: new Date(now - 86_400_000),
  };
}

function mockWithdrawTxOk(candidacy = {
  id: "c1",
  status: "Validee",
  adherentId: "ad1",
  election: electionBeforeScrutin(),
}) {
  countVote.mockResolvedValue(0);
  findUniqueCandidacy.mockResolvedValue(candidacy);
  queryRaw.mockResolvedValue([{ id: candidacy.id }]);
  deleteCandidacy.mockResolvedValue({});
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

describe("submitMyCandidacy / withdrawMyCandidacy", () => {
  beforeEach(() => {
    findUniqueAdherent.mockReset();
    findUniqueElection.mockReset();
    findFirstPosition.mockReset();
    findFirstCandidacy.mockReset();
    createCandidacy.mockReset();
    deleteCandidacy.mockReset();
    countVote.mockReset();
    transaction.mockReset();
    queryRaw.mockReset();
    findUniqueCandidacy.mockReset();
    findUniqueAdherent.mockResolvedValue(eligibleAdherent());
  });

  it("soumet candidature si période ouverte", async () => {
    findUniqueElection.mockResolvedValue(openCandidacyElection());
    findFirstPosition.mockResolvedValue({ id: "p1" });
    findFirstCandidacy.mockResolvedValue(null);
    createCandidacy.mockResolvedValue({ id: "c1", status: "EnAttente" });
    const r = await submitMyCandidacy(actor(), "e1", "p1", {
      motivation: "m",
      programme: "p",
    });
    expect(r.id).toBe("c1");
  });

  it("P2002 → CONFLICT", async () => {
    findUniqueElection.mockResolvedValue(openCandidacyElection());
    findFirstPosition.mockResolvedValue({ id: "p1" });
    findFirstCandidacy.mockResolvedValue(null);
    createCandidacy.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("unique", {
        code: "P2002",
        clientVersion: "test",
      })
    );
    await expect(
      submitMyCandidacy(actor(), "e1", "p1", {
        motivation: "m",
        programme: "p",
      })
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("motivation/programme vides → VALIDATION", async () => {
    await expect(
      submitMyCandidacy(actor(), "e1", "p1", {
        motivation: "  ",
        programme: "p",
      })
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("retrait OK avant dateScrutin sans vote", async () => {
    findUniqueElection.mockResolvedValue(electionBeforeScrutin());
    findFirstCandidacy.mockResolvedValue({
      id: "c1",
      status: "EnAttente",
      adherentId: "ad1",
    });
    mockWithdrawTxOk({
      id: "c1",
      status: "EnAttente",
      adherentId: "ad1",
      election: electionBeforeScrutin(),
    });
    const r = await withdrawMyCandidacy(actor(), "e1", "p1");
    expect(r.withdrawn).toBe(true);
    expect(deleteCandidacy).toHaveBeenCalledWith({ where: { id: "c1" } });
  });

  it("retrait Validee OK avant scrutin sans vote", async () => {
    findUniqueElection.mockResolvedValue(electionBeforeScrutin());
    findFirstCandidacy.mockResolvedValue({
      id: "c1",
      status: "Validee",
      adherentId: "ad1",
    });
    mockWithdrawTxOk();
    await expect(withdrawMyCandidacy(actor(), "e1", "p1")).resolves.toMatchObject({
      withdrawn: true,
    });
  });

  it("retrait interdit après dateScrutin (même sans vote)", async () => {
    findUniqueElection.mockResolvedValue(electionAfterScrutin());
    findFirstCandidacy.mockResolvedValue({
      id: "c1",
      status: "Validee",
      adherentId: "ad1",
    });
    countVote.mockResolvedValue(0);
    await expect(withdrawMyCandidacy(actor(), "e1", "p1")).rejects.toMatchObject({
      code: "CONFLICT",
      message: expect.stringMatching(/scrutin a commencé/),
    });
    expect(transaction).not.toHaveBeenCalled();
  });

  it("retrait interdit si vote existant avant scrutin", async () => {
    findUniqueElection.mockResolvedValue(electionBeforeScrutin());
    findFirstCandidacy.mockResolvedValue({
      id: "c1",
      status: "Validee",
      adherentId: "ad1",
    });
    countVote.mockResolvedValue(1);
    await expect(withdrawMyCandidacy(actor(), "e1", "p1")).rejects.toMatchObject({
      code: "CONFLICT",
      message: expect.stringMatching(/votes ont déjà été enregistrés/),
    });
  });

  it("retrait interdit après scrutin + vote", async () => {
    findUniqueElection.mockResolvedValue(electionAfterScrutin());
    findFirstCandidacy.mockResolvedValue({
      id: "c1",
      status: "Validee",
      adherentId: "ad1",
    });
    countVote.mockResolvedValue(2);
    await expect(withdrawMyCandidacy(actor(), "e1", "p1")).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });

  it("retrait interdit si Cloturee", async () => {
    findUniqueElection.mockResolvedValue({
      id: "e1",
      status: "Cloturee",
      dateScrutin: new Date(Date.now() + 86_400_000),
    });
    findFirstCandidacy.mockResolvedValue({
      id: "c1",
      status: "EnAttente",
      adherentId: "ad1",
    });
    countVote.mockResolvedValue(0);
    await expect(withdrawMyCandidacy(actor(), "e1", "p1")).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });

  it("candidature inexistante → NOT_FOUND", async () => {
    findUniqueElection.mockResolvedValue(electionBeforeScrutin());
    findFirstCandidacy.mockResolvedValue(null);
    await expect(withdrawMyCandidacy(actor(), "e1", "p1")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("course vote/retrait : vote détecté dans la transaction", async () => {
    findUniqueElection.mockResolvedValue(electionBeforeScrutin());
    findFirstCandidacy.mockResolvedValue({
      id: "c1",
      status: "Validee",
      adherentId: "ad1",
    });
    // Pré-contrôle OK
    countVote.mockResolvedValueOnce(0);
    // Dans la TX : un vote est apparu
    countVote.mockResolvedValueOnce(1);
    findUniqueCandidacy.mockResolvedValue({
      id: "c1",
      status: "Validee",
      adherentId: "ad1",
      election: electionBeforeScrutin(),
    });
    queryRaw.mockResolvedValue([{ id: "c1" }]);
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
    await expect(withdrawMyCandidacy(actor(), "e1", "p1")).rejects.toMatchObject({
      code: "CONFLICT",
      message: expect.stringMatching(/votes/),
    });
    expect(deleteCandidacy).not.toHaveBeenCalled();
  });

  it("erreur FK Prisma P2003 → CONFLICT métier", async () => {
    findUniqueElection.mockResolvedValue(electionBeforeScrutin());
    findFirstCandidacy.mockResolvedValue({
      id: "c1",
      status: "Validee",
      adherentId: "ad1",
    });
    countVote.mockResolvedValue(0);
    findUniqueCandidacy.mockResolvedValue({
      id: "c1",
      status: "Validee",
      adherentId: "ad1",
      election: electionBeforeScrutin(),
    });
    queryRaw.mockResolvedValue([{ id: "c1" }]);
    deleteCandidacy.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("fk", {
        code: "P2003",
        clientVersion: "test",
      })
    );
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
    await expect(withdrawMyCandidacy(actor(), "e1", "p1")).rejects.toMatchObject({
      code: "CONFLICT",
      message: expect.stringMatching(/votes/),
    });
  });
});
