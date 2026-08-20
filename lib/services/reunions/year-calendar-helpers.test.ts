import { describe, expect, it } from "vitest";
import {
  buildYearMonths,
  canWithdrawAsReunionHost,
  isCalendarMonthPast,
  resolveHostProposalEligibility,
} from "@/lib/services/reunions/year-calendar-helpers";

describe("isCalendarMonthPast", () => {
  const now = new Date("2026-06-15T12:00:00");

  it("mois passé", () => {
    expect(isCalendarMonthPast(2026, 5, now)).toBe(true);
  });

  it("mois courant / futur", () => {
    expect(isCalendarMonthPast(2026, 6, now)).toBe(false);
    expect(isCalendarMonthPast(2026, 10, now)).toBe(false);
  });
});

describe("canWithdrawAsReunionHost", () => {
  // 15 juin 2026 local → seuil = 13 juillet 2026 (J+28)
  const now = new Date(2026, 5, 15, 12, 0, 0);

  it("false si pas hôte", () => {
    expect(
      canWithdrawAsReunionHost({
        isCurrentUserHost: false,
        dateReunion: null,
        now,
      })
    ).toBe(false);
  });

  it("true sans date (aligné Web)", () => {
    expect(
      canWithdrawAsReunionHost({
        isCurrentUserHost: true,
        dateReunion: null,
        now,
      })
    ).toBe(true);
  });

  it("J-29 → autorisé", () => {
    expect(
      canWithdrawAsReunionHost({
        isCurrentUserHost: true,
        dateReunion: new Date(2026, 6, 14), // 15+29 = 14 juil.
        now,
      })
    ).toBe(true);
  });

  it("J-28 → autorisé (borne inclusive)", () => {
    expect(
      canWithdrawAsReunionHost({
        isCurrentUserHost: true,
        dateReunion: new Date(2026, 6, 13), // 15+28
        now,
      })
    ).toBe(true);
  });

  it("J-27 → refus", () => {
    expect(
      canWithdrawAsReunionHost({
        isCurrentUserHost: true,
        dateReunion: new Date(2026, 6, 12), // 15+27
        now,
      })
    ).toBe(false);
  });

  it("J-1 → refus", () => {
    expect(
      canWithdrawAsReunionHost({
        isCurrentUserHost: true,
        dateReunion: new Date(2026, 5, 16),
        now,
      })
    ).toBe(false);
  });

  it("jour J → refus", () => {
    expect(
      canWithdrawAsReunionHost({
        isCurrentUserHost: true,
        dateReunion: new Date(2026, 5, 15),
        now,
      })
    ).toBe(false);
  });

  it("réunion passée → refus", () => {
    expect(
      canWithdrawAsReunionHost({
        isCurrentUserHost: true,
        dateReunion: new Date(2026, 5, 1),
        now,
      })
    ).toBe(false);
  });
});

describe("resolveHostProposalEligibility", () => {
  const now = new Date("2026-06-15T12:00:00");

  it("disponible si aucune réunion", () => {
    expect(
      resolveHostProposalEligibility({
        annee: 2026,
        mois: 10,
        reunion: null,
        alreadyHostThisYear: false,
        now,
      })
    ).toEqual({
      canProposeAsHost: true,
      hostProposalBlockedReason: null,
      statusLabel: "Disponible",
    });
  });

  it("disponible si EnAttente sans hôte (après désistement)", () => {
    expect(
      resolveHostProposalEligibility({
        annee: 2026,
        mois: 10,
        reunion: {
          id: "r1",
          mois: 10,
          statut: "EnAttente",
          dateReunion: null,
          hostId: null,
          hostFirstname: null,
          hostLastname: null,
        },
        alreadyHostThisYear: false,
        now,
      })
    ).toEqual({
      canProposeAsHost: true,
      hostProposalBlockedReason: null,
      statusLabel: "Hôte à désigner",
    });
  });

  it("bloque mois passé", () => {
    expect(
      resolveHostProposalEligibility({
        annee: 2026,
        mois: 3,
        reunion: null,
        alreadyHostThisYear: false,
        now,
      }).hostProposalBlockedReason
    ).toBe("MONTH_IN_PAST");
  });

  it("bloque déjà hôte cette année", () => {
    expect(
      resolveHostProposalEligibility({
        annee: 2026,
        mois: 10,
        reunion: null,
        alreadyHostThisYear: true,
        now,
      }).hostProposalBlockedReason
    ).toBe("ALREADY_HOST_THIS_YEAR");
  });

  it("bloque mois déjà pris", () => {
    expect(
      resolveHostProposalEligibility({
        annee: 2026,
        mois: 10,
        reunion: {
          id: "r1",
          mois: 10,
          statut: "EnAttente",
          dateReunion: null,
          hostId: "adh-other",
          hostFirstname: "Jean",
          hostLastname: "Dupont",
        },
        alreadyHostThisYear: false,
        now,
      }).hostProposalBlockedReason
    ).toBe("MONTH_ALREADY_TAKEN");
  });
});

describe("buildYearMonths", () => {
  const now = new Date("2026-06-15T12:00:00");

  it("génère 12 mois avec date/hôte/statut", () => {
    const months = buildYearMonths({
      annee: 2026,
      currentAdherentId: "adh-me",
      now,
      reunions: [
        {
          id: "r9",
          mois: 9,
          statut: "DateConfirmee",
          dateReunion: new Date("2026-09-19T12:00:00.000Z"),
          hostId: "adh-other",
          hostFirstname: "Jean",
          hostLastname: "Dupont",
        },
        {
          id: "r10",
          mois: 10,
          statut: "EnAttente",
          dateReunion: null,
          hostId: "adh-me",
          hostFirstname: "Alice",
          hostLastname: "Martin",
        },
      ],
    });

    expect(months).toHaveLength(12);
    expect(months[8].monthLabel).toBe("Septembre");
    expect(months[8].dateReunion).toBe("2026-09-19T12:00:00.000Z");
    expect(months[8].hostName).toBe("Jean Dupont");
    expect(months[8].statusLabel).toBe("Date confirmée");
    expect(months[8].canProposeAsHost).toBe(false);

    expect(months[9].isCurrentUserHost).toBe(true);
    expect(months[9].canWithdrawAsHost).toBe(true);
    expect(months[9].dateReunion).toBeNull();
    expect(months[10].statusLabel).toBe("Disponible");
    expect(months[10].canProposeAsHost).toBe(false);
    expect(months[10].hostProposalBlockedReason).toBe(
      "ALREADY_HOST_THIS_YEAR"
    );
  });

  it("après désistement : mois reclaimable + canWithdraw false", () => {
    const months = buildYearMonths({
      annee: 2026,
      currentAdherentId: "adh-me",
      now,
      reunions: [
        {
          id: "r10",
          mois: 10,
          statut: "EnAttente",
          dateReunion: null,
          hostId: null,
          hostFirstname: null,
          hostLastname: null,
        },
      ],
    });

    expect(months[9].statusLabel).toBe("Hôte à désigner");
    expect(months[9].canProposeAsHost).toBe(true);
    expect(months[9].isCurrentUserHost).toBe(false);
    expect(months[9].canWithdrawAsHost).toBe(false);
    expect(months[9].hostName).toBeNull();
  });

  it("admin multi-hôte même année : affiche sans corruption", () => {
    const months = buildYearMonths({
      annee: 2026,
      currentAdherentId: "adh-me",
      now,
      reunions: [
        {
          id: "r7",
          mois: 7,
          statut: "DateConfirmee",
          dateReunion: new Date("2026-07-11T12:00:00.000Z"),
          hostId: "adh-me",
          hostFirstname: "Alice",
          hostLastname: "Martin",
        },
        {
          id: "r11",
          mois: 11,
          statut: "EnAttente",
          dateReunion: null,
          hostId: "adh-me",
          hostFirstname: "Alice",
          hostLastname: "Martin",
        },
      ],
    });

    expect(months[6].isCurrentUserHost).toBe(true);
    expect(months[10].isCurrentUserHost).toBe(true);
    expect(months.every((m) => !m.canProposeAsHost)).toBe(true);
  });
});
