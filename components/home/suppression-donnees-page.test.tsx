/**
 * @vitest-environment jsdom
 *
 * Design + formulaire + flux — page publique /suppression-donnees.
 */
import React from "react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  SUPPRESSION_DONNEES_APP_SCOPE,
  SUPPRESSION_DONNEES_CATEGORIES_SUPPRIMEES,
  SUPPRESSION_DONNEES_CONSERVEES,
  SUPPRESSION_DONNEES_DELAI,
  SUPPRESSION_DONNEES_NO_DIRECT_DELETE,
  SUPPRESSION_DONNEES_PROCEDURE,
} from "@/lib/rgpd/suppression-donnees-content";

const submitDataDeletionRequest = vi.fn();

vi.mock("@/actions/data-deletion", () => ({
  submitDataDeletionRequest: (...args: unknown[]) =>
    submitDataDeletionRequest(...args),
}));

vi.mock("@/components/home/DynamicNavbar", () => ({
  DynamicNavbar: () => <nav data-testid="mock-navbar">Navbar</nav>,
}));

vi.mock("@/components/home/Footer", () => ({
  Footer: () => <footer data-testid="mock-footer">Footer</footer>,
}));

vi.mock("react-toastify", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import SuppressionDonneesPage from "@/app/suppression-donnees/page";

describe("SuppressionDonneesPage — design public", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    submitDataDeletionRequest.mockResolvedValue({
      success: true,
      deleted: false,
      message:
        "Demande prise en compte. Une vérification d'identité est requise.",
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("affiche un CardHeader avec padding et dégradé AMAKI", () => {
    render(<SuppressionDonneesPage />);
    const header = screen.getByTestId("suppression-card-header");
    expect(header.className).toMatch(/bg-gradient-to-r/);
    expect(header.className).toMatch(/from-blue-500/);
    expect(header.className).toMatch(/px-5|sm:px-6/);
    expect(header.className).toMatch(/pt-5|sm:pt-6/);
    expect(screen.getByTestId("suppression-main-card").className).toMatch(
      /overflow-hidden/
    );
  });

  it("expose un titre principal accessible", () => {
    render(<SuppressionDonneesPage />);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /AMAKI — Suppression des données/i,
      })
    ).toBeTruthy();
  });

  it("distingue explications, catégories, formulaire et conserve les textes obligatoires", () => {
    render(<SuppressionDonneesPage />);
    expect(screen.getByTestId("suppression-explications")).toBeTruthy();
    expect(screen.getByTestId("suppression-donnees-categories")).toBeTruthy();
    expect(screen.getByTestId("suppression-formulaire")).toBeTruthy();
    expect(screen.getByTestId("suppression-aide")).toBeTruthy();

    expect(screen.getByText(SUPPRESSION_DONNEES_APP_SCOPE)).toBeTruthy();
    expect(screen.getByText(SUPPRESSION_DONNEES_NO_DIRECT_DELETE)).toBeTruthy();
    expect(screen.getByText(SUPPRESSION_DONNEES_DELAI)).toBeTruthy();

    for (const step of SUPPRESSION_DONNEES_PROCEDURE) {
      expect(screen.getByText(step)).toBeTruthy();
    }
    for (const item of SUPPRESSION_DONNEES_CATEGORIES_SUPPRIMEES) {
      expect(screen.getByText(item)).toBeTruthy();
    }
    for (const item of SUPPRESSION_DONNEES_CONSERVEES) {
      expect(screen.getByText(item)).toBeTruthy();
    }
  });

  it("conserve le lien vers /confidentialite et les labels du formulaire", () => {
    render(<SuppressionDonneesPage />);
    const links = screen.getAllByRole("link", {
      name: /politique de confidentialité/i,
    });
    expect(links.length).toBeGreaterThanOrEqual(1);
    expect(links[0].getAttribute("href")).toBe("/confidentialite");

    expect(screen.getByLabelText(/Adresse e-mail du compte/i)).toBeTruthy();
    expect(screen.getByLabelText(/Message \(optionnel\)/i)).toBeTruthy();
    expect(
      screen.getByRole("button", {
        name: /Envoyer la demande de suppression/i,
      })
    ).toBeTruthy();
    expect(
      screen.getByText(/Seule information strictement nécessaire/i)
    ).toBeTruthy();
  });

  it("soumet le formulaire inchangé (email + message optionnel) puis affiche la confirmation", async () => {
    const user = userEvent.setup();
    render(<SuppressionDonneesPage />);

    await user.type(
      screen.getByLabelText(/Adresse e-mail du compte/i),
      "membre@example.com"
    );
    await user.type(
      screen.getByLabelText(/Message \(optionnel\)/i),
      "Merci de traiter"
    );
    await user.click(
      screen.getByRole("button", {
        name: /Envoyer la demande de suppression/i,
      })
    );

    await waitFor(() => {
      expect(submitDataDeletionRequest).toHaveBeenCalledTimes(1);
    });

    const fd = submitDataDeletionRequest.mock.calls[0][0] as FormData;
    expect(fd.get("email")).toBe("membre@example.com");
    expect(fd.get("message")).toBe("Merci de traiter");

    expect(
      await screen.findByRole("heading", { level: 1, name: /Demande reçue/i })
    ).toBeTruthy();
    expect(screen.getByTestId("suppression-confirmation-header").className).toMatch(
      /bg-gradient-to-r/
    );
    expect(screen.getByTestId("suppression-confirmation-alert")).toBeTruthy();
    expect(
      within(screen.getByTestId("suppression-confirmation-alert")).getByText(
        new RegExp(SUPPRESSION_DONNEES_NO_DIRECT_DELETE.slice(0, 40))
      )
    ).toBeTruthy();
  });
});
