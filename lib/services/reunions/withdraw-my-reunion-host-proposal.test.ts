import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContext } from "@/lib/auth-context";

const { findUniqueAdherent, findUniqueReunion, updateReunion } = vi.hoisted(
  () => ({
    findUniqueAdherent: vi.fn(),
    findUniqueReunion: vi.fn(),
    updateReunion: vi.fn(),
  })
);

vi.mock("@/lib/db", () => ({
  db: {
    adherent: { findUnique: findUniqueAdherent },
    reunionMensuelle: {
      findUnique: findUniqueReunion,
      update: updateReunion,
    },
  },
}));

import { withdrawMyReunionHostProposal } from "@/lib/services/reunions/withdraw-my-reunion-host-proposal";

function actor(overrides: Partial<AuthContext> = {}): AuthContext {
  return {
    userId: "user-A",
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
  findUniqueReunion.mockReset();
  updateReunion.mockReset();
});

describe("withdrawMyReunionHostProposal", () => {
  it("UNAUTHENTICATED si userId absent", async () => {
    await expect(
      withdrawMyReunionHostProposal(actor({ userId: "" }), "r1")
    ).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  });

  it("VALIDATION_ERROR si id vide", async () => {
    await expect(
      withdrawMyReunionHostProposal(actor(), "  ")
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("NOT_FOUND si adhérent absent", async () => {
    findUniqueAdherent.mockResolvedValue(null);
    await expect(
      withdrawMyReunionHostProposal(actor(), "r1")
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("NOT_FOUND si réunion inconnue", async () => {
    findUniqueAdherent.mockResolvedValue({ id: "adh-A" });
    findUniqueReunion.mockResolvedValue(null);
    await expect(
      withdrawMyReunionHostProposal(actor(), "r-unknown")
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("FORBIDDEN si pas d'hôte", async () => {
    findUniqueAdherent.mockResolvedValue({ id: "adh-A" });
    findUniqueReunion.mockResolvedValue({
      id: "r1",
      annee: 2026,
      mois: 10,
      statut: "EnAttente",
      dateReunion: null,
      adherentHoteId: null,
    });
    await expect(
      withdrawMyReunionHostProposal(actor(), "r1")
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("FORBIDDEN si B tente de désister A (anti-IDOR)", async () => {
    findUniqueAdherent.mockResolvedValue({ id: "adh-B" });
    findUniqueReunion.mockResolvedValue({
      id: "r1",
      annee: 2026,
      mois: 10,
      statut: "EnAttente",
      dateReunion: null,
      adherentHoteId: "adh-A",
    });
    await expect(
      withdrawMyReunionHostProposal(actor({ userId: "user-B" }), "r1")
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Seul l'hôte de la réunion peut se désister.",
    });
    expect(updateReunion).not.toHaveBeenCalled();
  });

  it("FORBIDDEN si date à moins de 28 jours", async () => {
    findUniqueAdherent.mockResolvedValue({ id: "adh-A" });
    const soon = new Date();
    soon.setDate(soon.getDate() + 10);
    findUniqueReunion.mockResolvedValue({
      id: "r1",
      annee: soon.getFullYear(),
      mois: soon.getMonth() + 1,
      statut: "DateConfirmee",
      dateReunion: soon,
      adherentHoteId: "adh-A",
    });
    await expect(
      withdrawMyReunionHostProposal(actor(), "r1")
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(updateReunion).not.toHaveBeenCalled();
  });

  it("A hôte sans date peut se désister → EnAttente + hôte null", async () => {
    findUniqueAdherent.mockResolvedValue({ id: "adh-A" });
    findUniqueReunion.mockResolvedValue({
      id: "r1",
      annee: 2027,
      mois: 10,
      statut: "MoisValide",
      dateReunion: null,
      adherentHoteId: "adh-A",
      typeLieu: "Domicile",
    });
    updateReunion.mockResolvedValue({
      id: "r1",
      annee: 2027,
      mois: 10,
      statut: "EnAttente",
    });

    const result = await withdrawMyReunionHostProposal(actor(), "r1");

    expect(result).toEqual({
      id: "r1",
      annee: 2027,
      mois: 10,
      statut: "EnAttente",
    });
    expect(updateReunion).toHaveBeenCalledWith({
      where: { id: "r1" },
      data: {
        adherentHoteId: null,
        statut: "EnAttente",
        dateReunion: null,
        updatedBy: "user-A",
        adresse: null,
      },
      select: expect.any(Object),
    });
  });

  it("Domicile → nullifie adresse en base", async () => {
    findUniqueAdherent.mockResolvedValue({ id: "adh-A" });
    findUniqueReunion.mockResolvedValue({
      id: "r1",
      annee: 2027,
      mois: 10,
      statut: "DateConfirmee",
      dateReunion: (() => {
        const d = new Date();
        d.setDate(d.getDate() + 40);
        return d;
      })(),
      adherentHoteId: "adh-A",
      typeLieu: "Domicile",
    });
    updateReunion.mockResolvedValue({
      id: "r1",
      annee: 2027,
      mois: 10,
      statut: "EnAttente",
    });

    await withdrawMyReunionHostProposal(actor(), "r1");
    expect(updateReunion).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ adresse: null }),
      })
    );
  });

  it("Restaurant → conserve adresse / ne patch pas adresse", async () => {
    findUniqueAdherent.mockResolvedValue({ id: "adh-A" });
    findUniqueReunion.mockResolvedValue({
      id: "r1",
      annee: 2027,
      mois: 11,
      statut: "EnAttente",
      dateReunion: null,
      adherentHoteId: "adh-A",
      typeLieu: "Restaurant",
    });
    updateReunion.mockResolvedValue({
      id: "r1",
      annee: 2027,
      mois: 11,
      statut: "EnAttente",
    });

    await withdrawMyReunionHostProposal(actor(), "r1");
    const data = updateReunion.mock.calls[0][0].data;
    expect(data.adherentHoteId).toBeNull();
    expect(data).not.toHaveProperty("adresse");
    expect(data).not.toHaveProperty("nomRestaurant");
  });

  it("Autre → conserve adresse", async () => {
    findUniqueAdherent.mockResolvedValue({ id: "adh-A" });
    findUniqueReunion.mockResolvedValue({
      id: "r1",
      annee: 2027,
      mois: 12,
      statut: "EnAttente",
      dateReunion: null,
      adherentHoteId: "adh-A",
      typeLieu: "Autre",
    });
    updateReunion.mockResolvedValue({
      id: "r1",
      annee: 2027,
      mois: 12,
      statut: "EnAttente",
    });

    await withdrawMyReunionHostProposal(actor(), "r1");
    expect(updateReunion.mock.calls[0][0].data).not.toHaveProperty("adresse");
  });

  it("A hôte avec date ≥ 28 jours peut se désister", async () => {
    findUniqueAdherent.mockResolvedValue({ id: "adh-A" });
    const far = new Date();
    far.setDate(far.getDate() + 40);
    findUniqueReunion.mockResolvedValue({
      id: "r1",
      annee: far.getFullYear(),
      mois: far.getMonth() + 1,
      statut: "DateConfirmee",
      dateReunion: far,
      adherentHoteId: "adh-A",
      typeLieu: "Domicile",
    });
    updateReunion.mockResolvedValue({
      id: "r1",
      annee: far.getFullYear(),
      mois: far.getMonth() + 1,
      statut: "EnAttente",
    });

    await withdrawMyReunionHostProposal(actor(), "r1");
    expect(updateReunion).toHaveBeenCalled();
  });

  it("ignore adherentId session injecté — ownership via userId", async () => {
    findUniqueAdherent.mockResolvedValue({ id: "adh-A" });
    findUniqueReunion.mockResolvedValue({
      id: "r1",
      annee: 2027,
      mois: 11,
      statut: "EnAttente",
      dateReunion: null,
      adherentHoteId: "adh-A",
      typeLieu: "Domicile",
    });
    updateReunion.mockResolvedValue({
      id: "r1",
      annee: 2027,
      mois: 11,
      statut: "EnAttente",
    });

    await withdrawMyReunionHostProposal(
      actor({ userId: "user-A", adherentId: "adh-injected" }),
      "r1"
    );

    expect(findUniqueAdherent).toHaveBeenCalledWith({
      where: { userId: "user-A" },
      select: { id: true },
    });
  });
});
