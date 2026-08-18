import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContext } from "@/lib/auth-context";

const { findUniqueAdherent } = vi.hoisted(() => ({
  findUniqueAdherent: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    adherent: {
      findUnique: findUniqueAdherent,
    },
  },
}));

import { getMyPasseport } from "@/lib/services/passeport/get-my-passeport";

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

const activeAdherent = {
  id: "adh-abc123456789",
  civility: "Monsieur",
  firstname: "Hubert",
  lastname: "Itomba",
  dateNaissance: new Date("1990-01-15"),
  profession: "Ingénieur",
  numeroPasseport: null as string | null,
  dateGenerationPasseport: null as Date | null,
  User: {
    status: "Actif",
    email: "hubert@example.com",
    createdAt: new Date("2024-01-01"),
  },
  Adresse: [],
};

describe("getMyPasseport", () => {
  beforeEach(() => {
    findUniqueAdherent.mockReset();
  });

  it("A — UNAUTHENTICATED si actor.userId absent", async () => {
    await expect(getMyPasseport(actor({ userId: "" }))).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
    });
    expect(findUniqueAdherent).not.toHaveBeenCalled();
  });

  it("C — NOT_FOUND si adhérent absent", async () => {
    findUniqueAdherent.mockResolvedValue(null);
    await expect(getMyPasseport(actor())).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("D — FORBIDDEN si compte non actif", async () => {
    findUniqueAdherent.mockResolvedValue({
      ...activeAdherent,
      User: { ...activeAdherent.User, status: "Inactif" },
    });
    await expect(getMyPasseport(actor())).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("E — actif sans numéro : peutGenerer true", async () => {
    findUniqueAdherent.mockResolvedValue(activeAdherent);
    const result = await getMyPasseport(actor());
    expect(result).toEqual({
      numeroPasseport: null,
      dateGenerationPasseport: null,
      disponible: true,
      peutGenerer: true,
    });
  });

  it("F — actif avec numéro : peutGenerer false", async () => {
    findUniqueAdherent.mockResolvedValue({
      ...activeAdherent,
      numeroPasseport: "AMAKI-2026-ABC123",
      dateGenerationPasseport: new Date("2026-08-18T10:00:00.000Z"),
    });
    const result = await getMyPasseport(actor());
    expect(result.numeroPasseport).toBe("AMAKI-2026-ABC123");
    expect(result.peutGenerer).toBe(false);
    expect(result.disponible).toBe(true);
    expect(result.dateGenerationPasseport).toBe("2026-08-18T10:00:00.000Z");
  });

  it("filtre sur actor.userId uniquement (anti-IDOR)", async () => {
    findUniqueAdherent.mockResolvedValue(activeAdherent);
    await getMyPasseport(actor({ userId: "user-own" }));
    expect(findUniqueAdherent).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-own" },
      })
    );
  });
});
