import { describe, expect, it } from "vitest";
import type { MyReunionDto } from "@/api/types";
import {
  canOpenPublishedReport,
  formatRapportDate,
  rapportErrorMessage,
} from "@/api/rapports-reunion-state";

function reunion(
  overrides: Partial<MyReunionDto> = {}
): Pick<MyReunionDto, "hasPublishedReport" | "publishedReportId"> {
  return {
    hasPublishedReport: false,
    publishedReportId: null,
    ...overrides,
  };
}

describe("canOpenPublishedReport", () => {
  it("vrai seulement si PUBLISHED flag + id non nul", () => {
    expect(
      canOpenPublishedReport(
        reunion({ hasPublishedReport: true, publishedReportId: "r1" })
      )
    ).toBe(true);
  });

  it("faux si pas de rapport", () => {
    expect(canOpenPublishedReport(reunion())).toBe(false);
  });

  it("faux si flag vrai mais id null", () => {
    expect(
      canOpenPublishedReport(
        reunion({ hasPublishedReport: true, publishedReportId: null })
      )
    ).toBe(false);
  });

  it("faux si id vide", () => {
    expect(
      canOpenPublishedReport(
        reunion({ hasPublishedReport: true, publishedReportId: "  " })
      )
    ).toBe(false);
  });
});

describe("rapportErrorMessage", () => {
  it("réseau", () => {
    expect(
      rapportErrorMessage({ status: 0, code: "NETWORK_ERROR", message: "x" })
    ).toMatch(/injoignable/i);
  });

  it("404/403 générique (pas le message serveur)", () => {
    expect(
      rapportErrorMessage({
        status: 404,
        code: "NOT_FOUND",
        message: "Rapport non trouvé secret",
      })
    ).toBe("Compte rendu indisponible");
    expect(
      rapportErrorMessage({
        status: 403,
        code: "FORBIDDEN",
        message: "interne",
      })
    ).toBe("Compte rendu indisponible");
  });

  it("401 session", () => {
    expect(
      rapportErrorMessage({
        status: 401,
        code: "UNAUTHENTICATED",
        message: "x",
      })
    ).toMatch(/Session/i);
  });

  it("500 générique", () => {
    expect(
      rapportErrorMessage({
        status: 500,
        code: "INTERNAL_ERROR",
        message: "stack",
      })
    ).toBe("Impossible de charger le compte rendu");
  });
});

describe("formatRapportDate", () => {
  it("formate ISO fr-FR", () => {
    const label = formatRapportDate("2026-03-14T00:00:00.000Z");
    expect(label).toMatch(/2026/);
    expect(label).not.toBe("—");
  });

  it("null → tiret", () => {
    expect(formatRapportDate(null)).toBe("—");
  });
});
