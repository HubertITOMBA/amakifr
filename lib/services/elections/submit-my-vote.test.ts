import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContext } from "@/lib/auth-context";
import { Prisma } from "@prisma/client";

const {
  findUniqueAdherent,
  findUniqueElection,
  findFirstCandidacy,
  findFirstVote,
  createVote,
  transaction,
} = vi.hoisted(() => ({
  findUniqueAdherent: vi.fn(),
  findUniqueElection: vi.fn(),
  findFirstCandidacy: vi.fn(),
  findFirstVote: vi.fn(),
  createVote: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    adherent: { findUnique: findUniqueAdherent },
    election: { findUnique: findUniqueElection },
    candidacy: { findFirst: findFirstCandidacy },
    vote: { findFirst: findFirstVote, create: createVote },
    $transaction: transaction,
  },
}));

import { submitMyVote } from "@/lib/services/elections/submit-my-vote";
import { getMyElectionResults } from "@/lib/services/elections/get-my-election-results";

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

/** Élection Ouverte dans la fenêtre de vote relative à maintenant. */
function openElectionInWindow(positions = [{ id: "p1" }, { id: "p2" }]) {
  const now = Date.now();
  return {
    id: "e1",
    status: "Ouverte",
    dateScrutin: new Date(now - 86_400_000),
    dateCloture: new Date(now + 86_400_000),
    positions,
  };
}

describe("submitMyVote", () => {
  beforeEach(() => {
    findUniqueAdherent.mockReset();
    findUniqueElection.mockReset();
    findFirstCandidacy.mockReset();
    findFirstVote.mockReset();
    createVote.mockReset();
    transaction.mockReset();
    findUniqueAdherent.mockResolvedValue(eligibleAdherent());
    transaction.mockImplementation(async (fn: any) =>
      fn({
        vote: { findFirst: findFirstVote, create: createVote },
      })
    );
  });

  it("vote valide + blanc", async () => {
    findUniqueElection.mockResolvedValue(openElectionInWindow());
    findFirstCandidacy.mockResolvedValue({ id: "c1" });
    findFirstVote.mockResolvedValue(null);
    createVote.mockResolvedValue({ id: "v1" });

    const r = await submitMyVote(actor(), "e1", {
      votes: [
        { positionId: "p1", candidacyId: "c1" },
        { positionId: "p2", candidacyId: null },
      ],
    });
    expect(r.recorded).toBe(2);
    expect(createVote).toHaveBeenCalledTimes(2);
  });

  it("refuse Ouverte avant dateScrutin", async () => {
    const now = Date.now();
    findUniqueElection.mockResolvedValue({
      id: "e1",
      status: "Ouverte",
      dateScrutin: new Date(now + 86_400_000),
      dateCloture: new Date(now + 2 * 86_400_000),
      positions: [{ id: "p1" }],
    });
    await expect(
      submitMyVote(actor(), "e1", {
        votes: [{ positionId: "p1", candidacyId: null }],
      })
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("refuse Ouverte après dateCloture", async () => {
    const now = Date.now();
    findUniqueElection.mockResolvedValue({
      id: "e1",
      status: "Ouverte",
      dateScrutin: new Date(now - 2 * 86_400_000),
      dateCloture: new Date(now - 86_400_000),
      positions: [{ id: "p1" }],
    });
    await expect(
      submitMyVote(actor(), "e1", {
        votes: [{ positionId: "p1", candidacyId: null }],
      })
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("refuse élection non ouverte (Cloturee même dans fenêtre)", async () => {
    const now = Date.now();
    findUniqueElection.mockResolvedValue({
      id: "e1",
      status: "Cloturee",
      dateScrutin: new Date(now - 86_400_000),
      dateCloture: new Date(now + 86_400_000),
      positions: [{ id: "p1" }],
    });
    await expect(
      submitMyVote(actor(), "e1", {
        votes: [{ positionId: "p1", candidacyId: null }],
      })
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("refuse Preparation même dans fenêtre", async () => {
    const now = Date.now();
    findUniqueElection.mockResolvedValue({
      id: "e1",
      status: "Preparation",
      dateScrutin: new Date(now - 86_400_000),
      dateCloture: new Date(now + 86_400_000),
      positions: [{ id: "p1" }],
    });
    await expect(
      submitMyVote(actor(), "e1", {
        votes: [{ positionId: "p1", candidacyId: null }],
      })
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("refuse candidat autre poste / non validé", async () => {
    findUniqueElection.mockResolvedValue(
      openElectionInWindow([{ id: "p1" }])
    );
    findFirstCandidacy.mockResolvedValue(null);
    await expect(
      submitMyVote(actor(), "e1", {
        votes: [{ positionId: "p1", candidacyId: "c-x" }],
      })
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("double vote → CONFLICT", async () => {
    findUniqueElection.mockResolvedValue(
      openElectionInWindow([{ id: "p1" }])
    );
    findFirstVote.mockResolvedValue({ id: "existing" });
    await expect(
      submitMyVote(actor(), "e1", {
        votes: [{ positionId: "p1", candidacyId: null }],
      })
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("refuse deux choix pour le même poste (miroir 1 radio Web)", async () => {
    findUniqueElection.mockResolvedValue(
      openElectionInWindow([{ id: "p1" }])
    );
    findFirstCandidacy.mockResolvedValue({ id: "c1" });
    await expect(
      submitMyVote(actor(), "e1", {
        votes: [
          { positionId: "p1", candidacyId: "c1" },
          { positionId: "p1", candidacyId: null },
        ],
      })
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      message: "Un seul choix par poste",
    });
  });

  it("vote blanc seul (candidacyId null) accepté", async () => {
    findUniqueElection.mockResolvedValue(
      openElectionInWindow([{ id: "p1" }])
    );
    findFirstVote.mockResolvedValue(null);
    createVote.mockResolvedValue({ id: "v1" });
    const r = await submitMyVote(actor(), "e1", {
      votes: [{ positionId: "p1", candidacyId: null }],
    });
    expect(r.recorded).toBe(1);
    expect(createVote).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          candidacyId: null,
          status: "Blanc",
        }),
      })
    );
  });

  it("P2002 concurrence → CONFLICT", async () => {
    findUniqueElection.mockResolvedValue(
      openElectionInWindow([{ id: "p1" }])
    );
    findFirstVote.mockResolvedValue(null);
    createVote.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("unique", {
        code: "P2002",
        clientVersion: "test",
      })
    );
    await expect(
      submitMyVote(actor(), "e1", {
        votes: [{ positionId: "p1", candidacyId: null }],
      })
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("non éligible (pas adresse/tel)", async () => {
    findUniqueAdherent.mockResolvedValue({
      id: "ad1",
      Adresse: [],
      Telephones: [],
    });
    await expect(
      submitMyVote(actor(), "e1", {
        votes: [{ positionId: "p1", candidacyId: null }],
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("getMyElectionResults confidentialité", () => {
  beforeEach(() => {
    findUniqueAdherent.mockReset();
    findUniqueElection.mockReset();
    findUniqueAdherent.mockResolvedValue({ id: "ad1" });
  });

  it("refuse avant clôture", async () => {
    findUniqueElection.mockResolvedValue({
      id: "e1",
      titre: "AG",
      status: "Ouverte",
      positions: [],
    });
    await expect(getMyElectionResults(actor(), "e1")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("résultats Cloturee sans PII électeurs", async () => {
    findUniqueElection.mockResolvedValue({
      id: "e1",
      titre: "AG",
      status: "Cloturee",
      positions: [
        {
          id: "p1",
          titre: "Président",
          PosteTemplate: { ordre: 1 },
          candidacies: [
            {
              id: "c1",
              adherent: {
                civility: "Monsieur",
                firstname: "Jean",
                lastname: "Dupont",
              },
              _count: { votes: 3 },
            },
          ],
          votes: [
            { status: "Valide" },
            { status: "Valide" },
            { status: "Valide" },
            { status: "Blanc" },
          ],
        },
      ],
    });
    const r = await getMyElectionResults(actor(), "e1");
    expect(r.positions[0].totalVotes).toBe(4);
    expect(r.positions[0].blankVotes).toBe(1);
    expect(r.positions[0].candidacies[0].votesCount).toBe(3);
    expect(JSON.stringify(r)).not.toMatch(/adherentId|email|userId/i);
  });
});
