import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import type { AuthContext } from "@/lib/auth-context";

const {
  findUniqueAdherent,
  findFirstCotisation,
  findFirstDette,
  findFirstAssistance,
  findFirstObligation,
  findFirstCompte,
  findFirstPaiement,
  createPaiement,
  findUniquePaiement,
  updatePaiement,
  updateManyPaiement,
  updateCotisation,
  updateDette,
  updateAssistance,
  findManyAvoir,
  createAvoir,
  updateAvoir,
  createUtilisationAvoir,
  findUniqueAvoir,
  deleteAvoir,
  deleteManyUtilisationAvoir,
  findManyDette,
  findManyCotisation,
  findManyAssistance,
  createNotification,
  transaction,
  findFirstInscriptionEvenement,
  updateInscriptionEvenement,
} = vi.hoisted(() => ({
  findUniqueAdherent: vi.fn(),
  findFirstCotisation: vi.fn(),
  findFirstDette: vi.fn(),
  findFirstAssistance: vi.fn(),
  findFirstObligation: vi.fn(),
  findFirstCompte: vi.fn(),
  findFirstPaiement: vi.fn(),
  createPaiement: vi.fn(),
  findUniquePaiement: vi.fn(),
  updatePaiement: vi.fn(),
  updateManyPaiement: vi.fn(),
  updateCotisation: vi.fn(),
  updateDette: vi.fn(),
  updateAssistance: vi.fn(),
  findManyAvoir: vi.fn(),
  createAvoir: vi.fn(),
  updateAvoir: vi.fn(),
  createUtilisationAvoir: vi.fn(),
  findUniqueAvoir: vi.fn(),
  deleteAvoir: vi.fn(),
  deleteManyUtilisationAvoir: vi.fn(),
  findManyDette: vi.fn(),
  findManyCotisation: vi.fn(),
  findManyAssistance: vi.fn(),
  createNotification: vi.fn(),
  transaction: vi.fn(),
  findFirstInscriptionEvenement: vi.fn(),
  updateInscriptionEvenement: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    adherent: { findUnique: findUniqueAdherent },
    cotisationMensuelle: {
      findFirst: findFirstCotisation,
      findMany: findManyCotisation,
      update: updateCotisation,
    },
    detteInitiale: {
      findFirst: findFirstDette,
      findMany: findManyDette,
      update: updateDette,
    },
    assistance: {
      findFirst: findFirstAssistance,
      findMany: findManyAssistance,
      update: updateAssistance,
    },
    obligationCotisation: { findFirst: findFirstObligation },
    comptePaiementAssociation: { findFirst: findFirstCompte },
    paiementCotisation: {
      create: createPaiement,
      findUnique: findUniquePaiement,
      findFirst: findFirstPaiement,
      update: updatePaiement,
      updateMany: updateManyPaiement,
    },
    avoir: {
      findMany: findManyAvoir,
      create: createAvoir,
      update: updateAvoir,
      findUnique: findUniqueAvoir,
      delete: deleteAvoir,
    },
    utilisationAvoir: {
      create: createUtilisationAvoir,
      deleteMany: deleteManyUtilisationAvoir,
    },
    notification: { create: createNotification },
    inscriptionEvenement: {
      findFirst: findFirstInscriptionEvenement,
      update: updateInscriptionEvenement,
    },
    $transaction: transaction,
  },
}));

vi.mock("@/lib/authorize", () => ({
  authorize: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/services/push/send-push", () => ({
  sendPushToUser: vi.fn().mockResolvedValue({
    attempted: 0,
    ok: 0,
    errors: 0,
    disabled: 0,
  }),
  sendPushToUsers: vi.fn().mockResolvedValue({
    attempted: 0,
    ok: 0,
    errors: 0,
    disabled: 0,
  }),
}));

import {
  declareBankOrWeroPayment,
  validatePendingPayment,
  rejectPendingPayment,
  buildPaymentReference,
  applyValidatedPaymentCredit,
  formatMoyenPaiementLabel,
  formatPaymentTargetLabel,
} from "@/lib/services/paiements/declare-bank-wero-payment";

function member(userId = "user-A"): AuthContext {
  return {
    userId,
    role: "MEMBRE",
    status: "Actif",
    email: "a@a.fr",
    name: "Ada",
    sessionId: null,
    adminRoles: [],
    adherentId: null,
    channel: "mobile",
  };
}

function admin(): AuthContext {
  return { ...member("admin-1"), role: "ADMIN" };
}

function mockTx() {
  return {
    paiementCotisation: {
      findFirst: findFirstPaiement,
      findUnique: findUniquePaiement,
      create: createPaiement,
      update: updatePaiement,
      updateMany: updateManyPaiement,
    },
    cotisationMensuelle: {
      findFirst: findFirstCotisation,
      findMany: findManyCotisation,
      update: updateCotisation,
    },
    detteInitiale: {
      findFirst: findFirstDette,
      findMany: findManyDette,
      update: updateDette,
    },
    assistance: {
      findFirst: findFirstAssistance,
      findMany: findManyAssistance,
      update: updateAssistance,
    },
    obligationCotisation: {
      findFirst: findFirstObligation,
      update: vi.fn(),
    },
    avoir: {
      findMany: findManyAvoir,
      create: createAvoir,
      update: updateAvoir,
      findUnique: findUniqueAvoir,
      delete: deleteAvoir,
    },
    utilisationAvoir: {
      create: createUtilisationAvoir,
      deleteMany: deleteManyUtilisationAvoir,
    },
    inscriptionEvenement: {
      findFirst: findFirstInscriptionEvenement,
      update: updateInscriptionEvenement,
    },
  };
}

function wireTransaction() {
  transaction.mockImplementation(
    async (
      fn: (tx: ReturnType<typeof mockTx>) => unknown,
      _opts?: unknown
    ) => fn(mockTx())
  );
}

beforeEach(() => {
  findUniqueAdherent.mockReset();
  findFirstCotisation.mockReset();
  findFirstDette.mockReset();
  findFirstAssistance.mockReset();
  findFirstObligation.mockReset();
  findFirstCompte.mockReset();
  findFirstPaiement.mockReset();
  createPaiement.mockReset();
  findUniquePaiement.mockReset();
  updatePaiement.mockReset();
  updateManyPaiement.mockReset();
  updateCotisation.mockReset();
  updateDette.mockReset();
  updateAssistance.mockReset();
  findManyAvoir.mockReset();
  createAvoir.mockReset();
  updateAvoir.mockReset();
  createUtilisationAvoir.mockReset();
  findUniqueAvoir.mockReset();
  deleteAvoir.mockReset();
  deleteManyUtilisationAvoir.mockReset();
  findManyDette.mockReset();
  findManyCotisation.mockReset();
  findManyAssistance.mockReset();
  createNotification.mockReset();
  transaction.mockReset();
  findFirstInscriptionEvenement.mockReset();
  updateInscriptionEvenement.mockReset();
  findManyAvoir.mockResolvedValue([]);
  findUniqueAvoir.mockResolvedValue(null);
  findManyDette.mockResolvedValue([]);
  findManyCotisation.mockResolvedValue([]);
  findManyAssistance.mockResolvedValue([]);
  createNotification.mockResolvedValue({ id: "notif-1" });
  createAvoir.mockImplementation(async ({ data }: { data: { montant: Prisma.Decimal } }) => ({
    id: "avoir-1",
    ...data,
  }));
  wireTransaction();
});

describe("buildPaymentReference", () => {
  it("format AMAKI-YEAR-TYPE-XXXX", () => {
    expect(buildPaymentReference("cotisation-mensuelle", 2026)).toMatch(
      /^AMAKI-2026-COT-[A-Z0-9]+$/
    );
  });
});

describe("declareBankOrWeroPayment — anti double EnAttente", () => {
  function setupHappyPath() {
    findUniqueAdherent.mockResolvedValue({ id: "adh-A" });
    findFirstCompte.mockResolvedValue({
      actifPourPaiement: true,
      weroActif: true,
      telephoneWero: "+33600000000",
    });
    findFirstPaiement.mockResolvedValue(null);
    findFirstCotisation.mockResolvedValue({
      adherentId: "adh-A",
      montantRestant: new Prisma.Decimal("100"),
      statut: "EnAttente",
    });
    createPaiement.mockResolvedValue({
      id: "pay-1",
      montant: new Prisma.Decimal("30"),
      moyenPaiement: "Virement",
      reference: "AMAKI-2026-COT-TEST",
      statut: "EnAttente",
    });
  }

  it("premier EnAttente → succès", async () => {
    setupHappyPath();
    const r = await declareBankOrWeroPayment(member(), {
      targetType: "cotisation-mensuelle",
      targetId: "cot-A",
      amount: "30",
      paymentMethod: "Virement",
      justificatifChemin: "private/justificatifs-paiements/x.pdf",
    });
    expect(r.statut).toBe("EnAttente");
    expect(createPaiement).toHaveBeenCalledTimes(1);
  });

  it("second paiement même cible avant validation → PAYMENT_ALREADY_PENDING", async () => {
    setupHappyPath();
    findFirstPaiement.mockResolvedValue({ id: "pay-pending" });
    await expect(
      declareBankOrWeroPayment(member(), {
        targetType: "cotisation-mensuelle",
        targetId: "cot-A",
        amount: "20",
        paymentMethod: "Virement",
        justificatifChemin: "private/x.pdf",
      })
    ).rejects.toMatchObject({ code: "PAYMENT_ALREADY_PENDING" });
  });

  it("après validation + reste = 0 → déclaration refusée", async () => {
    setupHappyPath();
    findFirstCotisation.mockResolvedValue({
      adherentId: "adh-A",
      montantRestant: new Prisma.Decimal("0"),
      statut: "Paye",
    });
    await expect(
      declareBankOrWeroPayment(member(), {
        targetType: "cotisation-mensuelle",
        targetId: "cot-A",
        amount: "10",
        paymentMethod: "Virement",
        justificatifChemin: "private/x.pdf",
      })
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("reste 50 / déclaration 100 → OK EnAttente (surpaiement)", async () => {
    setupHappyPath();
    findFirstCotisation.mockResolvedValue({
      adherentId: "adh-A",
      montantRestant: new Prisma.Decimal("50"),
      statut: "EnAttente",
    });
    createPaiement.mockResolvedValue({
      id: "pay-over",
      montant: new Prisma.Decimal("100"),
      moyenPaiement: "Virement",
      reference: "AMAKI-2026-COT-OVER",
      statut: "EnAttente",
    });
    const r = await declareBankOrWeroPayment(member(), {
      targetType: "cotisation-mensuelle",
      targetId: "cot-A",
      amount: "100",
      paymentMethod: "Virement",
      justificatifChemin: "private/justificatifs-paiements/x.pdf",
    });
    expect(r.statut).toBe("EnAttente");
    expect(createPaiement.mock.calls[0][0].data.montant.toString()).toBe("100");
  });

  it("reste 50 / déclaration 0 → VALIDATION_ERROR", async () => {
    setupHappyPath();
    findFirstCotisation.mockResolvedValue({
      adherentId: "adh-A",
      montantRestant: new Prisma.Decimal("50"),
      statut: "EnAttente",
    });
    await expect(
      declareBankOrWeroPayment(member(), {
        targetType: "cotisation-mensuelle",
        targetId: "cot-A",
        amount: "0",
        paymentMethod: "Virement",
        justificatifChemin: "private/x.pdf",
      })
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      message: "Montant invalide",
    });
  });

  it("montant négatif / mal formé → rejeté à la validation", async () => {
    setupHappyPath();
    await expect(
      declareBankOrWeroPayment(member(), {
        targetType: "cotisation-mensuelle",
        targetId: "cot-A",
        amount: "-10",
        paymentMethod: "Virement",
        justificatifChemin: "private/x.pdf",
      })
    ).rejects.toThrow();
  });
});

describe("validatePendingPayment — ventilation excédent (createPaiement)", () => {
  function pendingPay(overrides: Record<string, unknown> = {}) {
    return {
      id: "pay-1",
      adherentId: "adh-A",
      montant: new Prisma.Decimal("100"),
      moyenPaiement: "Wero",
      reference: "AMAKI-2026-COT-XXXX",
      statut: "EnAttente",
      description: null,
      cotisationMensuelleId: "cot-A",
      detteInitialeId: null,
      assistanceId: null,
      obligationCotisationId: null,
      Adherent: { userId: "user-A" },
      CotisationMensuelle: {
        mois: 3,
        annee: 2026,
        TypeCotisation: { nom: "Cotisation mensuelle" },
      },
      DetteInitiale: null,
      Assistance: null,
      ObligationCotisation: null,
      inscriptionEvenementId: null,
      InscriptionEvenement: null,
      ...overrides,
    };
  }

  it("dû 50 / paiement 50 → validation OK, pas d'avoir", async () => {
    findUniquePaiement.mockResolvedValue(
      pendingPay({ montant: new Prisma.Decimal("50") })
    );
    updateManyPaiement.mockResolvedValue({ count: 1 });
    findFirstCotisation.mockResolvedValue({
      id: "cot-A",
      adherentId: "adh-A",
      montantPaye: new Prisma.Decimal("0"),
      montantRestant: new Prisma.Decimal("50"),
      montantAttendu: new Prisma.Decimal("50"),
    });
    const r = await validatePendingPayment(admin(), "pay-1");
    expect(r.statut).toBe("Valide");
    expect(r.creditedToTarget).toBe("50");
    expect(r.surplus).toBe("0");
    expect(createAvoir).not.toHaveBeenCalled();
    expect(updateCotisation.mock.calls[0][0].data.montantPaye.toString()).toBe(
      "50"
    );
  });

  it("dû 50 / paiement 100 / dette 80 → cible soldée + dette réduite de 50 (pas d'avoir)", async () => {
    findUniquePaiement.mockResolvedValue(pendingPay());
    updateManyPaiement.mockResolvedValue({ count: 1 });
    findFirstCotisation.mockResolvedValue({
      id: "cot-A",
      adherentId: "adh-A",
      montantPaye: new Prisma.Decimal("0"),
      montantRestant: new Prisma.Decimal("50"),
      montantAttendu: new Prisma.Decimal("50"),
    });
    findManyDette.mockResolvedValue([
      {
        id: "dette-1",
        adherentId: "adh-A",
        montantPaye: new Prisma.Decimal("0"),
        montantRestant: new Prisma.Decimal("80"),
        annee: 2025,
      },
    ]);
    findManyCotisation.mockResolvedValue([]);
    findManyAssistance.mockResolvedValue([]);
    findManyAvoir.mockResolvedValue([]);

    const r = await validatePendingPayment(admin(), "pay-1");
    expect(r.creditedToTarget).toBe("50");
    expect(r.surplus).toBe("50");
    expect(updateCotisation.mock.calls[0][0].data.montantPaye.toString()).toBe(
      "50"
    );
    expect(updateDette.mock.calls[0][0].data.montantPaye.toString()).toBe("50");
    expect(createAvoir).not.toHaveBeenCalled();
  });

  it("A: forfait 100 + paiement 150 + assistance CM 30 → soldées + avoir 20", async () => {
    findUniquePaiement.mockResolvedValue(
      pendingPay({ montant: new Prisma.Decimal("150") })
    );
    updateManyPaiement.mockResolvedValue({ count: 1 });
    findFirstCotisation.mockResolvedValue({
      id: "cot-A",
      adherentId: "adh-A",
      montantPaye: new Prisma.Decimal("0"),
      montantRestant: new Prisma.Decimal("100"),
      montantAttendu: new Prisma.Decimal("100"),
    });
    findManyDette.mockResolvedValue([]);
    findManyCotisation.mockResolvedValue([
      {
        id: "cm-ass-deces",
        montantPaye: new Prisma.Decimal("0"),
        montantRestant: new Prisma.Decimal("30"),
        montantAttendu: new Prisma.Decimal("30"),
        dateEcheance: new Date("2026-03-01"),
      },
    ]);
    findManyAssistance.mockResolvedValue([]);
    findManyAvoir.mockResolvedValue([]);

    const r = await validatePendingPayment(admin(), "pay-1");
    expect(r.creditedToTarget).toBe("100");
    expect(r.surplus).toBe("50");
    expect(updateCotisation.mock.calls[0][0].data.montantPaye.toString()).toBe(
      "100"
    );
    expect(updateCotisation.mock.calls[1][0].where.id).toBe("cm-ass-deces");
    expect(updateCotisation.mock.calls[1][0].data.montantPaye.toString()).toBe(
      "30"
    );
    expect(updateCotisation.mock.calls[1][0].data.statut).toBe("Paye");
    expect(createAvoir.mock.calls[0][0].data.montant.toString()).toBe("20");
  });

  it("B: forfait 50 + 2 assistances 20/30 + paiement 120 → tout soldé + avoir 20", async () => {
    findUniquePaiement.mockResolvedValue(
      pendingPay({ montant: new Prisma.Decimal("120") })
    );
    updateManyPaiement.mockResolvedValue({ count: 1 });
    findFirstCotisation.mockResolvedValue({
      id: "cot-A",
      adherentId: "adh-A",
      montantPaye: new Prisma.Decimal("0"),
      montantRestant: new Prisma.Decimal("50"),
      montantAttendu: new Prisma.Decimal("50"),
    });
    findManyDette.mockResolvedValue([]);
    findManyCotisation.mockResolvedValue([
      {
        id: "cm-mariage",
        montantPaye: new Prisma.Decimal("0"),
        montantRestant: new Prisma.Decimal("20"),
        montantAttendu: new Prisma.Decimal("20"),
        dateEcheance: new Date("2026-03-01"),
      },
      {
        id: "cm-deces",
        montantPaye: new Prisma.Decimal("0"),
        montantRestant: new Prisma.Decimal("30"),
        montantAttendu: new Prisma.Decimal("30"),
        dateEcheance: new Date("2026-03-15"),
      },
    ]);
    findManyAssistance.mockResolvedValue([]);
    findManyAvoir.mockResolvedValue([]);

    await validatePendingPayment(admin(), "pay-1");
    expect(updateCotisation.mock.calls[0][0].data.montantPaye.toString()).toBe(
      "50"
    );
    expect(updateCotisation.mock.calls[1][0].where.id).toBe("cm-mariage");
    expect(updateCotisation.mock.calls[1][0].data.montantPaye.toString()).toBe(
      "20"
    );
    expect(updateCotisation.mock.calls[2][0].where.id).toBe("cm-deces");
    expect(updateCotisation.mock.calls[2][0].data.montantPaye.toString()).toBe(
      "30"
    );
    expect(createAvoir.mock.calls[0][0].data.montant.toString()).toBe("20");
  });

  it("C: forfait déjà soldé + assistance 40 + paiement 40 → assistance soldée, avoir 0", async () => {
    findUniquePaiement.mockResolvedValue(
      pendingPay({
        montant: new Prisma.Decimal("40"),
        cotisationMensuelleId: "cm-ass",
      })
    );
    updateManyPaiement.mockResolvedValue({ count: 1 });
    findFirstCotisation.mockResolvedValue({
      id: "cm-ass",
      adherentId: "adh-A",
      montantPaye: new Prisma.Decimal("0"),
      montantRestant: new Prisma.Decimal("40"),
      montantAttendu: new Prisma.Decimal("40"),
    });
    findManyDette.mockResolvedValue([]);
    findManyCotisation.mockResolvedValue([]);
    findManyAssistance.mockResolvedValue([]);
    findManyAvoir.mockResolvedValue([]);

    const r = await validatePendingPayment(admin(), "pay-1");
    expect(r.creditedToTarget).toBe("40");
    expect(r.surplus).toBe("0");
    expect(createAvoir).not.toHaveBeenCalled();
  });

  it("D: aucune dette restante + paiement excédentaire 50 → avoir 50", async () => {
    findUniquePaiement.mockResolvedValue(
      pendingPay({
        id: "pay-B",
        montant: new Prisma.Decimal("50"),
      })
    );
    updateManyPaiement.mockResolvedValue({ count: 1 });
    findFirstCotisation.mockResolvedValue({
      id: "cot-A",
      adherentId: "adh-A",
      montantPaye: new Prisma.Decimal("50"),
      montantRestant: new Prisma.Decimal("0"),
      montantAttendu: new Prisma.Decimal("50"),
    });
    findManyDette.mockResolvedValue([]);
    findManyCotisation.mockResolvedValue([]);
    findManyAssistance.mockResolvedValue([]);
    findManyAvoir.mockResolvedValue([]);

    const r = await validatePendingPayment(admin(), "pay-1");
    expect(r.creditedToTarget).toBe("0");
    expect(r.surplus).toBe("50");
    expect(createAvoir.mock.calls[0][0].data.montant.toString()).toBe("50");
  });

  it("F: assistance déjà soldée → ignorée, avoir conserve l'excédent", async () => {
    findUniquePaiement.mockResolvedValue(
      pendingPay({ montant: new Prisma.Decimal("100") })
    );
    updateManyPaiement.mockResolvedValue({ count: 1 });
    findFirstCotisation.mockResolvedValue({
      id: "cot-A",
      adherentId: "adh-A",
      montantPaye: new Prisma.Decimal("0"),
      montantRestant: new Prisma.Decimal("50"),
      montantAttendu: new Prisma.Decimal("50"),
    });
    findManyDette.mockResolvedValue([]);
    findManyCotisation.mockResolvedValue([]);
    findManyAssistance.mockResolvedValue([]);
    findManyAvoir.mockResolvedValue([]);

    await validatePendingPayment(admin(), "pay-1");
    expect(createAvoir.mock.calls[0][0].data.montant.toString()).toBe("50");
  });

  it("G: dette antérieure + assistance CM → dette d'abord puis assistance", async () => {
    findUniquePaiement.mockResolvedValue(
      pendingPay({ montant: new Prisma.Decimal("100") })
    );
    updateManyPaiement.mockResolvedValue({ count: 1 });
    findFirstCotisation.mockResolvedValue({
      id: "cot-A",
      adherentId: "adh-A",
      montantPaye: new Prisma.Decimal("0"),
      montantRestant: new Prisma.Decimal("40"),
      montantAttendu: new Prisma.Decimal("40"),
    });
    findManyDette.mockResolvedValue([
      {
        id: "dette-2024",
        montantPaye: new Prisma.Decimal("0"),
        montantRestant: new Prisma.Decimal("30"),
        annee: 2024,
      },
    ]);
    findManyCotisation.mockResolvedValue([
      {
        id: "cm-ass",
        montantPaye: new Prisma.Decimal("0"),
        montantRestant: new Prisma.Decimal("20"),
        montantAttendu: new Prisma.Decimal("20"),
        dateEcheance: new Date("2026-04-01"),
      },
    ]);
    findManyAssistance.mockResolvedValue([]);
    findManyAvoir.mockResolvedValue([]);

    await validatePendingPayment(admin(), "pay-1");
    expect(updateDette.mock.calls[0][0].data.montantPaye.toString()).toBe("30");
    expect(updateCotisation.mock.calls[1][0].where.id).toBe("cm-ass");
    expect(createAvoir.mock.calls[0][0].data.montant.toString()).toBe("10");
  });

  it("dû 50 / paiement 100 / aucune dette → avoir 50", async () => {
    findUniquePaiement.mockResolvedValue(pendingPay());
    updateManyPaiement.mockResolvedValue({ count: 1 });
    findFirstCotisation.mockResolvedValue({
      id: "cot-A",
      adherentId: "adh-A",
      montantPaye: new Prisma.Decimal("0"),
      montantRestant: new Prisma.Decimal("50"),
      montantAttendu: new Prisma.Decimal("50"),
    });
    findManyDette.mockResolvedValue([]);
    findManyCotisation.mockResolvedValue([]);
    findManyAssistance.mockResolvedValue([]);
    findManyAvoir.mockResolvedValue([]);

    const r = await validatePendingPayment(admin(), "pay-1");
    expect(r.surplus).toBe("50");
    expect(createAvoir.mock.calls[0][0].data.montant.toString()).toBe("50");
    expect(updateDette).not.toHaveBeenCalled();
  });

  it("ancienne double EnAttente : 2e validation → Valide + avoir (pas perdu)", async () => {
    findUniquePaiement.mockResolvedValue(
      pendingPay({ id: "pay-B", montant: new Prisma.Decimal("50") })
    );
    updateManyPaiement.mockResolvedValue({ count: 1 });
    findFirstCotisation.mockResolvedValue({
      id: "cot-A",
      adherentId: "adh-A",
      montantPaye: new Prisma.Decimal("50"),
      montantRestant: new Prisma.Decimal("0"),
      montantAttendu: new Prisma.Decimal("50"),
    });
    findManyDette.mockResolvedValue([]);
    findManyCotisation.mockResolvedValue([]);
    findManyAssistance.mockResolvedValue([]);
    findManyAvoir.mockResolvedValue([]);

    const r = await validatePendingPayment(admin(), "pay-B");
    expect(r.statut).toBe("Valide");
    expect(r.creditedToTarget).toBe("0");
    expect(r.surplus).toBe("50");
    expect(createAvoir).toHaveBeenCalled();
  });

  it("après A=70 (reste 30), B=50 → crédit 30 + avoir 20 (pas payé 120)", async () => {
    findUniquePaiement.mockResolvedValue(
      pendingPay({ id: "pay-B", montant: new Prisma.Decimal("50") })
    );
    updateManyPaiement.mockResolvedValue({ count: 1 });
    findFirstCotisation.mockResolvedValue({
      id: "cot-A",
      adherentId: "adh-A",
      montantPaye: new Prisma.Decimal("70"),
      montantRestant: new Prisma.Decimal("30"),
      montantAttendu: new Prisma.Decimal("100"),
    });
    findManyDette.mockResolvedValue([]);
    findManyCotisation.mockResolvedValue([]);
    findManyAssistance.mockResolvedValue([]);
    findManyAvoir.mockResolvedValue([]);

    const r = await validatePendingPayment(admin(), "pay-B");
    expect(r.creditedToTarget).toBe("30");
    expect(r.surplus).toBe("20");
    expect(updateCotisation.mock.calls[0][0].data.montantPaye.toString()).toBe(
      "100"
    );
    expect(createAvoir.mock.calls[0][0].data.montant.toString()).toBe("20");
  });

  it("dette 150 / paiement 50 → payé dette 50", async () => {
    findUniquePaiement.mockResolvedValue(
      pendingPay({
        montant: new Prisma.Decimal("50"),
        cotisationMensuelleId: null,
        detteInitialeId: "dette-2025",
      })
    );
    updateManyPaiement.mockResolvedValue({ count: 1 });
    findFirstDette.mockResolvedValue({
      id: "dette-2025",
      adherentId: "adh-A",
      montantPaye: new Prisma.Decimal("0"),
      montantRestant: new Prisma.Decimal("150"),
    });
    const r = await validatePendingPayment(admin(), "pay-1");
    expect(r.statut).toBe("Valide");
    expect(updateDette.mock.calls[0][0].data.montantPaye.toString()).toBe("50");
    expect(createAvoir).not.toHaveBeenCalled();
  });

  it("double validation → CONFLICT", async () => {
    findUniquePaiement.mockResolvedValue({ id: "pay-1", statut: "Valide" });
    await expect(validatePendingPayment(admin(), "pay-1")).rejects.toMatchObject(
      { code: "CONFLICT" }
    );
  });

  it("rejet → Annule sans crédit", async () => {
    findUniquePaiement.mockResolvedValue({
      id: "pay-1",
      statut: "EnAttente",
      description: null,
    });
    updateManyPaiement.mockResolvedValue({ count: 1 });
    const r = await rejectPendingPayment(admin(), "pay-1");
    expect(r.statut).toBe("Annule");
    expect(r.reversed).toBe(false);
    expect(updateCotisation).not.toHaveBeenCalled();
  });

  it("annulation d'un Valide → reverse crédit cotisation", async () => {
    findUniquePaiement.mockResolvedValue({
      id: "pay-1",
      statut: "Valide",
      description: "ok",
      montant: new Prisma.Decimal("40"),
      cotisationMensuelleId: "cot-A",
      detteInitialeId: null,
      assistanceId: null,
      obligationCotisationId: null,
    });
    findUniqueAvoir.mockResolvedValue(null);
    findFirstCotisation.mockResolvedValue({
      id: "cot-A",
      montantPaye: new Prisma.Decimal("40"),
      montantAttendu: new Prisma.Decimal("100"),
      montantRestant: new Prisma.Decimal("60"),
    });
    updateManyPaiement.mockResolvedValue({ count: 1 });
    const r = await rejectPendingPayment(admin(), "pay-1");
    expect(r.statut).toBe("Annule");
    expect(r.reversed).toBe(true);
    expect(updateCotisation.mock.calls[0][0].data.montantPaye.toString()).toBe(
      "0"
    );
    expect(updateCotisation.mock.calls[0][0].data.statut).toBe("EnAttente");
  });

  it("revalidation d'un Annule → crédit appliqué", async () => {
    findUniquePaiement.mockResolvedValue({
      id: "pay-1",
      statut: "Annule",
      description: "Rejeté",
      montant: new Prisma.Decimal("25"),
      moyenPaiement: "Virement",
      reference: null,
      adherentId: "adh-A",
      cotisationMensuelleId: "cot-A",
      detteInitialeId: null,
      assistanceId: null,
      obligationCotisationId: null,
      Adherent: { userId: "user-A" },
      CotisationMensuelle: {
        mois: 3,
        annee: 2026,
        TypeCotisation: { nom: "Cotisation mensuelle" },
      },
      DetteInitiale: null,
      Assistance: null,
      ObligationCotisation: null,
    });
    updateManyPaiement.mockResolvedValue({ count: 1 });
    findFirstCotisation.mockResolvedValue({
      id: "cot-A",
      adherentId: "adh-A",
      montantPaye: new Prisma.Decimal("0"),
      montantRestant: new Prisma.Decimal("100"),
      montantAttendu: new Prisma.Decimal("100"),
    });
    findManyAvoir.mockResolvedValue([]);
    const r = await validatePendingPayment(admin(), "pay-1");
    expect(r.statut).toBe("Valide");
    expect(updateCotisation.mock.calls[0][0].data.montantPaye.toString()).toBe(
      "25"
    );
  });

  it("validation → notification adhérent (Wero + objet)", async () => {
    findUniquePaiement.mockResolvedValue(pendingPay());
    updateManyPaiement.mockResolvedValue({ count: 1 });
    findFirstCotisation.mockResolvedValue({
      id: "cot-A",
      adherentId: "adh-A",
      montantPaye: new Prisma.Decimal("0"),
      montantRestant: new Prisma.Decimal("100"),
      montantAttendu: new Prisma.Decimal("100"),
    });
    findManyAvoir.mockResolvedValue([]);
    await validatePendingPayment(admin(), "pay-1");
    expect(createNotification).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-A",
        type: "Cotisation",
        titre: "Paiement validé",
        lien: "/paiement",
        message: expect.stringContaining("Wero"),
      }),
    });
    expect(createNotification.mock.calls[0][0].data.message).toContain(
      "Cotisation mensuelle"
    );
  });

  it("rejet EnAttente → notification adhérent", async () => {
    findUniquePaiement.mockResolvedValue(
      pendingPay({ moyenPaiement: "Virement", montant: new Prisma.Decimal("40") })
    );
    updateManyPaiement.mockResolvedValue({ count: 1 });
    await rejectPendingPayment(admin(), "pay-1");
    expect(createNotification).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-A",
        type: "Cotisation",
        titre: "Paiement rejeté",
        message: expect.stringContaining("virement bancaire"),
      }),
    });
  });
});

describe("libellés notification paiement", () => {
  it("formatMoyenPaiementLabel", () => {
    expect(formatMoyenPaiementLabel("Wero")).toBe("Wero");
    expect(formatMoyenPaiementLabel("Virement")).toBe("virement bancaire");
  });

  it("formatPaymentTargetLabel dette", () => {
    expect(
      formatPaymentTargetLabel({
        montant: new Prisma.Decimal("10"),
        moyenPaiement: "Wero",
        reference: null,
        Adherent: { userId: "u" },
        CotisationMensuelle: null,
        DetteInitiale: { annee: 2025 },
        Assistance: null,
        ObligationCotisation: null,
        InscriptionEvenement: null,
      })
    ).toBe("dette initiale 2025");
  });

  it("formatPaymentTargetLabel événement (EnAttente/Valide/Annule)", () => {
    expect(
      formatPaymentTargetLabel({
        montant: new Prisma.Decimal("30"),
        moyenPaiement: "Wero",
        reference: "AMAKI-2026-EVT-XXXX",
        Adherent: { userId: "u" },
        CotisationMensuelle: null,
        DetteInitiale: null,
        Assistance: null,
        ObligationCotisation: null,
        InscriptionEvenement: {
          id: "ins1",
          evenementId: "e1",
          Evenement: { titre: "Gala" },
        },
      })
    ).toBe("événement « Gala »");
  });
});

describe("isolation paiement événement / cotisations", () => {
  function pendingEventPay(overrides: Record<string, unknown> = {}) {
    return {
      id: "pay-evt-1",
      adherentId: "adh-A",
      montant: new Prisma.Decimal("30"),
      moyenPaiement: "Wero",
      reference: "AMAKI-2026-EVT-XXXX",
      statut: "EnAttente",
      description: "Déclaration Wero — en attente de validation",
      cotisationMensuelleId: null,
      detteInitialeId: null,
      assistanceId: null,
      obligationCotisationId: null,
      inscriptionEvenementId: "ins-evt-1",
      Adherent: { userId: "user-A" },
      CotisationMensuelle: null,
      DetteInitiale: null,
      Assistance: null,
      ObligationCotisation: null,
      InscriptionEvenement: {
        id: "ins-evt-1",
        evenementId: "e-gala",
        Evenement: { titre: "Gala" },
      },
      ...overrides,
    };
  }

  it("validation 30 € événement → crédite inscription seulement, pas cotisation/dette/avoir", async () => {
    findUniquePaiement.mockResolvedValue(pendingEventPay());
    updateManyPaiement.mockResolvedValue({ count: 1 });
    findFirstInscriptionEvenement.mockResolvedValue({
      id: "ins-evt-1",
      adherentId: "adh-A",
      montantAttendu: new Prisma.Decimal("30"),
      montantPaye: new Prisma.Decimal("0"),
      statutPaiement: "APayer",
    });

    const r = await validatePendingPayment(admin(), "pay-evt-1");
    expect(r.statut).toBe("Valide");
    expect(r.creditedToTarget).toBe("30");
    expect(r.surplus).toBe("0");
    expect(updateInscriptionEvenement).toHaveBeenCalled();
    expect(updateCotisation).not.toHaveBeenCalled();
    expect(updateDette).not.toHaveBeenCalled();
    expect(updateAssistance).not.toHaveBeenCalled();
    expect(createAvoir).not.toHaveBeenCalled();
  });

  it("rejet EnAttente événement → recalcule statut inscription, aucune dette/cotisation/avoir", async () => {
    findUniquePaiement.mockResolvedValue(pendingEventPay());
    updateManyPaiement.mockResolvedValue({ count: 1 });
    findFirstInscriptionEvenement.mockResolvedValue({
      id: "ins-evt-1",
      montantAttendu: new Prisma.Decimal("30"),
      montantPaye: new Prisma.Decimal("0"),
    });

    const r = await rejectPendingPayment(admin(), "pay-evt-1");
    expect(r.statut).toBe("Annule");
    expect(r.reversed).toBe(false);
    expect(updateInscriptionEvenement).toHaveBeenCalled();
    expect(updateCotisation).not.toHaveBeenCalled();
    expect(updateDette).not.toHaveBeenCalled();
    expect(createAvoir).not.toHaveBeenCalled();
  });

  it("paiement partiel événement 20/50 → PartiellementPaye, pas d'allocation cotisation", async () => {
    const tx = mockTx();
    findFirstInscriptionEvenement.mockResolvedValue({
      id: "ins-evt-1",
      adherentId: "adh-A",
      montantAttendu: new Prisma.Decimal("50"),
      montantPaye: new Prisma.Decimal("0"),
    });

    const r = await applyValidatedPaymentCredit(tx as never, {
      id: "pay-part",
      adherentId: "adh-A",
      montant: new Prisma.Decimal("20"),
      cotisationMensuelleId: null,
      detteInitialeId: null,
      assistanceId: null,
      obligationCotisationId: null,
      inscriptionEvenementId: "ins-evt-1",
    });

    expect(r.creditedToTarget).toBe("20");
    expect(r.surplus).toBe("0");
    expect(updateInscriptionEvenement.mock.calls[0][0].data.montantPaye.toString()).toBe(
      "20"
    );
    expect(updateInscriptionEvenement.mock.calls[0][0].data.statutPaiement).toBe(
      "PartiellementPaye"
    );
    expect(updateCotisation).not.toHaveBeenCalled();
    expect(updateDette).not.toHaveBeenCalled();
    expect(createAvoir).not.toHaveBeenCalled();
  });
});

describe("applyValidatedPaymentCredit scénario 100→30→70", () => {
  it("applique +30 puis +70", async () => {
    const tx = mockTx();
    findFirstCotisation
      .mockResolvedValueOnce({
        id: "cot-A",
        adherentId: "adh-A",
        montantPaye: new Prisma.Decimal("0"),
        montantRestant: new Prisma.Decimal("100"),
        montantAttendu: new Prisma.Decimal("100"),
      })
      .mockResolvedValueOnce({
        id: "cot-A",
        adherentId: "adh-A",
        montantPaye: new Prisma.Decimal("30"),
        montantRestant: new Prisma.Decimal("70"),
        montantAttendu: new Prisma.Decimal("100"),
      });
    findManyAvoir.mockResolvedValue([]);

    await applyValidatedPaymentCredit(tx as never, {
      id: "p1",
      adherentId: "adh-A",
      montant: new Prisma.Decimal("30"),
      cotisationMensuelleId: "cot-A",
      detteInitialeId: null,
      assistanceId: null,
      obligationCotisationId: null,
    });
    await applyValidatedPaymentCredit(tx as never, {
      id: "p2",
      adherentId: "adh-A",
      montant: new Prisma.Decimal("70"),
      cotisationMensuelleId: "cot-A",
      detteInitialeId: null,
      assistanceId: null,
      obligationCotisationId: null,
    });
    expect(updateCotisation.mock.calls[1][0].data.montantPaye.toString()).toBe(
      "100"
    );
    expect(updateCotisation.mock.calls[1][0].data.statut).toBe("Paye");
  });
});
