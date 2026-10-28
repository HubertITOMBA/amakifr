import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import type { AuthContext } from "@/lib/auth-context";

const {
  findUniqueAdherent,
  findManyCotisation,
  findManyDette,
  findManyAssistance,
  findManyPaiement,
  aggregatePaiement,
  findManyObligation,
  findManyAvoir,
} = vi.hoisted(() => ({
  findUniqueAdherent: vi.fn(),
  findManyCotisation: vi.fn(),
  findManyDette: vi.fn(),
  findManyAssistance: vi.fn(),
  findManyPaiement: vi.fn(),
  aggregatePaiement: vi.fn(),
  findManyObligation: vi.fn(),
  findManyAvoir: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    adherent: { findUnique: findUniqueAdherent },
    cotisationMensuelle: { findMany: findManyCotisation },
    detteInitiale: { findMany: findManyDette },
    assistance: { findMany: findManyAssistance },
    paiementCotisation: {
      findMany: findManyPaiement,
      aggregate: aggregatePaiement,
    },
    obligationCotisation: { findMany: findManyObligation },
    avoir: { findMany: findManyAvoir },
  },
}));

import { getMyCotisationLines } from "@/lib/services/cotisations/get-my-cotisation-lines";

function actor(): AuthContext {
  return {
    userId: "user-A",
    role: "MEMBRE",
    status: "Actif",
    email: "a@example.com",
    name: "Ada",
    sessionId: null,
    adminRoles: [],
    adherentId: null,
    channel: "mobile",
  };
}

beforeEach(() => {
  findUniqueAdherent.mockReset();
  findManyCotisation.mockReset();
  findManyDette.mockReset();
  findManyAssistance.mockReset();
  findManyPaiement.mockReset();
  aggregatePaiement.mockReset();
  findManyObligation.mockReset();
  findManyAvoir.mockReset();
});

describe("getMyCotisationLines — résumé dette", () => {
  it("ne lit pas l’entité Assistance ; DTO summary inchangé ; totalPayeAnnee préservé", async () => {
    findUniqueAdherent.mockResolvedValue({ id: "adh-A" });

    // dettes (liste) + open CM (summary) partagent findManyCotisation :
    // getMyCotisationLines : dettes, cotisations (toutes), pending, buildSummary
    // buildSummary : dettes, open CM, obligations, avoirs, aggregate
    findManyDette
      .mockResolvedValueOnce([]) // liste
      .mockResolvedValueOnce([
        { montantRestant: new Prisma.Decimal("60") },
      ]); // summary
    findManyCotisation
      .mockResolvedValueOnce([]) // liste lignes
      .mockResolvedValueOnce([
        {
          adherentId: "adh-A",
          adherentBeneficiaireId: null,
          montantRestant: new Prisma.Decimal("20"),
        },
      ]); // summary open
    findManyPaiement.mockResolvedValue([]);
    findManyObligation.mockResolvedValue([]);
    findManyAvoir.mockResolvedValue([
      { montantRestant: new Prisma.Decimal("15") },
    ]);
    aggregatePaiement.mockResolvedValue({
      _sum: { montant: new Prisma.Decimal("42") },
    });
    findManyAssistance.mockResolvedValue([
      { montantRestant: new Prisma.Decimal("999") },
    ]);

    const page = await getMyCotisationLines(actor(), { limit: 20, offset: 0 });

    expect(Object.keys(page.summary).sort()).toEqual(
      ["avoirDisponible", "detteBrute", "resteNet", "totalPayeAnnee"].sort()
    );
    expect(page.summary.detteBrute).toBe("80");
    expect(page.summary.avoirDisponible).toBe("15");
    expect(page.summary.resteNet).toBe("65");
    expect(page.summary.totalPayeAnnee).toBe("42");
    expect(findManyAssistance).not.toHaveBeenCalled();
    expect(aggregatePaiement.mock.calls[0][0].where.inscriptionEvenementId).toBe(
      null
    );
  });

  it("exclut CM auto-bénéfice du résumé ; conserve CM tiers", async () => {
    findUniqueAdherent.mockResolvedValue({ id: "adh-A" });
    findManyDette.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    findManyCotisation
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          adherentId: "adh-A",
          adherentBeneficiaireId: "adh-A",
          montantRestant: new Prisma.Decimal("50"),
        },
        {
          adherentId: "adh-A",
          adherentBeneficiaireId: "adh-B",
          montantRestant: new Prisma.Decimal("30"),
        },
      ]);
    findManyPaiement.mockResolvedValue([]);
    findManyObligation.mockResolvedValue([
      { montantRestant: new Prisma.Decimal("5") },
    ]);
    findManyAvoir.mockResolvedValue([]);
    aggregatePaiement.mockResolvedValue({ _sum: { montant: null } });

    const page = await getMyCotisationLines(actor());
    expect(page.summary.detteBrute).toBe("35");
    expect(page.summary.resteNet).toBe("35");
    expect(findManyAssistance).not.toHaveBeenCalled();
  });
});
