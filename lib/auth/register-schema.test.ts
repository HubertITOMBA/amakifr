import { describe, expect, it } from "vitest";
import { RegisterSchema } from "@/schemas";

const validBase = {
  email: "nouveau@example.com",
  password: "secret1",
  name: "Jean Dupont",
  anneePromotion: "",
  pays: "",
  ville: "",
};

const CONSENT_MSG = /accepter les conditions/i;

describe("RegisterSchema — acceptConditions", () => {
  it("accepte acceptConditions=true avec champs valides", () => {
    const parsed = RegisterSchema.safeParse({
      ...validBase,
      acceptConditions: true,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.acceptConditions).toBe(true);
    }
  });

  it("refuse acceptConditions=false", () => {
    const parsed = RegisterSchema.safeParse({
      ...validBase,
      acceptConditions: false,
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(
        parsed.error.issues.some((i) => i.path[0] === "acceptConditions"),
      ).toBe(true);
      expect(parsed.error.issues[0]?.message).toMatch(CONSENT_MSG);
    }
  });

  it("refuse l'absence du champ acceptConditions", () => {
    const parsed = RegisterSchema.safeParse({ ...validBase });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(
        parsed.error.issues.some((i) => i.path[0] === "acceptConditions"),
      ).toBe(true);
      expect(
        parsed.error.issues.find((i) => i.path[0] === "acceptConditions")
          ?.message,
      ).toMatch(CONSENT_MSG);
    }
  });

  it("refuse null", () => {
    const parsed = RegisterSchema.safeParse({
      ...validBase,
      acceptConditions: null,
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(
        parsed.error.issues.some((i) => i.path[0] === "acceptConditions"),
      ).toBe(true);
      expect(
        parsed.error.issues.find((i) => i.path[0] === "acceptConditions")
          ?.message,
      ).toMatch(CONSENT_MSG);
    }
  });

  it("refuse le nombre 1", () => {
    const parsed = RegisterSchema.safeParse({
      ...validBase,
      acceptConditions: 1,
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(
        parsed.error.issues.some((i) => i.path[0] === "acceptConditions"),
      ).toBe(true);
      expect(
        parsed.error.issues.find((i) => i.path[0] === "acceptConditions")
          ?.message,
      ).toMatch(CONSENT_MSG);
    }
  });

  it('refuse la chaîne "true"', () => {
    const parsed = RegisterSchema.safeParse({
      ...validBase,
      acceptConditions: "true",
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(
        parsed.error.issues.some((i) => i.path[0] === "acceptConditions"),
      ).toBe(true);
      expect(
        parsed.error.issues.find((i) => i.path[0] === "acceptConditions")
          ?.message,
      ).toMatch(CONSENT_MSG);
    }
  });
});
