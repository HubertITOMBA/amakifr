import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const {
  $transaction,
  $executeRaw,
  noteFindUnique,
  noteUpdateMany,
  choixFindFirst,
  choixFindUniqueOrThrow,
  choixUpdate,
  cibleUpdate,
  operationFindUnique,
  operationCreate,
  reglementCreate,
  ligneCreate,
  avoirCreate,
  utilisationCreate,
  detteFindFirst,
  detteFindUniqueOrThrow,
  detteUpdate,
  cmFindFirst,
  cmFindUniqueOrThrow,
  cmUpdate,
  userFindUnique,
  userAdminRoleFindMany,
  resolveActionPermissionConfig,
} = vi.hoisted(() => ({
  $transaction: vi.fn(),
  $executeRaw: vi.fn(),
  noteFindUnique: vi.fn(),
  noteUpdateMany: vi.fn(),
  choixFindFirst: vi.fn(),
  choixFindUniqueOrThrow: vi.fn(),
  choixUpdate: vi.fn(),
  cibleUpdate: vi.fn(),
  operationFindUnique: vi.fn(),
  operationCreate: vi.fn(),
  reglementCreate: vi.fn(),
  ligneCreate: vi.fn(),
  avoirCreate: vi.fn(),
  utilisationCreate: vi.fn(),
  detteFindFirst: vi.fn(),
  detteFindUniqueOrThrow: vi.fn(),
  detteUpdate: vi.fn(),
  cmFindFirst: vi.fn(),
  cmFindUniqueOrThrow: vi.fn(),
  cmUpdate: vi.fn(),
  userFindUnique: vi.fn(),
  userAdminRoleFindMany: vi.fn(),
  resolveActionPermissionConfig: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    $transaction: (...a: unknown[]) => $transaction(...a),
    $executeRaw: (...a: unknown[]) => $executeRaw(...a),
    noteFrais: {
      findUnique: (...a: unknown[]) => noteFindUnique(...a),
      updateMany: (...a: unknown[]) => noteUpdateMany(...a),
    },
    noteFraisChoixReglement: {
      findFirst: (...a: unknown[]) => choixFindFirst(...a),
      findUniqueOrThrow: (...a: unknown[]) => choixFindUniqueOrThrow(...a),
      update: (...a: unknown[]) => choixUpdate(...a),
    },
    noteFraisChoixReglementCible: {
      update: (...a: unknown[]) => cibleUpdate(...a),
    },
    noteFraisReglementOperation: {
      findUnique: (...a: unknown[]) => operationFindUnique(...a),
      create: (...a: unknown[]) => operationCreate(...a),
    },
    noteFraisReglement: { create: (...a: unknown[]) => reglementCreate(...a) },
    noteFraisReglementLigne: { create: (...a: unknown[]) => ligneCreate(...a) },
    avoir: { create: (...a: unknown[]) => avoirCreate(...a) },
    utilisationAvoir: { create: (...a: unknown[]) => utilisationCreate(...a) },
    detteInitiale: {
      findFirst: (...a: unknown[]) => detteFindFirst(...a),
      findUniqueOrThrow: (...a: unknown[]) => detteFindUniqueOrThrow(...a),
      update: (...a: unknown[]) => detteUpdate(...a),
    },
    cotisationMensuelle: {
      findFirst: (...a: unknown[]) => cmFindFirst(...a),
      findUniqueOrThrow: (...a: unknown[]) => cmFindUniqueOrThrow(...a),
      update: (...a: unknown[]) => cmUpdate(...a),
    },
    user: { findUnique: (...a: unknown[]) => userFindUnique(...a) },
    userAdminRole: { findMany: (...a: unknown[]) => userAdminRoleFindMany(...a) },
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
  canWrite: vi.fn().mockResolvedValue(false),
  resolveActionPermissionConfig: (...a: unknown[]) =>
    resolveActionPermissionConfig(...a),
}));

import { executeNoteFraisReglementMixte } from "@/lib/services/frais-avances/note-frais-mixte-service";
import { canUserExecuteNoteFraisReglementMixte } from "@/lib/frais-avances/authz";

const executeAtIso = "2026-06-01T12:00:00.000Z";
const clock = { now: () => new Date("2026-06-01T12:00:00.000Z") };

function completeOperationFixture(overrides?: {
  noteFraisId?: string;
  referenceNormalisee?: string;
  rembMontant?: string;
  rang?: number;
  omitComp?: boolean;
  omitRemb?: boolean;
  onlyCompTwice?: boolean;
}) {
  const noteFraisId = overrides?.noteFraisId ?? "n1";
  const ref = overrides?.referenceNormalisee ?? "VIR-1";
  const rembMontant = overrides?.rembMontant ?? "40.00";
  const rang = overrides?.rang ?? 1;
  const remb = {
    id: "reg-remb",
    type: "REMBOURSEMENT",
    montantTotal: new Prisma.Decimal(rembMontant),
    moyen: "VIREMENT",
    referenceNormalisee: ref,
    executeAt: new Date(executeAtIso),
    Lignes: [] as Array<{
      typeCible: string | null;
      cibleId: string | null;
      montant: Prisma.Decimal;
      rang: number;
    }>,
  };
  const comp = {
    id: "reg-comp",
    type: "COMPENSATION",
    montantTotal: new Prisma.Decimal("60.00"),
    moyen: null as string | null,
    referenceNormalisee: null as string | null,
    executeAt: new Date(executeAtIso),
    Lignes: [
      {
        typeCible: "DETTE_INITIALE",
        cibleId: "d1",
        montant: new Prisma.Decimal("60.00"),
        rang,
      },
    ],
  };
  let Reglements = [comp, remb];
  if (overrides?.omitComp) Reglements = [remb];
  if (overrides?.omitRemb) Reglements = [comp];
  if (overrides?.onlyCompTwice) Reglements = [comp, { ...comp, id: "reg-comp-2" }];
  return {
    id: "op1",
    noteFraisId,
    choixId: "ch1",
    executeAt: new Date(executeAtIso),
    Reglements,
  };
}

const baseMixteInput = {
  actorUserId: "tres",
  noteId: "n1",
  expectedNoteVersion: 3,
  idempotencyKey: "mixte-key-replay",
  montantRembourse: "40.00",
  moyen: "VIREMENT" as const,
  reference: "VIR-1",
  executeAt: executeAtIso,
  lignesCompensation: [
    {
      typeCible: "DETTE_INITIALE" as const,
      cibleId: "d1",
      montant: "60.00",
      rang: 1,
    },
  ],
  clock,
};

describe("canUserExecuteNoteFraisReglementMixte", () => {
  beforeEach(() => {
    userAdminRoleFindMany.mockResolvedValue([]);
    resolveActionPermissionConfig.mockResolvedValue({ status: "absent" });
  });

  it("TRESOR ok ; COMCPT/MEMBRE refusés", async () => {
    userFindUnique.mockResolvedValue({ role: "TRESOR", status: "Actif" });
    expect(await canUserExecuteNoteFraisReglementMixte("t")).toBe(true);
    userFindUnique.mockResolvedValue({ role: "COMCPT", status: "Actif" });
    expect(await canUserExecuteNoteFraisReglementMixte("c")).toBe(false);
    userFindUnique.mockResolvedValue({ role: "MEMBRE", status: "Actif" });
    expect(await canUserExecuteNoteFraisReglementMixte("m")).toBe(false);
  });
});

describe("executeNoteFraisReglementMixte", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveActionPermissionConfig.mockResolvedValue({ status: "absent" });
    userFindUnique.mockResolvedValue({ role: "TRESOR", status: "Actif" });
    userAdminRoleFindMany.mockResolvedValue([]);
    operationFindUnique.mockResolvedValue(null);
    $executeRaw.mockResolvedValue(undefined);
    noteUpdateMany.mockResolvedValue({ count: 1 });
    operationCreate.mockResolvedValue({ id: "op1" });
    reglementCreate
      .mockResolvedValueOnce({ id: "reg-comp" })
      .mockResolvedValueOnce({ id: "reg-remb" });
    ligneCreate.mockResolvedValue({ id: "lig1" });
    avoirCreate.mockResolvedValue({ id: "av1" });
    utilisationCreate.mockResolvedValue({ id: "ut1" });
    cibleUpdate.mockResolvedValue({});
    choixUpdate.mockResolvedValue({});
  });

  it("refuse partie nulle (USE_SIMPLE)", async () => {
    const res = await executeNoteFraisReglementMixte({
      actorUserId: "tres",
      noteId: "n1",
      expectedNoteVersion: 3,
      idempotencyKey: "mixte-key-01",
      montantRembourse: "0",
      moyen: "VIREMENT",
      reference: "REF1",
      executeAt: executeAtIso,
      lignesCompensation: [
        {
          typeCible: "DETTE_INITIALE",
          cibleId: "d1",
          montant: "10",
          rang: 1,
        },
      ],
      clock,
    });
    expect(res.success).toBe(false);
    if (!res.success) expect(res.code).toBe("USE_SIMPLE_SERVICE");
  });

  it("refuse auto-exécution", async () => {
    noteFindUnique.mockResolvedValue({
      id: "n1",
      statut: "VALIDEE",
      version: 3,
      demandeurUserId: "actor",
      decideeAt: new Date("2026-05-01"),
      montantAccepte: new Prisma.Decimal(100),
      adherentId: "adh1",
    });
    const res = await executeNoteFraisReglementMixte({
      actorUserId: "actor",
      noteId: "n1",
      expectedNoteVersion: 3,
      idempotencyKey: "mixte-key-02",
      montantRembourse: "40",
      moyen: "VIREMENT",
      reference: "REF1",
      executeAt: executeAtIso,
      lignesCompensation: [
        {
          typeCible: "DETTE_INITIALE",
          cibleId: "d1",
          montant: "60",
          rang: 1,
        },
      ],
      clock,
    });
    expect(res.success).toBe(false);
    if (!res.success) expect(res.code).toBe("AUTO_EXECUTION_FORBIDDEN");
  });

  it("succès frais : crée opération + 2 enfants (idempotency null)", async () => {
    const decideeAt = new Date("2026-05-01T00:00:00.000Z");
    noteFindUnique.mockResolvedValue({
      id: "n1",
      statut: "VALIDEE",
      version: 3,
      demandeurUserId: "dem",
      decideeAt,
      montantAccepte: new Prisma.Decimal(100),
      adherentId: "adh1",
    });
    const choixRow = {
      id: "ch1",
      mode: "MIXTE",
      montantRemboursement: new Prisma.Decimal(40),
      montantCompensation: new Prisma.Decimal(60),
      montantRembourseUtilise: new Prisma.Decimal(0),
      montantCompensationUtilise: new Prisma.Decimal(0),
      Cibles: [
        {
          id: "cc1",
          typeCible: "DETTE_INITIALE",
          cibleId: "d1",
          montantAutorise: new Prisma.Decimal(60),
          montantUtilise: new Prisma.Decimal(0),
        },
      ],
    };
    choixFindFirst.mockResolvedValue(choixRow);
    choixFindUniqueOrThrow.mockResolvedValue(choixRow);
    detteFindFirst.mockResolvedValue({
      id: "d1",
      montantRestant: new Prisma.Decimal(80),
      montantPaye: new Prisma.Decimal(0),
    });
    detteFindUniqueOrThrow.mockResolvedValue({
      id: "d1",
      montantPaye: new Prisma.Decimal(0),
      montantRestant: new Prisma.Decimal(80),
    });
    detteUpdate.mockResolvedValue({});
    detteFindUniqueOrThrow
      .mockResolvedValueOnce({
        id: "d1",
        montantPaye: new Prisma.Decimal(0),
        montantRestant: new Prisma.Decimal(80),
      })
      .mockResolvedValueOnce({
        id: "d1",
        montantRestant: new Prisma.Decimal(20),
      });

    $transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        $executeRaw,
        noteFrais: {
          findUnique: noteFindUnique,
          updateMany: noteUpdateMany,
        },
        noteFraisChoixReglement: {
          findFirst: choixFindFirst,
          findUniqueOrThrow: choixFindUniqueOrThrow,
          update: choixUpdate,
        },
        noteFraisChoixReglementCible: { update: cibleUpdate },
        noteFraisReglementOperation: {
          findUnique: operationFindUnique,
          create: operationCreate,
        },
        noteFraisReglement: { create: reglementCreate },
        noteFraisReglementLigne: { create: ligneCreate },
        avoir: { create: avoirCreate },
        utilisationAvoir: { create: utilisationCreate },
        detteInitiale: {
          findFirst: detteFindFirst,
          findUniqueOrThrow: detteFindUniqueOrThrow,
          update: detteUpdate,
        },
        cotisationMensuelle: {
          findFirst: cmFindFirst,
          findUniqueOrThrow: cmFindUniqueOrThrow,
          update: cmUpdate,
        },
      };
      return fn(tx);
    });

    const res = await executeNoteFraisReglementMixte({
      actorUserId: "tres",
      noteId: "n1",
      expectedNoteVersion: 3,
      idempotencyKey: "mixte-key-ok",
      montantRembourse: "40.00",
      moyen: "VIREMENT",
      reference: "VIR-1",
      executeAt: executeAtIso,
      lignesCompensation: [
        {
          typeCible: "DETTE_INITIALE",
          cibleId: "d1",
          montant: "60.00",
          rang: 1,
        },
      ],
      clock,
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.operationId).toBe("op1");
      expect(res.data.compensation.reglementId).toBe("reg-comp");
      expect(res.data.remboursement.reglementId).toBe("reg-remb");
      expect(res.data.executeAt).toBe(executeAtIso);
    }
    expect(operationCreate).toHaveBeenCalled();
    const compCreate = reglementCreate.mock.calls[0]?.[0]?.data;
    const rembCreate = reglementCreate.mock.calls[1]?.[0]?.data;
    expect(compCreate.idempotencyKey).toBeNull();
    expect(rembCreate.idempotencyKey).toBeNull();
    expect(compCreate.operationId).toBe("op1");
    expect(rembCreate.operationId).toBe("op1");
    expect(compCreate.executeAt.toISOString()).toBe(executeAtIso);
    expect(rembCreate.executeAt.toISOString()).toBe(executeAtIso);
  });

  it("replay même contenu → alreadyExecuted", async () => {
    operationFindUnique.mockResolvedValue(completeOperationFixture());
    noteFindUnique.mockResolvedValue({ version: 4, demandeurUserId: "dem" });
    const res = await executeNoteFraisReglementMixte(baseMixteInput);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.alreadyExecuted).toBe(true);
      expect(res.data.operationId).toBe("op1");
    }
    expect($transaction).not.toHaveBeenCalled();
  });

  it("replay : contenu canonique (rang / date / référence) — conflit si différent", async () => {
    operationFindUnique.mockResolvedValue(
      completeOperationFixture({ rang: 2, referenceNormalisee: "VIR-1" })
    );
    noteFindUnique.mockResolvedValue({ version: 4, demandeurUserId: "dem" });
    const res = await executeNoteFraisReglementMixte(baseMixteInput);
    expect(res.success).toBe(false);
    if (!res.success) expect(res.code).toBe("IDEMPOTENCY_CONFLICT");
  });

  it("replay : référence normalisée différente → CONFLICT", async () => {
    operationFindUnique.mockResolvedValue(
      completeOperationFixture({ referenceNormalisee: "OTHER" })
    );
    noteFindUnique.mockResolvedValue({ version: 4, demandeurUserId: "dem" });
    const res = await executeNoteFraisReglementMixte(baseMixteInput);
    expect(res.success).toBe(false);
    if (!res.success) expect(res.code).toBe("IDEMPOTENCY_CONFLICT");
  });

  it("parent incomplet → NOTES_FRAIS_MIXTE_OPERATION_INCOMPLETE", async () => {
    operationFindUnique.mockResolvedValue(
      completeOperationFixture({ omitComp: true })
    );
    noteFindUnique.mockResolvedValue({ version: 4, demandeurUserId: "dem" });
    const res = await executeNoteFraisReglementMixte(baseMixteInput);
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.code).toBe("NOTES_FRAIS_MIXTE_OPERATION_INCOMPLETE");
    }
    expect($transaction).not.toHaveBeenCalled();
  });

  it("parent avec deux COMPENSATION → OPERATION_INCOMPLETE", async () => {
    operationFindUnique.mockResolvedValue(
      completeOperationFixture({ onlyCompTwice: true })
    );
    noteFindUnique.mockResolvedValue({ version: 4, demandeurUserId: "dem" });
    const res = await executeNoteFraisReglementMixte(baseMixteInput);
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.code).toBe("NOTES_FRAIS_MIXTE_OPERATION_INCOMPLETE");
    }
  });

  it("replay : authz MEMBRE refusée", async () => {
    operationFindUnique.mockResolvedValue(completeOperationFixture());
    noteFindUnique.mockResolvedValue({ version: 4, demandeurUserId: "dem" });
    userFindUnique.mockResolvedValue({ role: "MEMBRE", status: "Actif" });
    const res = await executeNoteFraisReglementMixte({
      ...baseMixteInput,
      actorUserId: "membre",
    });
    expect(res.success).toBe(false);
    if (!res.success) expect(res.code).toBe("FORBIDDEN");
  });

  it("P2002 idempotencyKey → succès alreadyExecuted après relecture", async () => {
    const decidee = new Date("2026-05-01T00:00:00.000Z");
    noteFindUnique
      .mockResolvedValueOnce({
        id: "n1",
        statut: "VALIDEE",
        version: 3,
        demandeurUserId: "dem",
        decideeAt: decidee,
        montantAccepte: new Prisma.Decimal(100),
        adherentId: "adh1",
      })
      .mockResolvedValueOnce({ version: 4, demandeurUserId: "dem" });
    operationFindUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(completeOperationFixture());
    $transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique", {
        code: "P2002",
        clientVersion: "test",
        meta: { target: ["idempotencyKey"] },
      })
    );
    const res = await executeNoteFraisReglementMixte(baseMixteInput);
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.alreadyExecuted).toBe(true);
  });

  it("P2002 autre contrainte → propagé (pas de replay)", async () => {
    const decidee = new Date("2026-05-01T00:00:00.000Z");
    noteFindUnique.mockResolvedValue({
      id: "n1",
      statut: "VALIDEE",
      version: 3,
      demandeurUserId: "dem",
      decideeAt: decidee,
      montantAccepte: new Prisma.Decimal(100),
      adherentId: "adh1",
    });
    operationFindUnique.mockResolvedValue(null);
    $transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique other", {
        code: "P2002",
        clientVersion: "test",
        meta: { target: ["someOtherUnique"] },
      })
    );
    const res = await executeNoteFraisReglementMixte(baseMixteInput);
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.code).not.toBe("IDEMPOTENCY_CONFLICT");
      expect(res.data).toBeUndefined();
    }
  });

  it("P2002 unique(operationId,type) → non transformé en replay", async () => {
    const decidee = new Date("2026-05-01T00:00:00.000Z");
    noteFindUnique.mockResolvedValue({
      id: "n1",
      statut: "VALIDEE",
      version: 3,
      demandeurUserId: "dem",
      decideeAt: decidee,
      montantAccepte: new Prisma.Decimal(100),
      adherentId: "adh1",
    });
    operationFindUnique.mockResolvedValue(null);
    $transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique child type", {
        code: "P2002",
        clientVersion: "test",
        meta: { target: ["operationId", "type"] },
      })
    );
    const res = await executeNoteFraisReglementMixte(baseMixteInput);
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.code).not.toBe("IDEMPOTENCY_CONFLICT");
      expect((res as { data?: unknown }).data).toBeUndefined();
    }
  });
});
