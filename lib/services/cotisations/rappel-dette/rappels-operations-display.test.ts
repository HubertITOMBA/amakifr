import { describe, expect, it } from "vitest";
import {
  isPrepareExpired,
  formatOperationsDateTime,
} from "@/lib/services/cotisations/rappel-dette/rappels-operations-display";

describe("rappels-operations-display", () => {
  it("isPrepareExpired : true si passé ou invalide", () => {
    expect(isPrepareExpired("not-a-date")).toBe(true);
    expect(
      isPrepareExpired("2020-01-01T00:00:00.000Z", Date.parse("2024-01-01T00:00:00.000Z"))
    ).toBe(true);
    expect(
      isPrepareExpired("2030-01-01T00:00:00.000Z", Date.parse("2024-01-01T00:00:00.000Z"))
    ).toBe(false);
  });

  it("formatOperationsDateTime : tiret si vide", () => {
    expect(formatOperationsDateTime(null)).toBe("—");
    expect(formatOperationsDateTime(undefined)).toBe("—");
  });
});
