import { describe, expect, it } from "vitest";
import {
  civilDaysBetweenParis,
  getParisYmd,
  parisCivilDate,
} from "@/lib/services/cotisations/rappel-dette/paris-calendar";
import {
  resolveAssistanceDueDate,
  resolveCotisationMensuelleDueDate,
  resolveDetteInitialeDueDate,
} from "@/lib/services/cotisations/rappel-dette/resolve-due-date";

describe("resolve-due-date", () => {
  it("CotisationMensuelle : normalise dateEcheance en jour civil Paris", () => {
    const due = resolveCotisationMensuelleDueDate(
      new Date("2024-03-01T15:00:00.000Z")
    );
    expect(getParisYmd(due)).toEqual({ year: 2024, month: 3, day: 1 });
  });

  it("DetteInitiale : convention 01/01/(annee+1) 00:00 Europe/Paris", () => {
    const due = resolveDetteInitialeDueDate(2023);
    expect(getParisYmd(due)).toEqual({ year: 2024, month: 1, day: 1 });
    // Instant exact 00:00 Paris (CET = UTC+1 en janvier)
    expect(due.toISOString()).toBe("2023-12-31T23:00:00.000Z");
  });

  it("DetteInitiale : année normale et passage d’année", () => {
    const due2024 = resolveDetteInitialeDueDate(2024);
    expect(getParisYmd(due2024)).toEqual({ year: 2025, month: 1, day: 1 });

    // Jour de l’échéance : 0 jour de retard
    expect(
      civilDaysBetweenParis(due2024, parisCivilDate(2025, 1, 1))
    ).toBe(0);
  });

  it("DetteInitiale : frontière J+15 (J+14 non, J+15 oui)", () => {
    const due = resolveDetteInitialeDueDate(2023); // 2024-01-01 Paris
    expect(civilDaysBetweenParis(due, parisCivilDate(2024, 1, 15))).toBe(14);
    expect(civilDaysBetweenParis(due, parisCivilDate(2024, 1, 16))).toBe(15);
  });

  it("Assistance : utilise dateEvenement (pas createdAt)", () => {
    const due = resolveAssistanceDueDate(
      new Date("2023-11-20T08:00:00.000Z")
    );
    expect(getParisYmd(due)).toEqual({ year: 2023, month: 11, day: 20 });
  });

  it("DetteInitiale : refuse une année invalide", () => {
    expect(() => resolveDetteInitialeDueDate(1800)).toThrow();
  });
});
