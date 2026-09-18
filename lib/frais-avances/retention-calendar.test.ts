/**
 * Tests unitaires calcul calendaire conservation (lot 4.10).
 */
import { describe, expect, it } from "vitest";
import {
  addCalendarYears,
  computeExerciceClotureContainingSafe,
  computeRetentionDeadlines,
  isValidClotureDay,
  resolveClotureDateForYear,
} from "@/lib/frais-avances/retention-calendar";

describe("retention-calendar", () => {
  it("clôture 31/12 — date dans l'année → 31/12 même année", () => {
    const d = new Date(Date.UTC(2024, 5, 15)); // 15 juin
    const cloture = computeExerciceClotureContainingSafe(d, {
      mois: 12,
      jour: 31,
    });
    expect(cloture.toISOString().slice(0, 10)).toBe("2024-12-31");
  });

  it("exercice décalé 31/03 — après clôture → année suivante", () => {
    const d = new Date(Date.UTC(2024, 5, 15)); // 15 juin
    const cloture = computeExerciceClotureContainingSafe(d, {
      mois: 3,
      jour: 31,
    });
    expect(cloture.toISOString().slice(0, 10)).toBe("2025-03-31");
  });

  it("exercice décalé 31/03 — avant clôture → même année", () => {
    const d = new Date(Date.UTC(2024, 1, 10)); // 10 févr
    const cloture = computeExerciceClotureContainingSafe(d, {
      mois: 3,
      jour: 31,
    });
    expect(cloture.toISOString().slice(0, 10)).toBe("2024-03-31");
  });

  it("années bissextiles — 29/02 valide en 2024", () => {
    expect(isValidClotureDay(2024, 2, 29)).toBe(true);
    expect(isValidClotureDay(2025, 2, 29)).toBe(false);
  });

  it("clôture 29/02 hors bissextile → 28/02", () => {
    const d = resolveClotureDateForYear(2025, { mois: 2, jour: 29 });
    expect(d.toISOString().slice(0, 10)).toBe("2025-02-28");
  });

  it("ajoute 10 années calendaires depuis 31/12/2024", () => {
    const base = new Date(Date.UTC(2024, 11, 31));
    const end = addCalendarYears(base, 10);
    expect(end.toISOString().slice(0, 10)).toBe("2034-12-31");
  });

  it("ajoute 1 an depuis 29/02/2024 → 28/02/2025", () => {
    const base = new Date(Date.UTC(2024, 1, 29));
    const end = addCalendarYears(base, 1);
    expect(end.toISOString().slice(0, 10)).toBe("2025-02-28");
  });

  it("computeRetentionDeadlines P1=P2=P3=10", () => {
    const r = computeRetentionDeadlines({
      dateEconomique: new Date(Date.UTC(2024, 5, 15)),
      p1Years: 10,
      p2Years: 10,
      p3Years: 10,
      cloture: { mois: 12, jour: 31 },
    });
    expect(r.exerciceClotureAt.toISOString().slice(0, 10)).toBe("2024-12-31");
    expect(r.retentionEndsAtP1.toISOString().slice(0, 10)).toBe("2034-12-31");
    expect(r.retentionEndsAtP2.toISOString().slice(0, 10)).toBe("2034-12-31");
    expect(r.retentionEndsAtP3.toISOString().slice(0, 10)).toBe("2034-12-31");
  });
});
