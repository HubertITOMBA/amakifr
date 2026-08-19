import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContext } from "@/lib/auth-context";

const { findUniqueAdherent, findUniqueSousProjet, createCommentaire } =
  vi.hoisted(() => ({
    findUniqueAdherent: vi.fn(),
    findUniqueSousProjet: vi.fn(),
    createCommentaire: vi.fn(),
  }));

vi.mock("@/lib/db", () => ({
  db: {
    adherent: { findUnique: findUniqueAdherent },
    sousProjet: { findUnique: findUniqueSousProjet },
    commentaireTache: { create: createCommentaire },
  },
}));

import { createMyTacheCommentaire } from "@/lib/services/taches/create-my-tache-commentaire";

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

describe("createMyTacheCommentaire", () => {
  beforeEach(() => {
    findUniqueAdherent.mockReset();
    findUniqueSousProjet.mockReset();
    createCommentaire.mockReset();
  });

  it("UNAUTHENTICATED si actor.userId absent", async () => {
    await expect(
      createMyTacheCommentaire(actor({ userId: "" }), "sp-1", {
        contenu: "test",
      })
    ).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  });

  it("NOT_FOUND si adhérent absent", async () => {
    findUniqueAdherent.mockResolvedValue(null);
    await expect(
      createMyTacheCommentaire(actor(), "sp-1", { contenu: "test" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("NOT_FOUND si tâche inexistante", async () => {
    findUniqueAdherent.mockResolvedValue({ id: "adh-1" });
    findUniqueSousProjet.mockResolvedValue(null);
    await expect(
      createMyTacheCommentaire(actor(), "sp-999", { contenu: "test" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("FORBIDDEN si non affecté", async () => {
    findUniqueAdherent.mockResolvedValue({ id: "adh-1" });
    findUniqueSousProjet.mockResolvedValue({
      id: "sp-1",
      Affectations: [],
    });
    await expect(
      createMyTacheCommentaire(actor(), "sp-1", { contenu: "test" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("crée un commentaire valide", async () => {
    findUniqueAdherent.mockResolvedValue({ id: "adh-1" });
    findUniqueSousProjet.mockResolvedValue({
      id: "sp-1",
      Affectations: [{ adherentId: "adh-1" }],
    });
    createCommentaire.mockResolvedValue({ id: "com-new" });

    const result = await createMyTacheCommentaire(actor(), "sp-1", {
      contenu: "Mon avancement",
    });
    expect(result.id).toBe("com-new");
    expect(createCommentaire).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sousProjetId: "sp-1",
          adherentId: "adh-1",
          contenu: "Mon avancement",
          pourcentageAvancement: null,
        }),
      })
    );
  });

  it("crée avec pourcentage", async () => {
    findUniqueAdherent.mockResolvedValue({ id: "adh-1" });
    findUniqueSousProjet.mockResolvedValue({
      id: "sp-1",
      Affectations: [{ adherentId: "adh-1" }],
    });
    createCommentaire.mockResolvedValue({ id: "com-new" });

    await createMyTacheCommentaire(actor(), "sp-1", {
      contenu: "Terminé",
      pourcentageAvancement: 100,
    });
    expect(createCommentaire).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ pourcentageAvancement: 100 }),
      })
    );
  });

  it("VALIDATION_ERROR si commentaire vide", async () => {
    await expect(
      createMyTacheCommentaire(actor(), "sp-1", { contenu: "" })
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("VALIDATION_ERROR si pourcentage > 100", async () => {
    await expect(
      createMyTacheCommentaire(actor(), "sp-1", {
        contenu: "test",
        pourcentageAvancement: 150,
      })
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("VALIDATION_ERROR si pourcentage < 0", async () => {
    await expect(
      createMyTacheCommentaire(actor(), "sp-1", {
        contenu: "test",
        pourcentageAvancement: -1,
      })
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("auteur déterminé côté serveur — IDOR adhérent B ne peut commenter tâche A", async () => {
    findUniqueAdherent.mockResolvedValue({ id: "adh-B" });
    findUniqueSousProjet.mockResolvedValue({
      id: "sp-A",
      Affectations: [],
    });
    await expect(
      createMyTacheCommentaire(actor({ userId: "user-B" }), "sp-A", {
        contenu: "attaque",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(createCommentaire).not.toHaveBeenCalled();
  });

  it("VALIDATION_ERROR si tacheId vide", async () => {
    await expect(
      createMyTacheCommentaire(actor(), "", { contenu: "test" })
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });
});
