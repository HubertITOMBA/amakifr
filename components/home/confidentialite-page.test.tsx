/**
 * @vitest-environment jsdom
 *
 * Design + contenus obligatoires — page publique /confidentialite.
 */
import React from "react";
import { describe, expect, it, vi, afterEach } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";

vi.mock("@/components/home/DynamicNavbar", () => ({
  DynamicNavbar: () => <nav data-testid="mock-navbar">Navbar</nav>,
}));

vi.mock("@/components/home/Footer", () => ({
  Footer: () => <footer data-testid="mock-footer">Footer</footer>,
}));

import ConfidentialitePage from "@/app/confidentialite/page";

describe("ConfidentialitePage — design public", () => {
  afterEach(() => {
    cleanup();
  });

  it("affiche un CardHeader avec padding et dégradé AMAKI", () => {
    render(<ConfidentialitePage />);
    const header = screen.getByTestId("confidentialite-card-header");
    expect(header.className).toMatch(/bg-gradient-to-r/);
    expect(header.className).toMatch(/from-blue-500/);
    expect(header.className).toMatch(/px-5|sm:px-6/);
    expect(header.className).toMatch(/pt-5|sm:pt-6/);
    expect(header.className).toMatch(/pb-4|sm:pb-5/);
    expect(screen.getByTestId("confidentialite-main-card").className).toMatch(
      /overflow-hidden/
    );
  });

  it("expose un titre principal accessible", () => {
    render(<ConfidentialitePage />);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /Politique de Confidentialité/i,
      })
    ).toBeTruthy();
  });

  it("conserve les sections juridiques obligatoires", () => {
    render(<ConfidentialitePage />);
    const main = screen.getByRole("main");
    expect(within(main).getByRole("heading", { name: /1\. Introduction/i })).toBeTruthy();
    expect(
      within(main).getByRole("heading", { name: /2\. Données que nous collectons/i })
    ).toBeTruthy();
    expect(
      within(main).getByRole("heading", { name: /3\. Utilisation de vos données/i })
    ).toBeTruthy();
    expect(
      within(main).getByRole("heading", { name: /4\. Partage de vos données/i })
    ).toBeTruthy();
    expect(
      within(main).getByRole("heading", { name: /5\. Sécurité de vos données/i })
    ).toBeTruthy();
    expect(within(main).getByRole("heading", { name: /6\. Vos droits/i })).toBeTruthy();
    expect(
      within(main).getByRole("heading", {
        name: /7\. Cookies et technologies similaires/i,
      })
    ).toBeTruthy();
    expect(
      within(main).getByRole("heading", { name: /8\. Durée de conservation/i })
    ).toBeTruthy();
    expect(
      within(main).getByRole("heading", {
        name: /9\. Modifications de cette politique/i,
      })
    ).toBeTruthy();
    expect(within(main).getByRole("heading", { name: /10\. Contact/i })).toBeTruthy();
    expect(within(main).getByText(/10 ans conformément aux obligations comptables/i)).toBeTruthy();
    expect(within(main).getByText(/119 rue des Grands Champs/i)).toBeTruthy();
  });

  it("conserve le lien public vers /suppression-donnees et l'URL canonique", () => {
    render(<ConfidentialitePage />);
    const link = screen.getByRole("link", {
      name: /page publique de demande de suppression des données/i,
    });
    expect(link.getAttribute("href")).toBe("/suppression-donnees");
    expect(
      screen.getByText(/https:\/\/www\.amaki\.fr\/suppression-donnees/)
    ).toBeTruthy();
  });
});
