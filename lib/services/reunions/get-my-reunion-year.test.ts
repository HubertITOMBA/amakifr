import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContext } from "@/lib/auth-context";

const { findUniqueAdherent, findManyReunions } = vi.hoisted(() => ({
  findUniqueAdherent: vi.fn(),
  findManyReunions: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    adherent: { findUnique: findUniqueAdherent },
    reunionMensuelle: { findMany: findManyReunions },
  },
}));

import { getMyReunionYear } from "@/lib/services/reunions/get-my-reunion-year";

function actor(overrides: Partial<AuthContext> = {}): AuthContext {
  return {
    userId: "user-1",
    role: "MEMBRE",
    status: "Actif",
    email: "a@example.com",
    name: "Ada",
    sessionId: null,
    adminRoles: [],
    adherentId: null,
    channel: "web",
    ...overrides,
  };
}

beforeEach(() => {
  findUniqueAdherent.mockReset();
  findManyReunions.mockReset();
});

describe("getMyReunionYear", () => {
  it("UNAUTHENTICATED si userId vide", async () => {
    await expect(
      getMyReunionYear(actor({ userId: "" }), 2026)
    ).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  });

  it("VALIDATION_ERROR si année hors bornes", async () => {
    await expect(getMyReunionYear(actor(), 1999)).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });

  it("NOT_FOUND si adhérent absent", async () => {
    findUniqueAdherent.mockResolvedValue(null);
    await expect(getMyReunionYear(actor(), 2026)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("retourne 12 mois pour une année", async () => {
    findUniqueAdherent.mockResolvedValue({ id: "adh-1" });
    findManyReunions.mockResolvedValue([
      {
        id: "r10",
        mois: 10,
        statut: "EnAttente",
        dateReunion: null,
        adherentHoteId: "adh-1",
        AdherentHote: {
          id: "adh-1",
          firstname: "Alice",
          lastname: "Martin",
        },
      },
    ]);

    const result = await getMyReunionYear(actor(), 2026);
    expect(result.annee).toBe(2026);
    expect(result.months).toHaveLength(12);
    expect(result.alreadyHostThisYear).toBe(true);
    expect(result.months[9].isCurrentUserHost).toBe(true);
    expect(findManyReunions).toHaveBeenCalledWith(
      expect.objectContaining({ where: { annee: 2026 } })
    );
  });
});
