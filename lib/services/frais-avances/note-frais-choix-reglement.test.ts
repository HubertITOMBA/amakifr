/**
 * Tests unitaires — choix de règlement (lot 3).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { readFile } from "node:fs/promises";

const {
  $transaction,
  $executeRaw,
  noteFindUnique,
  noteFindUniqueOrThrow,
  choixFindUnique,
  choixFindFirst,
  choixFindMany,
  choixCount,
  choixCreate,
  choixUpdate,
  noteUpdateMany,
  detteFindFirst,
  detteFindMany,
  cmFindFirst,
  cmFindMany,
  canReadSubmitted,
} = vi.hoisted(() => ({
  $transaction: vi.fn(),
  $executeRaw: vi.fn(),
  noteFindUnique: vi.fn(),
  noteFindUniqueOrThrow: vi.fn(),
  choixFindUnique: vi.fn(),
  choixFindFirst: vi.fn(),
  choixFindMany: vi.fn(),
  choixCount: vi.fn(),
  choixCreate: vi.fn(),
  choixUpdate: vi.fn(),
  noteUpdateMany: vi.fn(),
  detteFindFirst: vi.fn(),
  detteFindMany: vi.fn(),
  cmFindFirst: vi.fn(),
  cmFindMany: vi.fn(),
  canReadSubmitted: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    $transaction: (...a: unknown[]) => $transaction(...a),
    $executeRaw: (...a: unknown[]) => $executeRaw(...a),
    noteFrais: {
      findUnique: (...a: unknown[]) => noteFindUnique(...a),
      findUniqueOrThrow: (...a: unknown[]) => noteFindUniqueOrThrow(...a),
      updateMany: (...a: unknown[]) => noteUpdateMany(...a),
    },
    noteFraisChoixReglement: {
      findUnique: (...a: unknown[]) => choixFindUnique(...a),
      findFirst: (...a: unknown[]) => choixFindFirst(...a),
      findMany: (...a: unknown[]) => choixFindMany(...a),
      count: (...a: unknown[]) => choixCount(...a),
      create: (...a: unknown[]) => choixCreate(...a),
      update: (...a: unknown[]) => choixUpdate(...a),
    },
    detteInitiale: {
      findFirst: (...a: unknown[]) => detteFindFirst(...a),
      findMany: (...a: unknown[]) => detteFindMany(...a),
    },
    cotisationMensuelle: {
      findFirst: (...a: unknown[]) => cmFindFirst(...a),
      findMany: (...a: unknown[]) => cmFindMany(...a),
    },
  },
}));

vi.mock("@/lib/frais-avances/feature-flag", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/frais-avances/feature-flag")
  >("@/lib/frais-avances/feature-flag");
  return {
    ...actual,
    assertNotesFraisEnabled: vi.fn(),
    isNotesFraisEnabled: () => true,
  };
});

vi.mock("@/lib/frais-avances/authz", () => ({
  canUserReadSubmittedNotesFrais: (...a: unknown[]) => canReadSubmitted(...a),
  canUserDecideNoteFrais: vi.fn(),
  canUserReadNotesFraisArchive: vi.fn(),
}));

vi.mock("@/lib/services/frais-avances/rgpd-account-deletion", () => ({
  lockUserRowForNotesFrais: vi.fn().mockResolvedValue(undefined),
}));

import {
  listCiblesCompensationEligibles,
  setChoixReglement,
  toChoixReglementArchiveSummary,
  validateChoixMontants,
} from "@/lib/services/frais-avances/note-frais-choix-reglement-service";

describe("validateChoixMontants", () => {
  it("accepte remboursement total", () => {
    const c = validateChoixMontants({
      mode: "REMBOURSEMENT",
      montantReference: 100,
      montantRemboursement: 100,
      montantCompensation: 0,
      cibles: [],
    });
    expect(c.montantRemboursement).toBe("100.00");
  });

  it("refuse somme cibles ≠ compensation", () => {
    expect(() =>
      validateChoixMontants({
        mode: "COMPENSATION",
        montantReference: 50,
        montantRemboursement: 0,
        montantCompensation: 50,
        cibles: [
          {
            typeCible: "DETTE_INITIALE",
            cibleId: "d1",
            montantAutorise: 30,
            rang: 0,
          },
        ],
      })
    ).toThrow(/Somme des cibles/);
  });

  it("refuse mixte si total ≠ accepté", () => {
    expect(() =>
      validateChoixMontants({
        mode: "MIXTE",
        montantReference: 100,
        montantRemboursement: 40,
        montantCompensation: 50,
        cibles: [
          {
            typeCible: "DETTE_INITIALE",
            cibleId: "d1",
            montantAutorise: 50,
            rang: 0,
          },
        ],
      })
    ).toThrow(/égal au montant accepté/);
  });

  it("ne réduit pas silencieusement — validation exacte", () => {
    const c = validateChoixMontants({
      mode: "MIXTE",
      montantReference: "80.00",
      montantRemboursement: 30,
      montantCompensation: 50,
      cibles: [
        {
          typeCible: "COTISATION_MENSUELLE",
          cibleId: "c1",
          montantAutorise: 20,
          rang: 0,
        },
        {
          typeCible: "DETTE_INITIALE",
          cibleId: "d1",
          montantAutorise: 30,
          rang: 1,
        },
      ],
    });
    expect(c.cibles).toHaveLength(2);
    expect(c.montantCompensation).toBe("50.00");
  });
});

describe("toChoixReglementArchiveSummary", () => {
  it("n'expose pas d'IDs de cibles", () => {
    const s = toChoixReglementArchiveSummary({
      mode: "MIXTE",
      montantRemboursement: 10,
      montantCompensation: 20,
    });
    expect(s).toEqual({
      modeReglement: "MIXTE",
      montantRemboursementChoix: "10.00",
      montantCompensationChoix: "20.00",
    });
    expect(JSON.stringify(s)).not.toMatch(/cibleId|libelle/);
  });
});

describe("listCiblesCompensationEligibles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("refuse non-owner", async () => {
    noteFindUnique.mockResolvedValue({
      id: "n1",
      statut: "VALIDEE",
      adherentId: "a1",
      demandeurUserId: "owner",
      montantAccepte: new Prisma.Decimal(40),
    });
    const res = await listCiblesCompensationEligibles({
      actorUserId: "other",
      noteId: "n1",
    });
    expect(res.success).toBe(false);
  });

  it("liste dettes + CM ordinaires uniquement", async () => {
    noteFindUnique.mockResolvedValue({
      id: "n1",
      statut: "VALIDEE",
      adherentId: "a1",
      demandeurUserId: "owner",
      montantAccepte: new Prisma.Decimal(40),
    });
    detteFindMany.mockResolvedValue([
      { id: "d1", annee: 2025, montantRestant: new Prisma.Decimal(20) },
    ]);
    cmFindMany.mockResolvedValue([
      {
        id: "c1",
        periode: "2026-01",
        montantRestant: new Prisma.Decimal(15),
        TypeCotisation: { nom: "Forfait" },
      },
    ]);
    const res = await listCiblesCompensationEligibles({
      actorUserId: "owner",
      noteId: "n1",
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data).toHaveLength(2);
      expect(cmFindMany.mock.calls[0][0].where.adherentBeneficiaireId).toBe(
        null
      );
      expect(
        cmFindMany.mock.calls[0][0].where.TypeCotisation.categorie
      ).toEqual({ not: "Assistance" });
    }
  });
});

describe("setChoixReglement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    choixFindUnique.mockResolvedValue(null);
    $executeRaw.mockResolvedValue(undefined);
  });

  it("refuse IDOR et note non VALIDEE", async () => {
    noteFindUnique.mockResolvedValue({
      id: "n1",
      statut: "SOUMISE",
      version: 2,
      adherentId: "a1",
      demandeurUserId: "owner",
      montantAccepte: null,
    });
    const res = await setChoixReglement({
      actorUserId: "owner",
      noteId: "n1",
      expectedNoteVersion: 2,
      idempotencyKey: "k1",
      mode: "REMBOURSEMENT",
      montantRemboursement: 10,
      montantCompensation: 0,
      cibles: [],
    });
    expect(res.success).toBe(false);
  });

  it("crée un choix remboursement ACTIF", async () => {
    noteFindUnique.mockResolvedValue({
      id: "n1",
      statut: "VALIDEE",
      version: 3,
      adherentId: "a1",
      demandeurUserId: "owner",
      montantAccepte: new Prisma.Decimal(40),
    });
    $transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
      const tx = {
        $executeRaw,
        noteFrais: {
          findUnique: noteFindUnique,
          updateMany: noteUpdateMany,
        },
        noteFraisChoixReglement: {
          findUnique: choixFindUnique,
          findMany: choixFindMany,
          count: choixCount,
          create: choixCreate,
          update: choixUpdate,
        },
        detteInitiale: { findFirst: detteFindFirst },
        cotisationMensuelle: { findFirst: cmFindFirst },
      };
      noteFindUnique.mockResolvedValueOnce({
        id: "n1",
        statut: "VALIDEE",
        version: 3,
        adherentId: "a1",
        demandeurUserId: "owner",
        montantAccepte: new Prisma.Decimal(40),
      });
      choixFindMany.mockResolvedValue([]);
      choixCreate.mockResolvedValue({
        id: "ch1",
        noteFraisId: "n1",
        mode: "REMBOURSEMENT",
        statut: "ACTIF",
        montantReference: new Prisma.Decimal(40),
        montantRemboursement: new Prisma.Decimal(40),
        montantCompensation: new Prisma.Decimal(0),
        montantRembourseUtilise: new Prisma.Decimal(0),
        montantCompensationUtilise: new Prisma.Decimal(0),
        remplaceChoixId: null,
        choisiAt: new Date(),
        Cibles: [],
      });
      choixCount.mockResolvedValue(1);
      noteUpdateMany.mockResolvedValue({ count: 1 });
      return fn(tx);
    });

    const res = await setChoixReglement({
      actorUserId: "owner",
      noteId: "n1",
      expectedNoteVersion: 3,
      idempotencyKey: "choix-remb-01",
      mode: "REMBOURSEMENT",
      montantRemboursement: 40,
      montantCompensation: 0,
      cibles: [],
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.choix.mode).toBe("REMBOURSEMENT");
      expect(res.data.replaced).toBe(false);
    }
  });

  it("idempotence même contenu = succès", async () => {
    const existingChoix = {
      id: "ch1",
      noteFraisId: "n1",
      mode: "REMBOURSEMENT",
      statut: "ACTIF",
      montantReference: new Prisma.Decimal(40),
      montantRemboursement: new Prisma.Decimal(40),
      montantCompensation: new Prisma.Decimal(0),
      montantRembourseUtilise: new Prisma.Decimal(0),
      montantCompensationUtilise: new Prisma.Decimal(0),
      remplaceChoixId: null,
      choisiAt: new Date(),
      Cibles: [],
    };
    noteFindUnique.mockResolvedValue({
      id: "n1",
      statut: "VALIDEE",
      version: 4,
      adherentId: "a1",
      demandeurUserId: "owner",
      montantAccepte: new Prisma.Decimal(40),
    });
    noteFindUniqueOrThrow.mockResolvedValue({ version: 4 });
    choixFindUnique.mockResolvedValue(existingChoix);

    const res = await setChoixReglement({
      actorUserId: "owner",
      noteId: "n1",
      expectedNoteVersion: 4,
      idempotencyKey: "same-key",
      mode: "REMBOURSEMENT",
      montantRemboursement: 40,
      montantCompensation: 0,
      cibles: [],
    });
    expect(res.success).toBe(true);
    expect($transaction).not.toHaveBeenCalled();
  });
});

describe("zéro écriture financière lot 3", () => {
  it("le service choix n'écrit pas de mouvement financier", async () => {
    const src = await readFile(
      "/soft/dev/nextjs/amakifr/lib/services/frais-avances/note-frais-choix-reglement-service.ts",
      "utf8"
    );
    expect(src).not.toMatch(
      /\bDepense\b|\bAvoir\b|UtilisationAvoir|PaiementCotisation/
    );
  });
});
