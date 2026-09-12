import { describe, expect, it } from "vitest";
import { isPublicRoute, publicRoutes } from "@/routes";
import {
  SUPPRESSION_DONNEES_APP_SCOPE,
  SUPPRESSION_DONNEES_BRAND,
  SUPPRESSION_DONNEES_CATEGORIES_SUPPRIMEES,
  SUPPRESSION_DONNEES_CONSERVEES,
  SUPPRESSION_DONNEES_DELAI,
  SUPPRESSION_DONNEES_NO_DIRECT_DELETE,
  SUPPRESSION_DONNEES_PROCEDURE,
  SUPPRESSION_DONNEES_REQUIRED_PHRASES,
} from "@/lib/rgpd/suppression-donnees-content";

describe("routes publiques — suppression-donnees", () => {
  it("liste publicRoutes contient /suppression-donnees", () => {
    expect(publicRoutes).toContain("/suppression-donnees");
  });

  it("accès anonyme autorisé (pas de redirect auth)", () => {
    expect(isPublicRoute("/suppression-donnees")).toBe(true);
  });

  it("ne rend pas publiques des sous-routes inventées", () => {
    expect(isPublicRoute("/suppression-donnees/extra")).toBe(false);
  });

  it("admin RGPD reste protégé", () => {
    expect(isPublicRoute("/admin/rgpd/demandes")).toBe(false);
  });
});

describe("contenus publics suppression-donnees (Play Store)", () => {
  it("affiche marque, app mobile et package Android", () => {
    expect(SUPPRESSION_DONNEES_BRAND).toBe("AMAKI");
    expect(SUPPRESSION_DONNEES_APP_SCOPE).toMatch(/application mobile AMAKI/i);
    expect(SUPPRESSION_DONNEES_APP_SCOPE).toContain("fr.amaki.app");
  });

  it("décrit la procédure et l'absence de suppression directe", () => {
    expect(SUPPRESSION_DONNEES_PROCEDURE.length).toBeGreaterThanOrEqual(4);
    expect(SUPPRESSION_DONNEES_NO_DIRECT_DELETE).toMatch(
      /ne supprime pas immédiatement/i
    );
    expect(SUPPRESSION_DONNEES_NO_DIRECT_DELETE).toMatch(/vérification/i);
  });

  it("liste catégories supprimées et conservation documentée", () => {
    expect(SUPPRESSION_DONNEES_CATEGORIES_SUPPRIMEES.length).toBeGreaterThan(3);
    expect(SUPPRESSION_DONNEES_CONSERVEES.some((c) => /10 ans/i.test(c))).toBe(
      true
    );
    expect(SUPPRESSION_DONNEES_DELAI).toMatch(/30 jours/i);
  });

  it("phrases obligatoires présentes", () => {
    const blob = [
      SUPPRESSION_DONNEES_BRAND,
      SUPPRESSION_DONNEES_APP_SCOPE,
      ...SUPPRESSION_DONNEES_PROCEDURE,
      ...SUPPRESSION_DONNEES_CATEGORIES_SUPPRIMEES,
      ...SUPPRESSION_DONNEES_CONSERVEES,
      SUPPRESSION_DONNEES_DELAI,
      SUPPRESSION_DONNEES_NO_DIRECT_DELETE,
    ].join("\n");

    for (const phrase of SUPPRESSION_DONNEES_REQUIRED_PHRASES) {
      expect(blob).toContain(phrase);
    }
  });
});
