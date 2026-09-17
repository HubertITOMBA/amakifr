/**
 * Tests unitaires — corrections append-only (lot 4.6).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const {
  canCorrect,
  lockUser,
  noteFindUnique,
  correctionFindUnique,
  reglementFindUnique,
  tx,
  processOutbox,
} = vi.hoisted(() => {
  const tx = {
    $executeRaw: vi.fn().mockResolvedValue(0),
    noteFrais: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      updateMany: vi.fn(),
    },
    noteFraisReglement: { findUnique: vi.fn() },
    noteFraisChoixReglement: {
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
    },
    noteFraisChoixReglementCible: {
      update: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    noteFraisReglementCorrection: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    noteFraisCorrectionInverseCible: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
    },
    detteInitiale: {
      findFirst: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
    },
    cotisationMensuelle: {
      findFirst: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
    },
    notification: { create: vi.fn() },
    noteFraisOutboxEvent: { create: vi.fn() },
  };
  return {
    canCorrect: vi.fn(),
    lockUser: vi.fn(),
    noteFindUnique: vi.fn(),
    correctionFindUnique: vi.fn(),
    reglementFindUnique: vi.fn(),
    tx,
    processOutbox: vi.fn().mockResolvedValue(0),
  };
});

vi.mock("@/lib/db", () => ({
  db: {
    noteFrais: { findUnique: (...a: unknown[]) => noteFindUnique(...a) },
    noteFraisReglement: {
      findUnique: (...a: unknown[]) => reglementFindUnique(...a),
    },
    noteFraisReglementCorrection: {
      findUnique: (...a: unknown[]) => correctionFindUnique(...a),
    },
    $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
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
  canUserCorrectNoteFraisReglement: (...a: unknown[]) => canCorrect(...a),
}));

vi.mock("@/lib/services/frais-avances/rgpd-account-deletion", () => ({
  lockUserRowForNotesFrais: (...a: unknown[]) => lockUser(...a),
}));

vi.mock("@/lib/services/frais-avances/note-frais-service", () => ({
  processNoteFraisOutboxOnce: (...a: unknown[]) => processOutbox(...a),
}));

import {
  computeReglementNetMontant,
  correctNoteFraisReglement,
  normalizeCorrectionAllocations,
  normalizeCorrectionMotif,
  normalizeCorrectionPreuveRef,
  parsePreuveKind,
} from "@/lib/services/frais-avances/note-frais-correction-service";
import { enrichNoteFraisFinancierDto, toNoteFraisPublicDto } from "@/lib/frais-avances/dto";
import {
  CORRECTION_NOTIFY_MESSAGE,
  CORRECTION_NOTIFY_TITRE,
  buildNoteFraisReglementOutboxEventKey,
} from "@/lib/services/frais-avances/note-frais-reglement-notify";

describe("preuve / motif / allocations", () => {
  it("motif 1–2000", () => {
    expect(normalizeCorrectionMotif(" ok ")).toBe("ok");
    expect(() => normalizeCorrectionMotif("")).toThrow(/Motif/);
  });

  it("preuveKind + preuveRef charset / refus email IBAN montant", () => {
    expect(parsePreuveKind("EMAIL_TRACE")).toBe("EMAIL_TRACE");
    expect(normalizeCorrectionPreuveRef("TRACE-EMAIL-001")).toBe(
      "TRACE-EMAIL-001"
    );
    expect(() => normalizeCorrectionPreuveRef("ab")).toThrow(/8/);
    expect(() =>
      normalizeCorrectionPreuveRef("user@example.com-xx")
    ).toThrow(/caractères|email/);
    expect(() =>
      normalizeCorrectionPreuveRef("FR7612345678901234567890123")
    ).toThrow(/IBAN/);
    expect(() => normalizeCorrectionPreuveRef("PV-12.50-TRACE")).toThrow(
      /montant/
    );
  });

  it("allocations somme exacte ; positif stocké négatif côté service", () => {
    const alloc = normalizeCorrectionAllocations(
      [
        { reglementLigneId: "l2", montantARestaurer: "10.00" },
        { reglementLigneId: "l1", montantARestaurer: "5.50" },
      ],
      "15.50"
    );
    expect(alloc.map((a) => a.reglementLigneId)).toEqual(["l1", "l2"]);
    expect(() =>
      normalizeCorrectionAllocations(
        [{ reglementLigneId: "l1", montantARestaurer: "1.00" }],
        "2.00"
      )
    ).toThrow(/somme/);
  });

  it("net = brut + corrections négatives", () => {
    expect(
      computeReglementNetMontant("100.00", ["-30.00", "-20.00"]).toFixed(2)
    ).toBe("50.00");
    expect(() => computeReglementNetMontant("10.00", ["5.00"])).toThrow();
  });
});

describe("notify helpers correction", () => {
  it("eventKey + textes génériques sans montant", () => {
    expect(
      buildNoteFraisReglementOutboxEventKey(
        "CORRECTION_REFERENCE",
        "n1",
        "c1"
      )
    ).toBe("note:n1:correction:c1");
    expect(CORRECTION_NOTIFY_TITRE).toMatch(/Correction/);
    expect(CORRECTION_NOTIFY_MESSAGE).not.toMatch(/\d+[.,]\d{2}/);
    expect(CORRECTION_NOTIFY_MESSAGE.toLowerCase()).not.toContain("motif");
  });
});

describe("DTO confidentialité corrections", () => {
  it("membre : type + montant absolu, pas motif/preuve/réf", () => {
    const base = toNoteFraisPublicDto({
      id: "n1",
      libelle: "L",
      description: null,
      dateDepense: new Date("2026-01-01"),
      montantDemande: "100",
      statut: "VALIDEE",
      version: 2,
      soumiseAt: new Date(),
      alerteSansDestinataire: false,
      montantAccepte: "100",
      createdAt: new Date(),
      updatedAt: new Date(),
      ChoixReglements: [
        {
          id: "ch",
          mode: "REMBOURSEMENT",
          statut: "ACTIF",
          montantReference: "100",
          montantRemboursement: "100",
          montantCompensation: "0",
          montantRembourseUtilise: "80",
          montantCompensationUtilise: "0",
          remplaceChoixId: null,
          choisiAt: new Date(),
          Cibles: [],
        },
      ],
    });
    const dto = enrichNoteFraisFinancierDto(base, {
      includeReference: false,
      includeCorrectionAudit: false,
      remboursements: [
        {
          id: "r1",
          montantTotal: "100.00",
          montantNet: "80.00",
          moyen: "VIREMENT",
          reference: "SECRET-REF",
          executeAt: new Date("2026-01-02"),
        },
      ],
      corrections: [
        {
          id: "c1",
          reglementId: "r1",
          type: "MONTANT_NEGATIF",
          createdAt: new Date("2026-01-03"),
          montant: "-20.00",
          motif: "erreur saisie",
          preuveKind: "PV_TRESORERIE",
          preuveRef: "PV-2026-0001",
          referenceAvant: null,
          referenceApres: null,
          reglementType: "REMBOURSEMENT",
        },
      ],
    });
    const corr = dto.historiqueReglements!.find(
      (h) => h.kind === "CORRECTION_MONTANT_NEGATIF"
    )!;
    expect(corr.montantCorrection).toBe("20.00");
    expect(corr.motif).toBeUndefined();
    expect(corr.preuveRef).toBeUndefined();
    expect(dto.historiqueReglements![0].reference).toBeUndefined();
  });

  it("ADMIN audit : motif + refs si droits", () => {
    const base = toNoteFraisPublicDto({
      id: "n1",
      libelle: "L",
      description: null,
      dateDepense: new Date("2026-01-01"),
      montantDemande: "40",
      statut: "VALIDEE",
      version: 2,
      soumiseAt: new Date(),
      alerteSansDestinataire: false,
      montantAccepte: "40",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const dto = enrichNoteFraisFinancierDto(base, {
      includeReference: true,
      includeCorrectionAudit: true,
      corrections: [
        {
          id: "c2",
          reglementId: "r1",
          type: "REFERENCE",
          createdAt: new Date(),
          montant: null,
          motif: "typo",
          preuveKind: null,
          preuveRef: null,
          referenceAvant: "OLD",
          referenceApres: "NEW",
          reglementType: "REMBOURSEMENT",
        },
      ],
    });
    const corr = dto.historiqueReglements![0];
    expect(corr.motif).toBe("typo");
    expect(corr.referenceAvant).toBe("OLD");
    expect(corr.referenceApres).toBe("NEW");
  });
});

describe("correctNoteFraisReglement (mocks)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    canCorrect.mockResolvedValue(true);
    correctionFindUnique.mockResolvedValue(null);
    tx.noteFraisReglementCorrection.findUnique.mockResolvedValue(null);
    tx.noteFrais.updateMany.mockResolvedValue({ count: 1 });
    tx.notification.create.mockResolvedValue({});
    tx.noteFraisOutboxEvent.create.mockResolvedValue({});
  });

  function seedNote() {
    tx.noteFrais.findUnique.mockResolvedValue({
      demandeurUserId: "dem",
      statut: "VALIDEE",
    });
    tx.noteFrais.findUniqueOrThrow.mockResolvedValue({
      id: "n1",
      version: 3,
      statut: "VALIDEE",
      demandeurUserId: "dem",
      adherentId: "adh",
    });
  }

  it("refuse auto-correction même si TRESOR", async () => {
    seedNote();
    correctionFindUnique.mockResolvedValue(null);
    const res = await correctNoteFraisReglement({
      actorUserId: "dem",
      noteId: "n1",
      reglementId: "r1",
      expectedNoteVersion: 3,
      idempotencyKey: "corr-key-01",
      type: "REFERENCE",
      referenceApres: "NEW-REF-1",
      motif: "typo",
      client: undefined as never,
    });
    // client undefined uses mocked db — but assertCorrector runs with dem===actor
    // Actually we pass no client so uses mocked db.$transaction
    expect(res.success).toBe(false);
    if (!res.success) expect(res.code).toBe("AUTO_CORRECTION_FORBIDDEN");
  });

  it("REFERENCE no-change → CORRECTION_NO_CHANGE", async () => {
    seedNote();
    tx.noteFraisReglement.findUnique.mockResolvedValue({
      id: "r1",
      noteFraisId: "n1",
      choixId: "ch",
      type: "REMBOURSEMENT",
      statut: "EXECUTE",
      montantTotal: new Prisma.Decimal("40"),
      reference: "SAME",
      referenceNormalisee: "SAME",
      Lignes: [],
      Corrections: [],
    });
    tx.noteFraisChoixReglement.findUniqueOrThrow.mockResolvedValue({
      id: "ch",
      montantRembourseUtilise: new Prisma.Decimal("40"),
      montantCompensationUtilise: new Prisma.Decimal(0),
      Cibles: [],
    });
    const res = await correctNoteFraisReglement({
      actorUserId: "tres",
      noteId: "n1",
      reglementId: "r1",
      expectedNoteVersion: 3,
      idempotencyKey: "corr-key-02",
      type: "REFERENCE",
      referenceApres: "SAME",
      motif: "noop",
    });
    expect(res.success).toBe(false);
    if (!res.success) expect(res.code).toBe("CORRECTION_NO_CHANGE");
  });

  it("REFERENCE fresh : crée correction + notif générique ; règlement non muté", async () => {
    seedNote();
    tx.noteFraisReglement.findUnique.mockResolvedValue({
      id: "r1",
      noteFraisId: "n1",
      choixId: "ch",
      type: "REMBOURSEMENT",
      statut: "EXECUTE",
      montantTotal: new Prisma.Decimal("40"),
      reference: "OLD-REF",
      referenceNormalisee: "OLD-REF",
      Lignes: [],
      Corrections: [],
    });
    tx.noteFraisChoixReglement.findUniqueOrThrow.mockResolvedValue({
      id: "ch",
      montantRembourseUtilise: new Prisma.Decimal("40"),
      montantCompensationUtilise: new Prisma.Decimal(0),
      Cibles: [],
    });
    tx.noteFraisReglementCorrection.create.mockResolvedValue({
      id: "corr1",
    });
    const res = await correctNoteFraisReglement({
      actorUserId: "tres",
      noteId: "n1",
      reglementId: "r1",
      expectedNoteVersion: 3,
      idempotencyKey: "corr-key-03xx",
      type: "REFERENCE",
      referenceApres: "NEW-REF",
      motif: "typo banque",
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.alreadyCorrected).toBe(false);
      expect(res.data.type).toBe("REFERENCE");
    }
    const createArg = tx.noteFraisReglementCorrection.create.mock.calls[0]![0];
    expect(createArg.data.referenceAvantNorm).toBe("OLD-REF");
    expect(createArg.data.referenceApresNorm).toBe("NEW-REF");
    expect(createArg.data.preuveKind).toBeNull();
    expect(tx.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          titre: CORRECTION_NOTIFY_TITRE,
          message: CORRECTION_NOTIFY_MESSAGE,
        }),
      })
    );
    const outbox = tx.noteFraisOutboxEvent.create.mock.calls[0]![0];
    expect(outbox.data.kind).toBe("CORRECTION_REFERENCE");
    expect(JSON.stringify(outbox.data.payload)).not.toMatch(/NEW-REF|typo/);
  });

  it("MONTANT_NEGATIF remb : stocke négatif depuis chaîne positive", async () => {
    seedNote();
    tx.noteFraisReglement.findUnique.mockResolvedValue({
      id: "r1",
      noteFraisId: "n1",
      choixId: "ch",
      type: "REMBOURSEMENT",
      statut: "EXECUTE",
      montantTotal: new Prisma.Decimal("40.00"),
      reference: "R",
      referenceNormalisee: "R",
      Lignes: [],
      Corrections: [],
    });
    tx.noteFraisChoixReglement.findUniqueOrThrow.mockResolvedValue({
      id: "ch",
      montantRembourseUtilise: new Prisma.Decimal("40.00"),
      montantCompensationUtilise: new Prisma.Decimal(0),
      Cibles: [],
    });
    tx.noteFraisReglementCorrection.create.mockResolvedValue({ id: "corr2" });
    const res = await correctNoteFraisReglement({
      actorUserId: "tres",
      noteId: "n1",
      reglementId: "r1",
      expectedNoteVersion: 3,
      idempotencyKey: "corr-key-04xx",
      type: "MONTANT_NEGATIF",
      montantACorriger: "10.00",
      motif: "erreur enregistrement",
      preuveKind: "PV_TRESORERIE",
      preuveRef: "PV-2026-00042",
    });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.montant).toBe("-10.00");
    const createArg = tx.noteFraisReglementCorrection.create.mock.calls[0]![0];
    expect(createArg.data.montant.toString()).toBe("-10");
    expect(tx.noteFraisChoixReglement.update).toHaveBeenCalled();
  });

  it("authz refusée avant replay", async () => {
    canCorrect.mockResolvedValue(false);
    correctionFindUnique.mockResolvedValue({
      id: "corr-old",
      reglementId: "r1",
      type: "REFERENCE",
      montant: null,
      referenceApresNorm: "NEW",
      motif: "typo",
      preuveKind: null,
      preuveRef: null,
      Inverses: [],
    });
    noteFindUnique.mockResolvedValue({
      version: 3,
      demandeurUserId: "dem",
    });
    const res = await correctNoteFraisReglement({
      actorUserId: "membre",
      noteId: "n1",
      reglementId: "r1",
      expectedNoteVersion: 3,
      idempotencyKey: "corr-key-05xx",
      type: "REFERENCE",
      referenceApres: "NEW",
      motif: "typo",
    });
    expect(res.success).toBe(false);
    if (!res.success) expect(res.code).toBe("FORBIDDEN");
  });

  it("replay exact → alreadyCorrected sans notif", async () => {
    canCorrect.mockResolvedValue(true);
    noteFindUnique.mockResolvedValue({
      version: 5,
      demandeurUserId: "dem",
    });
    correctionFindUnique.mockResolvedValue({
      id: "corr-old",
      reglementId: "r1",
      type: "REFERENCE",
      montant: null,
      referenceApresNorm: "NEW-REF",
      motif: "typo banque",
      preuveKind: null,
      preuveRef: null,
      Inverses: [],
    });
    const res = await correctNoteFraisReglement({
      actorUserId: "tres",
      noteId: "n1",
      reglementId: "r1",
      expectedNoteVersion: 5,
      idempotencyKey: "corr-key-06xx",
      type: "REFERENCE",
      referenceApres: "NEW-REF",
      motif: "typo banque",
    });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.alreadyCorrected).toBe(true);
    expect(tx.notification.create).not.toHaveBeenCalled();
  });

  it("zéro / invalide / dépassement montant", async () => {
    seedNote();
    tx.noteFraisReglement.findUnique.mockResolvedValue({
      id: "r1",
      noteFraisId: "n1",
      choixId: "ch",
      type: "REMBOURSEMENT",
      statut: "EXECUTE",
      montantTotal: new Prisma.Decimal("10.00"),
      reference: "R",
      referenceNormalisee: "R",
      Lignes: [],
      Corrections: [],
    });
    tx.noteFraisChoixReglement.findUniqueOrThrow.mockResolvedValue({
      id: "ch",
      montantRembourseUtilise: new Prisma.Decimal("10.00"),
      montantCompensationUtilise: new Prisma.Decimal(0),
      Cibles: [],
    });
    const zero = await correctNoteFraisReglement({
      actorUserId: "tres",
      noteId: "n1",
      reglementId: "r1",
      expectedNoteVersion: 3,
      idempotencyKey: "corr-key-07xx",
      type: "MONTANT_NEGATIF",
      montantACorriger: "0.00",
      motif: "x",
      preuveKind: "AUTRE_TRACE",
      preuveRef: "TRACE-00000001",
    });
    expect(zero.success).toBe(false);

    const over = await correctNoteFraisReglement({
      actorUserId: "tres",
      noteId: "n1",
      reglementId: "r1",
      expectedNoteVersion: 3,
      idempotencyKey: "corr-key-08xx",
      type: "MONTANT_NEGATIF",
      montantACorriger: "11.00",
      motif: "x",
      preuveKind: "AUTRE_TRACE",
      preuveRef: "TRACE-00000002",
    });
    expect(over.success).toBe(false);
    if (!over.success) expect(over.code).toBe("PLAFOND_DEPASSE");
  });
});
