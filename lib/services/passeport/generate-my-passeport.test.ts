import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContext } from "@/lib/auth-context";

const { findUniqueAdherent, updateAdherent } = vi.hoisted(() => ({
  findUniqueAdherent: vi.fn(),
  updateAdherent: vi.fn(),
}));

const { generateNumeroPasseportMock } = vi.hoisted(() => ({
  generateNumeroPasseportMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    adherent: {
      findUnique: findUniqueAdherent,
      update: updateAdherent,
    },
  },
}));

vi.mock("@/lib/passeport-helpers", () => ({
  generateNumeroPasseport: generateNumeroPasseportMock,
}));

import { generateMyPasseport } from "@/lib/services/passeport/generate-my-passeport";

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

describe("generateMyPasseport", () => {
  beforeEach(() => {
    findUniqueAdherent.mockReset();
    updateAdherent.mockReset();
    generateNumeroPasseportMock.mockReset();
    generateNumeroPasseportMock.mockReturnValue("AMAKI-2026-ABC123");
  });

  it("G — génère si numéro absent", async () => {
    findUniqueAdherent.mockResolvedValue(activeAdherent);
    updateAdherent.mockResolvedValue({
      numeroPasseport: "AMAKI-2026-ABC123",
      dateGenerationPasseport: new Date("2026-08-18T10:00:00.000Z"),
    });

    const result = await generateMyPasseport(actor());

    expect(generateNumeroPasseportMock).toHaveBeenCalledWith(
      "adh-abc123456789",
      activeAdherent.User.createdAt
    );
    expect(updateAdherent).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "adh-abc123456789" },
        data: expect.objectContaining({
          numeroPasseport: "AMAKI-2026-ABC123",
        }),
      })
    );
    expect(result.numeroPasseport).toBe("AMAKI-2026-ABC123");
    expect(result.peutGenerer).toBe(false);
  });

  it("H — idempotent si numéro déjà présent", async () => {
    findUniqueAdherent.mockResolvedValue({
      ...activeAdherent,
      numeroPasseport: "AMAKI-2026-EXIST",
      dateGenerationPasseport: new Date("2026-01-01T00:00:00.000Z"),
    });

    const result = await generateMyPasseport(actor());

    expect(generateNumeroPasseportMock).not.toHaveBeenCalled();
    expect(updateAdherent).not.toHaveBeenCalled();
    expect(result.numeroPasseport).toBe("AMAKI-2026-EXIST");
  });

  it("I — FORBIDDEN si compte inactif", async () => {
    findUniqueAdherent.mockResolvedValue({
      ...activeAdherent,
      User: { ...activeAdherent.User, status: "Inactif" },
    });
    await expect(generateMyPasseport(actor())).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(updateAdherent).not.toHaveBeenCalled();
  });

  it("J — ownership actor.userId uniquement", async () => {
    findUniqueAdherent.mockResolvedValue(activeAdherent);
    updateAdherent.mockResolvedValue({
      numeroPasseport: "AMAKI-2026-ABC123",
      dateGenerationPasseport: new Date(),
    });
    await generateMyPasseport(actor({ userId: "user-own" }));
    expect(findUniqueAdherent).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-own" } })
    );
  });
});
