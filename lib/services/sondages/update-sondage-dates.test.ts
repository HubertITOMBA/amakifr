import { beforeEach, describe, expect, it, vi } from "vitest";

const { findUnique, update } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    sondage: { findUnique, update },
  },
}));

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { auth } from "@/auth";
import { UserRole } from "@prisma/client";
import { updateSondageDates } from "@/actions/sondages";

describe("updateSondageDates", () => {
  beforeEach(() => {
    findUnique.mockReset();
    update.mockReset();
    vi.mocked(auth).mockReset();
  });

  it("refuse non admin", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "u1", role: UserRole.MEMBRE },
    } as any);
    const res = await updateSondageDates({
      id: "s1",
      dateDebut: new Date("2026-01-01"),
      dateFin: new Date("2026-02-01"),
    });
    expect(res.success).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });

  it("refuse dates invalides", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "admin", role: UserRole.ADMIN },
    } as any);
    const res = await updateSondageDates({
      id: "s1",
      dateDebut: new Date("2026-02-01"),
      dateFin: new Date("2026-01-01"),
    });
    expect(res.success).toBe(false);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("refuse sondage inexistant", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "admin", role: UserRole.ADMIN },
    } as any);
    findUnique.mockResolvedValue(null);
    const res = await updateSondageDates({
      id: "missing",
      dateDebut: new Date("2026-01-01"),
      dateFin: new Date("2026-02-01"),
    });
    expect(res.success).toBe(false);
  });

  it("met à jour dates d'un Ouvert et conserve reponseCount", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "admin", role: UserRole.ADMIN },
    } as any);
    findUnique.mockResolvedValue({
      id: "s1",
      status: "Ouvert",
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
    vi.mocked(auth).mockResolvedValue({
      user: { id: "admin", role: UserRole.ADMIN },
    } as any);
    findUnique.mockResolvedValue({
      id: "s1",
      status: "Brouillon",
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
});
