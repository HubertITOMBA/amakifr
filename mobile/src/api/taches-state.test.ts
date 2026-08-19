import { describe, expect, it } from "vitest";
import { formatTacheDate, formatTacheDateTime, tachesErrorMessage } from "@/api/taches-state";

describe("tachesErrorMessage", () => {
  it("NETWORK", () => {
    expect(
      tachesErrorMessage({ status: 0, code: "NETWORK_ERROR", message: "" })
    ).toBe("Serveur injoignable");
  });

  it("401", () => {
    expect(
      tachesErrorMessage({ status: 401, code: "UNAUTHENTICATED", message: "" })
    ).toContain("Session expirée");
  });

  it("403", () => {
    expect(
      tachesErrorMessage({
        status: 403,
        code: "FORBIDDEN",
        message: "Non affecté",
      })
    ).toBe("Non affecté");
  });

  it("404", () => {
    expect(
      tachesErrorMessage({ status: 404, code: "NOT_FOUND", message: "" })
    ).toContain("introuvable");
  });

  it("500", () => {
    expect(
      tachesErrorMessage({ status: 500, code: "INTERNAL_ERROR", message: "" })
    ).toContain("Impossible");
  });
});

describe("formatTacheDate", () => {
  it("formate une date ISO fr-FR", () => {
    const formatted = formatTacheDate("2026-03-15T10:00:00.000Z");
    expect(formatted).toMatch(/2026/);
    expect(formatted).toMatch(/mars|15/i);
  });

  it("retourne — si absent", () => {
    expect(formatTacheDate(null)).toBe("—");
    expect(formatTacheDate(undefined)).toBe("—");
  });

  it("retourne — si invalide", () => {
    expect(formatTacheDate("pas-une-date")).toBe("—");
  });
});

describe("formatTacheDateTime", () => {
  it("formate une date ISO avec heure fr-FR", () => {
    const formatted = formatTacheDateTime("2026-08-19T12:18:00.000Z");
    expect(formatted).toMatch(/19/);
    expect(formatted).toMatch(/2026/);
    expect(formatted).toMatch(/\d{2}:\d{2}/);
  });

  it("retourne — si null/undefined", () => {
    expect(formatTacheDateTime(null)).toBe("—");
    expect(formatTacheDateTime(undefined)).toBe("—");
  });

  it("retourne — si invalide", () => {
    expect(formatTacheDateTime("pas-une-date")).toBe("—");
  });
});
