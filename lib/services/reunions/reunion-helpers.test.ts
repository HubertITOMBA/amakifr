import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildLieuAdresse,
  buildLieuLabel,
  canUpdateParticipation,
  formatAdresseLieu,
  hostWithdrawalLocationPatch,
  isReunionPast,
  resolveLieuAdresseForDto,
  selectHostTelephones,
} from "@/lib/services/reunions/reunion-helpers";

describe("buildLieuLabel", () => {
  it("Domicile → Chez Prénom Nom", () => {
    expect(
      buildLieuLabel({
        typeLieu: "Domicile",
        adresse: "12 rue Privée",
        nomRestaurant: null,
        hostFirstname: "Alice",
        hostLastname: "Martin",
      })
    ).toBe("Chez Alice Martin");
  });

  it("Domicile sans hôte → Hôte à désigner", () => {
    expect(
      buildLieuLabel({
        typeLieu: "Domicile",
        adresse: null,
        nomRestaurant: null,
        hostFirstname: null,
        hostLastname: null,
      })
    ).toBe("Hôte à désigner");
  });

  it("Restaurant → libellé compact sans adresse", () => {
    expect(
      buildLieuLabel({
        typeLieu: "Restaurant",
        adresse: "1 place République",
        nomRestaurant: "Le Bistrot",
        hostFirstname: null,
        hostLastname: null,
      })
    ).toBe("Restaurant Le Bistrot");
  });

  it("Autre → libellé court", () => {
    expect(
      buildLieuLabel({
        typeLieu: "Autre",
        adresse: "Hôtel Mercure Paris",
        nomRestaurant: null,
        hostFirstname: null,
        hostLastname: null,
      })
    ).toBe("Hôtel Mercure Paris");
  });
});

describe("formatAdresseLieu / buildLieuAdresse", () => {
  it("utilise label BAN si présent", () => {
    expect(
      formatAdresseLieu({
        label: "10 Rue de la Paix, 75001 Paris",
      })
    ).toBe("10 Rue de la Paix, 75001 Paris");
  });

  it("Domicile → adresse hôte (première adresse)", () => {
    expect(
      buildLieuAdresse({
        typeLieu: "Domicile",
        adresse: null,
        hostAdresse: {
          streetnum: "12",
          street1: "rue Example",
          codepost: "75000",
          city: "Paris",
        },
      })
    ).toBe("12 rue Example, 75000 Paris");
  });

  it("Domicile → adresse réunion si différente du domicile", () => {
    expect(
      buildLieuAdresse({
        typeLieu: "Domicile",
        adresse: "Salle annexe, 5 avenue X",
        hostAdresse: {
          street1: "12 rue Example",
        },
      })
    ).toBe("Salle annexe, 5 avenue X");
  });

  it("Domicile sans hôte → jamais d'adresse orpheline", () => {
    expect(
      buildLieuAdresse({
        typeLieu: "Domicile",
        adresse: "12 rue Privée de l'ancien hôte",
        hostAdresse: null,
        hasHost: false,
      })
    ).toBeNull();
  });

  it("Restaurant → adresse enregistrée sur la réunion", () => {
    expect(
      buildLieuAdresse({
        typeLieu: "Restaurant",
        adresse: "1 place République, Lyon",
        hostAdresse: null,
      })
    ).toBe("1 place République, Lyon");
  });

  it("Domicile sans fallback hôte → null si pas d'adresse réunion", () => {
    expect(
      buildLieuAdresse({
        typeLieu: "Domicile",
        adresse: null,
        hostAdresse: { label: "12 rue Example" },
        allowHostFallback: false,
      })
    ).toBeNull();
  });
});

describe("resolveLieuAdresseForDto", () => {
  const now = new Date("2026-06-15T12:00:00.000Z");

  it("DateConfirmee future + adresse réunion → présente", () => {
    expect(
      resolveLieuAdresseForDto({
        statut: "DateConfirmee",
        typeLieu: "Restaurant",
        adresse: "1 place République",
        hostAdresse: null,
        dateReunion: new Date("2026-07-01"),
        now,
      })
    ).toBe("1 place République");
  });

  it("DateConfirmee future + domicile + fallback hôte → présente", () => {
    expect(
      resolveLieuAdresseForDto({
        statut: "DateConfirmee",
        typeLieu: "Domicile",
        adresse: null,
        hostAdresse: { label: "12 rue Example, Paris" },
        dateReunion: new Date("2026-07-01"),
        now,
      })
    ).toBe("12 rue Example, Paris");
  });

  it("passée → null", () => {
    expect(
      resolveLieuAdresseForDto({
        statut: "DateConfirmee",
        typeLieu: "Domicile",
        adresse: "12 rue Example",
        hostAdresse: null,
        dateReunion: new Date("2026-01-01"),
        now,
      })
    ).toBeNull();
  });

  it("EnAttente sans adresse → null (pas de fallback hôte)", () => {
    expect(
      resolveLieuAdresseForDto({
        statut: "EnAttente",
        typeLieu: "Domicile",
        adresse: null,
        hostAdresse: { label: "12 rue Example" },
        dateReunion: null,
        now,
      })
    ).toBeNull();
  });

  it("MoisValide sans adresse → null", () => {
    expect(
      resolveLieuAdresseForDto({
        statut: "MoisValide",
        typeLieu: "Domicile",
        adresse: null,
        hostAdresse: { label: "12 rue Example" },
        dateReunion: null,
        now,
      })
    ).toBeNull();
  });

  it("EnAttente avec adresse réunion → présente", () => {
    expect(
      resolveLieuAdresseForDto({
        statut: "EnAttente",
        typeLieu: "Autre",
        adresse: "Salle communale",
        hostAdresse: null,
        dateReunion: null,
        now,
      })
    ).toBe("Salle communale");
  });

  it("EnAttente Domicile sans hôte + adresse orpheline → null", () => {
    expect(
      resolveLieuAdresseForDto({
        statut: "EnAttente",
        typeLieu: "Domicile",
        adresse: "12 rue Privée ancien hôte",
        hostAdresse: null,
        dateReunion: null,
        now,
        hasHost: false,
      })
    ).toBeNull();
  });
});

describe("hostWithdrawalLocationPatch", () => {
  it("Domicile → adresse null", () => {
    expect(hostWithdrawalLocationPatch("Domicile")).toEqual({ adresse: null });
  });

  it("Restaurant / Autre → aucun patch", () => {
    expect(hostWithdrawalLocationPatch("Restaurant")).toEqual({});
    expect(hostWithdrawalLocationPatch("Autre")).toEqual({});
  });
});

describe("selectHostTelephones", () => {
  it("priorise principal puis mobile", () => {
    expect(
      selectHostTelephones([
        { numero: "0102030405", type: "Fixe", estPrincipal: false },
        { numero: "0607080910", type: "Mobile", estPrincipal: true },
      ])
    ).toEqual([
      { numero: "0607080910", type: "Mobile" },
      { numero: "0102030405", type: "Fixe" },
    ]);
  });

  it("retourne [] si aucun téléphone", () => {
    expect(selectHostTelephones([])).toEqual([]);
  });
});

describe("isReunionPast / canUpdateParticipation — Europe/Paris journée civile", () => {
  const now = new Date("2026-06-15T12:00:00.000Z"); // 14:00 Paris (CEST)

  it("réunion passée (jour civil Paris antérieur)", () => {
    expect(isReunionPast(new Date("2026-01-01T12:00:00.000Z"), now)).toBe(true);
  });

  it("réunion future ou aujourd'hui (même jour civil Paris)", () => {
    expect(isReunionPast(new Date("2026-06-15T08:00:00.000Z"), now)).toBe(false);
    expect(isReunionPast(new Date("2026-07-01T12:00:00.000Z"), now)).toBe(false);
  });

  it("ne clôture pas à l'heure exacte de début : soirée du jour J encore ouverte", () => {
    // 23:30 Europe/Paris le 15 juin 2026 = 21:30 UTC
    const lateEvening = new Date("2026-06-15T21:30:00.000Z");
    expect(isReunionPast(new Date("2026-06-15T10:00:00.000Z"), lateEvening)).toBe(
      false
    );
  });

  it("minuit Paris : jour J+1 clôture le jour J", () => {
    // 00:15 Europe/Paris le 16 juin 2026 = 22:15 UTC le 15
    const afterMidnightParis = new Date("2026-06-15T22:15:00.000Z");
    expect(
      isReunionPast(new Date("2026-06-15T10:00:00.000Z"), afterMidnightParis)
    ).toBe(true);
    expect(
      isReunionPast(new Date("2026-06-16T10:00:00.000Z"), afterMidnightParis)
    ).toBe(false);
  });

  it("changement heure été (mars 2026) : jour civil Paris stable", () => {
    // 29 mars 2026 00:30 CET = 28 mars 23:30 UTC
    const justAfterMidnightCestEve = new Date("2026-03-28T23:30:00.000Z");
    expect(
      isReunionPast(new Date("2026-03-28T12:00:00.000Z"), justAfterMidnightCestEve)
    ).toBe(true);
    expect(
      isReunionPast(new Date("2026-03-29T12:00:00.000Z"), justAfterMidnightCestEve)
    ).toBe(false);
  });

  it("changement heure hiver (octobre 2026) : jour civil Paris stable", () => {
    // 25 oct 2026 00:30 CEST = 24 oct 22:30 UTC
    const justAfterMidnightCetEve = new Date("2026-10-24T22:30:00.000Z");
    expect(
      isReunionPast(new Date("2026-10-24T12:00:00.000Z"), justAfterMidnightCetEve)
    ).toBe(true);
    expect(
      isReunionPast(new Date("2026-10-25T12:00:00.000Z"), justAfterMidnightCetEve)
    ).toBe(false);
  });

  it("participation modifiable si DateConfirmee future", () => {
    expect(
      canUpdateParticipation({
        statut: "DateConfirmee",
        dateReunion: new Date("2027-07-01T12:00:00.000Z"),
        now,
      })
    ).toBe(true);
  });

  it("participation refusée si EnAttente", () => {
    expect(
      canUpdateParticipation({
        statut: "EnAttente",
        dateReunion: new Date("2026-07-01T12:00:00.000Z"),
        now,
      })
    ).toBe(false);
  });

  it("participation refusée si passée", () => {
    expect(
      canUpdateParticipation({
        statut: "DateConfirmee",
        dateReunion: new Date("2026-01-01T12:00:00.000Z"),
        now,
      })
    ).toBe(false);
  });
});
