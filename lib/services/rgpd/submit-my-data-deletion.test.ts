import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContext } from "@/lib/auth-context";

const {
  findUniqueUser,
  findFirstRequest,
  createRequest,
} = vi.hoisted(() => ({
  findUniqueUser: vi.fn(),
  findFirstRequest: vi.fn(),
  createRequest: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    user: { findUnique: findUniqueUser },
    dataDeletionRequest: {
      findFirst: findFirstRequest,
      create: createRequest,
    },
  },
}));

import {
  getMyDataDeletionRequest,
  submitMyDataDeletionRequest,
} from "@/lib/services/rgpd/submit-my-data-deletion";

function actor(): AuthContext {
  return {
    userId: "user-A",
    role: "MEMBRE",
    status: "Actif",
    email: "a@example.com",
    name: "Ada",
    sessionId: null,
    adminRoles: [],
    adherentId: null,
    channel: "mobile",
  };
}

describe("submitMyDataDeletionRequest", () => {
  beforeEach(() => {
    findUniqueUser.mockReset();
    findFirstRequest.mockReset();
    createRequest.mockReset();
  });

  it("crée une demande pour actor.userId", async () => {
    findUniqueUser.mockResolvedValue({
      id: "user-A",
      email: "a@example.com",
      name: "Ada",
      adherent: null,
    });
    findFirstRequest.mockResolvedValue(null);
    createRequest.mockResolvedValue({ id: "req-1", statut: "EnAttente" });

    const res = await submitMyDataDeletionRequest(actor(), {
      message: "Merci",
    });
    expect(res).toEqual({ id: "req-1", statut: "EnAttente" });
    expect(createRequest.mock.calls[0][0].data.userId).toBe("user-A");
    expect(createRequest.mock.calls[0][0].data.userEmail).toBe("a@example.com");
  });

  it("CONFLICT si demande déjà en cours", async () => {
    findUniqueUser.mockResolvedValue({
      id: "user-A",
      email: "a@example.com",
      name: "Ada",
      adherent: null,
    });
    findFirstRequest.mockResolvedValue({ id: "req-old" });
    await expect(submitMyDataDeletionRequest(actor())).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });
});

describe("getMyDataDeletionRequest", () => {
  it("filtre sur actor.userId", async () => {
    findFirstRequest.mockResolvedValue({
      id: "r1",
      statut: "EnAttente",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    const res = await getMyDataDeletionRequest(actor());
    expect(res?.id).toBe("r1");
    expect(findFirstRequest.mock.calls[0][0].where.userId).toBe("user-A");
  });
});
