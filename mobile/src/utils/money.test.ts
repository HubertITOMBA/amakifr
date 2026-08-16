import { describe, expect, it } from "vitest";
import { formatMoneyDecimalString } from "@/utils/money";
import {
  cotisationErrorMessage,
  formatIsoDate,
} from "@/api/cotisations-state";

describe("formatMoneyDecimalString", () => {
  it("formate les cas courants sans Number", () => {
    expect(formatMoneyDecimalString("0")).toBe("0,00 €");
    expect(formatMoneyDecimalString("25")).toBe("25,00 €");
    expect(formatMoneyDecimalString("25.5")).toBe("25,50 €");
    expect(formatMoneyDecimalString("25.50")).toBe("25,50 €");
  });

  it("préserve plus de 2 décimales (pas d'arrondi Number)", () => {
    expect(formatMoneyDecimalString("12.345")).toBe("12,345 €");
  });

  it("préserve une grosse valeur que Number perdrait", () => {
    const big = "9007199254740993.25";
    expect(formatMoneyDecimalString(big)).toBe("9007199254740993,25 €");
    // Contrôle : Number perdrait la précision sur l'entier
    expect(String(Number("9007199254740993"))).not.toBe("9007199254740993");
  });

  it("valeur invalide → tiret stable", () => {
    expect(formatMoneyDecimalString("")).toBe("—");
    expect(formatMoneyDecimalString("abc")).toBe("—");
    expect(formatMoneyDecimalString("12.34.56")).toBe("—");
  });
});

describe("formatIsoDate", () => {
  it("formate une ISO valide", () => {
    const out = formatIsoDate("2024-01-15T00:00:00.000Z");
    expect(out).not.toBe("—");
    expect(out.length).toBeGreaterThan(0);
  });

  it("date invalide → tiret", () => {
    expect(formatIsoDate("not-a-date")).toBe("—");
  });
});

describe("cotisationErrorMessage", () => {
  it("NETWORK", () => {
    expect(
      cotisationErrorMessage({
        status: 0,
        code: "NETWORK_ERROR",
        message: "x",
      })
    ).toBe("Serveur injoignable");
  });

  it("403", () => {
    expect(
      cotisationErrorMessage({
        status: 403,
        code: "FORBIDDEN",
        message: "Refusé",
      })
    ).toBe("Refusé");
  });

  it("404 Adherent", () => {
    expect(
      cotisationErrorMessage({
        status: 404,
        code: "NOT_FOUND",
        message: "Adhérent non trouvé",
      })
    ).toBe("Aucun dossier adhérent associé");
  });

  it("429", () => {
    expect(
      cotisationErrorMessage({
        status: 429,
        code: "RATE_LIMITED",
        message: "x",
      })
    ).toContain("Trop de requêtes");
  });

  it("500", () => {
    expect(
      cotisationErrorMessage({
        status: 500,
        code: "INTERNAL_ERROR",
        message: "x",
      })
    ).toBe("Impossible de charger les cotisations");
  });
});
