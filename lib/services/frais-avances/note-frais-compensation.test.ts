import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const {
  $transaction,
  $executeRaw,
  noteFindUnique,
  noteUpdateMany,
  reglementFindUnique,
  reglementCreate,
  ligneCreate,
  avoirCreate,
  utilisationCreate,
  choixFindFirst,
  choixFindUnique,
  choixUpdate,
  cibleUpdate,
  detteFindFirst,
  detteFindUnique,
  detteUpdate,
  cmFindFirst,
  cmFindUnique,
  cmUpdate,
  userFindUnique,
  userAdminRoleFindMany,
  resolveActionPermissionConfig,
} = vi.hoisted(() => ({
  $transaction: vi.fn(),
  $executeRaw: vi.fn(),
  noteFindUnique: vi.fn(),
  noteUpdateMany: vi.fn(),
  reglementFindUnique: vi.fn(),
  reglementCreate: vi.fn(),
  ligneCreate: vi.fn(),
  avoirCreate: vi.fn(),
  utilisationCreate: vi.fn(),
  choixFindFirst: vi.fn(),
  choixFindUnique: vi.fn(),
  choixUpdate: vi.fn(),
  cibleUpdate: vi.fn(),
  detteFindFirst: vi.fn(),
  detteFindUnique: vi.fn(),
  detteUpdate: vi.fn(),
  cmFindFirst: vi.fn(),
  cmFindUnique: vi.fn(),
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
      findUniqueOrThrow: (...a: unknown[]) => noteFindUnique(...a),
      updateMany: (...a: unknown[]) => noteUpdateMany(...a),
    },
    noteFraisReglement: {
      findUnique: (...a: unknown[]) => reglementFindUnique(...a),
      create: (...a: unknown[]) => reglementCreate(...a),
    },
    noteFraisReglementLigne: {
      create: (...a: unknown[]) => ligneCreate(...a),
    },
    avoir: { create: (...a: unknown[]) => avoirCreate(...a) },
    utilisationAvoir: { create: (...a: unknown[]) => utilisationCreate(...a) },
    noteFraisChoixReglement: {
      findFirst: (...a: unknown[]) => choixFindFirst(...a),
      findUnique: (...a: unknown[]) => choixFindUnique(...a),
      findUniqueOrThrow: (...a: unknown[]) => choixFindUnique(...a),
      update: (...a: unknown[]) => choixUpdate(...a),
    },
    noteFraisChoixReglementCible: {
      update: (...a: unknown[]) => cibleUpdate(...a),
    },
    detteInitiale: {
      findFirst: (...a: unknown[]) => detteFindFirst(...a),
      findUnique: (...a: unknown[]) => detteFindUnique(...a),
      findUniqueOrThrow: (...a: unknown[]) => detteFindUnique(...a),
      update: (...a: unknown[]) => detteUpdate(...a),
    },
    cotisationMensuelle: {
      findFirst: (...a: unknown[]) => cmFindFirst(...a),
      findUnique: (...a: unknown[]) => cmFindUnique(...a),
      findUniqueOrThrow: (...a: unknown[]) => cmFindUnique(...a),
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

import {
  executeNoteFraisCompensation,
  normalizeCompensationLignes,
  sumNormalizedLignes,
} from "@/lib/services/frais-avances/note-frais-compensation-service";
import { canUserExecuteNoteFraisCompensation } from "@/lib/frais-avances/authz";
import { withCompensationsNotesFrais } from "@/lib/financial/synthese-charges";

const existingReglement = {
  id: "reg1",
  noteFraisId: "n1",
  choixId: "ch1",
  type: "COMPENSATION",
  montantTotal: new Prisma.Decimal(10),
  Lignes: [
    {
      typeCible: "DETTE_INITIALE",
      cibleId: "d1",
      montant: new Prisma.Decimal(10),
      rang: 1,
    },
  ],
};

describe("normalizeCompensationLignes", () => {
  it("exige montants > 0 et somme exacte", () => {
    const n = normalizeCompensationLignes([
      {
        typeCible: "DETTE_INITIALE",
        cibleId: "d1",
        montant: 10.5,
        rang: 2,
      },
      {
        typeCible: "COTISATION_MENSUELLE",
        cibleId: "c1",
        montant: 5,
        rang: 1,
      },
    ]);
    expect(n[0]!.rang).toBe(1);
    expect(sumNormalizedLignes(n)).toBe("15.50");
    expect(() =>
      normalizeCompensationLignes([
        { typeCible: "DETTE_INITIALE", cibleId: "d1", montant: 0, rang: 1 },
      ])
    ).toThrow(/strictement positif/);
  });
});

describe("canUserExecuteNoteFraisCompensation", () => {
  beforeEach(() => {
    userAdminRoleFindMany.mockResolvedValue([]);
    resolveActionPermissionConfig.mockResolvedValue({ status: "absent" });
  });

  it("autorise TRESOR ; refuse MEMBRE même avec permission", async () => {
    userFindUnique.mockResolvedValue({ role: "TRESOR", status: "Actif" });
    expect(await canUserExecuteNoteFraisCompensation("t")).toBe(true);
    userFindUnique.mockResolvedValue({ role: "MEMBRE", status: "Actif" });
    resolveActionPermissionConfig.mockResolvedValue({
      status: "configured",
      roles: ["MEMBRE", "TRESOR"],
    });
    expect(await canUserExecuteNoteFraisCompensation("m")).toBe(false);
  });

  it("refuse COMCPT, PRESID, SECRET", async () => {
    for (const role of ["COMCPT", "PRESID", "SECRET"] as const) {
      userFindUnique.mockResolvedValue({ role, status: "Actif" });
      resolveActionPermissionConfig.mockResolvedValue({
        status: "configured",
        roles: ["COMCPT", "PRESID", "SECRET", "TRESOR", "ADMIN"],
      });
      expect(await canUserExecuteNoteFraisCompensation(`u-${role}`)).toBe(
        false
      );
    }
  });

  it("autorise rôle additionnel TRESOR", async () => {
    userFindUnique.mockResolvedValue({ role: "MEMBRE", status: "Actif" });
    userAdminRoleFindMany.mockResolvedValue([{ role: "TRESOR" }]);
    expect(await canUserExecuteNoteFraisCompensation("u-extra")).toBe(true);
  });

  it("refuse TRESOR si permission disabled ; ADMIN principal bypass", async () => {
    userFindUnique.mockResolvedValue({ role: "TRESOR", status: "Actif" });
    resolveActionPermissionConfig.mockResolvedValue({ status: "disabled" });
    expect(await canUserExecuteNoteFraisCompensation("u-tresor")).toBe(false);

    userFindUnique.mockResolvedValue({ role: "ADMIN", status: "Actif" });
    resolveActionPermissionConfig.mockClear();
    resolveActionPermissionConfig.mockResolvedValue({ status: "disabled" });
    expect(await canUserExecuteNoteFraisCompensation("u-admin")).toBe(true);
    expect(resolveActionPermissionConfig).not.toHaveBeenCalled();
  });

  it("refuse TRESOR si configurée sans son rôle", async () => {
    userFindUnique.mockResolvedValue({ role: "TRESOR", status: "Actif" });
    resolveActionPermissionConfig.mockResolvedValue({
      status: "configured",
      roles: ["ADMIN"],
    });
    expect(await canUserExecuteNoteFraisCompensation("u-tresor")).toBe(false);
  });
});

describe("withCompensationsNotesFrais", () => {
  it("augmente compensations sans toucher solde inputs", () => {
    const base = {
      totalCharges: 100,
      depensesOrdinairesDecaissees: 40,
      decaissementsNotesFrais: 0,
      compensationsNotesFrais: 0,
      restitutionsNotesFrais: 0,
      restantDuNotesFrais: 0,
    };
    const w = withCompensationsNotesFrais(base, 25);
    expect(w.compensationsNotesFrais).toBe(25);
    expect(w.depensesOrdinairesDecaissees).toBe(40);
  });
});

describe("executeNoteFraisCompensation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveActionPermissionConfig.mockResolvedValue({ status: "absent" });
    userFindUnique.mockResolvedValue({ role: "TRESOR", status: "Actif" });
    userAdminRoleFindMany.mockResolvedValue([]);
    reglementFindUnique.mockResolvedValue(null);
    $executeRaw.mockResolvedValue(undefined);
    noteUpdateMany.mockResolvedValue({ count: 1 });
    reglementCreate.mockResolvedValue({
      id: "reg1",
      choixId: "ch1",
      montantTotal: new Prisma.Decimal(30),
    });
    ligneCreate.mockResolvedValue({ id: "lig1" });
    avoirCreate.mockResolvedValue({ id: "av1" });
    utilisationCreate.mockResolvedValue({ id: "ua1" });
    cibleUpdate.mockResolvedValue({});
    choixUpdate.mockResolvedValue({});
  });

  it("refuse auto-exécution", async () => {
    noteFindUnique.mockResolvedValue({
      id: "n1",
      statut: "VALIDEE",
      version: 3,
      demandeurUserId: "actor",
      adherentId: "adh",
    });
    const res = await executeNoteFraisCompensation({
      actorUserId: "actor",
      noteId: "n1",
      expectedNoteVersion: 3,
      idempotencyKey: "comp-key-01",
      lignes: [
        {
          typeCible: "DETTE_INITIALE",
          cibleId: "d1",
          montant: 10,
          rang: 1,
        },
      ],
    });
    expect(res.success).toBe(false);
    if (!res.success) expect(res.code).toBe("AUTO_EXECUTION_FORBIDDEN");
  });

  it("idempotence même contenu : authz TRESOR puis succès hors TX", async () => {
    reglementFindUnique.mockResolvedValue(existingReglement);
    noteFindUnique.mockResolvedValue({
      version: 4,
      demandeurUserId: "dem",
    });
    const res = await executeNoteFraisCompensation({
      actorUserId: "tres",
      noteId: "n1",
      expectedNoteVersion: 3,
      idempotencyKey: "comp-key-01",
      lignes: [
        {
          typeCible: "DETTE_INITIALE",
          cibleId: "d1",
          montant: 10,
          rang: 1,
        },
      ],
    });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.alreadyExecuted).toBe(true);
    expect($transaction).not.toHaveBeenCalled();
    expect(userFindUnique).toHaveBeenCalled();
  });

  it("replay refuse MEMBRE même avec clé connue", async () => {
    reglementFindUnique.mockResolvedValue(existingReglement);
    noteFindUnique.mockResolvedValue({
      version: 4,
      demandeurUserId: "dem",
    });
    userFindUnique.mockResolvedValue({ role: "MEMBRE", status: "Actif" });
    const res = await executeNoteFraisCompensation({
      actorUserId: "membre",
      noteId: "n1",
      expectedNoteVersion: 3,
      idempotencyKey: "comp-key-01",
      lignes: [
        {
          typeCible: "DETTE_INITIALE",
          cibleId: "d1",
          montant: 10,
          rang: 1,
        },
      ],
    });
    expect(res.success).toBe(false);
    if (!res.success) expect(res.code).toBe("FORBIDDEN");
    expect($transaction).not.toHaveBeenCalled();
  });

  it("replay refuse COMCPT / PRESID / SECRET", async () => {
    reglementFindUnique.mockResolvedValue(existingReglement);
    noteFindUnique.mockResolvedValue({
      version: 4,
      demandeurUserId: "dem",
    });
    for (const role of ["COMCPT", "PRESID", "SECRET"] as const) {
      userFindUnique.mockResolvedValue({ role, status: "Actif" });
      const res = await executeNoteFraisCompensation({
        actorUserId: `u-${role}`,
        noteId: "n1",
        expectedNoteVersion: 3,
        idempotencyKey: "comp-key-01",
        lignes: [
          {
            typeCible: "DETTE_INITIALE",
            cibleId: "d1",
            montant: 10,
            rang: 1,
          },
        ],
      });
      expect(res.success).toBe(false);
      if (!res.success) expect(res.code).toBe("FORBIDDEN");
    }
  });

  it("P2002 idempotencyKey : relecture + authz + succès idempotent", async () => {
    noteFindUnique
      .mockResolvedValueOnce({
        id: "n1",
        statut: "VALIDEE",
        version: 3,
        demandeurUserId: "dem",
        adherentId: "adh",
      })
      .mockResolvedValueOnce({
        version: 4,
        demandeurUserId: "dem",
      });
    reglementFindUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(existingReglement);
    $transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint", {
        code: "P2002",
        clientVersion: "test",
        meta: { target: ["idempotencyKey"] },
      })
    );

    const res = await executeNoteFraisCompensation({
      actorUserId: "tres",
      noteId: "n1",
      expectedNoteVersion: 3,
      idempotencyKey: "comp-key-01",
      lignes: [
        {
          typeCible: "DETTE_INITIALE",
          cibleId: "d1",
          montant: 10,
          rang: 1,
        },
      ],
    });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.alreadyExecuted).toBe(true);
  });

  it("P2002 + contenu différent → IDEMPOTENCY_CONFLICT", async () => {
    noteFindUnique
      .mockResolvedValueOnce({
        id: "n1",
        statut: "VALIDEE",
        version: 3,
        demandeurUserId: "dem",
        adherentId: "adh",
      })
      .mockResolvedValueOnce({
        version: 4,
        demandeurUserId: "dem",
      });
    reglementFindUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({
      ...existingReglement,
      Lignes: [
        {
          typeCible: "DETTE_INITIALE",
          cibleId: "d1",
          montant: new Prisma.Decimal(5),
          rang: 1,
        },
      ],
    });
    $transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint", {
        code: "P2002",
        clientVersion: "test",
        meta: { target: ["idempotencyKey"] },
      })
    );

    const res = await executeNoteFraisCompensation({
      actorUserId: "tres",
      noteId: "n1",
      expectedNoteVersion: 3,
      idempotencyKey: "comp-key-01",
      lignes: [
        {
          typeCible: "DETTE_INITIALE",
          cibleId: "d1",
          montant: 10,
          rang: 1,
        },
      ],
    });
    expect(res.success).toBe(false);
    if (!res.success) expect(res.code).toBe("IDEMPOTENCY_CONFLICT");
  });
});
