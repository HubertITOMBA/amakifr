import { describe, expect, it } from "vitest";
import {
  addCivilDaysParis,
  civilDaysBetweenParis,
  getParisYmd,
  parisCivilDate,
} from "@/lib/services/cotisations/rappel-dette/paris-calendar";

describe("paris-calendar", () => {
  it("extrait le jour civil Europe/Paris", () => {
    // 2024-06-15 00:30 UTC = encore 15 juin à Paris (UTC+2)
    const ymd = getParisYmd(new Date("2024-06-15T00:30:00.000Z"));
    expect(ymd).toEqual({ year: 2024, month: 6, day: 15 });
  });

  it("civilDaysBetweenParis : même jour = 0, lendemain = 1", () => {
    const a = parisCivilDate(2024, 1, 10);
    const b = parisCivilDate(2024, 1, 10);
    const c = parisCivilDate(2024, 1, 11);
    expect(civilDaysBetweenParis(a, b)).toBe(0);
    expect(civilDaysBetweenParis(a, c)).toBe(1);
  });

  it("addCivilDaysParis respecte le calendrier", () => {
    const start = parisCivilDate(2024, 1, 31);
    const next = addCivilDaysParis(start, 1);
    expect(getParisYmd(next)).toEqual({ year: 2024, month: 2, day: 1 });
  });
});
