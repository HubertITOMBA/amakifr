import { describe, expect, it } from "vitest";
import {
  centsToMoneyString,
  moneyIsStrictlyPositive,
  moneyRestantNonNegatif,
  moneySubStrings,
  parseMoneyToCents,
} from "@/lib/frais-avances/money-cents";

describe("money-cents", () => {
  it("parseMoneyToCents : décimales classiques", () => {
    expect(parseMoneyToCents("0.10")).toBe(10);
    expect(parseMoneyToCents("0.29")).toBe(29);
    expect(parseMoneyToCents("10.01")).toBe(1001);
    expect(parseMoneyToCents("10")).toBe(1000);
    expect(parseMoneyToCents("10.1")).toBe(1010);
  });

  it("parseMoneyToCents : virgule UI", () => {
    expect(parseMoneyToCents("10,01")).toBe(1001);
    expect(parseMoneyToCents("0,29")).toBe(29);
  });

  it("refuse plus de 2 décimales", () => {
    expect(() => parseMoneyToCents("1.001")).toThrow();
    expect(() => parseMoneyToCents("abc")).toThrow();
  });

  it("centsToMoneyString : format strict 2 décimales", () => {
    expect(centsToMoneyString(10)).toBe("0.10");
    expect(centsToMoneyString(29)).toBe("0.29");
    expect(centsToMoneyString(1001)).toBe("10.01");
    expect(centsToMoneyString(0)).toBe("0.00");
  });

  it("soustraction et restant non négatif en entiers", () => {
    expect(moneySubStrings("10.01", "0.10")).toBe("9.91");
    expect(moneyRestantNonNegatif("0.10", "0.29")).toBe("0.00");
    expect(moneyRestantNonNegatif("40.00", "10.00")).toBe("30.00");
  });

  it("moneyIsStrictlyPositive", () => {
    expect(moneyIsStrictlyPositive("0.01")).toBe(true);
    expect(moneyIsStrictlyPositive("0.00")).toBe(false);
    expect(moneyIsStrictlyPositive("0")).toBe(false);
    expect(moneyIsStrictlyPositive("")).toBe(false);
  });
});
