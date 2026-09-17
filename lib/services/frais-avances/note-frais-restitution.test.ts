/**
 * Tests unitaires — restitutions réelles (lot 4.7).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const {
  canRecord,
  lockUser,
  noteFindUnique,
  restitutionFindUnique,
  tx,
  processOutbox,
  $transaction,
} = vi.hoisted(() => {
  const tx = {
    $executeRaw: vi.fn().mockResolvedValue(0),
    noteFrais: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      updateMany: vi.fn(),
    },
    noteFraisReglement: { findUnique: vi.fn() },
    noteFraisReglementOperation: { findUnique: vi.fn() },
    noteFraisChoixReglement: {
      findUniqueOrThrow: vi.fn(),
      updateMany: vi.fn(),
    },
    noteFraisRestitution: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    notification: { create: vi.fn() },
    noteFraisOutboxEvent: { create: vi.fn() },
  };
  return {
    canRecord: vi.fn(),
    lockUser: vi.fn(),
    noteFindUnique: vi.fn(),
    restitutionFindUnique: vi.fn(),
    tx,
    processOutbox: vi.fn().mockResolvedValue(0),
    $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) =>
      fn(tx)
    ),
  };
});

vi.mock("@/lib/db", () => ({
  db: {
    noteFrais: { findUnique: (...a: unknown[]) => noteFindUnique(...a) },
    noteFraisRestitution: {
      findUnique: (...a: unknown[]) => restitutionFindUnique(...a),
    },
    $transaction: (...a: unknown[]) => $transaction(...a),
  },
}));

vi.mock("@/lib/frais-avances/feature-flag", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/frais-avances/feature-flag")
  >("@/lib/frais-avances/feature-flag");
  return {
    ...actual,
    assertNotesFraisEnabled: vi.fn(),
  };
});

vi.mock("@/lib/frais-avances/authz", () => ({
  canUserRecordNoteFraisRestitution: (...a: unknown[]) => canRecord(...a),
}));

vi.mock("@/lib/services/frais-avances/rgpd-account-deletion", () => ({
  lockUserRowForNotesFrais: (...a: unknown[]) => lockUser(...a),
}));

vi.mock("@/lib/services/frais-avances/note-frais-service", () => ({
  processNoteFraisOutboxOnce: (...a: unknown[]) => processOutbox(...a),
}));

import {
  computeResteRestituable,
  computeRestantDuNotesFraisGlobal,
  recordNoteFraisRestitution,
} from "@/lib/services/frais-avances/note-frais-restitution-service";
import { RESTITUTION_NOTIFY_TITRE } from "@/lib/services/frais-avances/note-frais-reglement-notify";
import {
  enrichNoteFraisFinancierDto,
  toNoteFraisPublicDto,
} from "@/lib/frais-avances/dto";

const BASE_PAYLOAD = {
  actorUserId: "tres",
  noteId: "n1",
  reglementId: "r1",
  expectedNoteVersion: 3,
  idempotencyKey: "rest-key-02xx",
  montant: "10.00",
  moyen: "VIREMENT" as const,
  reference: "VIR-REST-001",
  dateRestitution: "2026-02-01T12:00:00.000Z",
  motif: "retour partiel",
};

function existingRow(
  overrides: Partial<{
    montant: Prisma.Decimal;
    moyen: string;
    referenceNormalisee: string;
    dateRestitution: Date;
    motif: string;
  }> = {}
) {
  return {
    id: "rest-old",
    reglementId: "r1",
    montant: new Prisma.Decimal("10.00"),
    moyen: "VIREMENT",
    reference: "VIR-REST-001",
    referenceNormalisee: "VIR-REST-001",
    dateRestitution: new Date("2026-02-01T12:00:00.000Z"),
    motif: "retour partiel",
    ...overrides,
  };
}

describe("computeResteRestituable", () => {
  it("applique formules net − cumuls", () => {
    const r = computeResteRestituable("100.00", ["-20.00"], ["30.00"]);
    expect(r.remboursementCorrige.toFixed(2)).toBe("80.00");
    expect(r.restitueCumule.toFixed(2)).toBe("30.00");
    expect(r.resteRestituable.toFixed(2)).toBe("50.00");
  });
});

describe("computeRestantDuNotesFraisGlobal", () => {
  it("montantAccepte null sur VALIDEE → NOTES_FRAIS_FINANCIAL_STATE_INCONSISTENT", async () => {
    const client = {
      noteFrais: {
        findMany: vi.fn().mockResolvedValue([
          { montantAccepte: null, ChoixReglements: [] },
        ]),
      },
    };
    await expect(
      computeRestantDuNotesFraisGlobal(client as never)
    ).rejects.toThrow(/NOTES_FRAIS_FINANCIAL_STATE_INCONSISTENT/);
  });

  it("restant négatif → fail-closed sans clamp", async () => {
    const client = {
      noteFrais: {
        findMany: vi.fn().mockResolvedValue([
          {
            montantAccepte: new Prisma.Decimal("10.00"),
            ChoixReglements: [
              {
                montantRembourseUtilise: new Prisma.Decimal("20.00"),
                montantCompensationUtilise: new Prisma.Decimal(0),
              },
            ],
          },
        ]),
      },
    };
    await expect(
      computeRestantDuNotesFraisGlobal(client as never)
    ).rejects.toThrow(/NOTES_FRAIS_FINANCIAL_STATE_INCONSISTENT/);
  });
});

describe("DTO restitution — clés sensibles absentes", () => {
  function baseDto() {
    return toNoteFraisPublicDto({
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
  }

  const restitutions = [
    {
      id: "rest1",
      reglementId: "r1",
      montant: "10.00",
      moyen: "VIREMENT" as const,
      reference: "SECRET-REF",
      referenceNormalisee: "SECRET-REF",
      dateRestitution: new Date("2026-02-01"),
      motif: "secret motif",
      actorUserId: "actor-secret",
      operationId: null,
    },
  ];

  function assertNoSensitiveKeys(entry: object) {
    expect(
      Object.prototype.hasOwnProperty.call(entry, "reference")
    ).toBe(false);
    expect(
      Object.prototype.hasOwnProperty.call(entry, "referenceNormalisee")
    ).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(entry, "motif")).toBe(false);
    expect(
      Object.prototype.hasOwnProperty.call(entry, "actorUserId")
    ).toBe(false);
    expect(JSON.stringify(entry)).not.toMatch(
      /SECRET|secret motif|actor-secret/
    );
  }

  it("membre : hasOwnProperty false + JSON sans sensible", () => {
    const dto = enrichNoteFraisFinancierDto(baseDto(), {
      includeReference: false,
      includeRestitutionReference: false,
      includeRestitutionAudit: false,
      remboursements: [],
      restitutions,
    });
    const entry = dto.historiqueReglements!.find((h) => h.kind === "RESTITUTION")!;
    expect(entry.montantRestitution).toBe("10.00");
    expect(entry.moyen).toBe("VIREMENT");
    assertNoSensitiveKeys(entry);
  });

  it("COMCPT : hasOwnProperty false + JSON sans sensible", () => {
    const dto = enrichNoteFraisFinancierDto(baseDto(), {
      includeReference: false,
      includeRestitutionReference: false,
      includeRestitutionAudit: false,
      remboursements: [],
      restitutions,
    });
    const entry = dto.historiqueReglements!.find((h) => h.kind === "RESTITUTION")!;
    assertNoSensitiveKeys(entry);
  });

  it("ADMIN/TRESOR autorisé : référence + motif présents", () => {
    const dto = enrichNoteFraisFinancierDto(baseDto(), {
      includeReference: true,
      includeRestitutionReference: true,
      includeRestitutionAudit: true,
      remboursements: [],
      restitutions,
    });
    const entry = dto.historiqueReglements!.find((h) => h.kind === "RESTITUTION")!;
    expect(entry.reference).toBe("SECRET-REF");
    expect(entry.motif).toBe("secret motif");
    expect(
      Object.prototype.hasOwnProperty.call(entry, "actorUserId")
    ).toBe(false);
    expect(
      Object.prototype.hasOwnProperty.call(entry, "referenceNormalisee")
    ).toBe(false);
  });
});

describe("recordNoteFraisRestitution (mocks)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    canRecord.mockResolvedValue(true);
    restitutionFindUnique.mockResolvedValue(null);
    tx.noteFraisRestitution.findUnique.mockResolvedValue(null);
    tx.noteFrais.updateMany.mockResolvedValue({ count: 1 });
    tx.noteFraisChoixReglement.updateMany.mockResolvedValue({ count: 1 });
    tx.noteFraisReglementOperation.findUnique.mockResolvedValue(null);
    tx.notification.create.mockResolvedValue({});
    tx.noteFraisOutboxEvent.create.mockResolvedValue({});
    $transaction.mockImplementation(async (fn: (t: typeof tx) => Promise<unknown>) =>
      fn(tx)
    );
  });

  function seedNote() {
    noteFindUnique.mockResolvedValue({
      id: "n1",
      statut: "VALIDEE",
      demandeurUserId: "dem",
      decideeAt: new Date("2026-01-01T00:00:00.000Z"),
      version: 3,
    });
    tx.noteFrais.findUniqueOrThrow.mockResolvedValue({
      id: "n1",
      version: 3,
      statut: "VALIDEE",
      demandeurUserId: "dem",
      decideeAt: new Date("2026-01-01T00:00:00.000Z"),
    });
  }

  function seedRemb() {
    tx.noteFraisReglement.findUnique.mockResolvedValue({
      id: "r1",
      noteFraisId: "n1",
      choixId: "ch",
      type: "REMBOURSEMENT",
      statut: "EXECUTE",
      montantTotal: new Prisma.Decimal("40.00"),
      Corrections: [],
      Restitutions: [],
    });
    tx.noteFraisChoixReglement.findUniqueOrThrow.mockResolvedValue({
      id: "ch",
      statut: "ACTIF",
      montantRembourseUtilise: new Prisma.Decimal("40.00"),
    });
  }

  it("auto-restitution refusée", async () => {
    seedNote();
    const res = await recordNoteFraisRestitution({
      ...BASE_PAYLOAD,
      actorUserId: "dem",
      idempotencyKey: "rest-key-01xx",
    });
    expect(res.success).toBe(false);
    if (!res.success) expect(res.code).toBe("AUTO_RESTITUTION_FORBIDDEN");
  });

  it("fresh : crée restitution + décrémente compteur + notif générique", async () => {
    seedNote();
    seedRemb();
    tx.noteFraisRestitution.create.mockResolvedValue({ id: "rest1" });
    const res = await recordNoteFraisRestitution(BASE_PAYLOAD);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.montant).toBe("10.00");
      expect(typeof res.data.montant).toBe("string");
      expect(res.data.alreadyRestituted).toBe(false);
    }
    expect(tx.noteFraisChoixReglement.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          montantRembourseUtilise: { gte: expect.anything() },
        }),
        data: expect.objectContaining({
          montantRembourseUtilise: { decrement: expect.anything() },
        }),
      })
    );
    const createArg = tx.noteFraisRestitution.create.mock.calls[0]![0];
    expect(createArg.data.montant).toBeInstanceOf(Prisma.Decimal);
    expect(createArg.data.montant.toFixed(2)).toBe("10.00");
    const notif = tx.notification.create.mock.calls[0]![0];
    expect(notif.data.titre).toBe(RESTITUTION_NOTIFY_TITRE);
    expect(JSON.stringify(notif)).not.toMatch(/VIR-REST|10\.00|retour/);
    const outbox = tx.noteFraisOutboxEvent.create.mock.calls[0]![0];
    expect(outbox.data.kind).toBe("RESTITUTION_ENREGISTREE");
    expect(outbox.data.eventKey).toBe("note:n1:restitution:rest1");
  });

  it("authz refusée avant replay", async () => {
    canRecord.mockResolvedValue(false);
    restitutionFindUnique.mockResolvedValue(existingRow());
    noteFindUnique.mockResolvedValue({
      id: "n1",
      statut: "VALIDEE",
      demandeurUserId: "dem",
      decideeAt: new Date("2026-01-01T00:00:00.000Z"),
      version: 3,
    });
    const res = await recordNoteFraisRestitution({
      ...BASE_PAYLOAD,
      actorUserId: "membre",
      idempotencyKey: "rest-key-replay",
    });
    expect(res.success).toBe(false);
    if (!res.success) expect(res.code).toBe("FORBIDDEN");
    expect($transaction).not.toHaveBeenCalled();
    expect(tx.noteFraisRestitution.create).not.toHaveBeenCalled();
  });

  it("replay exact → alreadyRestituted sans notif ni mutation", async () => {
    canRecord.mockResolvedValue(true);
    restitutionFindUnique.mockResolvedValue(existingRow());
    noteFindUnique.mockResolvedValue({
      id: "n1",
      statut: "VALIDEE",
      demandeurUserId: "dem",
      decideeAt: new Date("2026-01-01T00:00:00.000Z"),
      version: 5,
    });
    const res = await recordNoteFraisRestitution({
      ...BASE_PAYLOAD,
      expectedNoteVersion: 99,
      idempotencyKey: "rest-key-replay",
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.alreadyRestituted).toBe(true);
      expect(res.data.version).toBe(5);
    }
    expect(canRecord).toHaveBeenCalled();
    expect($transaction).not.toHaveBeenCalled();
    expect(tx.notification.create).not.toHaveBeenCalled();
    expect(tx.noteFraisOutboxEvent.create).not.toHaveBeenCalled();
    expect(tx.noteFraisChoixReglement.updateMany).not.toHaveBeenCalled();
    expect(tx.noteFrais.updateMany).not.toHaveBeenCalled();
  });

  it("même clé + montant différent → IDEMPOTENCY_CONFLICT", async () => {
    canRecord.mockResolvedValue(true);
    restitutionFindUnique.mockResolvedValue(existingRow());
    noteFindUnique.mockResolvedValue({
      id: "n1",
      statut: "VALIDEE",
      demandeurUserId: "dem",
      version: 5,
    });
    const res = await recordNoteFraisRestitution({
      ...BASE_PAYLOAD,
      montant: "15.00",
      idempotencyKey: "rest-key-replay",
    });
    expect(res.success).toBe(false);
    if (!res.success) expect(res.code).toBe("IDEMPOTENCY_CONFLICT");
  });

  it("même clé + date/moyen/référence/motif différent → conflit", async () => {
    canRecord.mockResolvedValue(true);
    noteFindUnique.mockResolvedValue({
      id: "n1",
      statut: "VALIDEE",
      demandeurUserId: "dem",
      version: 5,
    });
    for (const override of [
      { dateRestitution: "2026-03-01T12:00:00.000Z" },
      { moyen: "ESPECES" as const, reference: "CAISSE-001" },
      { reference: "VIR-OTHER-99" },
      { motif: "autre motif" },
    ]) {
      restitutionFindUnique.mockResolvedValue(existingRow());
      const res = await recordNoteFraisRestitution({
        ...BASE_PAYLOAD,
        ...override,
        idempotencyKey: "rest-key-replay",
      });
      expect(res.success).toBe(false);
      if (!res.success) expect(res.code).toBe("IDEMPOTENCY_CONFLICT");
    }
  });

  it("P2002 idempotencyKey → relecture + authz + alreadyRestituted", async () => {
    seedNote();
    seedRemb();
    $transaction.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("unique", {
        code: "P2002",
        clientVersion: "test",
        meta: { target: ["idempotencyKey"] },
      })
    );
    restitutionFindUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(existingRow());
    const res = await recordNoteFraisRestitution(BASE_PAYLOAD);
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.alreadyRestituted).toBe(true);
    expect(canRecord).toHaveBeenCalled();
  });

  it("P2002 autre contrainte → erreur propagée, jamais succès", async () => {
    seedNote();
    seedRemb();
    $transaction.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("unique", {
        code: "P2002",
        clientVersion: "test",
        meta: { target: ["eventKey"] },
      })
    );
    const res = await recordNoteFraisRestitution(BASE_PAYLOAD);
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toMatch(/unique|P2002|erreur|inattendue/i);
      expect(res.code).not.toBe("IDEMPOTENCY_CONFLICT");
    }
  });

  it("compensation refusée", async () => {
    seedNote();
    tx.noteFraisReglement.findUnique.mockResolvedValue({
      id: "r1",
      noteFraisId: "n1",
      choixId: "ch",
      type: "COMPENSATION",
      statut: "EXECUTE",
      montantTotal: new Prisma.Decimal("40.00"),
      Corrections: [],
      Restitutions: [],
    });
    tx.noteFraisChoixReglement.findUniqueOrThrow.mockResolvedValue({
      id: "ch",
      statut: "ACTIF",
    });
    const res = await recordNoteFraisRestitution({
      ...BASE_PAYLOAD,
      idempotencyKey: "rest-key-03xx",
      motif: "interdit",
    });
    expect(res.success).toBe(false);
  });

  it("parent MIXTE refusé", async () => {
    seedNote();
    tx.noteFraisReglementOperation.findUnique.mockResolvedValue({ id: "op1" });
    const res = await recordNoteFraisRestitution({
      ...BASE_PAYLOAD,
      reglementId: "op1",
      idempotencyKey: "rest-key-04xx",
      motif: "parent",
    });
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toMatch(/MIXTE parente/);
  });

  it("dépassement reste restituable", async () => {
    seedNote();
    tx.noteFraisReglement.findUnique.mockResolvedValue({
      id: "r1",
      noteFraisId: "n1",
      choixId: "ch",
      type: "REMBOURSEMENT",
      statut: "EXECUTE",
      montantTotal: new Prisma.Decimal("40.00"),
      Corrections: [{ montant: new Prisma.Decimal("-10.00") }],
      Restitutions: [{ montant: new Prisma.Decimal("20.00") }],
    });
    tx.noteFraisChoixReglement.findUniqueOrThrow.mockResolvedValue({
      id: "ch",
      statut: "ACTIF",
    });
    const res = await recordNoteFraisRestitution({
      ...BASE_PAYLOAD,
      montant: "15.00",
      idempotencyKey: "rest-key-05xx",
      motif: "trop",
    });
    expect(res.success).toBe(false);
    if (!res.success) expect(res.code).toBe("RESTITUTION_EXCEEDS_REMAINING");
  });

  it("validations montant / date / moyen / référence / motif", async () => {
    seedNote();
    seedRemb();

    for (const montant of ["0", "-1", "abc", ""]) {
      const res = await recordNoteFraisRestitution({
        ...BASE_PAYLOAD,
        montant,
        idempotencyKey: `rest-m-${montant || "empty"}`.slice(0, 64),
      });
      expect(res.success).toBe(false);
    }

    const noTz = await recordNoteFraisRestitution({
      ...BASE_PAYLOAD,
      dateRestitution: "2026-02-01T12:00:00",
      idempotencyKey: "rest-date-notzxxxx",
    });
    expect(noTz.success).toBe(false);

    const badCal = await recordNoteFraisRestitution({
      ...BASE_PAYLOAD,
      dateRestitution: "2026-02-31T12:00:00.000Z",
      idempotencyKey: "rest-date-badcalxx",
    });
    expect(badCal.success).toBe(false);

    const future = await recordNoteFraisRestitution({
      ...BASE_PAYLOAD,
      dateRestitution: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      idempotencyKey: "rest-date-futurexx",
      clock: { now: () => new Date() },
    });
    expect(future.success).toBe(false);

    const moyen = await recordNoteFraisRestitution({
      ...BASE_PAYLOAD,
      moyen: "CHEQUE" as never,
      idempotencyKey: "rest-moyen-badxxxx",
    });
    expect(moyen.success).toBe(false);

    for (const reference of ["", "   "]) {
      const res = await recordNoteFraisRestitution({
        ...BASE_PAYLOAD,
        reference,
        idempotencyKey: `rest-ref-${reference.length}`.padEnd(16, "x"),
      });
      expect(res.success).toBe(false);
    }
    const especes = await recordNoteFraisRestitution({
      ...BASE_PAYLOAD,
      moyen: "ESPECES",
      reference: "",
      idempotencyKey: "rest-ref-especesxx",
    });
    expect(especes.success).toBe(false);

    const motifVide = await recordNoteFraisRestitution({
      ...BASE_PAYLOAD,
      motif: "  ",
      idempotencyKey: "rest-motif-emptyxx",
    });
    expect(motifVide.success).toBe(false);

    const motifLong = await recordNoteFraisRestitution({
      ...BASE_PAYLOAD,
      motif: "x".repeat(2001),
      idempotencyKey: "rest-motif-longxxxx",
    });
    expect(motifLong.success).toBe(false);
  });
});
