import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserRole } from "@prisma/client";
import { PREVIEW_RAPPELS_ACCESS_DENIED_MESSAGE } from "@/lib/services/cotisations/rappel-dette/preview-access";

const { auth, searchRappelDetteAdherents } = vi.hoisted(() => ({
  auth: vi.fn(),
  searchRappelDetteAdherents: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth }));

vi.mock(
  "@/lib/services/cotisations/rappel-dette/rappel-dette-adherent-search",
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import("@/lib/services/cotisations/rappel-dette/rappel-dette-adherent-search")
      >();
    return {
      ...actual,
      searchRappelDetteAdherents,
    };
  }
);

import { searchRappelDetteAdherentsAction } from "@/actions/cotisations/search-rappel-dette-adherents";

describe("searchRappelDetteAdherentsAction", () => {
  beforeEach(() => {
    auth.mockReset();
    searchRappelDetteAdherents.mockReset();
  });

  it("refuse non authentifié avant service", async () => {
    auth.mockResolvedValue(null);
    const r = await searchRappelDetteAdherentsAction({ query: "Ada" });
    expect(r).toEqual({
      success: false,
      error: PREVIEW_RAPPELS_ACCESS_DENIED_MESSAGE,
      code: "UNAUTHENTICATED",
    });
    expect(searchRappelDetteAdherents).not.toHaveBeenCalled();
  });

  it("refuse rôles hors ADMIN/PRESID avant service", async () => {
    auth.mockResolvedValue({ user: { id: "u1", role: UserRole.TRESOR } });
    const r = await searchRappelDetteAdherentsAction({ query: "Ada" });
    expect(r).toEqual({
      success: false,
      error: PREVIEW_RAPPELS_ACCESS_DENIED_MESSAGE,
      code: "FORBIDDEN",
    });
    expect(searchRappelDetteAdherents).not.toHaveBeenCalled();
  });

  it("refuse query trop courte (Zod) avant service", async () => {
    auth.mockResolvedValue({ user: { id: "a1", role: UserRole.ADMIN } });
    const r = await searchRappelDetteAdherentsAction({ query: "A" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.code).toBe("VALIDATION_ERROR");
    expect(searchRappelDetteAdherents).not.toHaveBeenCalled();
  });

  it("refuse champs clients interdits (strict)", async () => {
    auth.mockResolvedValue({ user: { id: "a1", role: UserRole.ADMIN } });
    const r = await searchRappelDetteAdherentsAction({
      query: "Ada",
      limit: 999,
    });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.code).toBe("VALIDATION_ERROR");
    expect(searchRappelDetteAdherents).not.toHaveBeenCalled();
  });

  it("délègue au service pour ADMIN", async () => {
    auth.mockResolvedValue({ user: { id: "a1", role: UserRole.ADMIN } });
    searchRappelDetteAdherents.mockResolvedValue({
      ok: true,
      query: "Ada",
      items: [
        {
          adherentId: "id-1",
          firstname: "Ada",
          lastname: "Lovelace",
          disambiguationLabel: "Fiche 1",
        },
      ],
      truncated: false,
      limit: 20,
    });
    const r = await searchRappelDetteAdherentsAction({ query: "Ada" });
    expect(r).toEqual({
      success: true,
      data: {
        query: "Ada",
        items: [
          {
            adherentId: "id-1",
            firstname: "Ada",
            lastname: "Lovelace",
            disambiguationLabel: "Fiche 1",
          },
        ],
        truncated: false,
        limit: 20,
      },
    });
    expect(searchRappelDetteAdherents).toHaveBeenCalledWith({
      actor: { userId: "a1", role: UserRole.ADMIN },
      query: "Ada",
    });
  });

  it("propage erreur technique service", async () => {
    auth.mockResolvedValue({ user: { id: "a1", role: UserRole.PRESID } });
    searchRappelDetteAdherents.mockResolvedValue({
      ok: false,
      code: "INTERNAL_ERROR",
      message: "Erreur technique lors de la recherche d’adhérents.",
    });
    const r = await searchRappelDetteAdherentsAction({ query: "Ada" });
    expect(r).toEqual({
      success: false,
      error: "Erreur technique lors de la recherche d’adhérents.",
      code: "INTERNAL_ERROR",
    });
  });
});
