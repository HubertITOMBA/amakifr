import { describe, expect, it } from "vitest";
import { isPublicRoute, publicRoutes } from "@/routes";

/**
 * Couvre la règle middleware :
 * if (!isLoggedIn && !isPublicRoute) → redirect /auth/sign-in
 */
describe("routes publiques — confidentialité", () => {
  it("liste publicRoutes contient /confidentialite", () => {
    expect(publicRoutes).toContain("/confidentialite");
  });

  it("non connecté + /confidentialite → accès autorisé (publique)", () => {
    expect(isPublicRoute("/confidentialite")).toBe(true);
  });

  it("connecté + /confidentialite → accès autorisé (toujours publique)", () => {
    // L'état connecté est géré dans middleware ; la route reste publique
    expect(isPublicRoute("/confidentialite")).toBe(true);
  });

  it("ne rend pas publiques des sous-routes inventées", () => {
    expect(isPublicRoute("/confidentialite/extra")).toBe(false);
  });

  it("route privée voisine → toujours protégée", () => {
    expect(isPublicRoute("/suppression-donnees")).toBe(false);
    expect(isPublicRoute("/user/profile")).toBe(false);
  });

  it("admin → inchangé (non public)", () => {
    expect(isPublicRoute("/admin")).toBe(false);
    expect(isPublicRoute("/admin/rgpd/demandes")).toBe(false);
  });
});
