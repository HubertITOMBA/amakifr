import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContext } from "@/lib/auth-context";

const { findUniqueAdherent, findUniqueReunion, upsertParticipation } =
  vi.hoisted(() => ({
    findUniqueAdherent: vi.fn(),
    findUniqueReunion: vi.fn(),
    upsertParticipation: vi.fn(),
  }));

vi.mock("@/lib/db", () => ({
  db: {
    adherent: { findUnique: findUniqueAdherent },
    reunionMensuelle: { findUnique: findUniqueReunion },
    participationReunion: { upsert: upsertParticipation },
  },
}));

import { updateMyReunionParticipation } from "@/lib/services/reunions/update-my-reunion-participation";

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

const futureDate = new Date();
futureDate.setDate(futureDate.getDate() + 30);

const pastDate = new Date();
pastDate.setDate(pastDate.getDate() - 30);

describe("updateMyReunionParticipation", () => {
  beforeEach(() => {
    findUniqueAdherent.mockReset();
    findUniqueReunion.mockReset();
    upsertParticipation.mockReset();
  });

  it("UNAUTHENTICATED si userId absent", async () => {
    await expect(
      updateMyReunionParticipation(actor({ userId: "" }), "r1", {
        statut: "Present",
      })
    ).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  });

  it("NOT_FOUND si adhérent absent", async () => {
    findUniqueAdherent.mockResolvedValue(null);
    await expect(
      updateMyReunionParticipation(actor(), "r1", { statut: "Present" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("NOT_FOUND si réunion inexistante", async () => {
    findUniqueAdherent.mockResolvedValue({ id: "adh-1" });
    findUniqueReunion.mockResolvedValue(null);
    await expect(
      updateMyReunionParticipation(actor(), "r-missing", {
        statut: "Present",
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("FORBIDDEN si statut EnAttente", async () => {
    findUniqueAdherent.mockResolvedValue({ id: "adh-1" });
    findUniqueReunion.mockResolvedValue({
      id: "r1",
      statut: "EnAttente",
      dateReunion: futureDate,
    });
    await expect(
      updateMyReunionParticipation(actor(), "r1", { statut: "Present" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(upsertParticipation).not.toHaveBeenCalled();
  });

  it("FORBIDDEN si statut Annulee (via non DateConfirmee)", async () => {
    findUniqueAdherent.mockResolvedValue({ id: "adh-1" });
    findUniqueReunion.mockResolvedValue({
      id: "r1",
      statut: "Annulee",
      dateReunion: futureDate,
    });
    await expect(
      updateMyReunionParticipation(actor(), "r1", { statut: "Present" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("FORBIDDEN si réunion passée", async () => {
    findUniqueAdherent.mockResolvedValue({ id: "adh-1" });
    findUniqueReunion.mockResolvedValue({
      id: "r1",
      statut: "DateConfirmee",
      dateReunion: pastDate,
    });
    await expect(
      updateMyReunionParticipation(actor(), "r1", { statut: "Present" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(upsertParticipation).not.toHaveBeenCalled();
  });

  it("VALIDATION_ERROR si statut invalide", async () => {
    await expect(
      updateMyReunionParticipation(actor(), "r1", {
        statut: "NonRepondu" as "Present",
      })
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("upsert Présent pour réunion future DateConfirmee", async () => {
    findUniqueAdherent.mockResolvedValue({ id: "adh-1" });
    findUniqueReunion.mockResolvedValue({
      id: "r1",
      statut: "DateConfirmee",
      dateReunion: futureDate,
    });
    upsertParticipation.mockResolvedValue({ statut: "Present" });

    const result = await updateMyReunionParticipation(actor(), "r1", {
      statut: "Present",
    });
    expect(result.statut).toBe("Present");
    expect(upsertParticipation).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          reunionId_adherentId: {
            reunionId: "r1",
            adherentId: "adh-1",
          },
        },
        create: expect.objectContaining({
          adherentId: "adh-1",
          statut: "Present",
        }),
      })
    );
  });

  it("Absent et Excuse acceptés", async () => {
    findUniqueAdherent.mockResolvedValue({ id: "adh-1" });
    findUniqueReunion.mockResolvedValue({
      id: "r1",
      statut: "DateConfirmee",
      dateReunion: futureDate,
    });
    upsertParticipation.mockResolvedValue({ statut: "Excuse" });

    await updateMyReunionParticipation(actor(), "r1", { statut: "Excuse" });
    expect(upsertParticipation).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { statut: "Excuse" },
      })
    );
  });

  it("anti-IDOR : adhérent B ne modifie que sa participation", async () => {
    findUniqueAdherent.mockResolvedValue({ id: "adh-B" });
    findUniqueReunion.mockResolvedValue({
      id: "r1",
      statut: "DateConfirmee",
      dateReunion: futureDate,
    });
    upsertParticipation.mockResolvedValue({ statut: "Absent" });

    await updateMyReunionParticipation(
      actor({ userId: "user-B", adherentId: "adh-A-injected" }),
      "r1",
      { statut: "Absent" }
    );

    expect(findUniqueAdherent).toHaveBeenCalledWith({
      where: { userId: "user-B" },
      select: { id: true },
    });
    expect(upsertParticipation).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          reunionId_adherentId: {
            reunionId: "r1",
            adherentId: "adh-B",
          },
        },
      })
    );
  });
});
