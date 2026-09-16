import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const {
  $transaction,
  $executeRaw,
  noteFindUnique,
  noteFindFirst,
  noteUpdateMany,
  noteCreate,
  decisionCreate,
  notifCreate,
  outboxCreate,
  userFindUnique,
  userAdminRoleFindMany,
  canWrite,
  resolveActionPermissionConfig,
  typeDepenseFindFirst,
  depenseFindUnique,
  depenseCreate,
} = vi.hoisted(() => ({
  $transaction: vi.fn(),
  $executeRaw: vi.fn(),
  noteFindUnique: vi.fn(),
  noteFindFirst: vi.fn(),
  noteUpdateMany: vi.fn(),
  noteCreate: vi.fn(),
  decisionCreate: vi.fn(),
  notifCreate: vi.fn(),
  outboxCreate: vi.fn(),
  userFindUnique: vi.fn(),
  userAdminRoleFindMany: vi.fn(),
  canWrite: vi.fn(),
  resolveActionPermissionConfig: vi.fn(),
  typeDepenseFindFirst: vi.fn(),
  depenseFindUnique: vi.fn(),
  depenseCreate: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    $transaction: (...a: unknown[]) => $transaction(...a),
    $executeRaw: (...a: unknown[]) => $executeRaw(...a),
    noteFrais: {
      findUnique: (...a: unknown[]) => noteFindUnique(...a),
      findFirst: (...a: unknown[]) => noteFindFirst(...a),
      updateMany: (...a: unknown[]) => noteUpdateMany(...a),
      create: (...a: unknown[]) => noteCreate(...a),
    },
    noteFraisDecision: {
      create: (...a: unknown[]) => decisionCreate(...a),
    },
    notification: { create: (...a: unknown[]) => notifCreate(...a) },
    noteFraisOutboxEvent: { create: (...a: unknown[]) => outboxCreate(...a) },
    user: { findUnique: (...a: unknown[]) => userFindUnique(...a) },
    userAdminRole: { findMany: (...a: unknown[]) => userAdminRoleFindMany(...a) },
    typeDepense: {
      findFirst: (...a: unknown[]) => typeDepenseFindFirst(...a),
    },
    depense: {
      findUnique: (...a: unknown[]) => depenseFindUnique(...a),
      create: (...a: unknown[]) => depenseCreate(...a),
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

vi.mock("@/lib/dynamic-permissions", () => ({
  canRead: vi.fn().mockResolvedValue(false),
  canWrite: (...a: unknown[]) => canWrite(...a),
  resolveActionPermissionConfig: (...a: unknown[]) =>
    resolveActionPermissionConfig(...a),
}));

vi.mock("@/lib/user-roles", () => ({
  getUserAdminRolesFromDb: vi.fn().mockResolvedValue([]),
}));

import {
  createCorrectedNoteFraisDraft,
  decideNoteFrais,
  validateAndNormalizeDecisionContent,
} from "@/lib/services/frais-avances/note-frais-decision-service";
import { canUserDecideNoteFrais } from "@/lib/frais-avances/authz";
import { NOTES_FRAIS_TYPE_DEPENSE_ABSENT } from "@/lib/frais-avances/type-depense-frais-avance";

function baseSoumise(overrides: Record<string, unknown> = {}) {
  return {
    id: "n1",
    demandeurUserId: "dem",
    statut: "SOUMISE",
    version: 2,
    montantDemande: new Prisma.Decimal(100),
    libelle: "Note test",
    description: "desc",
    dateDepense: new Date("2026-03-01T00:00:00.000Z"),
    Decision: null,
    decisionIdempotencyKey: null,
    ...overrides,
  };
}

function mockTxHappyPath() {
  $transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
    const tx = {
      $executeRaw,
      noteFrais: {
        findUnique: noteFindUnique,
        updateMany: noteUpdateMany,
      },
      noteFraisDecision: { create: decisionCreate },
      notification: { create: notifCreate },
      noteFraisOutboxEvent: { create: outboxCreate },
      typeDepense: { findFirst: typeDepenseFindFirst },
      depense: {
        findUnique: depenseFindUnique,
        create: depenseCreate,
      },
    };
    return fn(tx);
  });
}

describe("validateAndNormalizeDecisionContent", () => {
  it("accepte total sans motif", () => {
    const c = validateAndNormalizeDecisionContent({
      outcome: "VALIDEE",
      montantDemande: 100,
      montantAccepte: 100,
    });
    expect(c.statutFinal).toBe("VALIDEE");
    expect(c.montantAccepte).toBe("100.00");
    expect(c.motif).toBeNull();
  });

  it("exige motif pour partiel et rejet", () => {
    expect(() =>
      validateAndNormalizeDecisionContent({
        outcome: "VALIDEE",
        montantDemande: 100,
        montantAccepte: 50,
      })
    ).toThrow(/Motif obligatoire/);
    expect(() =>
      validateAndNormalizeDecisionContent({
        outcome: "REJETEE",
        montantDemande: 100,
      })
    ).toThrow(/Motif obligatoire/);
  });

  it("refuse montant ≤ 0 ou > demandé", () => {
    expect(() =>
      validateAndNormalizeDecisionContent({
        outcome: "VALIDEE",
        montantDemande: 100,
        montantAccepte: 0,
      })
    ).toThrow(/strictement positif/);
    expect(() =>
      validateAndNormalizeDecisionContent({
        outcome: "VALIDEE",
        montantDemande: 100,
        montantAccepte: 101,
      })
    ).toThrow(/ne peut pas dépasser/);
  });
});

describe("canUserDecideNoteFrais", () => {
  beforeEach(() => {
    canWrite.mockResolvedValue(false);
    userAdminRoleFindMany.mockResolvedValue([]);
    resolveActionPermissionConfig.mockResolvedValue({ status: "absent" });
  });

  it("autorise TRESOR / ADMIN actifs", async () => {
    userFindUnique.mockResolvedValue({ role: "TRESOR", status: "Actif" });
    expect(await canUserDecideNoteFrais("u1")).toBe(true);
    userFindUnique.mockResolvedValue({ role: "ADMIN", status: "Actif" });
    expect(await canUserDecideNoteFrais("u2")).toBe(true);
  });

  it("refuse PRESID / SECRET / COMCPT / inactif", async () => {
    for (const role of ["PRESID", "SECRET", "COMCPT", "MEMBRE"]) {
      userFindUnique.mockResolvedValue({ role, status: "Actif" });
      expect(await canUserDecideNoteFrais("u")).toBe(false);
    }
    userFindUnique.mockResolvedValue({ role: "TRESOR", status: "Inactif" });
    expect(await canUserDecideNoteFrais("u")).toBe(false);
  });

  it("autorise rôle additionnel TRESOR", async () => {
    userFindUnique.mockResolvedValue({ role: "MEMBRE", status: "Actif" });
    userAdminRoleFindMany.mockResolvedValue([{ role: "TRESOR" }]);
    expect(await canUserDecideNoteFrais("u")).toBe(true);
  });

  it("refuse MEMBRE Actif même avec permission decideNoteFrais", async () => {
    userFindUnique.mockResolvedValue({ role: "MEMBRE", status: "Actif" });
    userAdminRoleFindMany.mockResolvedValue([]);
    resolveActionPermissionConfig.mockClear();
    resolveActionPermissionConfig.mockResolvedValue({
      status: "configured",
      roles: ["MEMBRE", "TRESOR", "ADMIN"],
    });
    expect(await canUserDecideNoteFrais("u-membre")).toBe(false);
    expect(resolveActionPermissionConfig).not.toHaveBeenCalled();
  });

  it("refuse TRESOR Actif si permission explicitement désactivée", async () => {
    userFindUnique.mockResolvedValue({ role: "TRESOR", status: "Actif" });
    userAdminRoleFindMany.mockResolvedValue([]);
    resolveActionPermissionConfig.mockResolvedValue({ status: "disabled" });
    expect(await canUserDecideNoteFrais("u-tresor")).toBe(false);
  });

  it("refuse TRESOR Actif si configurée sans son rôle (refus explicite)", async () => {
    userFindUnique.mockResolvedValue({ role: "TRESOR", status: "Actif" });
    userAdminRoleFindMany.mockResolvedValue([]);
    resolveActionPermissionConfig.mockResolvedValue({
      status: "configured",
      roles: ["ADMIN"],
    });
    expect(await canUserDecideNoteFrais("u-tresor")).toBe(false);
  });

  it("autorise TRESOR Actif si permission absente (non configurée)", async () => {
    userFindUnique.mockResolvedValue({ role: "TRESOR", status: "Actif" });
    userAdminRoleFindMany.mockResolvedValue([]);
    resolveActionPermissionConfig.mockResolvedValue({ status: "absent" });
    expect(await canUserDecideNoteFrais("u-tresor")).toBe(true);
  });

  it("ADMIN principal reste autorisé malgré permission désactivée", async () => {
    userFindUnique.mockResolvedValue({ role: "ADMIN", status: "Actif" });
    userAdminRoleFindMany.mockResolvedValue([]);
    resolveActionPermissionConfig.mockClear();
    resolveActionPermissionConfig.mockResolvedValue({ status: "disabled" });
    expect(await canUserDecideNoteFrais("u-admin")).toBe(true);
    expect(resolveActionPermissionConfig).not.toHaveBeenCalled();
  });
});

describe("decideNoteFrais", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    canWrite.mockResolvedValue(false);
    resolveActionPermissionConfig.mockResolvedValue({ status: "absent" });
    userFindUnique.mockResolvedValue({ role: "TRESOR", status: "Actif" });
    userAdminRoleFindMany.mockResolvedValue([]);
    noteFindFirst.mockResolvedValue(null);
    $executeRaw.mockResolvedValue(undefined);
    typeDepenseFindFirst.mockResolvedValue({
      id: "td-fa",
      code: "FRAIS_AVANCE",
      actif: true,
    });
    depenseFindUnique.mockResolvedValue(null);
    depenseCreate.mockResolvedValue({ id: "dep1" });
    decisionCreate.mockResolvedValue({});
    notifCreate.mockResolvedValue({});
    outboxCreate.mockResolvedValue({});
    noteUpdateMany.mockResolvedValue({ count: 1 });
  });

  it("refuse auto-décision", async () => {
    noteFindUnique.mockResolvedValue(baseSoumise({ demandeurUserId: "actor" }));
    const res = await decideNoteFrais({
      actorUserId: "actor",
      noteId: "n1",
      expectedVersion: 2,
      idempotencyKey: "decide-key-01",
      outcome: "VALIDEE",
      montantAccepte: 40,
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.code).toBe("AUTO_DECISION_FORBIDDEN");
    }
  });

  it("idempotence même contenu = succès sans doublon", async () => {
    const decided = {
      ...baseSoumise({
        statut: "VALIDEE",
        version: 3,
        decisionIdempotencyKey: "decide-key-01",
        montantAccepte: new Prisma.Decimal(40),
        montantDemande: new Prisma.Decimal(40),
      }),
      Decision: {
        statutFinal: "VALIDEE",
        montantAccepte: new Prisma.Decimal(40),
        motif: null,
      },
      Justificatifs: [],
      Demandeur: null,
      Adherent: null,
      soumiseAt: new Date(),
      alerteSansDestinataire: false,
      motifDecision: null,
      decideeAt: new Date(),
      decideurUserId: "tres",
      corrigeNoteFraisId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    noteFindFirst.mockResolvedValue(decided);
    noteFindUnique.mockResolvedValue(decided);
    const res = await decideNoteFrais({
      actorUserId: "tres",
      noteId: "n1",
      expectedVersion: 2,
      idempotencyKey: "decide-key-01",
      outcome: "VALIDEE",
      montantAccepte: 40,
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.alreadyDecided).toBe(true);
    }
    expect($transaction).not.toHaveBeenCalled();
    expect(depenseCreate).not.toHaveBeenCalled();
  });

  it("idempotence contenu différent = conflit", async () => {
    noteFindFirst.mockResolvedValue({
      id: "n1",
      demandeurUserId: "dem",
      statut: "VALIDEE",
      version: 3,
      montantDemande: new Prisma.Decimal(40),
      decisionIdempotencyKey: "decide-key-01",
      Decision: {
        statutFinal: "VALIDEE",
        montantAccepte: new Prisma.Decimal(40),
        motif: null,
      },
    });
    noteFindUnique.mockResolvedValue({
      id: "n1",
      demandeurUserId: "dem",
      statut: "VALIDEE",
      version: 3,
      montantDemande: new Prisma.Decimal(40),
      Decision: {
        statutFinal: "VALIDEE",
        montantAccepte: new Prisma.Decimal(40),
        motif: null,
      },
    });
    const res = await decideNoteFrais({
      actorUserId: "tres",
      noteId: "n1",
      expectedVersion: 2,
      idempotencyKey: "decide-key-01",
      outcome: "REJETEE",
      motif: "non",
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.code).toBe("IDEMPOTENCY_CONFLICT");
    }
  });

  it("VALIDEE totale : crée une Depense FRAIS_AVANCE atomique", async () => {
    const soumise = baseSoumise();
    noteFindUnique
      .mockResolvedValueOnce(soumise)
      .mockResolvedValueOnce(soumise)
      .mockResolvedValueOnce({
        ...soumise,
        statut: "VALIDEE",
        version: 3,
        montantAccepte: new Prisma.Decimal(100),
        Decision: {
          statutFinal: "VALIDEE",
          montantAccepte: new Prisma.Decimal(100),
          motif: null,
        },
        Justificatifs: [],
        Demandeur: null,
        Adherent: null,
        soumiseAt: new Date(),
        alerteSansDestinataire: false,
        motifDecision: null,
        decideeAt: new Date(),
        decideurUserId: "tres",
        corrigeNoteFraisId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    mockTxHappyPath();

    const res = await decideNoteFrais({
      actorUserId: "tres",
      noteId: "n1",
      expectedVersion: 2,
      idempotencyKey: "decide-val-total",
      outcome: "VALIDEE",
      montantAccepte: 100,
    });
    expect(res.success).toBe(true);
    expect(depenseCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          origine: "FRAIS_AVANCE",
          noteFraisId: "n1",
          typeDepenseId: "td-fa",
          statut: "Valide",
          createdBy: "tres",
          validatedBy: "tres",
          montant: expect.any(Prisma.Decimal),
        }),
      })
    );
    expect(decisionCreate).toHaveBeenCalled();
    expect(notifCreate).toHaveBeenCalled();
    expect(outboxCreate).toHaveBeenCalled();
  });

  it("VALIDEE partielle : Depense au montantAccepte", async () => {
    const soumise = baseSoumise();
    noteFindUnique
      .mockResolvedValueOnce(soumise)
      .mockResolvedValueOnce(soumise)
      .mockResolvedValueOnce({
        ...soumise,
        statut: "VALIDEE",
        version: 3,
        montantAccepte: new Prisma.Decimal(60),
        Decision: {
          statutFinal: "VALIDEE",
          montantAccepte: new Prisma.Decimal(60),
          motif: "partiel",
        },
        Justificatifs: [],
        Demandeur: null,
        Adherent: null,
        soumiseAt: new Date(),
        alerteSansDestinataire: false,
        motifDecision: "partiel",
        decideeAt: new Date(),
        decideurUserId: "tres",
        corrigeNoteFraisId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    mockTxHappyPath();

    const res = await decideNoteFrais({
      actorUserId: "tres",
      noteId: "n1",
      expectedVersion: 2,
      idempotencyKey: "decide-val-part",
      outcome: "VALIDEE",
      montantAccepte: 60,
      motif: "partiel",
    });
    expect(res.success).toBe(true);
    const arg = depenseCreate.mock.calls[0]?.[0] as {
      data: { montant: Prisma.Decimal };
    };
    expect(arg.data.montant.toFixed(2)).toBe("60.00");
  });

  it("REJETEE : aucune Depense", async () => {
    const soumise = baseSoumise();
    noteFindUnique
      .mockResolvedValueOnce(soumise)
      .mockResolvedValueOnce(soumise)
      .mockResolvedValueOnce({
        ...soumise,
        statut: "REJETEE",
        version: 3,
        Decision: {
          statutFinal: "REJETEE",
          montantAccepte: null,
          motif: "illisible",
        },
        Justificatifs: [],
        Demandeur: null,
        Adherent: null,
        soumiseAt: new Date(),
        alerteSansDestinataire: false,
        motifDecision: "illisible",
        decideeAt: new Date(),
        decideurUserId: "tres",
        corrigeNoteFraisId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    mockTxHappyPath();

    const res = await decideNoteFrais({
      actorUserId: "tres",
      noteId: "n1",
      expectedVersion: 2,
      idempotencyKey: "decide-rej",
      outcome: "REJETEE",
      motif: "illisible",
    });
    expect(res.success).toBe(true);
    expect(typeDepenseFindFirst).not.toHaveBeenCalled();
    expect(depenseCreate).not.toHaveBeenCalled();
  });

  it("TypeDepense absent : rollback (pas de claim/écritures)", async () => {
    const soumise = baseSoumise();
    noteFindUnique.mockResolvedValue(soumise);
    typeDepenseFindFirst.mockResolvedValue(null);
    mockTxHappyPath();

    const res = await decideNoteFrais({
      actorUserId: "tres",
      noteId: "n1",
      expectedVersion: 2,
      idempotencyKey: "decide-no-type",
      outcome: "VALIDEE",
      montantAccepte: 100,
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.code).toBe("TYPE_DEPENSE_FRAIS_AVANCE_ABSENT");
      expect(res.error).toBe(NOTES_FRAIS_TYPE_DEPENSE_ABSENT);
    }
    expect(noteUpdateMany).not.toHaveBeenCalled();
    expect(decisionCreate).not.toHaveBeenCalled();
    expect(depenseCreate).not.toHaveBeenCalled();
    expect(notifCreate).not.toHaveBeenCalled();
    expect(outboxCreate).not.toHaveBeenCalled();
  });
});

describe("createCorrectedNoteFraisDraft", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("refuse si note non REJETEE", async () => {
    noteFindFirst.mockResolvedValue(null);
    const res = await createCorrectedNoteFraisDraft({
      userId: "u1",
      corrigeNoteFraisId: "n1",
    });
    expect(res.success).toBe(false);
  });

  it("crée un brouillon lié", async () => {
    noteFindFirst.mockResolvedValue({
      id: "n-rej",
      libelle: "Ancien",
      description: "d",
      dateDepense: new Date("2026-01-01"),
      montantDemande: new Prisma.Decimal(12),
      statut: "REJETEE",
    });
    userFindUnique.mockResolvedValue({ adherent: { id: "adh1" } });
    $transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
      const tx = {
        $executeRaw,
        noteFrais: { create: noteCreate },
      };
      return fn(tx);
    });
    noteCreate.mockResolvedValue({ id: "n-new", version: 1 });
    const res = await createCorrectedNoteFraisDraft({
      userId: "u1",
      corrigeNoteFraisId: "n-rej",
    });
    expect(res.success).toBe(true);
    expect(noteCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          corrigeNoteFraisId: "n-rej",
          statut: "BROUILLON",
        }),
      })
    );
  });
});
