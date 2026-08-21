import { describe, expect, it } from "vitest";
import {
  buildClientPaymentReference,
  buildPayableTargetsFromYear,
  buildSharePaymentCoords,
  buildVirementModalContent,
  buildWeroModalContent,
  canDeclarePartialAmount,
  canShowPayButton,
  DECLARE_OVERPAYMENT_HINT,
  declarePaymentErrorMessage,
  formatIbanDisplay,
  getPaymentCardActions,
  isDeclaredAmountOverRestant,
  isWeroAvailable,
  mainScreenExposesBankDetails,
  NO_ACTIVE_PAYMENT_ACCOUNT_MESSAGE,
  PAYMENT_ALREADY_PENDING_MESSAGE,
  paymentStatusLabel,
  targetHasPendingPayment,
  validateJustificatifSelection,
  WERO_PAYMENT_HINT,
} from "@/api/payment-account-state";
import type { ActivePaymentAccountDto } from "@/api/payment-account-state";

const account: ActivePaymentAccountDto = {
  libelle: "Principal",
  titulaire: "AMAKI",
  iban: "FR7612345678901234567890185",
  bic: "AGRIFRPP",
  codeBanque: null,
  codeGuichet: null,
  numeroCompte: null,
  cleRib: null,
  telephoneWero: "+33612345678",
  weroActif: true,
};

describe("payment-account-state", () => {
  it("Wero disponible", () => {
    expect(isWeroAvailable(account)).toBe(true);
    expect(isWeroAvailable({ ...account, weroActif: false })).toBe(false);
  });

  it("format IBAN", () => {
    expect(formatIbanDisplay("FR7612345678901234567890185")).toContain("FR76");
  });

  it("statuts paiement", () => {
    expect(paymentStatusLabel("EnAttente")).toBe("En attente de validation");
    expect(paymentStatusLabel("Valide")).toBe("Validé");
  });

  it("targetHasPendingPayment", () => {
    const payments = [
      {
        statut: "EnAttente",
        cotisationMensuelleId: "cot-A",
        detteInitialeId: null,
        assistanceId: null,
      },
      {
        statut: "Valide",
        cotisationMensuelleId: "cot-B",
        detteInitialeId: null,
        assistanceId: null,
      },
    ];
    expect(
      targetHasPendingPayment(payments, "cotisation-mensuelle", "cot-A")
    ).toBe(true);
    expect(
      targetHasPendingPayment(payments, "cotisation-mensuelle", "cot-B")
    ).toBe(false);
  });

  it("canShowPayButton — reste > 0 sans pending", () => {
    expect(canShowPayButton("50.00", false)).toBe(true);
    expect(canShowPayButton("0", false)).toBe(false);
    expect(canShowPayButton("50.00", true)).toBe(false);
  });

  it("buildPayableTargetsFromYear — hasPendingPayment exclut la ligne", () => {
    const targets = buildPayableTargetsFromYear({
      dettes: [
        {
          id: "dette-1",
          annee: 2024,
          montantRestant: "30.00",
          hasPendingPayment: true,
        },
      ],
      cotisations: [],
      assistances: [],
    });
    expect(targets).toEqual([]);
  });

  it("buildPayableTargetsFromYear — mapping serveur, pas le libellé", () => {
    const targets = buildPayableTargetsFromYear({
      dettes: [
        { id: "dette-1", annee: 2024, montantRestant: "30.00" },
      ],
      cotisations: [
        {
          id: "cm-forfait",
          mois: 3,
          periode: "2026-03",
          montantRestant: "50.00",
          typeCotisation: { nom: "Forfait" },
        },
      ],
      assistances: [
        {
          id: "cm-ass-1",
          montantRestant: "50.00",
          displayLabel: "Assistance mariage - Madame Claire",
          libelle: "Assistance mariage",
          paymentTargetType: "cotisation-mensuelle",
        },
        {
          // Cas théorique : vraie entité Assistance
          id: "ass-entity-1",
          montantRestant: "50.00",
          displayLabel: "Assistance (entité)",
          paymentTargetType: "assistance",
        },
      ],
      obligations: [
        { id: "obl-1", annee: 2026, montantRestant: "20.00" },
      ],
      paiements: [],
    });

    expect(targets).toEqual([
      expect.objectContaining({
        targetType: "dette-initiale",
        targetId: "dette-1",
      }),
      expect.objectContaining({
        targetType: "cotisation-mensuelle",
        targetId: "cm-forfait",
      }),
      expect.objectContaining({
        targetType: "cotisation-mensuelle",
        targetId: "cm-ass-1",
      }),
      expect.objectContaining({
        targetType: "assistance",
        targetId: "ass-entity-1",
      }),
      expect.objectContaining({
        targetType: "obligation",
        targetId: "obl-1",
      }),
    ]);
    // Ne jamais mapper sur le texte « Assistance »
    expect(
      targets.find((t) => t.targetId === "cm-ass-1")?.targetType
    ).toBe("cotisation-mensuelle");
  });

  it("declarePaymentErrorMessage PAYMENT_ALREADY_PENDING", () => {
    expect(
      declarePaymentErrorMessage({
        code: "PAYMENT_ALREADY_PENDING",
        message: PAYMENT_ALREADY_PENDING_MESSAGE,
        status: 409,
      })
    ).toBe(PAYMENT_ALREADY_PENDING_MESSAGE);
  });

  it("partiel et surpaiement autorisé", () => {
    expect(canDeclarePartialAmount("20", "50").ok).toBe(true);
    expect(canDeclarePartialAmount("50", "50").ok).toBe(true);
    expect(canDeclarePartialAmount("100", "50").ok).toBe(true);
    expect(canDeclarePartialAmount("0", "50").ok).toBe(false);
    expect(canDeclarePartialAmount("-5", "50").ok).toBe(false);
    expect(canDeclarePartialAmount("abc", "50").ok).toBe(false);
    expect(isDeclaredAmountOverRestant("100", "50")).toBe(true);
    expect(isDeclaredAmountOverRestant("50", "50")).toBe(false);
    expect(DECLARE_OVERPAYMENT_HINT.length).toBeGreaterThan(20);
  });

  it("share coords", () => {
    const s = buildSharePaymentCoords(account, "AMAKI-2026-COT-X");
    expect(s).toContain("IBAN");
    expect(s).toContain("Wero");
    expect(s).toContain("AMAKI-2026-COT-X");
  });

  it("référence client", () => {
    expect(buildClientPaymentReference("cotisation-mensuelle", 2026)).toMatch(
      /^AMAKI-2026-COT-/
    );
  });

  it("justificatif validation", () => {
    expect(validateJustificatifSelection(null).ok).toBe(false);
    expect(
      validateJustificatifSelection({
        uri: "file://x.pdf",
        name: "x.pdf",
        mime: "application/pdf",
        size: 100,
      }).ok
    ).toBe(true);
    expect(
      validateJustificatifSelection({
        uri: "file://x.mp4",
        name: "x.mp4",
        mime: "video/mp4",
        size: 100,
      }).ok
    ).toBe(false);
    expect(
      validateJustificatifSelection({
        uri: "file://x.pdf",
        name: "x.pdf",
        mime: "application/pdf",
        size: 11 * 1024 * 1024,
      }).ok
    ).toBe(false);
  });
});

describe("UX carte paiement (page principale)", () => {
  it("aucun compte actif → warning", () => {
    const a = getPaymentCardActions(null);
    expect(a.warningMessage).toBe(NO_ACTIVE_PAYMENT_ACCOUNT_MESSAGE);
    expect(a.showPaymentCard).toBe(false);
    expect(a.showWeroButton).toBe(false);
    expect(a.showVirementButton).toBe(false);
  });

  it("compte actif → carte paiement", () => {
    const a = getPaymentCardActions(account);
    expect(a.showPaymentCard).toBe(true);
    expect(a.warningMessage).toBeNull();
    expect(a.showVirementButton).toBe(true);
  });

  it("Wero actif → bouton Wero", () => {
    expect(getPaymentCardActions(account).showWeroButton).toBe(true);
  });

  it("Wero inactif → bouton Wero absent", () => {
    const a = getPaymentCardActions({
      ...account,
      weroActif: false,
      telephoneWero: null,
    });
    expect(a.showWeroButton).toBe(false);
    expect(a.showVirementButton).toBe(true);
  });

  it("aucune coordonnée bancaire sur la page principale", () => {
    expect(mainScreenExposesBankDetails()).toBe(false);
  });

  it("ouverture Wero → téléphone + référence", () => {
    const c = buildWeroModalContent(account, "AMAKI-2026-COT-XYZ", "25.00");
    expect(c).not.toBeNull();
    expect(c!.phone).toBe("+33612345678");
    expect(c!.reference).toBe("AMAKI-2026-COT-XYZ");
    expect(c!.hint).toBe(WERO_PAYMENT_HINT);
  });

  it("Wero inactif → contenu modal null", () => {
    expect(
      buildWeroModalContent(
        { ...account, weroActif: false },
        "REF",
        "10"
      )
    ).toBeNull();
  });

  it("virement → IBAN/BIC/référence", () => {
    const c = buildVirementModalContent(account, "AMAKI-REF", "40");
    expect(c.iban).toBe(account.iban);
    expect(c.bic).toBe(account.bic);
    expect(c.titulaire).toBe("AMAKI");
    expect(c.reference).toBe("AMAKI-REF");
    expect(c.amount).toBe("40");
  });
});
