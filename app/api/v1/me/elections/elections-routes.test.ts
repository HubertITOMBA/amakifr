import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/api/auth-resolve", () => ({
  resolveApiActor: vi.fn(),
}));

vi.mock("@/lib/services/elections/get-my-elections", () => ({
  getMyElections: vi.fn(),
  getMyElectionsSummary: vi.fn(),
  getMyElection: vi.fn(),
}));

vi.mock("@/lib/services/elections/submit-my-vote", () => ({
  submitMyVote: vi.fn(),
}));

vi.mock("@/lib/services/elections/submit-my-candidacy", () => ({
  submitMyCandidacy: vi.fn(),
  withdrawMyCandidacy: vi.fn(),
}));

vi.mock("@/lib/services/elections/get-my-election-results", () => ({
  getMyElectionResults: vi.fn(),
}));

import { resolveApiActor } from "@/lib/api/auth-resolve";
import {
  getMyElection,
  getMyElections,
  getMyElectionsSummary,
} from "@/lib/services/elections/get-my-elections";
import { submitMyVote } from "@/lib/services/elections/submit-my-vote";
import {
  submitMyCandidacy,
  withdrawMyCandidacy,
} from "@/lib/services/elections/submit-my-candidacy";
import { getMyElectionResults } from "@/lib/services/elections/get-my-election-results";
import { GET as GET_LIST } from "./route";
import { GET as GET_ONE } from "./[id]/route";
import { POST as POST_VOTE } from "./[id]/vote/route";
import { GET as GET_RESULTS } from "./[id]/results/route";
import {
  POST as POST_CANDIDACY,
  DELETE as DELETE_CANDIDACY,
} from "./[id]/positions/[positionId]/candidacy/route";
import { ServiceError } from "@/lib/service-error";

const resolve = resolveApiActor as unknown as ReturnType<typeof vi.fn>;
const listFn = getMyElections as unknown as ReturnType<typeof vi.fn>;
const summaryFn = getMyElectionsSummary as unknown as ReturnType<typeof vi.fn>;
const detailFn = getMyElection as unknown as ReturnType<typeof vi.fn>;
const voteFn = submitMyVote as unknown as ReturnType<typeof vi.fn>;
const resultsFn = getMyElectionResults as unknown as ReturnType<typeof vi.fn>;
const candidacyFn = submitMyCandidacy as unknown as ReturnType<typeof vi.fn>;
const withdrawFn = withdrawMyCandidacy as unknown as ReturnType<typeof vi.fn>;

const actor = {
  userId: "u1",
  email: "a@b.com",
  role: "MEMBRE",
  status: "Actif",
  adminRoles: [],
  adherentId: null,
  name: "Ada",
  sessionId: null,
  channel: "mobile",
};

describe("API /api/v1/me/elections", () => {
  beforeEach(() => {
    resolve.mockReset();
    listFn.mockReset();
    summaryFn.mockReset();
    detailFn.mockReset();
    voteFn.mockReset();
    resultsFn.mockReset();
    candidacyFn.mockReset();
    withdrawFn.mockReset();
  });

  it("GET liste 401 sans actor", async () => {
    resolve.mockResolvedValue(null);
    const res = await GET_LIST(
      new NextRequest("http://localhost/api/v1/me/elections")
    );
    expect(res.status).toBe(401);
  });

  it("GET summary", async () => {
    resolve.mockResolvedValue(actor);
    summaryFn.mockResolvedValue({ aVoterCount: 2 });
    const res = await GET_LIST(
      new NextRequest("http://localhost/api/v1/me/elections?summary=1")
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.aVoterCount).toBe(2);
  });

  it("POST vote refuse champs ownership", async () => {
    resolve.mockResolvedValue(actor);
    const res = await POST_VOTE(
      new NextRequest("http://localhost/api/v1/me/elections/e1/vote", {
        method: "POST",
        body: JSON.stringify({
          votes: [{ positionId: "p1", candidacyId: null }],
          adherentId: "hack",
        }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ id: "e1" }) }
    );
    expect(res.status).toBe(400);
    expect(voteFn).not.toHaveBeenCalled();
  });

  it("POST vote OK", async () => {
    resolve.mockResolvedValue(actor);
    voteFn.mockResolvedValue({ recorded: 1, message: "ok" });
    const res = await POST_VOTE(
      new NextRequest("http://localhost/api/v1/me/elections/e1/vote", {
        method: "POST",
        body: JSON.stringify({
          votes: [{ positionId: "p1", candidacyId: "c1" }],
        }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ id: "e1" }) }
    );
    expect(res.status).toBe(200);
    expect(voteFn).toHaveBeenCalledWith(actor, "e1", {
      votes: [{ positionId: "p1", candidacyId: "c1" }],
    });
  });

  it("GET detail", async () => {
    resolve.mockResolvedValue(actor);
    detailFn.mockResolvedValue({ id: "e1", titre: "AG" });
    const res = await GET_ONE(
      new NextRequest("http://localhost/api/v1/me/elections/e1"),
      { params: Promise.resolve({ id: "e1" }) }
    );
    expect(res.status).toBe(200);
  });

  it("GET results 403 avant clôture", async () => {
    resolve.mockResolvedValue(actor);
    resultsFn.mockRejectedValue(
      new ServiceError("FORBIDDEN", "Les résultats ne sont pas encore disponibles")
    );
    const res = await GET_RESULTS(
      new NextRequest("http://localhost/api/v1/me/elections/e1/results"),
      { params: Promise.resolve({ id: "e1" }) }
    );
    expect(res.status).toBe(403);
  });

  it("GET list", async () => {
    resolve.mockResolvedValue(actor);
    listFn.mockResolvedValue({ items: [], total: 0, limit: 50, offset: 0 });
    const res = await GET_LIST(
      new NextRequest("http://localhost/api/v1/me/elections")
    );
    expect(res.status).toBe(200);
  });

  it("POST candidacy refuse ownership", async () => {
    resolve.mockResolvedValue(actor);
    const res = await POST_CANDIDACY(
      new NextRequest(
        "http://localhost/api/v1/me/elections/e1/positions/p1/candidacy",
        {
          method: "POST",
          body: JSON.stringify({
            motivation: "m",
            programme: "p",
            adherentId: "hack",
          }),
          headers: { "content-type": "application/json" },
        }
      ),
      { params: Promise.resolve({ id: "e1", positionId: "p1" }) }
    );
    expect(res.status).toBe(400);
    expect(candidacyFn).not.toHaveBeenCalled();
  });

  it("POST candidacy OK", async () => {
    resolve.mockResolvedValue(actor);
    candidacyFn.mockResolvedValue({
      id: "c1",
      status: "EnAttente",
      message: "ok",
    });
    const res = await POST_CANDIDACY(
      new NextRequest(
        "http://localhost/api/v1/me/elections/e1/positions/p1/candidacy",
        {
          method: "POST",
          body: JSON.stringify({ motivation: "m", programme: "p" }),
          headers: { "content-type": "application/json" },
        }
      ),
      { params: Promise.resolve({ id: "e1", positionId: "p1" }) }
    );
    expect(res.status).toBe(200);
    expect(candidacyFn).toHaveBeenCalledWith(actor, "e1", "p1", {
      motivation: "m",
      programme: "p",
    });
  });

  it("DELETE candidacy OK", async () => {
    resolve.mockResolvedValue(actor);
    withdrawFn.mockResolvedValue({ withdrawn: true, message: "ok" });
    const res = await DELETE_CANDIDACY(
      new NextRequest(
        "http://localhost/api/v1/me/elections/e1/positions/p1/candidacy",
        { method: "DELETE" }
      ),
      { params: Promise.resolve({ id: "e1", positionId: "p1" }) }
    );
    expect(res.status).toBe(200);
    expect(withdrawFn).toHaveBeenCalledWith(actor, "e1", "p1");
  });
});
