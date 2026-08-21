import { describe, expect, it } from "vitest";
import {
  getInitials,
  formatAddress,
  formatDateFr,
  formatDateTimeFr,
} from "./profile-helpers";
import type { MeAddressDto } from "@/api/types";

describe("getInitials", () => {
  it("extrait 2 initiales d'un nom complet", () => {
    expect(getInitials("Ada Lovelace")).toBe("AL");
  });

  it("gère un prénom seul (2 premières lettres)", () => {
    expect(getInitials("Hubert")).toBe("HU");
  });

  it("gère un seul caractère", () => {
    expect(getInitials("A")).toBe("A");
  });

  it("repli sur email si name null", () => {
    expect(getInitials(null, "john@example.com")).toBe("J");
  });

  it("repli sur email si name vide", () => {
    expect(getInitials("  ", "test@example.com")).toBe("T");
  });

  it("renvoie ? si tout est null", () => {
    expect(getInitials(null, null)).toBe("?");
  });

  it("renvoie ? si tout est vide", () => {
    expect(getInitials("", "")).toBe("?");
  });

  it("gère les accents", () => {
    expect(getInitials("Élodie Martin")).toBe("ÉM");
  });

  it("gère les espaces multiples", () => {
    expect(getInitials("  Jean   Pierre  ")).toBe("JP");
  });

  it("3 mots prend les 2 premiers", () => {
    expect(getInitials("Jean Pierre Dupont")).toBe("JP");
  });
});

describe("formatAddress", () => {
  const full: MeAddressDto = {
    id: "1",
    streetnum: "12",
    street1: "rue Exemple",
    street2: "Bât. A",
    codepost: "75000",
    city: "Paris",
    country: "France",
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
  };

  it("formate une adresse complète", () => {
    expect(formatAddress(full)).toEqual([
      "12 rue Exemple",
      "Bât. A",
      "75000 Paris",
      "France",
    ]);
  });

  it("omet les champs vides", () => {
    const partial: MeAddressDto = {
      ...full,
      streetnum: null,
      street2: null,
      country: null,
    };
    expect(formatAddress(partial)).toEqual(["rue Exemple", "75000 Paris"]);
  });

  it("renvoie un tableau vide si tout est null", () => {
    const empty: MeAddressDto = {
      id: "2",
      streetnum: null,
      street1: null,
      street2: null,
      codepost: null,
      city: null,
      country: null,
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-01-01T00:00:00.000Z",
    };
    expect(formatAddress(empty)).toEqual([]);
  });
});

describe("formatDateFr", () => {
  it("formate une date ISO", () => {
    const result = formatDateFr("2025-06-15T10:00:00.000Z");
    expect(result).toMatch(/15/);
    expect(result).toMatch(/2025/);
  });

  it("renvoie — pour null", () => {
    expect(formatDateFr(null)).toBe("—");
  });

  it("renvoie — pour undefined", () => {
    expect(formatDateFr(undefined)).toBe("—");
  });

  it("renvoie — pour une date invalide", () => {
    expect(formatDateFr("not-a-date")).toBe("—");
  });

  it("renvoie — pour une chaîne vide", () => {
    expect(formatDateFr("")).toBe("—");
  });
});

describe("formatDateTimeFr", () => {
  it("affiche date numérique et heure sans secondes", () => {
    const out = formatDateTimeFr("2026-08-21T16:03:45.000Z");
    expect(out).toMatch(/21\/08\/2026/);
    expect(out).toMatch(/à/);
    expect(out).toMatch(/\d{2}:\d{2}/);
    expect(out).not.toMatch(/:\d{2}:\d{2}/);
    expect(out).not.toBe("—");
  });

  it("retourne — pour invalide / vide", () => {
    expect(formatDateTimeFr(null)).toBe("—");
    expect(formatDateTimeFr(undefined)).toBe("—");
    expect(formatDateTimeFr("")).toBe("—");
    expect(formatDateTimeFr("nope")).toBe("—");
  });
});
