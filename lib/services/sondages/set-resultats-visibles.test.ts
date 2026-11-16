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

import { setSondageResultatsVisiblesAdherents } from "@/actions/sondages";

/**
 * Session minimale pour assertAdmin (id + role).
 */
function sessionWithRole(id: string, role: UserRole) {
  return { user: { id, role } };
}

describe("setSondageResultatsVisiblesAdherents", () => {
  beforeEach(() => {
    findUnique.mockReset();
    update.mockReset();
    auth.mockReset();
  });

  it("refuse non ADMIN", async () => {
    auth.mockResolvedValue(sessionWithRole("u1", UserRole.MEMBRE));
    const res = await setSondageResultatsVisiblesAdherents({
      id: "s1",
      visibles: true,
    });
    expect(res.success).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });

  it("autorise sur Ouvert + échéance passée (clôture effective)", async () => {
    auth.mockResolvedValue(sessionWithRole("admin", UserRole.ADMIN));
    findUnique.mockResolvedValue({
      id: "s1",
      status: "Ouvert",
      dateDebut: new Date("2025-01-01"),
      dateFin: new Date("2025-06-01"),
      resultatsVisiblesAdherents: false,
    });
    update.mockResolvedValue({});

    const res = await setSondageResultatsVisiblesAdherents({
      id: "s1",
      visibles: true,
    });
    expect(res.success).toBe(true);
    expect(res.message).toMatch(/autorisés à la consultation/i);
    expect(update).toHaveBeenCalledWith({
      where: { id: "s1" },
      data: { resultatsVisiblesAdherents: true },
    });
    // Ne touche pas aux dates
    expect(update.mock.calls[0][0].data.dateDebut).toBeUndefined();
    expect(update.mock.calls[0][0].data.dateFin).toBeUndefined();
  });

  it("retrait → message dédié", async () => {
    auth.mockResolvedValue(sessionWithRole("admin", UserRole.ADMIN));
    findUnique.mockResolvedValue({
      id: "s1",
      status: "Cloture",
      dateDebut: new Date("2025-01-01"),
      dateFin: new Date("2025-06-01"),
      resultatsVisiblesAdherents: true,
    });
    update.mockResolvedValue({});

    const res = await setSondageResultatsVisiblesAdherents({
      id: "s1",
      visibles: false,
    });
    expect(res.success).toBe(true);
    expect(res.message).toMatch(/retirés de la consultation/i);
  });

  it("refuse publication tant que encore ouvert effectif", async () => {
    auth.mockResolvedValue(sessionWithRole("admin", UserRole.ADMIN));
    findUnique.mockResolvedValue({
      id: "s1",
      status: "Ouvert",
      dateDebut: new Date(Date.now() - 86400000),
      dateFin: new Date(Date.now() + 86400000),
      resultatsVisiblesAdherents: false,
    });
    const res = await setSondageResultatsVisiblesAdherents({
      id: "s1",
      visibles: true,
    });
    expect(res.success).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });
});
