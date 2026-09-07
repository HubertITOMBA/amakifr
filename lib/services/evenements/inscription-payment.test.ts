import { describe, expect, it } from "vitest";
import { Prisma, StatutPaiementEvenement } from "@prisma/client";
import {
  canDeclareEventInscriptionPayment,
  canSelfWithdrawEventInscription,
  computeInscriptionMontantAttendu,
  initialStatutPaiementEvenement,
  inscriptionMontantRestant,
  resolveStatutPaiementAfterAmounts,
} from "@/lib/services/evenements/inscription-payment";

describe("inscription-payment helpers", () => {
  it("snapshot prix × N personnes", () => {
    expect(computeInscriptionMontantAttendu(25, 2).toString()).toBe("50");
    expect(computeInscriptionMontantAttendu(null, 2).toString()).toBe("0");
    expect(computeInscriptionMontantAttendu(0, 3).toString()).toBe("0");
  });

  it("statut initial", () => {
    expect(initialStatutPaiementEvenement(new Prisma.Decimal(50))).toBe(
      StatutPaiementEvenement.APayer
    );
    expect(initialStatutPaiementEvenement(new Prisma.Decimal(0))).toBe(
      StatutPaiementEvenement.NonApplicable
    );
  });

  it("restant et résolution statut", () => {
    expect(
      inscriptionMontantRestant(50, 20).toString()
    ).toBe("30");
    expect(
      resolveStatutPaiementAfterAmounts({
        montantAttendu: new Prisma.Decimal(50),
        montantPaye: new Prisma.Decimal(50),
      })
    ).toBe(StatutPaiementEvenement.Paye);
    expect(
      resolveStatutPaiementAfterAmounts({
        montantAttendu: new Prisma.Decimal(50),
        montantPaye: new Prisma.Decimal(20),
      })
    ).toBe(StatutPaiementEvenement.PartiellementPaye);
    expect(
      resolveStatutPaiementAfterAmounts({
        montantAttendu: new Prisma.Decimal(50),
        montantPaye: new Prisma.Decimal(0),
        hasPendingPayment: true,
      })
    ).toBe(StatutPaiementEvenement.EnAttenteValidation);
  });

  it("désinscription / canPay", () => {
    expect(canSelfWithdrawEventInscription({ montantPaye: 0, hasPendingPayment: false }).allowed).toBe(true);
    expect(canSelfWithdrawEventInscription({ montantPaye: 0, hasPendingPayment: true }).allowed).toBe(false);
    expect(canSelfWithdrawEventInscription({ montantPaye: 10, hasPendingPayment: false }).allowed).toBe(false);
    expect(
      canDeclareEventInscriptionPayment({
        statutPaiement: StatutPaiementEvenement.APayer,
        montantRestant: new Prisma.Decimal(50),
        hasPendingPayment: false,
      })
    ).toBe(true);
    expect(
      canDeclareEventInscriptionPayment({
        statutPaiement: StatutPaiementEvenement.APayer,
        montantRestant: new Prisma.Decimal(50),
        hasPendingPayment: true,
      })
    ).toBe(false);
  });
});
