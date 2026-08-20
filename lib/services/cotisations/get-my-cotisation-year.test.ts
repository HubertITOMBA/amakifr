import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import type { AuthContext } from "@/lib/auth-context";

const {
  findUniqueAdherent,
  findManyCotisation,
  findManyDette,
  findManyAssistance,
  findManyPaiement,
  findManyObligation,
  findManyAvoir,
} = vi.hoisted(() => ({
  findUniqueAdherent: vi.fn(),
  findManyCotisation: vi.fn(),
  findManyDette: vi.fn(),
  findManyAssistance: vi.fn(),
  findManyPaiement: vi.fn(),
  findManyObligation: vi.fn(),
  findManyAvoir: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    adherent: { findUnique: findUniqueAdherent },
    cotisationMensuelle: { findMany: findManyCotisation },
    detteInitiale: { findMany: findManyDette },
    assistance: { findMany: findManyAssistance },
    paiementCotisation: { findMany: findManyPaiement },
    obligationCotisation: { findMany: findManyObligation },
    avoir: { findMany: findManyAvoir },
  },
}));

import { getMyCotisationYear } from "@/lib/services/cotisations/get-my-cotisation-year";
import { buildAssistanceDisplayLabel } from "@/lib/services/cotisations/build-assistance-display-label";

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
    channel: "mobile",
    ...overrides,
  };
}

function emptyParallel() {
  findManyCotisation
    .mockResolvedValueOnce([]) // year cotisations
    .mockResolvedValueOnce([]); // open cotisations summary
  findManyDette.mockResolvedValue([]);
  findManyAssistance.mockResolvedValue([]); // open assistances summary only
  findManyPaiement.mockResolvedValue([]);
  findManyObligation.mockResolvedValue([]);
  findManyAvoir.mockResolvedValue([]);
}

function assistanceRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "cm-ass",
    periode: "2026-03",
    annee: 2026,
    mois: 3,
    typeCotisationId: "t-ass",
    adherentId: "adh-A",
    adherentBeneficiaireId: "adh-B",
    montantAttendu: new Prisma.Decimal("50"),
    montantPaye: new Prisma.Decimal("0"),
    montantRestant: new Prisma.Decimal("50"),
    dateEcheance: new Date("2026-03-15T00:00:00.000Z"),
    statut: "EnAttente",
    description: "Décès adhérent - Madame Henriette",
    cotisationDuMoisId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    TypeCotisation: {
      id: "t-ass",
      nom: "Décès adhérent",
      description: null,
      montant: new Prisma.Decimal("50"),
      obligatoire: false,
      actif: true,
      ordre: 2,
      categorie: "Assistance",
      aBeneficiaire: true,
    },
    AdherentBeneficiaire: {
      id: "adh-B",
      civility: "Madame",
      firstname: "Henriette",
      lastname: "Martin",
    },
    CotisationDuMois: null,
    Paiements: [],
    ...overrides,
  };
}

beforeEach(() => {
  findUniqueAdherent.mockReset();
  findManyCotisation.mockReset();
  findManyDette.mockReset();
  findManyAssistance.mockReset();
  findManyPaiement.mockReset();
  findManyObligation.mockReset();
  findManyAvoir.mockReset();
});

describe("buildAssistanceDisplayLabel", () => {
  it("préfère description déjà au format Type - …", () => {
    expect(
      buildAssistanceDisplayLabel({
        typeNom: "Décès adhérent",
        description: "Décès adhérent - Madame Henriette",
        beneficiaire: null,
      })
    ).toBe("Décès adhérent - Madame Henriette");
  });

  it("construit Type - civilité Prénom Nom", () => {
    expect(
      buildAssistanceDisplayLabel({
        typeNom: "Assistance mariage",
        description: null,
        beneficiaire: {
          civility: "Monsieur",
          firstname: "Bruno",
          lastname: "Dupont",
        },
      })
    ).toBe("Assistance mariage - Monsieur Bruno Dupont");
  });
});

describe("getMyCotisationYear", () => {
  it("UNAUTHENTICATED si userId absent", async () => {
    await expect(
      getMyCotisationYear(actor({ userId: "" }), 2026)
    ).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  });

  it("NOT_FOUND si adhérent absent", async () => {
    findUniqueAdherent.mockResolvedValue(null);
    await expect(getMyCotisationYear(actor(), 2026)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("VALIDATION_ERROR si année invalide", async () => {
    await expect(getMyCotisationYear(actor(), 1999)).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });

  it("résout adherent via actor.userId uniquement", async () => {
    findUniqueAdherent.mockResolvedValue({ id: "adh-A" });
    emptyParallel();

    await getMyCotisationYear(
      actor({ userId: "user-A", adherentId: "adh-injected" }),
      2026
    );

    expect(findUniqueAdherent).toHaveBeenCalledWith({
      where: { userId: "user-A" },
      select: { id: true },
    });
    expect(findManyCotisation.mock.calls[0][0].where.adherentId).toBe("adh-A");
  });

  it("synthèse dette/avoir/resteNet + totalPayeAnnee", async () => {
    findUniqueAdherent.mockResolvedValue({ id: "adh-A" });
    findManyCotisation
      .mockResolvedValueOnce([]) // year
      .mockResolvedValueOnce([
        { montantRestant: new Prisma.Decimal("20") },
      ]); // open
    findManyDette.mockResolvedValue([
      {
        id: "d1",
        annee: 2024,
        montant: new Prisma.Decimal("100"),
        montantPaye: new Prisma.Decimal("40"),
        montantRestant: new Prisma.Decimal("60"),
        description: null,
      },
    ]);
    findManyAssistance.mockResolvedValue([
      { montantRestant: new Prisma.Decimal("10") },
    ]);
    findManyPaiement.mockResolvedValue([
      {
        id: "p1",
        datePaiement: new Date("2026-03-12T10:00:00.000Z"),
        montant: new Prisma.Decimal("30"),
        moyenPaiement: "Virement",
        statut: "Valide",
        reference: null,
        description: null,
        cotisationMensuelleId: null,
        detteInitialeId: "d1",
        assistanceId: null,
        CotisationMensuelle: null,
        DetteInitiale: { annee: 2024 },
        Assistance: null,
      },
      {
        id: "p2",
        datePaiement: new Date("2026-03-01T10:00:00.000Z"),
        montant: new Prisma.Decimal("5"),
        moyenPaiement: "Virement",
        statut: "Annule",
        reference: null,
        description: null,
        cotisationMensuelleId: null,
        detteInitialeId: null,
        assistanceId: null,
        CotisationMensuelle: null,
        DetteInitiale: null,
        Assistance: null,
      },
    ]);
    findManyObligation.mockResolvedValue([]);
    findManyAvoir.mockResolvedValue([
      { montantRestant: new Prisma.Decimal("15") },
    ]);

    const result = await getMyCotisationYear(actor(), 2026);

    expect(result.summary.detteBrute).toBe("90");
    expect(result.summary.avoirDisponible).toBe("15");
    expect(result.summary.resteNet).toBe("75");
    expect(result.summary.totalPayeAnnee).toBe("30");
    expect(result.dettes).toHaveLength(1);
    expect(result.paiements).toHaveLength(2);
    expect(result.paiements[0].destinationLabel).toBe("Dette 2024");
  });

  it("sépare cotisations forfait et assistances ; masque auto-assistance bénéficiaire", async () => {
    findUniqueAdherent.mockResolvedValue({ id: "adh-A" });
    findManyCotisation
      .mockResolvedValueOnce([
        {
          id: "cm-forfait",
          periode: "2026-03",
          annee: 2026,
          mois: 3,
          typeCotisationId: "t1",
          adherentId: "adh-A",
          adherentBeneficiaireId: null,
          montantAttendu: new Prisma.Decimal("50"),
          montantPaye: new Prisma.Decimal("30"),
          montantRestant: new Prisma.Decimal("20"),
          dateEcheance: new Date("2026-03-15T00:00:00.000Z"),
          statut: "PartiellementPaye",
          description: null,
          cotisationDuMoisId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          TypeCotisation: {
            id: "t1",
            nom: "Forfait",
            description: null,
            montant: new Prisma.Decimal("50"),
            obligatoire: true,
            actif: true,
            ordre: 1,
            categorie: "ForfaitMensuel",
            aBeneficiaire: false,
          },
          AdherentBeneficiaire: null,
          CotisationDuMois: null,
          Paiements: [
            {
              id: "pv1",
              datePaiement: new Date("2026-03-10T00:00:00.000Z"),
              montant: new Prisma.Decimal("30"),
              moyenPaiement: "Virement",
              statut: "Valide",
              reference: "REF1",
              description: null,
              cotisationMensuelleId: "cm-forfait",
              detteInitialeId: null,
              assistanceId: null,
              CotisationMensuelle: {
                mois: 3,
                annee: 2026,
                TypeCotisation: { nom: "Forfait" },
              },
              DetteInitiale: null,
              Assistance: null,
            },
          ],
        },
        {
          id: "cm-self-ass",
          periode: "2026-04",
          annee: 2026,
          mois: 4,
          typeCotisationId: "t2",
          adherentId: "adh-A",
          adherentBeneficiaireId: "adh-A",
          montantAttendu: new Prisma.Decimal("50"),
          montantPaye: new Prisma.Decimal("0"),
          montantRestant: new Prisma.Decimal("50"),
          dateEcheance: new Date("2026-04-15T00:00:00.000Z"),
          statut: "EnAttente",
          description: null,
          cotisationDuMoisId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          TypeCotisation: {
            id: "t2",
            nom: "Assistance Naissance",
            description: null,
            montant: new Prisma.Decimal("50"),
            obligatoire: false,
            actif: true,
            ordre: 2,
            categorie: "Assistance",
            aBeneficiaire: true,
          },
          AdherentBeneficiaire: null,
          CotisationDuMois: null,
          Paiements: [],
        },
        {
          id: "cm-ass-other",
          periode: "2026-05",
          annee: 2026,
          mois: 5,
          typeCotisationId: "t2",
          adherentId: "adh-A",
          adherentBeneficiaireId: "adh-B",
          montantAttendu: new Prisma.Decimal("50"),
          montantPaye: new Prisma.Decimal("0"),
          montantRestant: new Prisma.Decimal("50"),
          dateEcheance: new Date("2026-05-15T00:00:00.000Z"),
          statut: "EnAttente",
          description: "Assistance Naissance - Monsieur Bruno Dupont",
          cotisationDuMoisId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          TypeCotisation: {
            id: "t2",
            nom: "Assistance Naissance",
            description: null,
            montant: new Prisma.Decimal("50"),
            obligatoire: false,
            actif: true,
            ordre: 2,
            categorie: "Assistance",
            aBeneficiaire: true,
          },
          AdherentBeneficiaire: {
            id: "adh-B",
            civility: "Monsieur",
            firstname: "Bruno",
            lastname: "Dupont",
          },
          CotisationDuMois: null,
          Paiements: [],
        },
      ])
      .mockResolvedValueOnce([]);
    findManyDette.mockResolvedValue([]);
    findManyAssistance.mockResolvedValue([]);
    findManyPaiement.mockResolvedValue([]);
    findManyObligation.mockResolvedValue([]);
    findManyAvoir.mockResolvedValue([]);

    const result = await getMyCotisationYear(actor(), 2026);

    expect(result.cotisations).toHaveLength(1);
    expect(result.cotisations[0].id).toBe("cm-forfait");
    expect(result.cotisations[0].paiements).toHaveLength(1);
    expect(result.assistances.map((a) => a.id)).toEqual(["cm-ass-other"]);
    expect(result.assistances[0].displayLabel).toBe(
      "Assistance Naissance - Monsieur Bruno Dupont"
    );
    expect(result.assistances[0].mois).toBe(5);
  });

  it("deux assistances même type → displayLabel distincts + mois", async () => {
    findUniqueAdherent.mockResolvedValue({ id: "adh-A" });
    findManyCotisation
      .mockResolvedValueOnce([
        assistanceRow({
          id: "cm-ass-1",
          mois: 3,
          periode: "2026-03",
          description: "Décès adhérent - Madame Henriette",
          AdherentBeneficiaire: {
            id: "adh-B",
            civility: "Madame",
            firstname: "Henriette",
            lastname: "Martin",
          },
        }),
        assistanceRow({
          id: "cm-ass-2",
          mois: 3,
          periode: "2026-03",
          description: "Décès adhérent - Monsieur Bruno",
          AdherentBeneficiaire: {
            id: "adh-C",
            civility: "Monsieur",
            firstname: "Bruno",
            lastname: "Leroy",
          },
        }),
        assistanceRow({
          id: "cm-ass-avril",
          mois: 4,
          periode: "2026-04",
          description: "Décès adhérent - Madame Claire",
          AdherentBeneficiaire: {
            id: "adh-D",
            civility: "Madame",
            firstname: "Claire",
            lastname: "Durand",
          },
        }),
      ])
      .mockResolvedValueOnce([]);
    findManyDette.mockResolvedValue([]);
    findManyAssistance.mockResolvedValue([]);
    findManyPaiement.mockResolvedValue([]);
    findManyObligation.mockResolvedValue([]);
    findManyAvoir.mockResolvedValue([]);

    const result = await getMyCotisationYear(actor(), 2026);

    expect(result.assistances).toHaveLength(3);
    expect(result.assistances.map((a) => a.displayLabel)).toEqual([
      "Décès adhérent - Madame Henriette",
      "Décès adhérent - Monsieur Bruno",
      "Décès adhérent - Madame Claire",
    ]);
    expect(result.assistances.filter((a) => a.mois === 3)).toHaveLength(2);
    expect(result.assistances.filter((a) => a.mois === 4)).toHaveLength(1);
    // Pas d'entité Assistance fusionnée → pas de doublon source
    expect(result.assistances.every((a) => a.source === "cotisation")).toBe(
      true
    );
  });

  it("aucune dette → liste vide", async () => {
    findUniqueAdherent.mockResolvedValue({ id: "adh-A" });
    emptyParallel();
    const result = await getMyCotisationYear(actor(), 2026);
    expect(result.dettes).toEqual([]);
  });
});
