import { describe, expect, it } from "vitest";
import {
  adminHistoriqueColumnVisibilityForDomaine,
  buildPaymentDestinationLabel,
  isTechnicalPaymentNote,
} from "@/lib/services/cotisations/payment-destination-label";

describe("payment-destination-label", () => {
  it("cotisation mensuelle", () => {
    expect(
      buildPaymentDestinationLabel({
        CotisationMensuelle: {
          mois: 3,
          annee: 2026,
          TypeCotisation: { nom: "Cotisation forfaitaire" },
        },
        DetteInitiale: null,
        Assistance: null,
        description:
          "Déclaration Wero — en attente de validation | Validé par l'administration",
      })
    ).toBe("Cotisation forfaitaire — mars 2026");
  });

  it("dette", () => {
    expect(
      buildPaymentDestinationLabel({
        CotisationMensuelle: null,
        DetteInitiale: { annee: 2025 },
        Assistance: null,
        description: "Annulation admin (crédit rétabli)",
      })
    ).toBe("Dette antérieure 2025");
  });

  it("assistance", () => {
    expect(
      buildPaymentDestinationLabel({
        CotisationMensuelle: null,
        DetteInitiale: null,
        Assistance: { type: "DecesFamille", description: "Madame Henriette" },
        description: null,
      })
    ).toBe("Assistance Décès familial — Madame Henriette");
  });

  it("obligation", () => {
    expect(
      buildPaymentDestinationLabel({
        CotisationMensuelle: null,
        DetteInitiale: null,
        Assistance: null,
        ObligationCotisation: { periode: "2026-Q1" },
        description: "Validé par l'administration",
      })
    ).toBe("Obligation de cotisation (2026-Q1)");
  });

  it("événement", () => {
    expect(
      buildPaymentDestinationLabel({
        CotisationMensuelle: null,
        DetteInitiale: null,
        Assistance: null,
        InscriptionEvenement: { Evenement: { titre: "Gala AMAKI" } },
        description: "Déclaration Wero — en attente de validation",
      })
    ).toBe("Événement — Gala AMAKI");
  });

  it("note admin ne remplace jamais destination", () => {
    expect(
      isTechnicalPaymentNote(
        "Déclaration Wero — en attente de validation | Validé par l'administration | Annulation admin (crédit rétabli)"
      )
    ).toBe(true);
    expect(
      buildPaymentDestinationLabel({
        CotisationMensuelle: null,
        DetteInitiale: null,
        Assistance: null,
        description:
          "Déclaration Wero — en attente de validation | Validé par l'administration",
      })
    ).toBe("Paiement");
  });

  it("colonnes selon filtre Domaine", () => {
    const cot = adminHistoriqueColumnVisibilityForDomaine("cotisations");
    expect(cot.evenement).toBe(false);
    expect(cot.destination).toBe(true);
    expect(cot.typePersonne).toBe(false);
    expect(cot.domaine).toBe(false);

    const evt = adminHistoriqueColumnVisibilityForDomaine("evenements");
    expect(evt.evenement).toBe(true);
    expect(evt.destination).toBe(false);
    expect(evt.typePersonne).toBe(true);

    const all = adminHistoriqueColumnVisibilityForDomaine("all");
    expect(all.domaine).toBe(true);
    expect(all.destination).toBe(true);
    expect(all.evenement).toBe(false);
  });
});
