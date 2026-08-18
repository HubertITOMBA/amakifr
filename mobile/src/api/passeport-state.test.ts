import { describe, expect, it } from "vitest";
import {
  formatPasseportDate,
  passeportErrorMessage,
  passeportLocalFilename,
} from "@/api/passeport-state";

describe("passeportErrorMessage", () => {
  it("NETWORK", () => {
    expect(
      passeportErrorMessage({ status: 0, code: "NETWORK_ERROR", message: "" })
    ).toBe("Serveur injoignable");
  });

  it("401", () => {
    expect(
      passeportErrorMessage({
        status: 401,
        code: "UNAUTHENTICATED",
        message: "x",
      })
    ).toContain("Session expirée");
  });

  it("403 compte non actif", () => {
    expect(
      passeportErrorMessage({
        status: 403,
        code: "FORBIDDEN",
        message: "Compte inactif",
      })
    ).toBe("Compte inactif");
  });

  it("404 adhérent", () => {
    expect(
      passeportErrorMessage({
        status: 404,
        code: "NOT_FOUND",
        message: "",
      })
    ).toContain("introuvable");
  });

  it("409 non généré", () => {
    expect(
      passeportErrorMessage({
        status: 409,
        code: "CONFLICT",
        message: "",
      })
    ).toContain("pas encore été généré");
  });

  it("429", () => {
    expect(
      passeportErrorMessage({
        status: 429,
        code: "RATE_LIMITED",
        message: "",
      })
    ).toContain("Trop de requêtes");
  });

  it("500", () => {
    expect(
      passeportErrorMessage({
        status: 500,
        code: "INTERNAL_ERROR",
        message: "",
      })
    ).toContain("Impossible");
  });
});

describe("formatPasseportDate", () => {
  it("formate une date ISO fr-FR", () => {
    const formatted = formatPasseportDate("2026-08-18T10:00:00.000Z");
    expect(formatted).toMatch(/2026/);
    expect(formatted).toMatch(/août|aout|18/i);
  });

  it("retourne — si absent", () => {
    expect(formatPasseportDate(null)).toBe("—");
  });
});

describe("passeportLocalFilename", () => {
  it("préfixe AMAKI", () => {
    expect(passeportLocalFilename("AMAKI-2026-ABC123")).toBe(
      "Passeport-AMAKI-AMAKI-2026-ABC123.pdf"
    );
  });
});
