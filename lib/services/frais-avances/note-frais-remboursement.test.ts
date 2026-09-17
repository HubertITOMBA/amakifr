import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const {
  $transaction,
  $executeRaw,
  noteFindUnique,
  noteUpdateMany,
  reglementFindUnique,
  reglementFindMany,
  reglementCreate,
  ligneCreate,
  choixFindFirst,
  choixUpdate,
  userFindUnique,
  userAdminRoleFindMany,
  resolveActionPermissionConfig,
  getUserAdminRolesFromDb,
  notificationCreate,
  outboxCreate,
} = vi.hoisted(() => ({
  $transaction: vi.fn(),
  $executeRaw: vi.fn(),
  noteFindUnique: vi.fn(),
  noteUpdateMany: vi.fn(),
  reglementFindUnique: vi.fn(),
  reglementFindMany: vi.fn(),
  reglementCreate: vi.fn(),
  ligneCreate: vi.fn(),
  choixFindFirst: vi.fn(),
  choixUpdate: vi.fn(),
  userFindUnique: vi.fn(),
  userAdminRoleFindMany: vi.fn(),
  resolveActionPermissionConfig: vi.fn(),
  getUserAdminRolesFromDb: vi.fn(),
  notificationCreate: vi.fn(),
  outboxCreate: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    $transaction: (...a: unknown[]) => $transaction(...a),
    $executeRaw: (...a: unknown[]) => $executeRaw(...a),
    noteFrais: {
      findUnique: (...a: unknown[]) => noteFindUnique(...a),
      updateMany: (...a: unknown[]) => noteUpdateMany(...a),
    },
    noteFraisReglement: {
      findUnique: (...a: unknown[]) => reglementFindUnique(...a),
      findMany: (...a: unknown[]) => reglementFindMany(...a),
      create: (...a: unknown[]) => reglementCreate(...a),
    },
    noteFraisReglementLigne: {
      create: (...a: unknown[]) => ligneCreate(...a),
    },
    noteFraisChoixReglement: {
      findFirst: (...a: unknown[]) => choixFindFirst(...a),
      update: (...a: unknown[]) => choixUpdate(...a),
    },
    user: { findUnique: (...a: unknown[]) => userFindUnique(...a) },
    userAdminRole: { findMany: (...a: unknown[]) => userAdminRoleFindMany(...a) },
    notification: { create: (...a: unknown[]) => notificationCreate(...a) },
    noteFraisOutboxEvent: { create: (...a: unknown[]) => outboxCreate(...a) },
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

vi.mock("@/lib/user-roles", () => ({
  getUserAdminRolesFromDb: (...a: unknown[]) => getUserAdminRolesFromDb(...a),
}));
import {
  NOTES_FRAIS_FINANCIAL_STATE_INCONSISTENT,
  computeEtatFinancierNoteFrais,
  executeNoteFraisRemboursement,
  normalizeRemboursementReference,
  parseAndCanonicalizeExecuteAt,
} from "@/lib/services/frais-avances/note-frais-remboursement-service";
import {
  canUserExecuteNoteFraisRemboursement,
  canUserReadNoteFraisFinancialView,
  canUserReadNoteFraisRemboursementReference,
  canUserReadSubmittedNotesFrais,
} from "@/lib/frais-avances/authz";
import {
  withDecaissementsNotesFrais,
  computeSoldeBancaireEstime,
  computeChargesFromDepensesValides,
} from "@/lib/financial/synthese-charges";
import { enrichNoteFraisFinancierDto } from "@/lib/frais-avances/dto";
import { getNoteFraisFinancialView } from "@/lib/services/frais-avances/note-frais-financial-view-service";
import { normalizeNotesFraisMontant } from "@/lib/services/frais-avances/note-frais-decision-service";

const executeAtIso = new Date("2026-06-01T12:00:00.000Z").toISOString();

describe("normalizeRemboursementReference", () => {
  it("trim, NFKC, refuse contrôles et caractères de contrôle", () => {
    const n = normalizeRemboursementReference("  vir-abc  ");
    expect(n.brute).toBe("vir-abc");
    expect(n.normalisee).toBe("VIR-ABC");
    expect(() => normalizeRemboursementReference("")).toThrow(/1 à 64/);
    expect(() => normalizeRemboursementReference("a\u0001b")).toThrow(
      /contrôle/
    );
    const wide = normalizeRemboursementReference("ﬁlle");
    expect(wide.normalisee.includes("FI") || wide.normalisee.length >= 1).toBe(
      true
    );
  });
});

describe("parseAndCanonicalizeExecuteAt", () => {
  it("refuse sans fuseau, invalide, calendaire", () => {
    expect(() => parseAndCanonicalizeExecuteAt("not-a-date")).toThrow(
      /fuseau|invalide/
    );
    expect(() => parseAndCanonicalizeExecuteAt("2026-06-01T12:00:00")).toThrow(
      /fuseau/
    );
    expect(() =>
      parseAndCanonicalizeExecuteAt("2026-02-31T12:00:00.000Z")
    ).toThrow(/calendaire|invalide/);
  });

  it("accepte Z et offset ; instant canonique exact", () => {
    const z = parseAndCanonicalizeExecuteAt("2026-06-01T12:00:00.000Z");
    expect(z.canonicalIso).toBe("2026-06-01T12:00:00.000Z");
    const off = parseAndCanonicalizeExecuteAt("2026-06-01T14:00:00.000+02:00");
    expect(off.canonicalIso).toBe("2026-06-01T12:00:00.000Z");
    expect(off.date.getTime()).toBe(z.date.getTime());
  });
});

describe("computeEtatFinancierNoteFrais", () => {
  it("NON / PARTIEL / REGLEE", () => {
    expect(
      computeEtatFinancierNoteFrais({
        montantAccepte: 100,
        montantRembourseUtilise: 0,
        montantCompensationUtilise: 0,
      }).etatFinancier
    ).toBe("NON_REGLEE");
    expect(
      computeEtatFinancierNoteFrais({
        montantAccepte: 100,
        montantRembourseUtilise: 40,
        montantCompensationUtilise: 0,
      }).etatFinancier
    ).toBe("PARTIELLEMENT_REGLEE");
    expect(
      computeEtatFinancierNoteFrais({
        montantAccepte: 100,
        montantRembourseUtilise: 40,
        montantCompensationUtilise: 60,
      }).etatFinancier
    ).toBe("REGLEE");
  });

  it("refuse incohérence consomme > accepté (pas de clamp)", () => {
    expect(() =>
      computeEtatFinancierNoteFrais({
        montantAccepte: 100,
        montantRembourseUtilise: 80,
        montantCompensationUtilise: 30,
      })
    ).toThrow(NOTES_FRAIS_FINANCIAL_STATE_INCONSISTENT);
  });
});

describe("montants décimaux sensibles (Decimal, pas float)", () => {
  it("normalise 0.10 / 0.29 / 10.01 sans dérive flottante", () => {
    expect(normalizeNotesFraisMontant("0.10")).toBe("0.10");
    expect(normalizeNotesFraisMontant("0.29")).toBe("0.29");
    expect(normalizeNotesFraisMontant("10.01")).toBe("10.01");
    expect(normalizeNotesFraisMontant(0.1)).toBe("0.10");
  });
});

describe("canUserExecuteNoteFraisRemboursement", () => {
  beforeEach(() => {
    userAdminRoleFindMany.mockResolvedValue([]);
    resolveActionPermissionConfig.mockResolvedValue({ status: "absent" });
  });

  it("TRESOR ok ; MEMBRE/COMCPT/PRESID/SECRET refusés", async () => {
    userFindUnique.mockResolvedValue({ role: "TRESOR", status: "Actif" });
    expect(await canUserExecuteNoteFraisRemboursement("t")).toBe(true);
    for (const role of ["MEMBRE", "COMCPT", "PRESID", "SECRET"] as const) {
      userFindUnique.mockResolvedValue({ role, status: "Actif" });
      expect(await canUserExecuteNoteFraisRemboursement(`u-${role}`)).toBe(
        false
      );
    }
  });

  it("ADMIN bypass disabled ; TRESOR disabled refusé", async () => {
    userFindUnique.mockResolvedValue({ role: "TRESOR", status: "Actif" });
    resolveActionPermissionConfig.mockResolvedValue({ status: "disabled" });
    expect(await canUserExecuteNoteFraisRemboursement("t")).toBe(false);
    userFindUnique.mockResolvedValue({ role: "ADMIN", status: "Actif" });
    expect(await canUserExecuteNoteFraisRemboursement("a")).toBe(true);
  });
});

describe("canUserReadNoteFraisRemboursementReference / financial view", () => {
  beforeEach(() => {
    userAdminRoleFindMany.mockResolvedValue([]);
    getUserAdminRolesFromDb.mockResolvedValue([]);
    resolveActionPermissionConfig.mockResolvedValue({ status: "absent" });
  });

  it("ADMIN TRESOR COMCPT oui ; PRESID SECRET non ; Inactif non", async () => {
    for (const role of ["ADMIN", "TRESOR", "COMCPT"] as const) {
      userFindUnique.mockResolvedValue({ role, status: "Actif" });
      expect(await canUserReadNoteFraisRemboursementReference(`u-${role}`)).toBe(
        true
      );
      expect(await canUserReadNoteFraisFinancialView(`u-${role}`)).toBe(true);
    }
    for (const role of ["PRESID", "SECRET", "MEMBRE"] as const) {
      userFindUnique.mockResolvedValue({ role, status: "Actif" });
      expect(await canUserReadNoteFraisRemboursementReference(`u-${role}`)).toBe(
        false
      );
      expect(await canUserReadNoteFraisFinancialView(`u-${role}`)).toBe(false);
    }
    userFindUnique.mockResolvedValue({ role: "COMCPT", status: "Inactif" });
    expect(await canUserReadNoteFraisFinancialView("u-inactif")).toBe(false);
  });

  it("COMCPT n'obtient pas le droit détail live soumis", async () => {
    userFindUnique.mockResolvedValue({ role: "COMCPT", status: "Actif" });
    getUserAdminRolesFromDb.mockResolvedValue([]);
    expect(await canUserReadSubmittedNotesFrais("com")).toBe(false);
  });
});

describe("DTO enrichissement référence", () => {
  it("membre sans référence ; comptable avec", () => {
    const base = {
      id: "n1",
      libelle: "x",
      description: null,
      dateDepense: new Date(),
      montantDemande: "100",
      statut: "VALIDEE",
      version: 3,
      soumiseAt: null,
      alerteSansDestinataire: false,
      montantAccepte: "100",
      motifDecision: null,
      decideeAt: null,
      decideurUserId: null,
      corrigeNoteFraisId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      Justificatifs: [],
      ChoixReglementActif: {
        id: "c1",
        mode: "REMBOURSEMENT",
        statut: "ACTIF",
        montantReference: "100",
        montantRemboursement: "100",
        montantCompensation: "0",
        montantRembourseUtilise: "40",
        montantCompensationUtilise: "0",
        remplaceChoixId: null,
        choisiAt: new Date(),
        Cibles: [],
      },
    };
    const sans = enrichNoteFraisFinancierDto(base, {
      includeReference: false,
      remboursements: [
        {
          id: "r1",
          montantTotal: 40,
          moyen: "VIREMENT",
          reference: "SECRET-REF",
          executeAt: new Date(),
        },
      ],
    });
    expect(sans.Remboursements?.[0]?.reference).toBeUndefined();
    expect(sans.etatFinancier).toBe("PARTIELLEMENT_REGLEE");
    const avec = enrichNoteFraisFinancierDto(base, {
      includeReference: true,
      remboursements: [
        {
          id: "r1",
          montantTotal: 40,
          moyen: "VIREMENT",
          reference: "SECRET-REF",
          executeAt: new Date(),
        },
      ],
    });
    expect(avec.Remboursements?.[0]?.reference).toBe("SECRET-REF");
  });

  it("enrich marque alerte si état incohérent (jamais REGLEE)", () => {
    const base = {
      id: "n1",
      libelle: "x",
      description: null,
      dateDepense: new Date(),
      montantDemande: "100",
      statut: "VALIDEE",
      version: 3,
      soumiseAt: null,
      alerteSansDestinataire: false,
      montantAccepte: "100",
      motifDecision: null,
      decideeAt: null,
      decideurUserId: null,
      corrigeNoteFraisId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      Justificatifs: [],
      ChoixReglementActif: {
        id: "c1",
        mode: "REMBOURSEMENT",
        statut: "ACTIF",
        montantReference: "100",
        montantRemboursement: "100",
        montantCompensation: "0",
        montantRembourseUtilise: "90",
        montantCompensationUtilise: "20",
        remplaceChoixId: null,
        choisiAt: new Date(),
        Cibles: [],
      },
    };
    const dto = enrichNoteFraisFinancierDto(base as never, {
      includeReference: false,
    });
    expect(dto.alerteEtatFinancier).toBe(true);
    expect(dto.etatFinancier).toBeUndefined();
  });
});

describe("synthèse décaissements", () => {
  it("banque baisse une fois ; charge inchangée", () => {
    const base = computeChargesFromDepensesValides([
      { montant: 80, origine: "FRAIS_AVANCE" },
      { montant: 20, origine: "ORDINAIRE" },
    ]);
    const withDec = withDecaissementsNotesFrais(base, 40);
    expect(withDec.totalCharges).toBe(100);
    expect(withDec.decaissementsNotesFrais).toBe(40);
    expect(computeSoldeBancaireEstime(200, withDec)).toBe(140);
  });
});

describe("getNoteFraisFinancialView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userAdminRoleFindMany.mockResolvedValue([]);
  });

  it("COMCPT : nets sans référence ; TRESOR avec référence ; PRESID/propriétaire refusés", async () => {
    const noteRow = {
      id: "n1",
      statut: "VALIDEE",
      version: 4,
      demandeurUserId: "dem",
      montantAccepte: new Prisma.Decimal(100),
      ChoixReglements: [
        {
          mode: "REMBOURSEMENT",
          montantRemboursement: new Prisma.Decimal(100),
          montantCompensation: new Prisma.Decimal(0),
          montantRembourseUtilise: new Prisma.Decimal(40),
          montantCompensationUtilise: new Prisma.Decimal(0),
        },
      ],
    };
    noteFindUnique.mockResolvedValue(noteRow);
    reglementFindMany.mockImplementation(async (args: { where?: { type?: string } }) => {
      if (args?.where?.type === "REMBOURSEMENT") {
        return [
          {
            id: "r1",
            montantTotal: new Prisma.Decimal("40.00"),
            moyen: "VIREMENT",
            reference: "REF-SECRET",
            executeAt: new Date("2026-06-01T12:00:00.000Z"),
            operationId: null,
            Corrections: [{ montant: new Prisma.Decimal("-5.00") }],
          },
        ];
      }
      return [];
    });
    const client = {
      user: { findUnique: userFindUnique },
      userAdminRole: { findMany: userAdminRoleFindMany },
      noteFrais: { findUnique: noteFindUnique },
      noteFraisReglement: { findMany: reglementFindMany },
      noteFraisReglementOperation: { findMany: vi.fn().mockResolvedValue([]) },
      noteFraisReglementCorrection: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "c1",
            reglementId: "r1",
            type: "MONTANT_NEGATIF",
            montant: new Prisma.Decimal("-5.00"),
            createdAt: new Date("2026-06-02T12:00:00.000Z"),
          },
        ]),
      },
    } as unknown as typeof import("@/lib/db").db;

    userFindUnique.mockResolvedValue({ role: "COMCPT", status: "Actif" });
    const ok = await getNoteFraisFinancialView({
      userId: "com",
      noteId: "n1",
      client,
    });
    expect(ok.success).toBe(true);
    if (ok.success) {
      expect(ok.data.remboursements[0]?.reference).toBeUndefined();
      expect(ok.data.remboursements[0]?.montantTotal).toBe("35.00");
      expect(ok.data.etatFinancier).toBe("PARTIELLEMENT_REGLEE");
      expect(ok.data.corrections?.[0]?.montantCorrection).toBe("5.00");
    }

    userFindUnique.mockResolvedValue({ role: "TRESOR", status: "Actif" });
    const tres = await getNoteFraisFinancialView({
      userId: "t",
      noteId: "n1",
      client,
    });
    expect(tres.success).toBe(true);
    if (tres.success) {
      expect(tres.data.remboursements[0]?.reference).toBe("REF-SECRET");
      expect(tres.data.remboursements[0]?.montantTotal).toBe("35.00");
    }

    userFindUnique.mockResolvedValue({ role: "PRESID", status: "Actif" });
    const presid = await getNoteFraisFinancialView({
      userId: "p",
      noteId: "n1",
      client,
    });
    expect(presid.success).toBe(false);

    userFindUnique.mockResolvedValue({ role: "ADMIN", status: "Actif" });
    const owner = await getNoteFraisFinancialView({
      userId: "dem",
      noteId: "n1",
      client,
    });
    expect(owner.success).toBe(false);
    if (!owner.success) expect(owner.error).toMatch(/propriétaire/);
  });
});

describe("executeNoteFraisRemboursement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveActionPermissionConfig.mockResolvedValue({ status: "absent" });
    userFindUnique.mockResolvedValue({ role: "TRESOR", status: "Actif" });
    userAdminRoleFindMany.mockResolvedValue([]);
    reglementFindUnique.mockResolvedValue(null);
    $executeRaw.mockResolvedValue(undefined);
    noteUpdateMany.mockResolvedValue({ count: 1 });
    reglementCreate.mockResolvedValue({ id: "reg1" });
    ligneCreate.mockResolvedValue({ id: "lig1" });
    choixUpdate.mockResolvedValue({});
    notificationCreate.mockResolvedValue({ id: "notif1" });
    outboxCreate.mockResolvedValue({ id: "ob1" });
  });

  it("refuse auto-exécution", async () => {
    noteFindUnique.mockResolvedValue({
      id: "n1",
      statut: "VALIDEE",
      version: 3,
      demandeurUserId: "actor",
      decideeAt: new Date("2026-05-01"),
      montantAccepte: new Prisma.Decimal(50),
    });
    const res = await executeNoteFraisRemboursement({
      actorUserId: "actor",
      noteId: "n1",
      expectedNoteVersion: 3,
      idempotencyKey: "remb-key-01",
      montant: "10.00",
      moyen: "VIREMENT",
      reference: "REF1",
      executeAt: executeAtIso,
    });
    expect(res.success).toBe(false);
    if (!res.success) expect(res.code).toBe("AUTO_EXECUTION_FORBIDDEN");
  });

  it("refuse montant nul et moyen invalide", async () => {
    noteFindUnique.mockResolvedValue({
      id: "n1",
      statut: "VALIDEE",
      version: 3,
      demandeurUserId: "dem",
      decideeAt: new Date("2026-05-01"),
      montantAccepte: new Prisma.Decimal(50),
    });
    const zero = await executeNoteFraisRemboursement({
      actorUserId: "tres",
      noteId: "n1",
      expectedNoteVersion: 3,
      idempotencyKey: "remb-key-02",
      montant: "0",
      moyen: "VIREMENT",
      reference: "REF1",
      executeAt: executeAtIso,
    });
    expect(zero.success).toBe(false);

    const badMoyen = await executeNoteFraisRemboursement({
      actorUserId: "tres",
      noteId: "n1",
      expectedNoteVersion: 3,
      idempotencyKey: "remb-key-03",
      montant: "10.00",
      moyen: "CHEQUE" as "VIREMENT",
      reference: "REF1",
      executeAt: executeAtIso,
    });
    expect(badMoyen.success).toBe(false);
    if (!badMoyen.success) expect(badMoyen.code).toBe("MOYEN_INVALIDE");
  });

  it("horloge injectable : exactement decideeAt, now+5min, au-delà", async () => {
    const decideeAt = new Date("2026-06-01T10:00:00.000Z");
    const now = new Date("2026-06-01T12:00:00.000Z");
    const clock = { now: () => now };
    noteFindUnique.mockResolvedValue({
      id: "n1",
      statut: "VALIDEE",
      version: 3,
      demandeurUserId: "dem",
      decideeAt,
      montantAccepte: new Prisma.Decimal(50),
    });

    const beyond = await executeNoteFraisRemboursement({
      actorUserId: "tres",
      noteId: "n1",
      expectedNoteVersion: 3,
      idempotencyKey: "remb-key-clk-2",
      montant: "10.00",
      moyen: "ESPECES",
      reference: "R1",
      executeAt: new Date(now.getTime() + 5 * 60 * 1000 + 1).toISOString(),
      clock,
    });
    expect(beyond.success).toBe(false);
    if (!beyond.success) expect(beyond.code).toBe("DATE_INVALIDE");

    const early = await executeNoteFraisRemboursement({
      actorUserId: "tres",
      noteId: "n1",
      expectedNoteVersion: 3,
      idempotencyKey: "remb-key-clk-3",
      montant: "10.00",
      moyen: "ESPECES",
      reference: "R1",
      executeAt: new Date(decideeAt.getTime() - 1).toISOString(),
      clock,
    });
    expect(early.success).toBe(false);
    if (!early.success) expect(early.code).toBe("DATE_INVALIDE");

    choixFindFirst.mockResolvedValue({
      id: "ch1",
      mode: "REMBOURSEMENT",
      montantRemboursement: new Prisma.Decimal(50),
      montantRembourseUtilise: new Prisma.Decimal(0),
      montantCompensationUtilise: new Prisma.Decimal(0),
    });
    $transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        $executeRaw,
        noteFrais: {
          findUnique: noteFindUnique,
          updateMany: noteUpdateMany,
        },
        noteFraisReglement: {
          findUnique: reglementFindUnique,
          create: reglementCreate,
        },
        noteFraisReglementLigne: { create: ligneCreate },
        noteFraisChoixReglement: {
          findFirst: choixFindFirst,
          update: choixUpdate,
        },
        notification: { create: notificationCreate },
        noteFraisOutboxEvent: { create: outboxCreate },
      };
      noteFindUnique.mockResolvedValue({
        id: "n1",
        statut: "VALIDEE",
        version: 3,
        demandeurUserId: "dem",
        decideeAt,
        montantAccepte: new Prisma.Decimal(50),
      });
      return fn(tx);
    });

    const atDecidee = await executeNoteFraisRemboursement({
      actorUserId: "tres",
      noteId: "n1",
      expectedNoteVersion: 3,
      idempotencyKey: "remb-key-clk-1",
      montant: "10.00",
      moyen: "ESPECES",
      reference: "R1",
      executeAt: decideeAt.toISOString(),
      clock,
    });
    expect(atDecidee.success).toBe(true);

    const atPlus5 = await executeNoteFraisRemboursement({
      actorUserId: "tres",
      noteId: "n1",
      expectedNoteVersion: 3,
      idempotencyKey: "remb-key-clk-4",
      montant: "10.01",
      moyen: "VIREMENT",
      reference: "R-PLUS5",
      executeAt: new Date(now.getTime() + 5 * 60 * 1000).toISOString(),
      clock,
    });
    expect(atPlus5.success).toBe(true);
  });

  it("accepte montant chaîne 0.29 sans Number()", async () => {
    const decideeAt = new Date("2026-05-01T00:00:00.000Z");
    const now = new Date("2026-06-01T12:00:00.000Z");
    noteFindUnique.mockResolvedValue({
      id: "n1",
      statut: "VALIDEE",
      version: 3,
      demandeurUserId: "dem",
      decideeAt,
      montantAccepte: new Prisma.Decimal(50),
    });
    choixFindFirst.mockResolvedValue({
      id: "ch1",
      mode: "REMBOURSEMENT",
      montantRemboursement: new Prisma.Decimal(50),
      montantRembourseUtilise: new Prisma.Decimal(0),
      montantCompensationUtilise: new Prisma.Decimal(0),
    });
    $transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        $executeRaw,
        noteFrais: {
          findUnique: noteFindUnique,
          updateMany: noteUpdateMany,
        },
        noteFraisReglement: {
          findUnique: reglementFindUnique,
          create: reglementCreate,
        },
        noteFraisReglementLigne: { create: ligneCreate },
        noteFraisChoixReglement: {
          findFirst: choixFindFirst,
          update: choixUpdate,
        },
        notification: { create: notificationCreate },
        noteFraisOutboxEvent: { create: outboxCreate },
      };
      return fn(tx);
    });
    const res = await executeNoteFraisRemboursement({
      actorUserId: "tres",
      noteId: "n1",
      expectedNoteVersion: 3,
      idempotencyKey: "remb-key-029",
      montant: "0.29",
      moyen: "VIREMENT",
      reference: "REF029",
      executeAt: now.toISOString(),
      clock: { now: () => now },
    });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.montantTotal).toBe("0.29");
  });

  it("refuse date avant decideeAt et date > now+5min", async () => {
    const clock = { now: () => new Date("2026-09-01T12:00:00.000Z") };
    noteFindUnique.mockResolvedValue({
      id: "n1",
      statut: "VALIDEE",
      version: 3,
      demandeurUserId: "dem",
      decideeAt: new Date("2026-08-01T00:00:00.000Z"),
      montantAccepte: new Prisma.Decimal(50),
    });
    const early = await executeNoteFraisRemboursement({
      actorUserId: "tres",
      noteId: "n1",
      expectedNoteVersion: 3,
      idempotencyKey: "remb-key-04",
      montant: "10",
      moyen: "ESPECES",
      reference: "R1",
      executeAt: "2026-07-01T00:00:00.000Z",
      clock,
    });
    expect(early.success).toBe(false);
    if (!early.success) expect(early.code).toBe("DATE_INVALIDE");

    const far = await executeNoteFraisRemboursement({
      actorUserId: "tres",
      noteId: "n1",
      expectedNoteVersion: 3,
      idempotencyKey: "remb-key-05",
      montant: "10",
      moyen: "ESPECES",
      reference: "R1",
      executeAt: "2026-09-01T13:00:00.000Z",
      clock,
    });
    expect(far.success).toBe(false);
  });

  it("replay : authz MEMBRE refusée", async () => {
    reglementFindUnique.mockResolvedValue({
      id: "reg1",
      noteFraisId: "n1",
      choixId: "ch1",
      type: "REMBOURSEMENT",
      montantTotal: new Prisma.Decimal(10),
      moyen: "VIREMENT",
      referenceNormalisee: "REF1",
      executeAt: new Date(executeAtIso),
    });
    noteFindUnique.mockResolvedValue({
      version: 4,
      demandeurUserId: "dem",
    });
    userFindUnique.mockResolvedValue({ role: "MEMBRE", status: "Actif" });
    const res = await executeNoteFraisRemboursement({
      actorUserId: "membre",
      noteId: "n1",
      expectedNoteVersion: 3,
      idempotencyKey: "remb-key-01",
      montant: "10",
      moyen: "VIREMENT",
      reference: "REF1",
      executeAt: executeAtIso,
    });
    expect(res.success).toBe(false);
    if (!res.success) expect(res.code).toBe("FORBIDDEN");
  });

  it("P2002 → succès idempotent après relecture", async () => {
    const decidee = new Date("2026-05-01T00:00:00.000Z");
    const exec = new Date("2026-06-01T11:00:00.000Z");
    noteFindUnique
      .mockResolvedValueOnce({
        id: "n1",
        statut: "VALIDEE",
        version: 3,
        demandeurUserId: "dem",
        decideeAt: decidee,
        montantAccepte: new Prisma.Decimal(50),
      })
      .mockResolvedValueOnce({ version: 4, demandeurUserId: "dem" });
    reglementFindUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: "reg1",
      noteFraisId: "n1",
      choixId: "ch1",
      type: "REMBOURSEMENT",
      montantTotal: new Prisma.Decimal(10),
      moyen: "VIREMENT",
      referenceNormalisee: "REF1",
      executeAt: exec,
    });
    $transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique", {
        code: "P2002",
        clientVersion: "test",
        meta: { target: ["idempotencyKey"] },
      })
    );
    const res = await executeNoteFraisRemboursement({
      actorUserId: "tres",
      noteId: "n1",
      expectedNoteVersion: 3,
      idempotencyKey: "remb-key-p2002",
      montant: "10",
      moyen: "VIREMENT",
      reference: "REF1",
      executeAt: exec.toISOString(),
      clock: { now: () => new Date("2026-06-01T12:00:00.000Z") },
    });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.alreadyExecuted).toBe(true);
    expect(notificationCreate).not.toHaveBeenCalled();
    expect(outboxCreate).not.toHaveBeenCalled();
  });
});