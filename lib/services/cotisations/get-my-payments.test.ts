import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import type { AuthContext } from "@/lib/auth-context";

const {
  findUniqueAdherent,
  countPaiement,
  findManyPaiement,
} = vi.hoisted(() => ({
  findUniqueAdherent: vi.fn(),
  countPaiement: vi.fn(),
  findManyPaiement: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    adherent: { findUnique: findUniqueAdherent },
    paiementCotisation: {
      count: countPaiement,
      findMany: findManyPaiement,
    },
  },
}));

import { getMyPayments } from "@/lib/services/cotisations/get-my-payments";

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
  countPaiement.mockReset();
  findManyPaiement.mockReset();
});

describe("getMyPayments", () => {
  it("pagine et mappe destinationLabel métier", async () => {
    findUniqueAdherent.mockResolvedValue({ id: "adh-A" });
    countPaiement.mockResolvedValue(1);
    findManyPaiement.mockResolvedValue([
      {
        id: "p1",
        datePaiement: new Date("2026-03-12T10:32:00.000Z"),
        montant: new Prisma.Decimal("30"),
        moyenPaiement: "Wero",
        statut: "EnAttente",
        reference: "REF-1",
        description: null,
        cotisationMensuelleId: null,
        detteInitialeId: "d1",
        assistanceId: null,
        CotisationMensuelle: null,
        DetteInitiale: { annee: 2025 },
        Assistance: null,
      },
    ]);

    const page = await getMyPayments(actor(), {
      annee: 2026,
      limit: 20,
      offset: 0,
    });

    expect(page.total).toBe(1);
    expect(page.items[0].destinationLabel).toBe("Dette antérieure 2025");
    expect(page.items[0].moyenPaiement).toBe("Wero");
    expect(findManyPaiement.mock.calls[0][0].take).toBe(20);
    expect(findManyPaiement.mock.calls[0][0].skip).toBe(0);
    expect(findManyPaiement.mock.calls[0][0].where.inscriptionEvenementId).toBe(
      null
    );
    expect(countPaiement.mock.calls[0][0].where.inscriptionEvenementId).toBe(
      null
    );
  });

  it("filtre serveur : jamais de paiement événement dans historique cotisations", async () => {
    findUniqueAdherent.mockResolvedValue({ id: "adh-A" });
    countPaiement.mockResolvedValue(0);
    findManyPaiement.mockResolvedValue([]);

    await getMyPayments(actor(), { annee: 2026 });

    expect(findManyPaiement.mock.calls[0][0].where).toMatchObject({
      adherentId: "adh-A",
      inscriptionEvenementId: null,
    });
  });
});
