import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserRole } from "@prisma/client";

const { findUnique, update, auth } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
  auth: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    sondage: { findUnique, update },
  },
}));

vi.mock("@/auth", () => ({
  auth,
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { updateSondageDates } from "@/actions/sondages";

/**
 * Session minimale pour assertAdmin (id + role).
 */
function sessionWithRole(id: string, role: UserRole) {
  return { user: { id, role } };
}

describe("updateSondageDates", () => {
  beforeEach(() => {
    findUnique.mockReset();
    update.mockReset();
    auth.mockReset();
  });

  it("refuse non admin", async () => {
    auth.mockResolvedValue(sessionWithRole("u1", UserRole.MEMBRE));
    const res = await updateSondageDates({
      id: "s1",
      dateDebut: new Date("2026-01-01"),
      dateFin: new Date("2026-02-01"),
    });
    expect(res.success).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });

  it("refuse dates invalides", async () => {
    auth.mockResolvedValue(sessionWithRole("admin", UserRole.ADMIN));
    const res = await updateSondageDates({
      id: "s1",
      dateDebut: new Date("2026-02-01"),
      dateFin: new Date("2026-01-01"),
    });
    expect(res.success).toBe(false);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("refuse sondage inexistant", async () => {
    auth.mockResolvedValue(sessionWithRole("admin", UserRole.ADMIN));
    findUnique.mockResolvedValue(null);
    const res = await updateSondageDates({
      id: "missing",
      dateDebut: new Date("2026-01-01"),
      dateFin: new Date("2026-02-01"),
    });
    expect(res.success).toBe(false);
  });

  it("met à jour dates d'un Ouvert et conserve reponseCount", async () => {
    auth.mockResolvedValue(sessionWithRole("admin", UserRole.ADMIN));
    findUnique.mockResolvedValue({
      id: "s1",
      status: "Ouvert",
      dateDebut: new Date("2026-03-01"),
      dateFin: new Date("2026-12-01"),
      _count: { reponses: 5 },
    });
    update.mockResolvedValue({
      id: "s1",
      status: "Ouvert",
      dateDebut: new Date("2026-03-01"),
      dateFin: new Date("2026-04-01"),
      _count: { reponses: 5 },
    });

    const res = await updateSondageDates({
      id: "s1",
      dateDebut: new Date("2026-03-01"),
      dateFin: new Date("2026-04-01"),
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data?.reponseCount).toBe(5);
    }
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "s1" },
        data: expect.objectContaining({
          dateDebut: expect.any(Date),
          dateFin: expect.any(Date),
        }),
      })
    );
  });

  it("met à jour un brouillon", async () => {
    auth.mockResolvedValue(sessionWithRole("admin", UserRole.ADMIN));
    findUnique.mockResolvedValue({
      id: "s1",
      status: "Brouillon",
      dateDebut: new Date("2026-03-01"),
      dateFin: new Date("2026-04-01"),
      _count: { reponses: 0 },
    });
    update.mockResolvedValue({
      id: "s1",
      status: "Brouillon",
      dateDebut: new Date("2026-03-01"),
      dateFin: new Date("2026-04-01"),
      _count: { reponses: 0 },
    });
    const res = await updateSondageDates({
      id: "s1",
      dateDebut: new Date("2026-03-01"),
      dateFin: new Date("2026-04-01"),
    });
    expect(res.success).toBe(true);
  });

  it("refuse Ouvert avec échéance passée (clôture effective)", async () => {
    auth.mockResolvedValue(sessionWithRole("admin", UserRole.ADMIN));
    findUnique.mockResolvedValue({
      id: "s1",
      status: "Ouvert",
      dateDebut: new Date("2025-01-01"),
      dateFin: new Date("2025-02-01"),
      _count: { reponses: 3 },
    });
    const res = await updateSondageDates({
      id: "s1",
      dateDebut: new Date("2026-03-01"),
      dateFin: new Date("2026-04-01"),
    });
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/terminé/i);
    expect(update).not.toHaveBeenCalled();
  });
});
