import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserRole } from "@prisma/client";
import {
  RAPPEL_DETTE_ADHERENT_SEARCH_ACCESS_DENIED_MESSAGE,
  RAPPEL_DETTE_ADHERENT_SEARCH_LIMIT,
  RAPPEL_DETTE_ADHERENT_SEARCH_QUERY_TOO_SHORT_MESSAGE,
  RAPPEL_DETTE_ADHERENT_SEARCH_TECHNICAL_ERROR_MESSAGE,
  normalizeAdherentSearchQuery,
  searchRappelDetteAdherents,
} from "./rappel-dette-adherent-search";

describe("normalizeAdherentSearchQuery", () => {
  it("trim et collapse espaces", () => {
    expect(normalizeAdherentSearchQuery("  Ada   Love  ")).toBe("Ada Love");
  });
});

describe("searchRappelDetteAdherents", () => {
  const findMany = vi.fn();

  beforeEach(() => {
    findMany.mockReset();
  });

  it("refuse sans userId avant Prisma", async () => {
    const r = await searchRappelDetteAdherents(
      { actor: null, query: "Ada" },
      { prisma: { adherent: { findMany } } }
    );
    expect(r).toEqual({
      ok: false,
      code: "UNAUTHENTICATED",
      message: RAPPEL_DETTE_ADHERENT_SEARCH_ACCESS_DENIED_MESSAGE,
    });
    expect(findMany).not.toHaveBeenCalled();
  });

  it("refuse rôles hors ADMIN/PRESID avant Prisma", async () => {
    const denied = [
      UserRole.MEMBRE,
      UserRole.TRESOR,
      UserRole.SECRET,
      UserRole.COMCPT,
    ] as const;
    for (const role of denied) {
      findMany.mockClear();
      const r = await searchRappelDetteAdherents(
        { actor: { userId: "u1", role }, query: "Ada" },
        { prisma: { adherent: { findMany } } }
      );
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.code).toBe("FORBIDDEN");
      expect(findMany).not.toHaveBeenCalled();
    }
  });

  it("refuse requête sous le seuil avant Prisma", async () => {
    const r = await searchRappelDetteAdherents(
      { actor: { userId: "a1", role: UserRole.ADMIN }, query: "A" },
      { prisma: { adherent: { findMany } } }
    );
    expect(r).toEqual({
      ok: false,
      code: "VALIDATION_ERROR",
      message: RAPPEL_DETTE_ADHERENT_SEARCH_QUERY_TOO_SHORT_MESSAGE,
    });
    expect(findMany).not.toHaveBeenCalled();
  });

  it("ADMIN : DTO minimal, take limit+1, ordre déterministe, sans filtre actif/rôle", async () => {
    findMany.mockResolvedValue([
      {
        id: "id-1",
        firstname: "Ada",
        lastname: "Lovelace",
      },
    ]);
    const r = await searchRappelDetteAdherents(
      { actor: { userId: "a1", role: UserRole.ADMIN }, query: "  Ada  " },
      { prisma: { adherent: { findMany } } }
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.query).toBe("Ada");
    expect(r.truncated).toBe(false);
    expect(r.limit).toBe(RAPPEL_DETTE_ADHERENT_SEARCH_LIMIT);
    expect(r.items).toEqual([
      {
        adherentId: "id-1",
        firstname: "Ada",
        lastname: "Lovelace",
        disambiguationLabel: null,
      },
    ]);
    expect(r.items[0]).not.toHaveProperty("email");
    expect(r.items[0]).not.toHaveProperty("phone");
    expect(r.items[0]).not.toHaveProperty("address");
    expect(r.items[0]).not.toHaveProperty("numeroPasseport");
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: RAPPEL_DETTE_ADHERENT_SEARCH_LIMIT + 1,
        orderBy: [{ lastname: "asc" }, { firstname: "asc" }, { id: "asc" }],
        select: {
          id: true,
          firstname: true,
          lastname: true,
        },
        where: {
          OR: [
            { firstname: { contains: "Ada", mode: "insensitive" } },
            { lastname: { contains: "Ada", mode: "insensitive" } },
          ],
        },
      })
    );
    const where = findMany.mock.calls[0][0].where;
    expect(where).not.toHaveProperty("status");
    expect(where).not.toHaveProperty("role");
    expect(where).not.toHaveProperty("AND");
  });

  it("n’inclut jamais numeroPasseport (select, DTO, sérialisation)", async () => {
    findMany.mockResolvedValue([
      { id: "id-1", firstname: "Ada", lastname: "Lovelace" },
    ]);
    const r = await searchRappelDetteAdherents(
      { actor: { userId: "a1", role: UserRole.ADMIN }, query: "Ada" },
      { prisma: { adherent: { findMany } } }
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const selectArg = findMany.mock.calls[0][0].select as Record<
      string,
      unknown
    >;
    expect(selectArg).toEqual({
      id: true,
      firstname: true,
      lastname: true,
    });
    expect(selectArg).not.toHaveProperty("numeroPasseport");

    for (const item of r.items) {
      expect(Object.keys(item).sort()).toEqual([
        "adherentId",
        "disambiguationLabel",
        "firstname",
        "lastname",
      ]);
      expect(item).not.toHaveProperty("numeroPasseport");
      expect(JSON.stringify(item)).not.toMatch(/passeport|P-\d+/i);
    }
  });

  it("PRESID accepté ; homonymes → Fiche N (référence locale résultats)", async () => {
    findMany.mockResolvedValue([
      {
        id: "b",
        firstname: "Jean",
        lastname: "Dupont",
      },
      {
        id: "a",
        firstname: "Jean",
        lastname: "Dupont",
      },
    ]);
    const r = await searchRappelDetteAdherents(
      { actor: { userId: "p1", role: UserRole.PRESID }, query: "Dupont" },
      { prisma: { adherent: { findMany } } }
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.items.map((i) => i.disambiguationLabel)).toEqual([
      "Fiche 2",
      "Fiche 1",
    ]);
    expect(JSON.stringify(r.items)).not.toMatch(/passeport/i);
  });

  it("signale truncated si plus de 20 lignes", async () => {
    const rows = Array.from({ length: 21 }, (_, i) => ({
      id: `id-${String(i).padStart(2, "0")}`,
      firstname: `F${i}`,
      lastname: `L${i}`,
    }));
    findMany.mockResolvedValue(rows);
    const r = await searchRappelDetteAdherents(
      { actor: { userId: "a1", role: UserRole.ADMIN }, query: "Li" },
      { prisma: { adherent: { findMany } } }
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.truncated).toBe(true);
    expect(r.items).toHaveLength(20);
  });

  it("erreur Prisma → INTERNAL_ERROR distinct d’aucun résultat", async () => {
    findMany.mockRejectedValue(new Error("db down"));
    const err = await searchRappelDetteAdherents(
      { actor: { userId: "a1", role: UserRole.ADMIN }, query: "Ada" },
      { prisma: { adherent: { findMany } } }
    );
    expect(err).toEqual({
      ok: false,
      code: "INTERNAL_ERROR",
      message: RAPPEL_DETTE_ADHERENT_SEARCH_TECHNICAL_ERROR_MESSAGE,
    });

    findMany.mockResolvedValue([]);
    const empty = await searchRappelDetteAdherents(
      { actor: { userId: "a1", role: UserRole.ADMIN }, query: "Ada" },
      { prisma: { adherent: { findMany } } }
    );
    expect(empty.ok).toBe(true);
    if (!empty.ok) return;
    expect(empty.items).toEqual([]);
    expect(empty.truncated).toBe(false);
  });
});
