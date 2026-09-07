import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma, StatutPaiementEvenement } from "@prisma/client";
import type { AuthContext } from "@/lib/auth-context";

const {
  findUniqueAdherent,
  findFirstCompte,
  transaction,
  createNotif,
} = vi.hoisted(() => ({
  findUniqueAdherent: vi.fn(),
  findFirstCompte: vi.fn(),
  transaction: vi.fn(),
  createNotif: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    adherent: { findUnique: findUniqueAdherent },
    comptePaiementAssociation: { findFirst: findFirstCompte },
    notification: { create: createNotif },
    $transaction: transaction,
  },
}));

vi.mock("@/lib/authorize", () => ({
  authorize: vi.fn().mockResolvedValue(undefined),
}));

import {
  buildPaymentReference,
  declareBankOrWeroPayment,
} from "@/lib/services/paiements/declare-bank-wero-payment";

const actor = (): AuthContext =>
  ({
    userId: "u1",
    email: "a@b.com",
    role: "MEMBRE",
    status: "Actif",
    adminRoles: [],
    adherentId: null,
    name: "Ada",
    sessionId: null,
    channel: "mobile",
  }) as AuthContext;

describe("paiement inscription-evenement", () => {
  beforeEach(() => {
    findUniqueAdherent.mockReset();
    findFirstCompte.mockReset();
    transaction.mockReset();
    findUniqueAdherent.mockResolvedValue({ id: "ad1" });
    findFirstCompte.mockResolvedValue({
      id: "acc1",
      weroActif: true,
      telephoneWero: "+33600000000",
      actifPourPaiement: true,
    });
  });

  it("référence EVT", () => {
    expect(buildPaymentReference("inscription-evenement", 2026)).toMatch(
      /^AMAKI-2026-EVT-/
    );
  });

  it("refuse surpaiement événement", async () => {
    transaction.mockImplementation(async (fn: any) => {
      const tx = {
        paiementCotisation: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn(),
        },
        inscriptionEvenement: {
          findFirst: vi.fn().mockResolvedValue({
            id: "ins1",
            adherentId: "ad1",
            statut: "EnAttente",
            montantAttendu: new Prisma.Decimal(50),
            montantPaye: new Prisma.Decimal(0),
            statutPaiement: StatutPaiementEvenement.APayer,
            Evenement: { prix: new Prisma.Decimal(25), titre: "AG" },
          }),
          update: vi.fn(),
        },
      };
      return fn(tx);
    });

    await expect(
      declareBankOrWeroPayment(actor(), {
        targetType: "inscription-evenement",
        targetId: "ins1",
        amount: "60",
        paymentMethod: "Wero",
        justificatifChemin: "/tmp/j.pdf",
      })
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("déclaration partielle OK + EnAttenteValidation", async () => {
    const create = vi.fn().mockResolvedValue({
      id: "pay1",
      montant: new Prisma.Decimal(20),
      moyenPaiement: "Wero",
      reference: "AMAKI-2026-EVT-XXXX",
      statut: "EnAttente",
    });
    const updateIns = vi.fn();
    transaction.mockImplementation(async (fn: any) => {
      const tx = {
        paiementCotisation: {
          findFirst: vi.fn().mockResolvedValue(null),
          create,
        },
        inscriptionEvenement: {
          findFirst: vi.fn().mockResolvedValue({
            id: "ins1",
            adherentId: "ad1",
            statut: "EnAttente",
            montantAttendu: new Prisma.Decimal(50),
            montantPaye: new Prisma.Decimal(0),
            statutPaiement: StatutPaiementEvenement.APayer,
            Evenement: { prix: new Prisma.Decimal(25), titre: "AG" },
          }),
          update: updateIns,
        },
      };
      return fn(tx);
    });

    const r = await declareBankOrWeroPayment(actor(), {
      targetType: "inscription-evenement",
      targetId: "ins1",
      amount: "20",
      paymentMethod: "Wero",
      justificatifChemin: "/tmp/j.pdf",
    });
    expect(r.statut).toBe("EnAttente");
    expect(create.mock.calls[0][0].data.inscriptionEvenementId).toBe("ins1");
    expect(create.mock.calls[0][0].data.cotisationMensuelleId).toBeNull();
    expect(updateIns).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { statutPaiement: StatutPaiementEvenement.EnAttenteValidation },
      })
    );
  });
});
