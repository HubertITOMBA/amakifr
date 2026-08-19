import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContext } from "@/lib/auth-context";

const { findUniqueAdherent, findManyAffectation } = vi.hoisted(() => ({
  findUniqueAdherent: vi.fn(),
  findManyAffectation: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    adherent: { findUnique: findUniqueAdherent },
    affectationSousProjet: { findMany: findManyAffectation },
  },
}));

import { getMyTaches } from "@/lib/services/taches/get-my-taches";

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

const sampleAffectation = {
  id: "aff-1",
  responsable: true,
  createdAt: new Date(),
  SousProjet: {
    id: "sp-1",
    titre: "Tâche alpha",
    description: "Description alpha",
    statut: "EnCours",
    dateDebut: new Date("2026-01-01"),
    dateFin: new Date("2026-06-01"),
    Projet: { id: "proj-1", titre: "Projet X" },
    Commentaires: [
      {
        id: "com-1",
        contenu: "Avancement OK",
        pourcentageAvancement: 50,
        createdAt: new Date("2026-03-01T10:00:00.000Z"),
        Adherent: { id: "adh-1", firstname: "Hubert", lastname: "Itomba" },
      },
    ],
  },
};

describe("getMyTaches", () => {
  beforeEach(() => {
    findUniqueAdherent.mockReset();
    findManyAffectation.mockReset();
  });

  it("UNAUTHENTICATED si actor.userId absent", async () => {
    await expect(getMyTaches(actor({ userId: "" }))).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
    });
    expect(findUniqueAdherent).not.toHaveBeenCalled();
  });

  it("NOT_FOUND si adhérent absent", async () => {
    findUniqueAdherent.mockResolvedValue(null);
    await expect(getMyTaches(actor())).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("retourne liste vide si aucune affectation", async () => {
    findUniqueAdherent.mockResolvedValue({ id: "adh-1" });
    findManyAffectation.mockResolvedValue([]);
    const result = await getMyTaches(actor());
    expect(result).toEqual([]);
  });

  it("retourne les tâches avec commentaires projetés", async () => {
    findUniqueAdherent.mockResolvedValue({ id: "adh-1" });
    findManyAffectation.mockResolvedValue([sampleAffectation]);
    const result = await getMyTaches(actor());
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("sp-1");
    expect(result[0].titre).toBe("Tâche alpha");
    expect(result[0].responsable).toBe(true);
    expect(result[0].projet.titre).toBe("Projet X");
    expect(result[0].commentaires).toHaveLength(1);
    expect(result[0].commentaires[0].auteur.firstname).toBe("Hubert");
    expect(result[0].commentaires[0].pourcentageAvancement).toBe(50);
    expect(typeof result[0].commentaires[0].createdAt).toBe("string");
  });

  it("filtre exclusivement via actor.userId (anti-IDOR)", async () => {
    findUniqueAdherent.mockResolvedValue({ id: "adh-own" });
    findManyAffectation.mockResolvedValue([]);
    await getMyTaches(actor({ userId: "user-own" }));
    expect(findUniqueAdherent).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-own" } })
    );
    expect(findManyAffectation).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ adherentId: "adh-own" }),
      })
    );
  });

  it("ne retourne pas les tâches d'un autre adhérent", async () => {
    findUniqueAdherent.mockResolvedValue({ id: "adh-A" });
    findManyAffectation.mockResolvedValue([sampleAffectation]);
    const result = await getMyTaches(actor({ userId: "user-A" }));
    expect(findManyAffectation).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ adherentId: "adh-A" }),
      })
    );
    expect(result).toHaveLength(1);
  });

  it("n'expose pas d'email ni de téléphone", async () => {
    findUniqueAdherent.mockResolvedValue({ id: "adh-1" });
    findManyAffectation.mockResolvedValue([sampleAffectation]);
    const result = await getMyTaches(actor());
    const json = JSON.stringify(result);
    expect(json).not.toContain("email");
    expect(json).not.toContain("telephone");
  });

  it("enveloppe erreur Prisma en INTERNAL_ERROR", async () => {
    findUniqueAdherent.mockRejectedValue(new Error("db down"));
    await expect(getMyTaches(actor())).rejects.toMatchObject({
      code: "INTERNAL_ERROR",
    });
  });
});
