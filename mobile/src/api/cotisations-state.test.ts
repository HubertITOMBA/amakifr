import { describe, expect, it } from "vitest";
import {
  COTISATION_SCREEN_SECTIONS,
  COTISATION_SECTION_TITLES,
  cotisationErrorMessage,
  filterAssistancesByMonth,
  filterCotisationsByMonth,
  formatAssistanceTitle,
  mapFinanceStatutDisplay,
  mapMoyenPaiement,
  shouldShowAvoir,
} from "@/api/cotisations-state";
import type { MyAssistanceDto, MyCotisationYearItemDto } from "@/api/types";

function item(mois: number, id = String(mois)): MyCotisationYearItemDto {
  return {
    id,
    periode: `2026-${String(mois).padStart(2, "0")}`,
    annee: 2026,
    mois,
    typeCotisationId: "t",
    adherentId: "a",
    adherentBeneficiaireId: null,
    montantAttendu: "50",
    montantPaye: "0",
    montantRestant: "50",
    dateEcheance: "2026-01-01T00:00:00.000Z",
    statut: "EnAttente",
    description: null,
    cotisationDuMoisId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    typeCotisation: {
      id: "t",
      nom: "Forfait",
      description: null,
      montant: "50",
      obligatoire: true,
      actif: true,
      ordre: 1,
      categorie: "ForfaitMensuel",
      aBeneficiaire: false,
    },
    hasPendingPayment: false,
  };
}

function assistance(
  mois: number,
  displayLabel: string,
  id = `a-${mois}-${displayLabel}`
): MyAssistanceDto {
  return {
    id,
    source: "cotisation",
    paymentTargetType: "cotisation-mensuelle",
    displayLabel,
    libelle: "Décès adhérent",
    description: displayLabel,
    annee: 2026,
    mois,
    periode: `2026-${String(mois).padStart(2, "0")}`,
    dateEvenement: null,
    typeEvenement: null,
    montantAttendu: "50",
    montantPaye: "0",
    montantRestant: "50",
    statut: "EnAttente",
    hasPendingPayment: false,
  };
}

describe("COTISATION_SCREEN_SECTIONS", () => {
  it("ordre Phase A : synthèse → dettes → cotisations → assistances → historique", () => {
    expect([...COTISATION_SCREEN_SECTIONS]).toEqual([
      "synthese",
      "dettes",
      "cotisations",
      "assistances",
      "historique",
    ]);
    expect(COTISATION_SECTION_TITLES.cotisations).toBe(
      "Cotisation mensuelle forfaitaire"
    );
  });
});

describe("formatAssistanceTitle", () => {
  it("utilise displayLabel serveur (aligné Web)", () => {
    expect(
      formatAssistanceTitle({
        displayLabel: "Décès adhérent - Madame Henriette",
        libelle: "Décès adhérent",
        description: "Décès adhérent - Madame Henriette",
      })
    ).toBe("Décès adhérent - Madame Henriette");
    expect(
      formatAssistanceTitle({
        displayLabel: "Assistance mariage - Monsieur Bruno",
        libelle: "Assistance mariage",
        description: null,
      })
    ).toBe("Assistance mariage - Monsieur Bruno");
  });
});

describe("filterAssistancesByMonth", () => {
  const list = [
    assistance(3, "Décès adhérent - Madame Henriette", "m3-a"),
    assistance(3, "Décès adhérent - Monsieur Bruno", "m3-b"),
    assistance(4, "Assistance mariage - Madame Claire", "m4-a"),
  ];

  it("Tous → chaque assistance une seule fois", () => {
    const all = filterAssistancesByMonth(list, 0);
    expect(all).toHaveLength(3);
    expect(new Set(all.map((a) => a.id)).size).toBe(3);
  });

  it("mars → uniquement mars (plusieurs OK)", () => {
    const mars = filterAssistancesByMonth(list, 3);
    expect(mars.map((a) => a.id)).toEqual(["m3-a", "m3-b"]);
  });

  it("avril → assistance mars absente", () => {
    const avril = filterAssistancesByMonth(list, 4);
    expect(avril.map((a) => a.id)).toEqual(["m4-a"]);
    expect(avril.some((a) => a.mois === 3)).toBe(false);
  });
});

describe("filterCotisationsByMonth", () => {
  const list = [item(1), item(3), item(5)];
  it("tous les mois", () => {
    expect(filterCotisationsByMonth(list, 0)).toHaveLength(3);
  });
  it("filtre mars", () => {
    expect(filterCotisationsByMonth(list, 3).map((c) => c.mois)).toEqual([3]);
  });
});

describe("shouldShowAvoir", () => {
  it("positif seulement", () => {
    expect(shouldShowAvoir("15")).toBe(true);
    expect(shouldShowAvoir("0")).toBe(false);
    expect(shouldShowAvoir(null)).toBe(false);
  });
});

describe("mapMoyenPaiement", () => {
  it("mappe Stripe/Mollie vers carte", () => {
    expect(mapMoyenPaiement("Stripe")).toBe("Carte bancaire");
    expect(mapMoyenPaiement("Virement")).toBe("Virement");
  });
});

describe("mapFinanceStatutDisplay", () => {
  it("conserve labels FR + tones lisibles", () => {
    expect(mapFinanceStatutDisplay("PartiellementPaye")).toEqual({
      label: "Partiellement payé",
      tone: "warning",
    });
    expect(mapFinanceStatutDisplay("EnRetard").tone).toBe("danger");
    expect(mapFinanceStatutDisplay("Paye").label).toBe("Payé");
  });
});

describe("cotisationErrorMessage", () => {
  it("réseau", () => {
    expect(
      cotisationErrorMessage({ status: 0, code: "NETWORK_ERROR", message: "" })
    ).toBe("Serveur injoignable");
  });
});
