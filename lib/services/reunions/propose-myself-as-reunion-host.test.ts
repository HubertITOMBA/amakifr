import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContext } from "@/lib/auth-context";

const {
  findUniqueAdherent,
  findUniqueReunion,
  findFirstReunion,
  createReunion,
  updateReunion,
} = vi.hoisted(() => ({
  findUniqueAdherent: vi.fn(),
  findUniqueReunion: vi.fn(),
  findFirstReunion: vi.fn(),
  createReunion: vi.fn(),
  updateReunion: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    adherent: { findUnique: findUniqueAdherent },
    reunionMensuelle: {
      findUnique: findUniqueReunion,
      findFirst: findFirstReunion,
      create: createReunion,
      update: updateReunion,
    },
  },
}));

import { proposeMyselfAsReunionHost } from "@/lib/services/reunions/propose-myself-as-reunion-host";

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

const futureYear = new Date().getFullYear() + 1;

beforeEach(() => {
  findUniqueAdherent.mockReset();
  findUniqueReunion.mockReset();
  findFirstReunion.mockReset();
  createReunion.mockReset();
  updateReunion.mockReset();
});

describe("proposeMyselfAsReunionHost", () => {
  it("UNAUTHENTICATED si userId absent", async () => {
    await expect(
      proposeMyselfAsReunionHost(actor({ userId: "" }), {
        annee: futureYear,
        mois: 10,
      })
    ).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  });

  it("VALIDATION_ERROR si mois invalide", async () => {
    await expect(
      proposeMyselfAsReunionHost(actor(), { annee: futureYear, mois: 13 })
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("FORBIDDEN si mois passé", async () => {
    await expect(
      proposeMyselfAsReunionHost(actor(), { annee: 2020, mois: 1 })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("NOT_FOUND si adhérent absent", async () => {
    findUniqueAdherent.mockResolvedValue(null);
    await expect(
      proposeMyselfAsReunionHost(actor(), { annee: futureYear, mois: 10 })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("FORBIDDEN si non MEMBRE actif", async () => {
    findUniqueAdherent.mockResolvedValue({
      id: "adh-1",
      firstname: "A",
      lastname: "B",
      User: { role: "ADMIN", status: "Actif" },
    });
    await expect(
      proposeMyselfAsReunionHost(actor(), { annee: futureYear, mois: 10 })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("CONFLICT si mois déjà pris", async () => {
    findUniqueAdherent.mockResolvedValue({
      id: "adh-1",
      firstname: "A",
      lastname: "B",
      User: { role: "MEMBRE", status: "Actif" },
    });
    findUniqueReunion.mockResolvedValue({
      id: "r-existing",
      adherentHoteId: "adh-other",
      statut: "EnAttente",
    });
    await expect(
      proposeMyselfAsReunionHost(actor(), { annee: futureYear, mois: 10 })
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(createReunion).not.toHaveBeenCalled();
  });

  it("FORBIDDEN si déjà hôte cette année", async () => {
    findUniqueAdherent.mockResolvedValue({
      id: "adh-1",
      firstname: "A",
      lastname: "B",
      User: { role: "MEMBRE", status: "Actif" },
    });
    findUniqueReunion.mockResolvedValue(null);
    findFirstReunion.mockResolvedValue({ id: "r-other", mois: 3 });
    await expect(
      proposeMyselfAsReunionHost(actor(), { annee: futureYear, mois: 10 })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("reclaim EnAttente sans hôte après désistement (A→B octobre)", async () => {
    findUniqueAdherent.mockResolvedValue({
      id: "adh-B",
      firstname: "Bob",
      lastname: "Bernard",
      User: { role: "MEMBRE", status: "Actif" },
    });
    findUniqueReunion.mockResolvedValue({
      id: "r-oct",
      adherentHoteId: null,
      statut: "EnAttente",
    });
    findFirstReunion.mockResolvedValue(null);
    updateReunion.mockResolvedValue({
      id: "r-oct",
      annee: futureYear,
      mois: 10,
      statut: "EnAttente",
    });

    const result = await proposeMyselfAsReunionHost(actor({ userId: "user-B" }), {
      annee: futureYear,
      mois: 10,
    });

    expect(result).toEqual({
      id: "r-oct",
      annee: futureYear,
      mois: 10,
      statut: "EnAttente",
      hostName: "Bob Bernard",
    });
    expect(createReunion).not.toHaveBeenCalled();
    expect(updateReunion).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "r-oct" },
        data: expect.objectContaining({
          adherentHoteId: "adh-B",
          statut: "EnAttente",
          updatedBy: "user-B",
        }),
      })
    );
  });

  it("CONFLICT si sans hôte mais statut non EnAttente", async () => {
    findUniqueAdherent.mockResolvedValue({
      id: "adh-1",
      firstname: "A",
      lastname: "B",
      User: { role: "MEMBRE", status: "Actif" },
    });
    findUniqueReunion.mockResolvedValue({
      id: "r-x",
      adherentHoteId: null,
      statut: "MoisValide",
    });
    await expect(
      proposeMyselfAsReunionHost(actor(), { annee: futureYear, mois: 10 })
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("crée EnAttente pour mois disponible", async () => {
    findUniqueAdherent.mockResolvedValue({
      id: "adh-1",
      firstname: "Alice",
      lastname: "Martin",
      User: { role: "MEMBRE", status: "Actif" },
    });
    findUniqueReunion.mockResolvedValue(null);
    findFirstReunion.mockResolvedValue(null);
    createReunion.mockResolvedValue({
      id: "r-new",
      annee: futureYear,
      mois: 10,
      statut: "EnAttente",
      AdherentHote: { firstname: "Alice", lastname: "Martin" },
    });

    const result = await proposeMyselfAsReunionHost(actor(), {
      annee: futureYear,
      mois: 10,
    });

    expect(result).toEqual({
      id: "r-new",
      annee: futureYear,
      mois: 10,
      statut: "EnAttente",
      hostName: "Alice Martin",
    });
    expect(createReunion).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          annee: futureYear,
          mois: 10,
          adherentHoteId: "adh-1",
          statut: "EnAttente",
          createdBy: "user-1",
        }),
      })
    );
  });

  it("anti-IDOR : hôte = actor, ignore adherentId session", async () => {
    findUniqueAdherent.mockResolvedValue({
      id: "adh-B",
      firstname: "Bob",
      lastname: "B",
      User: { role: "MEMBRE", status: "Actif" },
    });
    findUniqueReunion.mockResolvedValue(null);
    findFirstReunion.mockResolvedValue(null);
    createReunion.mockResolvedValue({
      id: "r-new",
      annee: futureYear,
      mois: 11,
      statut: "EnAttente",
      AdherentHote: { firstname: "Bob", lastname: "B" },
    });

    await proposeMyselfAsReunionHost(
      actor({ userId: "user-B", adherentId: "adh-A-injected" }),
      { annee: futureYear, mois: 11 }
    );

    expect(findUniqueAdherent).toHaveBeenCalledWith({
      where: { userId: "user-B" },
      select: expect.any(Object),
    });
    expect(createReunion).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ adherentHoteId: "adh-B" }),
      })
    );
  });

  it("CONFLICT sur race P2002", async () => {
    findUniqueAdherent.mockResolvedValue({
      id: "adh-1",
      firstname: "A",
      lastname: "B",
      User: { role: "MEMBRE", status: "Actif" },
    });
    findUniqueReunion.mockResolvedValue(null);
    findFirstReunion.mockResolvedValue(null);
    createReunion.mockRejectedValue({ code: "P2002" });

    await expect(
      proposeMyselfAsReunionHost(actor(), { annee: futureYear, mois: 10 })
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
});
