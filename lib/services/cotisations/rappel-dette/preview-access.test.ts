import { describe, expect, it } from "vitest";
import { UserRole } from "@prisma/client";
import {
  canAccessPreviewRappelsDette,
  PREVIEW_RAPPELS_ACCESS_DENIED_MESSAGE,
} from "@/lib/services/cotisations/rappel-dette/preview-access";

describe("canAccessPreviewRappelsDette", () => {
  it("accepte ADMIN et PRESID (enum et chaînes normalisées)", () => {
    expect(canAccessPreviewRappelsDette(UserRole.ADMIN)).toBe(true);
    expect(canAccessPreviewRappelsDette(UserRole.PRESID)).toBe(true);
    expect(canAccessPreviewRappelsDette("admin")).toBe(true);
    expect(canAccessPreviewRappelsDette("  presid  ")).toBe(true);
  });

  it("refuse tous les autres rôles UserRole réels", () => {
    const denied: UserRole[] = [
      UserRole.MEMBRE,
      UserRole.INVITE,
      UserRole.VICEPR,
      UserRole.SECRET,
      UserRole.VICESE,
      UserRole.COMCPT,
      UserRole.TRESOR,
      UserRole.VTRESO,
    ];
    for (const role of denied) {
      expect(canAccessPreviewRappelsDette(role)).toBe(false);
    }
  });

  it("refuse absence / valeurs invalides", () => {
    expect(canAccessPreviewRappelsDette(null)).toBe(false);
    expect(canAccessPreviewRappelsDette(undefined)).toBe(false);
    expect(canAccessPreviewRappelsDette("")).toBe(false);
    expect(canAccessPreviewRappelsDette("TRESO")).toBe(false);
  });

  it("expose le message d’accès Lot 2", () => {
    expect(PREVIEW_RAPPELS_ACCESS_DENIED_MESSAGE).toBe(
      "Accès réservé aux administrateurs et au président."
    );
  });
});
