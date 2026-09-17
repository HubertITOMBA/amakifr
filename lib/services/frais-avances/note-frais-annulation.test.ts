/**
 * Tests unitaires — annulation double validation (lot 4.8).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const {
  canRequest,
  canConfirm,
  canRefuse,
  lockUser,
  noteFindUnique,
  noteFindUniqueOrThrow,
  demandeFindUnique,
  tx,
  processOutbox,
  $transaction,
} = vi.hoisted(() => {
  const tx = {
    $executeRaw: vi.fn().mockResolvedValue(0),
    noteFrais: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    noteFraisReglement: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    noteFraisReglementOperation: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
    },
    noteFraisChoixReglement: {
      findUniqueOrThrow: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    noteFraisChoixReglementCible: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    noteFraisReglementCorrection: { count: vi.fn().mockResolvedValue(0) },
    noteFraisRestitution: { count: vi.fn().mockResolvedValue(0) },
    noteFraisReglementAnnulationDemande: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    noteFraisAnnulationInverseCible: { create: vi.fn() },
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
    user: { findMany: vi.fn().mockResolvedValue([]) },
    userAdminRole: { findMany: vi.fn().mockResolvedValue([]) },
    notification: { create: vi.fn().mockResolvedValue({}) },
    noteFraisOutboxEvent: { create: vi.fn().mockResolvedValue({}) },
  };
  return {
    canRequest: vi.fn(),
    canConfirm: vi.fn(),
    canRefuse: vi.fn(),
    lockUser: vi.fn(),
    noteFindUnique: vi.fn(),
    noteFindUniqueOrThrow: vi.fn(),
    demandeFindUnique: vi.fn(),
    tx,
    processOutbox: vi.fn().mockResolvedValue(0),
    $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) =>
      fn(tx)
    ),
  };
});

vi.mock("@/lib/db", () => ({
  db: {
    noteFrais: {
      findUnique: (...a: unknown[]) => noteFindUnique(...a),
      findUniqueOrThrow: (...a: unknown[]) => noteFindUniqueOrThrow(...a),
    },
    noteFraisReglementAnnulationDemande: {
      findUnique: (...a: unknown[]) => demandeFindUnique(...a),
      updateMany: vi.fn(),
      findMany: vi.fn(),
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
    isNotesFraisEnabled: () => true,
  };
});

vi.mock("@/lib/frais-avances/authz", () => ({
  canUserRequestCancelNoteFraisReglement: (...a: unknown[]) => canRequest(...a),
  canUserConfirmCancelNoteFraisReglement: (...a: unknown[]) => canConfirm(...a),
  canUserRefuseCancelNoteFraisReglement: (...a: unknown[]) => canRefuse(...a),
}));

vi.mock("@/lib/services/frais-avances/rgpd-account-deletion", () => ({
  lockUserRowForNotesFrais: (...a: unknown[]) => lockUser(...a),
}));

vi.mock("@/lib/services/frais-avances/note-frais-service", () => ({
  processNoteFraisOutboxOnce: (...a: unknown[]) => processOutbox(...a),
}));

import {
  NOTES_FRAIS_ANNULATION_TTL_MS,
  assertPreuveCompatible,
  confirmNoteFraisReglementAnnulation,
  expirePendingCancellationRequests,
  normalizeAnnulationMotif,
  normalizeAnnulationPreuveRef,
  refuseNoteFraisReglementAnnulation,
  requestNoteFraisReglementAnnulation,
} from "@/lib/services/frais-avances/note-frais-annulation-service";
import {
  ANNULATION_CONFIRMEE_MESSAGE,
  ANNULATION_CONFIRMEE_TITRE,
  ANNULATION_DEMANDE_MESSAGE,
  ANNULATION_DEMANDE_TITRE,
  ANNULATION_REFUSEE_MESSAGE,
  ANNULATION_REFUSEE_TITRE,
  buildNoteFraisReglementOutboxEventKey,
} from "@/lib/services/frais-avances/note-frais-reglement-notify";
import {
  enrichNoteFraisFinancierDto,
  toNoteFraisPublicDto,
} from "@/lib/frais-avances/dto";

const DAY_MS = 24 * 60 * 60 * 1000;
const T0 = new Date("2026-03-01T12:00:00.000Z");

describe("preuve / motif / preuveRef", () => {
  it("motif 1–2000", () => {
    expect(normalizeAnnulationMotif(" ok ")).toBe("ok");
    expect(() => normalizeAnnulationMotif("")).toThrow(/Motif/);
    expect(() => normalizeAnnulationMotif("x".repeat(2001))).toThrow(/Motif/);
  });

  it("preuveRef charset / refus email IBAN montant", () => {
    expect(normalizeAnnulationPreuveRef("TRACE-BNQ-001")).toBe("TRACE-BNQ-001");
    expect(() => normalizeAnnulationPreuveRef("ab")).toThrow(/8/);
    expect(() =>
      normalizeAnnulationPreuveRef("user@example.com-xx")
    ).toThrow(/email|preuve/i);
    expect(() =>
      normalizeAnnulationPreuveRef("FR7612345678901234567890123")
    ).toThrow(/IBAN/);
    expect(() => normalizeAnnulationPreuveRef("PV-12.50-TRACE")).toThrow(
      /montant/
    );
  });

  it("preuves compatibles par type de cible", () => {
    expect(() =>
      assertPreuveCompatible("REJET_BANQUE", "REMBOURSEMENT")
    ).not.toThrow();
    expect(() =>
      assertPreuveCompatible("ANNULATION_VIREMENT", "MIXTE")
    ).not.toThrow();
    expect(() =>
      assertPreuveCompatible("PV_TRESORERIE", "COMPENSATION")
    ).not.toThrow();
    expect(() =>
      assertPreuveCompatible("JUSTIFICATIF_INTERNE", "COMPENSATION")
    ).not.toThrow();
    expect(() =>
      assertPreuveCompatible("AUTRE_TRACE", "REMBOURSEMENT")
    ).not.toThrow();
    expect(() =>
      assertPreuveCompatible("AUTRE_TRACE", "COMPENSATION")
    ).not.toThrow();

    expect(() =>
      assertPreuveCompatible("PV_TRESORERIE", "REMBOURSEMENT")
    ).toThrow(/remboursement/i);
    expect(() =>
      assertPreuveCompatible("REJET_BANQUE", "COMPENSATION")
    ).toThrow(/compensation/i);
    expect(() =>
      assertPreuveCompatible("JUSTIFICATIF_INTERNE", "MIXTE")
    ).toThrow(/remboursement/i);
  });
});

describe("TTL 30 j — constante", () => {
  it("TTL = 30 jours exacts", () => {
    expect(NOTES_FRAIS_ANNULATION_TTL_MS).toBe(30 * DAY_MS);
  });
});

describe("notify helpers annulation", () => {
  it("eventKey + textes génériques sans montant/motif/preuve", () => {
    expect(
      buildNoteFraisReglementOutboxEventKey("ANNULATION_DEMANDEE", "n1", "d1")
    ).toBe("note:n1:annulation:d1:demandee");
    expect(
      buildNoteFraisReglementOutboxEventKey("ANNULATION_CONFIRMEE", "n1", "d1")
    ).toBe("note:n1:annulation:d1:confirmee");
    expect(
      buildNoteFraisReglementOutboxEventKey("ANNULATION_REFUSEE", "n1", "d1")
    ).toBe("note:n1:annulation:d1:refusee");

    for (const msg of [
      ANNULATION_DEMANDE_MESSAGE,
      ANNULATION_CONFIRMEE_MESSAGE,
      ANNULATION_REFUSEE_MESSAGE,
    ]) {
      expect(msg).not.toMatch(/\d+[.,]\d{2}/);
      expect(msg.toLowerCase()).not.toContain("motif");
      expect(msg.toLowerCase()).not.toContain("preuve");
      expect(msg.toLowerCase()).not.toContain("iban");
    }
    expect(ANNULATION_DEMANDE_TITRE).toMatch(/annulation/i);
    expect(ANNULATION_CONFIRMEE_TITRE).toMatch(/confirm/i);
    expect(ANNULATION_REFUSEE_TITRE).toMatch(/refus/i);
  });
});

describe("DTO confidentialité annulations", () => {
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

  const annulations = [
    {
      id: "ann1",
      reglementId: "r1",
      operationId: null,
      decideeAt: new Date("2026-02-01"),
      motif: "secret motif banque",
      preuveKind: "REJET_BANQUE",
      preuveRef: "SECRET-PREUVE-01",
    },
  ];

  it("membre/COMCPT : libellé sans motif/preuve (clés absentes)", () => {
    const dto = enrichNoteFraisFinancierDto(baseDto(), {
      includeAnnulationAudit: false,
      annulations,
    });
    const entry = dto.historiqueReglements!.find((h) => h.kind === "ANNULATION")!;
    expect(entry.libelleAnnulation).toBe("Règlement annulé");
    expect(Object.prototype.hasOwnProperty.call(entry, "motif")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(entry, "preuveKind")).toBe(
      false
    );
    expect(Object.prototype.hasOwnProperty.call(entry, "preuveRef")).toBe(
      false
    );
    expect(Object.prototype.hasOwnProperty.call(entry, "demandeurUserId")).toBe(
      false
    );
    expect(
      Object.prototype.hasOwnProperty.call(entry, "confirmateurUserId")
    ).toBe(false);
    expect(JSON.stringify(entry)).not.toMatch(/motif|preuve|acteur|SECRET/i);
  });

  it("ADMIN audit : motif + preuve si droits", () => {
    const dto = enrichNoteFraisFinancierDto(baseDto(), {
      includeAnnulationAudit: true,
      annulations,
    });
    const entry = dto.historiqueReglements!.find((h) => h.kind === "ANNULATION")!;
    expect(entry.motif).toBe("secret motif banque");
    expect(entry.preuveKind).toBe("REJET_BANQUE");
    expect(entry.preuveRef).toBe("SECRET-PREUVE-01");
    expect(Object.prototype.hasOwnProperty.call(entry, "motif")).toBe(true);
  });
});

describe("expirePendingCancellationRequests", () => {
  it("J+29 conserve ; frontière J+30 et J+31 expirent", async () => {
    const createdAt = T0;
    const expiresAt = new Date(createdAt.getTime() + NOTES_FRAIS_ANNULATION_TTL_MS);
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const client = {
      noteFraisReglementAnnulationDemande: { updateMany, findMany: vi.fn() },
    } as never;

    const j29 = new Date(expiresAt.getTime() - DAY_MS);
    updateMany.mockResolvedValueOnce({ count: 0 });
    expect(
      await expirePendingCancellationRequests({ now: j29, client })
    ).toBe(0);
    expect(updateMany.mock.calls[0]![0].where.expiresAt).toEqual({ lte: j29 });

    updateMany.mockResolvedValueOnce({ count: 1 });
    expect(
      await expirePendingCancellationRequests({ now: expiresAt, client })
    ).toBe(1);

    const j31 = new Date(expiresAt.getTime() + DAY_MS);
    updateMany.mockResolvedValueOnce({ count: 1 });
    expect(
      await expirePendingCancellationRequests({ now: j31, client })
    ).toBe(1);
  });
});

describe("requestNoteFraisReglementAnnulation (mocks)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    canRequest.mockResolvedValue(true);
    demandeFindUnique.mockResolvedValue(null);
    noteFindUnique.mockResolvedValue({
      id: "n1",
      statut: "VALIDEE",
      demandeurUserId: "dem",
    });
    tx.noteFrais.findUniqueOrThrow.mockResolvedValue({
      id: "n1",
      statut: "VALIDEE",
      demandeurUserId: "dem",
      adherentId: "adh",
    });
    tx.noteFraisReglementCorrection.count.mockResolvedValue(0);
    tx.noteFraisRestitution.count.mockResolvedValue(0);
    tx.noteFraisReglementAnnulationDemande.count.mockResolvedValue(0);
    tx.noteFraisReglementAnnulationDemande.findUnique.mockResolvedValue(null);
    tx.noteFraisReglementAnnulationDemande.create.mockResolvedValue({
      id: "dem-ann-1",
      expiresAt: new Date(T0.getTime() + NOTES_FRAIS_ANNULATION_TTL_MS),
    });
    tx.noteFraisReglementAnnulationDemande.updateMany.mockResolvedValue({
      count: 0,
    });
    tx.user.findMany.mockResolvedValue([{ id: "admin-1" }]);
    tx.userAdminRole.findMany.mockResolvedValue([]);
    $transaction.mockImplementation(
      async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)
    );
  });

  function seedRembReg() {
    tx.noteFraisReglement.findUnique.mockResolvedValue({
      id: "r1",
      noteFraisId: "n1",
      type: "REMBOURSEMENT",
      statut: "EXECUTE",
      operationId: null,
      montantTotal: new Prisma.Decimal("40"),
    });
  }

  it("refuse auto-demande (acteur = demandeur note)", async () => {
    const res = await requestNoteFraisReglementAnnulation({
      actorUserId: "dem",
      noteId: "n1",
      reglementId: "r1",
      idempotencyKey: "req-key-01xx",
      motif: "erreur virement",
      preuveKind: "REJET_BANQUE",
      preuveRef: "BNQ-TRACE-01",
      clock: { now: () => T0 },
    });
    expect(res.success).toBe(false);
    if (!res.success) expect(res.code).toBe("FORBIDDEN");
  });

  it("refuse acteurs non autorisés", async () => {
    canRequest.mockResolvedValue(false);
    seedRembReg();
    const res = await requestNoteFraisReglementAnnulation({
      actorUserId: "membre",
      noteId: "n1",
      reglementId: "r1",
      idempotencyKey: "req-key-02xx",
      motif: "erreur",
      preuveKind: "REJET_BANQUE",
      preuveRef: "BNQ-TRACE-02",
      clock: { now: () => T0 },
    });
    expect(res.success).toBe(false);
    if (!res.success) expect(res.code).toBe("FORBIDDEN");
  });

  it("fresh remb : crée DEMANDEE + notif générique sans finance", async () => {
    seedRembReg();
    const res = await requestNoteFraisReglementAnnulation({
      actorUserId: "tres-req",
      noteId: "n1",
      reglementId: "r1",
      idempotencyKey: "req-key-03xx",
      motif: "virement rejeté",
      preuveKind: "REJET_BANQUE",
      preuveRef: "BNQ-TRACE-03",
      clock: { now: () => T0 },
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.alreadyRequested).toBe(false);
      expect(res.data.statut).toBe("DEMANDEE");
      expect(res.data.expiresAt).toBe(
        new Date(T0.getTime() + NOTES_FRAIS_ANNULATION_TTL_MS).toISOString()
      );
    }
    expect(tx.noteFraisChoixReglement.updateMany).not.toHaveBeenCalled();
    expect(tx.noteFraisReglement.update).not.toHaveBeenCalled();
    expect(tx.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          titre: ANNULATION_DEMANDE_TITRE,
          message: ANNULATION_DEMANDE_MESSAGE,
        }),
      })
    );
    const outbox = tx.noteFraisOutboxEvent.create.mock.calls[0]![0];
    expect(outbox.data.kind).toBe("ANNULATION_DEMANDEE");
    expect(JSON.stringify(outbox.data.payload)).not.toMatch(
      /virement rejeté|BNQ-TRACE|40\.00/
    );
  });

  it("idempotence replay même contenu ; conflit contenu différent", async () => {
    seedRembReg();
    const existing = {
      id: "dem-old",
      reglementId: "r1",
      operationId: null,
      motif: "virement rejeté",
      preuveKind: "REJET_BANQUE",
      preuveRef: "BNQ-TRACE-03",
      expiresAt: new Date(T0.getTime() + NOTES_FRAIS_ANNULATION_TTL_MS),
      Reglement: { noteFraisId: "n1" },
      Operation: null,
    };
    demandeFindUnique.mockResolvedValue(existing);

    const replay = await requestNoteFraisReglementAnnulation({
      actorUserId: "tres-req",
      noteId: "n1",
      reglementId: "r1",
      idempotencyKey: "req-key-idem1",
      motif: "virement rejeté",
      preuveKind: "REJET_BANQUE",
      preuveRef: "BNQ-TRACE-03",
      clock: { now: () => T0 },
    });
    expect(replay.success).toBe(true);
    if (replay.success) {
      expect(replay.data.alreadyRequested).toBe(true);
      expect(replay.data.demandeId).toBe("dem-old");
    }
    expect($transaction).not.toHaveBeenCalled();

    demandeFindUnique.mockResolvedValue({
      ...existing,
      motif: "autre motif",
    });
    const conflict = await requestNoteFraisReglementAnnulation({
      actorUserId: "tres-req",
      noteId: "n1",
      reglementId: "r1",
      idempotencyKey: "req-key-idem1",
      motif: "virement rejeté",
      preuveKind: "REJET_BANQUE",
      preuveRef: "BNQ-TRACE-03",
      clock: { now: () => T0 },
    });
    expect(conflict.success).toBe(false);
    if (!conflict.success) expect(conflict.code).toBe("IDEMPOTENCY_CONFLICT");
  });

  it("P2002 idempotency → replay succès si même contenu", async () => {
    seedRembReg();
    const p2002 = new Prisma.PrismaClientKnownRequestError("Unique", {
      code: "P2002",
      clientVersion: "test",
      meta: { target: ["idempotencyKey"] },
    });
    $transaction.mockRejectedValueOnce(p2002);
    demandeFindUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "dem-race",
        reglementId: "r1",
        operationId: null,
        motif: "virement rejeté",
        preuveKind: "REJET_BANQUE",
        preuveRef: "BNQ-TRACE-P2",
        expiresAt: new Date(T0.getTime() + NOTES_FRAIS_ANNULATION_TTL_MS),
        Reglement: { noteFraisId: "n1" },
        Operation: null,
      });

    const res = await requestNoteFraisReglementAnnulation({
      actorUserId: "tres-req",
      noteId: "n1",
      reglementId: "r1",
      idempotencyKey: "req-key-p2002x",
      motif: "virement rejeté",
      preuveKind: "REJET_BANQUE",
      preuveRef: "BNQ-TRACE-P2",
      clock: { now: () => T0 },
    });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.alreadyRequested).toBe(true);
  });

  it("refuse si corrections / restitutions présentes", async () => {
    seedRembReg();
    tx.noteFraisReglementCorrection.count.mockResolvedValue(1);
    const withCorr = await requestNoteFraisReglementAnnulation({
      actorUserId: "tres-req",
      noteId: "n1",
      reglementId: "r1",
      idempotencyKey: "req-key-corr01",
      motif: "annul",
      preuveKind: "REJET_BANQUE",
      preuveRef: "BNQ-TRACE-C1",
      clock: { now: () => T0 },
    });
    expect(withCorr.success).toBe(false);
    if (!withCorr.success) expect(withCorr.code).toBe("REGLEMENT_HAS_CORRECTIONS");

    tx.noteFraisReglementCorrection.count.mockResolvedValue(0);
    tx.noteFraisRestitution.count.mockResolvedValue(1);
    const withRest = await requestNoteFraisReglementAnnulation({
      actorUserId: "tres-req",
      noteId: "n1",
      reglementId: "r1",
      idempotencyKey: "req-key-rest01",
      motif: "annul",
      preuveKind: "REJET_BANQUE",
      preuveRef: "BNQ-TRACE-R1",
      clock: { now: () => T0 },
    });
    expect(withRest.success).toBe(false);
    if (!withRest.success)
      expect(withRest.code).toBe("REGLEMENT_HAS_RESTITUTIONS");
  });

  it("enfant MIXTE → MIXTE_PARENT_REQUIRED", async () => {
    tx.noteFraisReglement.findUnique.mockResolvedValue({
      id: "r-enfant",
      noteFraisId: "n1",
      type: "REMBOURSEMENT",
      statut: "EXECUTE",
      operationId: "op1",
      montantTotal: new Prisma.Decimal("20"),
    });
    const res = await requestNoteFraisReglementAnnulation({
      actorUserId: "tres-req",
      noteId: "n1",
      reglementId: "r-enfant",
      idempotencyKey: "req-key-enfant",
      motif: "annul enfant",
      preuveKind: "REJET_BANQUE",
      preuveRef: "BNQ-ENFANT-01",
      clock: { now: () => T0 },
    });
    expect(res.success).toBe(false);
    if (!res.success) expect(res.code).toBe("MIXTE_PARENT_REQUIRED");
  });

  it("preuve incompatible compensation", async () => {
    tx.noteFraisReglement.findUnique.mockResolvedValue({
      id: "r-comp",
      noteFraisId: "n1",
      type: "COMPENSATION",
      statut: "EXECUTE",
      operationId: null,
      montantTotal: new Prisma.Decimal("30"),
    });
    const res = await requestNoteFraisReglementAnnulation({
      actorUserId: "tres-req",
      noteId: "n1",
      reglementId: "r-comp",
      idempotencyKey: "req-key-preuve",
      motif: "mauvaise preuve",
      preuveKind: "REJET_BANQUE",
      preuveRef: "BNQ-WRONG-01",
      clock: { now: () => T0 },
    });
    expect(res.success).toBe(false);
    if (!res.success) expect(res.code).toBe("PREUVE_INVALIDE");
  });
});

describe("refuseNoteFraisReglementAnnulation (mocks)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    canRefuse.mockResolvedValue(true);
    demandeFindUnique.mockResolvedValue(null);
    tx.noteFraisReglementAnnulationDemande.updateMany.mockResolvedValue({
      count: 0,
    });
    $transaction.mockImplementation(
      async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)
    );
  });

  it("refuse même acteur que demandeur de la demande", async () => {
    tx.noteFraisReglementAnnulationDemande.findUniqueOrThrow.mockResolvedValue({
      id: "d1",
      statut: "DEMANDEE",
      demandeurUserId: "tres-req",
      expiresAt: new Date(T0.getTime() + DAY_MS),
      Reglement: { noteFraisId: "n1" },
      Operation: null,
    });
    tx.noteFrais.findUniqueOrThrow.mockResolvedValue({
      demandeurUserId: "dem",
    });
    const res = await refuseNoteFraisReglementAnnulation({
      actorUserId: "tres-req",
      noteId: "n1",
      demandeId: "d1",
      decisionIdempotencyKey: "dec-ref-01xx",
      decisionMotif: "preuve insuffisante",
      clock: { now: () => T0 },
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toMatch(/distinct|auteur de la demande/i);
    }
  });

  it("fresh refus sans effet financier + notif auteur", async () => {
    tx.noteFraisReglementAnnulationDemande.findUniqueOrThrow.mockResolvedValue({
      id: "d1",
      statut: "DEMANDEE",
      demandeurUserId: "tres-req",
      expiresAt: new Date(T0.getTime() + DAY_MS),
      Reglement: { noteFraisId: "n1" },
      Operation: null,
    });
    tx.noteFrais.findUniqueOrThrow.mockResolvedValue({
      demandeurUserId: "dem",
    });
    tx.noteFraisReglementAnnulationDemande.updateMany.mockResolvedValue({
      count: 1,
    });
    const res = await refuseNoteFraisReglementAnnulation({
      actorUserId: "tres-conf",
      noteId: "n1",
      demandeId: "d1",
      decisionIdempotencyKey: "dec-ref-02xx",
      decisionMotif: "preuve insuffisante",
      clock: { now: () => T0 },
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.statut).toBe("REFUSEE");
      expect(res.data.alreadyDecided).toBe(false);
    }
    expect(tx.noteFraisChoixReglement.updateMany).not.toHaveBeenCalled();
    expect(tx.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "tres-req",
          titre: ANNULATION_REFUSEE_TITRE,
          message: ANNULATION_REFUSEE_MESSAGE,
        }),
      })
    );
  });

  it("J+30 frontière → ANNULATION_EXPIRED", async () => {
    const expiresAt = new Date(T0.getTime() + NOTES_FRAIS_ANNULATION_TTL_MS);
    tx.noteFraisReglementAnnulationDemande.findUniqueOrThrow.mockResolvedValue({
      id: "d1",
      statut: "DEMANDEE",
      demandeurUserId: "tres-req",
      expiresAt,
      Reglement: { noteFraisId: "n1" },
      Operation: null,
    });
    tx.noteFrais.findUniqueOrThrow.mockResolvedValue({
      demandeurUserId: "dem",
    });
    const res = await refuseNoteFraisReglementAnnulation({
      actorUserId: "tres-conf",
      noteId: "n1",
      demandeId: "d1",
      decisionIdempotencyKey: "dec-ref-exp01",
      decisionMotif: "trop tard",
      clock: { now: () => expiresAt },
    });
    expect(res.success).toBe(false);
    if (!res.success) expect(res.code).toBe("ANNULATION_EXPIRED");
  });

  it("idempotence décision refus replay", async () => {
    demandeFindUnique.mockResolvedValue({
      id: "d1",
      statut: "REFUSEE",
      decisionMotif: "preuve insuffisante",
    });
    const res = await refuseNoteFraisReglementAnnulation({
      actorUserId: "tres-conf",
      noteId: "n1",
      demandeId: "d1",
      decisionIdempotencyKey: "dec-ref-idem1",
      decisionMotif: "preuve insuffisante",
      clock: { now: () => T0 },
    });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.alreadyDecided).toBe(true);
    expect($transaction).not.toHaveBeenCalled();
  });
});

describe("confirmNoteFraisReglementAnnulation (mocks)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    canConfirm.mockResolvedValue(true);
    demandeFindUnique.mockResolvedValue(null);
    tx.noteFraisReglementCorrection.count.mockResolvedValue(0);
    tx.noteFraisRestitution.count.mockResolvedValue(0);
    tx.noteFraisReglementAnnulationDemande.updateMany.mockResolvedValue({
      count: 1,
    });
    tx.noteFrais.updateMany.mockResolvedValue({ count: 1 });
    tx.noteFraisChoixReglement.updateMany.mockResolvedValue({ count: 1 });
    $transaction.mockImplementation(
      async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)
    );
  });

  function seedConfirmRemb() {
    tx.noteFrais.findUniqueOrThrow
      .mockResolvedValueOnce({
        demandeurUserId: "dem",
        adherentId: "adh",
        version: 3,
      })
      .mockResolvedValueOnce({
        id: "n1",
        version: 3,
        adherentId: "adh",
        demandeurUserId: "dem",
      });
    tx.noteFraisReglementAnnulationDemande.findUniqueOrThrow
      .mockResolvedValueOnce({
        id: "d1",
        statut: "DEMANDEE",
        demandeurUserId: "tres-req",
        reglementId: "r1",
        operationId: null,
        expiresAt: new Date(T0.getTime() + DAY_MS),
        Reglement: {
          id: "r1",
          noteFraisId: "n1",
          type: "REMBOURSEMENT",
          statut: "EXECUTE",
          montantTotal: new Prisma.Decimal("40"),
          choixId: "ch",
          Lignes: [
            {
              id: "l1",
              typeLigne: "REMBOURSEMENT",
              typeCible: null,
              cibleId: null,
              montant: new Prisma.Decimal("40"),
              montantRestantCibleApres: null,
            },
          ],
        },
        Operation: null,
      })
      .mockResolvedValueOnce({
        id: "d1",
        statut: "DEMANDEE",
        demandeurUserId: "tres-req",
        reglementId: "r1",
        operationId: null,
        expiresAt: new Date(T0.getTime() + DAY_MS),
      });
    tx.noteFraisReglement.findUniqueOrThrow.mockResolvedValue({
      id: "r1",
      type: "REMBOURSEMENT",
      statut: "EXECUTE",
      montantTotal: new Prisma.Decimal("40"),
      choixId: "ch",
      operationId: null,
      Lignes: [
        {
          id: "l1",
          typeLigne: "REMBOURSEMENT",
          typeCible: null,
          cibleId: null,
          montant: new Prisma.Decimal("40"),
          montantRestantCibleApres: null,
        },
      ],
    });
    tx.noteFraisChoixReglement.findUniqueOrThrow.mockResolvedValue({
      id: "ch",
      statut: "ACTIF",
      Cibles: [],
    });
  }

  it("refuse confirmateur = auteur demande", async () => {
    tx.noteFrais.findUniqueOrThrow.mockResolvedValue({
      demandeurUserId: "dem",
      adherentId: "adh",
      version: 3,
    });
    tx.noteFraisReglementAnnulationDemande.findUniqueOrThrow.mockResolvedValue({
      id: "d1",
      statut: "DEMANDEE",
      demandeurUserId: "tres-req",
      reglementId: "r1",
      operationId: null,
      expiresAt: new Date(T0.getTime() + DAY_MS),
      Reglement: { noteFraisId: "n1" },
      Operation: null,
    });
    const res = await confirmNoteFraisReglementAnnulation({
      actorUserId: "tres-req",
      noteId: "n1",
      demandeId: "d1",
      expectedNoteVersion: 3,
      decisionIdempotencyKey: "dec-conf-same1",
      attestation: true,
      clock: { now: () => T0 },
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toMatch(/distinct|auteur de la demande/i);
    }
  });

  it("attestation false/absente → ANNULATION_ATTESTATION_REQUIRED", async () => {
    const resFalse = await confirmNoteFraisReglementAnnulation({
      actorUserId: "tres-conf",
      noteId: "n1",
      demandeId: "d1",
      expectedNoteVersion: 3,
      decisionIdempotencyKey: "dec-att-false",
      attestation: false,
      clock: { now: () => T0 },
    });
    expect(resFalse.success).toBe(false);
    if (!resFalse.success) {
      expect(resFalse.code).toBe("ANNULATION_ATTESTATION_REQUIRED");
    }
    const resAbs = await confirmNoteFraisReglementAnnulation({
      actorUserId: "tres-conf",
      noteId: "n1",
      demandeId: "d1",
      expectedNoteVersion: 3,
      decisionIdempotencyKey: "dec-att-abs",
      // @ts-expect-error — absente volontaire
      attestation: undefined,
      clock: { now: () => T0 },
    });
    expect(resAbs.success).toBe(false);
    if (!resAbs.success) {
      expect(resAbs.code).toBe("ANNULATION_ATTESTATION_REQUIRED");
    }
    expect($transaction).not.toHaveBeenCalled();
  });

  it("confirm remb : ANNULE + décrémente compteur + notif liens audience", async () => {
    seedConfirmRemb();
    const res = await confirmNoteFraisReglementAnnulation({
      actorUserId: "tres-conf",
      noteId: "n1",
      demandeId: "d1",
      expectedNoteVersion: 3,
      decisionIdempotencyKey: "dec-conf-remb1",
      attestation: true,
      clock: { now: () => T0 },
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.statut).toBe("CONFIRMEE");
      expect(res.data.version).toBe(4);
    }
    expect(tx.noteFraisReglement.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "r1" },
        data: { statut: "ANNULE" },
      })
    );
    expect(tx.noteFraisChoixReglement.updateMany).toHaveBeenCalled();
    expect(tx.notification.create).toHaveBeenCalledTimes(2);
    expect(tx.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "dem",
          lien: "/user/frais-avances/n1",
          titre: ANNULATION_CONFIRMEE_TITRE,
        }),
      })
    );
    expect(tx.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "tres-req",
          lien: "/admin/frais-avances/n1",
        }),
      })
    );
    expect(tx.noteFraisOutboxEvent.create).toHaveBeenCalledTimes(2);
    const keys = tx.noteFraisOutboxEvent.create.mock.calls.map(
      (c) => c[0].data.eventKey as string
    );
    expect(keys).toContain("note:n1:annulation:d1:confirmee:user");
    expect(keys).toContain("note:n1:annulation:d1:confirmee:admin");
    for (const c of tx.noteFraisOutboxEvent.create.mock.calls) {
      expect(JSON.stringify(c[0].data.payload)).not.toMatch(
        /40\.00|motif|preuve|iban/i
      );
    }
  });

  it("idempotence confirm replay", async () => {
    demandeFindUnique.mockResolvedValue({
      id: "d1",
      statut: "CONFIRMEE",
    });
    noteFindUniqueOrThrow.mockResolvedValue({ version: 5 });

    const res = await confirmNoteFraisReglementAnnulation({
      actorUserId: "tres-conf",
      noteId: "n1",
      demandeId: "d1",
      expectedNoteVersion: 99,
      decisionIdempotencyKey: "dec-conf-idem1",
      attestation: true,
      clock: { now: () => T0 },
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.alreadyDecided).toBe(true);
      expect(res.data.version).toBe(5);
    }
    expect($transaction).not.toHaveBeenCalled();
  });
});
