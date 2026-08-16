import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import type { AuthContext } from "@/lib/auth-context";
import { ServiceError } from "@/lib/service-error";

const { findUniqueAdherent, findManyCotisation } = vi.hoisted(() => ({
  findUniqueAdherent: vi.fn(),
  findManyCotisation: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    adherent: {
      findUnique: findUniqueAdherent,
    },
    cotisationMensuelle: {
      findMany: findManyCotisation,
    },
  },
}));

import { getMyCotisationsMensuelles } from "@/lib/services/cotisations/get-my-cotisations-mensuelles";
import { decimalToMoneyString } from "@/lib/services/cotisations/decimal-to-money-string";

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

const sampleRow = {
  id: "cm-1",
  periode: "2024-06",
  annee: 2024,
  mois: 6,
  typeCotisationId: "type-1",
  adherentId: "adh-1",
  adherentBeneficiaireId: null,
  montantAttendu: new Prisma.Decimal("25.50"),
  montantPaye: new Prisma.Decimal("0"),
  montantRestant: new Prisma.Decimal("25.50"),
  dateEcheance: new Date("2024-06-15T00:00:00.000Z"),
  statut: "EnAttente",
  description: "Forfait Mensuel",
  cotisationDuMoisId: "cdm-1",
  createdAt: new Date("2024-06-01T10:00:00.000Z"),
  updatedAt: new Date("2024-06-02T10:00:00.000Z"),
  TypeCotisation: {
    id: "type-1",
    nom: "Forfait Mensuel",
    description: null,
    montant: new Prisma.Decimal("15"),
    obligatoire: true,
    actif: true,
    ordre: 1,
    categorie: "ForfaitMensuel" as const,
    aBeneficiaire: false,
  },
};

describe("decimalToMoneyString", () => {
  it("sérialise via Decimal.toString()", () => {
    expect(decimalToMoneyString(new Prisma.Decimal("25"))).toBe("25");
    expect(decimalToMoneyString(new Prisma.Decimal("25.50"))).toBe("25.5");
    expect(decimalToMoneyString(new Prisma.Decimal("0"))).toBe("0");
  });
});

describe("getMyCotisationsMensuelles", () => {
  beforeEach(() => {
    findUniqueAdherent.mockReset();
    findManyCotisation.mockReset();
  });

  it("lance UNAUTHENTICATED si actor.userId est absent", async () => {
    await expect(
      getMyCotisationsMensuelles(actor({ userId: "" }))
    ).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    expect(findUniqueAdherent).not.toHaveBeenCalled();
  });

  it("lance NOT_FOUND si User sans Adherent", async () => {
    findUniqueAdherent.mockResolvedValue(null);
    await expect(getMyCotisationsMensuelles(actor())).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Adhérent non trouvé",
    });
    expect(findManyCotisation).not.toHaveBeenCalled();
  });

  it("requête CotisationMensuelle avec l'adherentId résolu côté serveur", async () => {
    findUniqueAdherent.mockResolvedValue({ id: "adh-resolved" });
    findManyCotisation.mockResolvedValue([]);
    await getMyCotisationsMensuelles(actor({ userId: "user-own" }));

    expect(findUniqueAdherent).toHaveBeenCalledWith({
      where: { userId: "user-own" },
      select: { id: true },
    });
    expect(findManyCotisation).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { adherentId: "adh-resolved" },
        orderBy: { periode: "desc" },
      })
    );
    const arg = findManyCotisation.mock.calls[0][0];
    expect(arg.where.adherentId).toBe("adh-resolved");
    expect(arg.where).not.toHaveProperty("userId");
  });

  it("retourne des DTO corrects (Decimal string, dates ISO)", async () => {
    findUniqueAdherent.mockResolvedValue({ id: "adh-1" });
    findManyCotisation.mockResolvedValue([sampleRow]);

    const result = await getMyCotisationsMensuelles(actor());
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "cm-1",
      periode: "2024-06",
      adherentId: "adh-1",
      montantAttendu: "25.5",
      montantPaye: "0",
      montantRestant: "25.5",
      dateEcheance: "2024-06-15T00:00:00.000Z",
      createdAt: "2024-06-01T10:00:00.000Z",
      updatedAt: "2024-06-02T10:00:00.000Z",
      typeCotisation: {
        id: "type-1",
        nom: "Forfait Mensuel",
        montant: "15",
      },
    });
    expect(typeof result[0].montantAttendu).toBe("string");
    expect(typeof result[0].dateEcheance).toBe("string");
  });

  it("retourne [] si aucune cotisation", async () => {
    findUniqueAdherent.mockResolvedValue({ id: "adh-1" });
    findManyCotisation.mockResolvedValue([]);
    await expect(getMyCotisationsMensuelles(actor())).resolves.toEqual([]);
  });

  it("INTERNAL_ERROR si Prisma échoue sur résolution Adherent", async () => {
    findUniqueAdherent.mockRejectedValue(new Error("db down"));
    await expect(getMyCotisationsMensuelles(actor())).rejects.toMatchObject({
      code: "INTERNAL_ERROR",
    });
  });

  it("INTERNAL_ERROR si Prisma échoue sur lecture CotisationMensuelle", async () => {
    findUniqueAdherent.mockResolvedValue({ id: "adh-1" });
    findManyCotisation.mockRejectedValue(new Error("db down"));
    await expect(getMyCotisationsMensuelles(actor())).rejects.toMatchObject({
      code: "INTERNAL_ERROR",
    });
  });

  it("préserve ServiceError (pas de wrap INTERNAL_ERROR)", async () => {
    findUniqueAdherent.mockImplementation(() => {
      throw new ServiceError("NOT_FOUND", "Adhérent non trouvé");
    });
    await expect(getMyCotisationsMensuelles(actor())).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Adhérent non trouvé",
    });
  });

  it("n'expose pas de champs paiement / provider sensibles", async () => {
    findUniqueAdherent.mockResolvedValue({ id: "adh-1" });
    findManyCotisation.mockResolvedValue([sampleRow]);
    const result = await getMyCotisationsMensuelles(actor());
    const json = JSON.stringify(result[0]);
    expect(json).not.toMatch(/stripe|mollie|paypal|receipt|password|justificatif/i);
    expect(result[0]).not.toHaveProperty("Paiements");
    expect(result[0]).not.toHaveProperty("Adherent");
    expect(result[0]).not.toHaveProperty("User");
    expect(result[0]).not.toHaveProperty("createdBy");
  });
});
