/**
 * @vitest-environment jsdom
 *
 * Vérifie l’honneur de ?vue= et l’affichage CM + DetteInitiale multi-années
 * sans élargir les Assistances reçues.
 */
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CotisationsSection } from "@/components/user/CotisationsSection";

let vueParam: string | null = "toutes";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => ({
    get: (key: string) => (key === "vue" ? vueParam : null),
  }),
}));

vi.mock("react-toastify", () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

vi.mock("@/actions/paiements", () => ({
  getSimulationVersementAssistance: vi.fn(),
  getSimulationVersementAssistanceForUser: vi.fn(),
  getTypesAssistancePourSimulation: vi.fn(async () => ({
    success: true,
    data: [],
  })),
}));

const profile = {
  id: "user-1",
  role: "ADHERENT",
  typeForfait: { montant: 10 },
  adherent: {
    id: "adh-1",
    DettesInitiales: [
      {
        id: "di-2023",
        annee: 2023,
        montant: 100,
        montantPaye: 0,
        montantRestant: 100,
        description: "Dette 2023",
      },
      {
        id: "di-2022",
        annee: 2022,
        montant: 50,
        montantPaye: 0,
        montantRestant: 50,
      },
    ],
    CotisationsMensuelles: [
      {
        id: "cm-2024-01",
        mois: 1,
        annee: 2024,
        montantAttendu: 20,
        montantPaye: 0,
        montantRestant: 20,
        dateEcheance: "2024-01-15",
        periode: "2024-01",
        statut: "EnAttente",
        TypeCotisation: { nom: "Forfait mensuel", aBeneficiaire: false },
        Paiements: [],
      },
      {
        id: "cm-2025-06",
        mois: 6,
        annee: 2025,
        montantAttendu: 20,
        montantPaye: 0,
        montantRestant: 20,
        dateEcheance: "2025-06-15",
        periode: "2025-06",
        statut: "EnAttente",
        TypeCotisation: { nom: "Forfait mensuel", aBeneficiaire: false },
        Paiements: [],
      },
    ],
    // Assistance reçue (bénéficiaire = self) — ne doit pas devenir payable
    Assistances: [
      {
        id: "ass-recv",
        type: "Deces",
        montant: 200,
        montantPaye: 0,
        montantRestant: 200,
        statut: "EnAttente",
        dateEvenement: "2023-05-01",
        adherentId: "adh-1",
        Adherent: { firstname: "A", lastname: "B" },
      },
    ],
    Avoirs: [],
    ObligationsCotisation: [],
  },
};

describe("CotisationsSection — vue URL", () => {
  beforeEach(() => {
    vueParam = "toutes";
  });

  afterEach(() => {
    cleanup();
  });

  it("vue=toutes affiche CM multi-années et DettesInitiales sans borne", () => {
    render(<CotisationsSection profile={profile as never} />);

    expect(screen.getByText(/Toutes mes cotisations/i)).toBeTruthy();
    // DettesInitiales : années 2023 et 2022 (pas de filtre année serveur/UI)
    expect(screen.getByText("2023")).toBeTruthy();
    expect(screen.getByText("2022")).toBeTruthy();
    // CM multi-années : deux lignes forfait (2024-01 + 2025-06) — description affichée
    expect(
      screen.getAllByText(/Cotisation mensuelle forfaitaire/i).length
    ).toBeGreaterThanOrEqual(2);
  });

  it("vue invalide → défaut mois (pas « Toutes »)", () => {
    vueParam = "nope";
    render(<CotisationsSection profile={profile as never} />);
    expect(screen.queryByText(/^Toutes mes cotisations$/i)).toBeNull();
    expect(screen.getByText(/Cotisations du mois/i)).toBeTruthy();
  });

  it("Assistance reçue (bénéficiaire self) non listée comme payable", () => {
    render(<CotisationsSection profile={profile as never} />);
    // Pas de ligne « Assistance Deces » dans le tableau des cotisations du mois/toutes
    // (bénéficiaire filtré) — le titre Dettes Initiales peut exister
    const assistanceRows = screen.queryAllByText(/Assistance Deces/i);
    expect(assistanceRows.length).toBe(0);
  });

  it("readOnly (viewAs) masque les actions Payer", () => {
    render(
      <CotisationsSection
        profile={profile as never}
        viewAsUserId="admin-view"
        readOnly
      />
    );
    expect(screen.queryByRole("button", { name: /^payer$/i })).toBeNull();
  });
});
