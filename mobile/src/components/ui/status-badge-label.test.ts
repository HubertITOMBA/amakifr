import { describe, expect, it } from "vitest";
import { badgeDisplayLabel } from "./status-badge-label";

describe("badgeDisplayLabel", () => {
  it("remplace les espaces par des NBSP (évite wrap « À » seul)", () => {
    const out = badgeDisplayLabel("À venir");
    expect(out).toBe("À\u00A0venir");
    expect(out).not.toContain(" ");
    expect(out.length).toBe("À venir".length);
  });

  it("conserve En cours / Terminé lisibles", () => {
    expect(badgeDisplayLabel("En cours")).toBe("En\u00A0cours");
    expect(badgeDisplayLabel("Terminé")).toBe("Terminé");
  });

  it("ne coupe pas le libellé (jamais seulement « À »)", () => {
    const out = badgeDisplayLabel("À venir");
    expect(out.startsWith("À")).toBe(true);
    expect(out.includes("venir")).toBe(true);
    expect(out).not.toBe("À");
  });
});
