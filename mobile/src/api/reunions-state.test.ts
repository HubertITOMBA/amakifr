import { describe, expect, it } from "vitest";
import type { MyReunionDto } from "@/api/types";
import {
  formatReunionDate,
  formatReunionDateTime,
  formatYearMonthDate,
  formatYearMonthHost,
  shouldShowHostWithdrawBlockedBy28DaysMessage,
  HOST_WITHDRAW_BLOCKED_BY_28_DAYS_MESSAGE,
  hostProposalBlockedLabel,
  hostProposalErrorMessage,
  mapParticipationStatut,
  mapReunionStatut,
  reunionsErrorMessage,
  splitReunionsByTime,
} from "@/api/reunions-state";

function reunion(overrides: Partial<MyReunionDto> = {}): MyReunionDto {
  return {
    id: "r1",
    titre: "Réunion de mars 2026",
    annee: 2026,
    mois: 3,
    dateReunion: null,
    statut: "DateConfirmee",
    typeLieu: "Domicile",
    lieuLabel: "Chez Alice",
    lieuAdresse: null,
    isHost: false,
    hostName: "Alice",
    hostTelephones: null,
    participationStatus: null,
    canUpdateParticipation: true,
    commentaires: null,
    ...overrides,
  };
}

describe("reunionsErrorMessage", () => {
  it("réseau", () => {
    expect(
      reunionsErrorMessage({ status: 0, code: "NETWORK_ERROR", message: "x" })
    ).toBe("Serveur injoignable");
  });

  it("404 adhérent", () => {
    expect(
      reunionsErrorMessage({ status: 404, code: "NOT_FOUND", message: "x" })
    ).toBe("Dossier adhérent introuvable.");
  });
});

describe("formatReunionDate*", () => {
  it("date absente", () => {
    expect(formatReunionDate(null)).toBe("Date à confirmer");
    expect(formatReunionDateTime(null)).toBe("Date à confirmer");
  });

  it("date valide", () => {
    const formatted = formatReunionDate("2026-03-14T18:00:00.000Z");
    expect(formatted).toMatch(/2026/);
  });
});

describe("mapReunionStatut", () => {
  it("mappe les statuts connus", () => {
    expect(mapReunionStatut("DateConfirmee").label).toBe("Confirmée");
    expect(mapReunionStatut("Annulee").tone).toBe("danger");
  });
});

describe("mapParticipationStatut", () => {
  it("null si absent", () => {
    expect(mapParticipationStatut(null)).toBeNull();
  });

  it("Présent", () => {
    expect(mapParticipationStatut("Present")?.label).toBe("Présent");
  });
});

describe("hostProposal helpers", () => {
  it("messages métier", () => {
    expect(
      hostProposalErrorMessage({
        status: 409,
        code: "CONFLICT",
        message: "Mois pris",
      })
    ).toBe("Mois pris");
    expect(hostProposalBlockedLabel("ALREADY_HOST_THIS_YEAR")).toMatch(
      /cette année/
    );
  });

  it("format année mois", () => {
    expect(
      formatYearMonthHost({ hostName: null })
    ).toBe("Hôte à désigner");
    expect(formatYearMonthDate({ dateReunion: null })).toBe(
      "Date à confirmer"
    );
  });
});

describe("splitReunionsByTime", () => {
  const now = new Date("2026-06-15T12:00:00.000Z");

  it("sépare à venir / historique", () => {
    const { upcoming, past } = splitReunionsByTime(
      [
        reunion({
          id: "future",
          dateReunion: "2026-07-01T18:00:00.000Z",
        }),
        reunion({
          id: "past",
          dateReunion: "2026-01-01T18:00:00.000Z",
        }),
        reunion({ id: "pending", dateReunion: null, statut: "EnAttente" }),
        reunion({ id: "cancelled", statut: "Annulee", dateReunion: null }),
      ],
      now
    );

    expect(upcoming.map((r) => r.id)).toEqual(["future", "pending"]);
    expect(past.map((r) => r.id)).toEqual(["past", "cancelled"]);
  });
});

describe("shouldShowHostWithdrawBlockedBy28DaysMessage", () => {
  it("hôte + J-27 (date + canWithdraw false) → message visible", () => {
    expect(
      shouldShowHostWithdrawBlockedBy28DaysMessage({
        isCurrentUserHost: true,
        dateReunion: "2026-07-12T12:00:00.000Z",
        canWithdrawAsHost: false,
      })
    ).toBe(true);
  });

  it("hôte + J-28 (canWithdraw true) → message absent", () => {
    expect(
      shouldShowHostWithdrawBlockedBy28DaysMessage({
        isCurrentUserHost: true,
        dateReunion: "2026-07-13T12:00:00.000Z",
        canWithdrawAsHost: true,
      })
    ).toBe(false);
  });

  it("non-hôte → message absent", () => {
    expect(
      shouldShowHostWithdrawBlockedBy28DaysMessage({
        isCurrentUserHost: false,
        dateReunion: "2026-07-12T12:00:00.000Z",
        canWithdrawAsHost: false,
      })
    ).toBe(false);
  });

  it("date null → message absent", () => {
    expect(
      shouldShowHostWithdrawBlockedBy28DaysMessage({
        isCurrentUserHost: true,
        dateReunion: null,
        canWithdrawAsHost: false,
      })
    ).toBe(false);
  });

  it("libellé message stable", () => {
    expect(HOST_WITHDRAW_BLOCKED_BY_28_DAYS_MESSAGE).toContain("28 jours");
  });
});

