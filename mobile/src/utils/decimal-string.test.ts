import { describe, expect, it } from "vitest";
import { isZeroDecimalString } from "@/utils/decimal-string";

describe("isZeroDecimalString", () => {
  it("détecte zéro sans Number", () => {
    expect(isZeroDecimalString("0")).toBe(true);
    expect(isZeroDecimalString("0.0")).toBe(true);
    expect(isZeroDecimalString("0.00")).toBe(true);
    expect(isZeroDecimalString("000.000")).toBe(true);
  });

  it("non-zéro", () => {
    expect(isZeroDecimalString("25")).toBe(false);
    expect(isZeroDecimalString("0.01")).toBe(false);
    expect(isZeroDecimalString("25.5")).toBe(false);
  });

  it("invalide → false", () => {
    expect(isZeroDecimalString("")).toBe(false);
    expect(isZeroDecimalString("abc")).toBe(false);
  });
});
