import { describe, expect, it } from "vitest";
import {
  NOTES_FRAIS_LIST_DEFAULT_PAGE_SIZE,
  buildNotesFraisListPaginationMeta,
  normalizeNotesFraisListPagination,
  sqlEtatFinancierCondition,
} from "@/lib/frais-avances/list-pagination";
import { computeEtatFinancierNoteFrais } from "@/lib/services/frais-avances/note-frais-remboursement-service";

describe("pagination / état financier liste", () => {
  it("normalise pageSize défaut 20", () => {
    expect(normalizeNotesFraisListPagination()).toEqual({
      page: 1,
      pageSize: NOTES_FRAIS_LIST_DEFAULT_PAGE_SIZE,
      skip: 0,
    });
    expect(normalizeNotesFraisListPagination({ page: 3, pageSize: 20 }).skip).toBe(
      40
    );
  });

  it("sql état : NON / PARTIEL / REGLEE (paramétré Prisma.Sql)", () => {
    const non = sqlEtatFinancierCondition("NON_REGLEE");
    const part = sqlEtatFinancierCondition("PARTIELLEMENT_REGLEE");
    const reg = sqlEtatFinancierCondition("REGLEE");
    expect(Array.isArray(non.strings)).toBe(true);
    expect(non.strings.join("")).toMatch(/montantRembourseUtilise/);
    expect(part.strings.join("")).toMatch(/</);
    expect(reg.strings.join("")).toMatch(/montantAccepte/);
  });

  it("définitions état : 0 / partiel / égal ; incohérence jamais REGLEE", () => {
    expect(
      computeEtatFinancierNoteFrais({
        montantAccepte: 100,
        montantRembourseUtilise: 0,
        montantCompensationUtilise: 0,
      }).etatFinancier
    ).toBe("NON_REGLEE");
    expect(
      computeEtatFinancierNoteFrais({
        montantAccepte: 100,
        montantRembourseUtilise: 40,
        montantCompensationUtilise: 0,
      }).etatFinancier
    ).toBe("PARTIELLEMENT_REGLEE");
    expect(
      computeEtatFinancierNoteFrais({
        montantAccepte: 100,
        montantRembourseUtilise: 40,
        montantCompensationUtilise: 60,
      }).etatFinancier
    ).toBe("REGLEE");
    expect(() =>
      computeEtatFinancierNoteFrais({
        montantAccepte: 100,
        montantRembourseUtilise: 80,
        montantCompensationUtilise: 30,
      })
    ).toThrow(/INCONSISTENT/);
  });

  it("meta pagination", () => {
    expect(
      buildNotesFraisListPaginationMeta({ page: 1, pageSize: 20, total: 45 })
    ).toEqual({ page: 1, pageSize: 20, total: 45, pageCount: 3 });
    expect(
      buildNotesFraisListPaginationMeta({ page: 1, pageSize: 20, total: 0 })
        .pageCount
    ).toBe(0);
  });
});
