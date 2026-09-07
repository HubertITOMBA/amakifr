import { describe, expect, it } from "vitest";
import {
  buildEventScopeWhere,
  canMemberSeeEvent,
  canRegisterToEvent,
  canWithdrawFromEvent,
  classifyEventTiming,
  computePlacesRestantes,
  eventStatusLabel,
  isEventRegistrationOpen,
  isEventVisibleForAdherent,
  parseEventPagination,
} from "@/lib/services/evenements/event-helpers";

const base = {
  statut: "Publie",
  dateAffichage: new Date("2026-01-01"),
  dateFinAffichage: new Date("2026-12-31"),
  dateDebut: new Date("2026-10-01T18:00:00Z"),
  inscriptionRequis: true,
  dateLimiteInscription: new Date("2026-09-30"),
  placesDisponibles: 10 as number | null,
  placesReservees: 2,
};

describe("event-helpers", () => {
  it("brouillon invisible (fenêtre affichage Web)", () => {
    expect(
      isEventVisibleForAdherent(
        { ...base, statut: "Brouillon" },
        new Date("2026-06-01")
      )
    ).toBe(false);
  });

  it("canMemberSeeEvent — Publie oui, brouillon non", () => {
    expect(canMemberSeeEvent({ statut: "Publie" })).toBe(true);
    expect(canMemberSeeEvent({ statut: "Brouillon" })).toBe(false);
  });

  it("futur visible dans fenêtre affichage", () => {
    expect(isEventVisibleForAdherent(base, new Date("2026-06-01"))).toBe(true);
  });

  it("hors fenêtre invisible (Web affichage)", () => {
    expect(isEventVisibleForAdherent(base, new Date("2027-01-01"))).toBe(false);
  });

  it("inscription ouverte même hors fenêtre dateAffichage (miroir Web)", () => {
    const avantAffichage = {
      ...base,
      dateAffichage: new Date("2026-09-01"),
      dateFinAffichage: new Date("2026-12-31"),
      dateLimiteInscription: null,
    };
    expect(
      isEventRegistrationOpen(avantAffichage, new Date("2026-06-01"))
    ).toBe(true);
    expect(
      canRegisterToEvent(avantAffichage, false, new Date("2026-06-01"))
    ).toBe(true);
  });

  it("places restantes", () => {
    expect(computePlacesRestantes(10, 3)).toBe(7);
    expect(computePlacesRestantes(null, 3)).toBeNull();
  });

  it("inscription ouverte / date limite", () => {
    expect(isEventRegistrationOpen(base, new Date("2026-06-01"))).toBe(true);
    expect(isEventRegistrationOpen(base, new Date("2026-10-01"))).toBe(false);
  });

  it("capacité pleine → fermée", () => {
    expect(
      isEventRegistrationOpen(
        { ...base, placesDisponibles: 2, placesReservees: 2 },
        new Date("2026-06-01")
      )
    ).toBe(false);
  });

  it("obligatoire sans inscriptionRequis → pas de canRegister", () => {
    expect(
      canRegisterToEvent(
        { ...base, inscriptionRequis: false },
        false,
        new Date("2026-06-01")
      )
    ).toBe(false);
  });

  it("canRegister / canWithdraw", () => {
    expect(canRegisterToEvent(base, false, new Date("2026-06-01"))).toBe(true);
    expect(canRegisterToEvent(base, true, new Date("2026-06-01"))).toBe(false);
    expect(canWithdrawFromEvent(base, true, new Date("2026-06-01"))).toBe(true);
    expect(canWithdrawFromEvent(base, false, new Date("2026-06-01"))).toBe(
      false
    );
  });

  it("statutLabel À venir", () => {
    expect(
      eventStatusLabel(
        {
          statut: "Publie",
          dateDebut: new Date("2026-10-01"),
          dateFin: null,
        },
        new Date("2026-06-01")
      )
    ).toBe("À venir");
  });

  it("créé aujourd'hui mais événement dans 2 mois → À venir", () => {
    const now = new Date("2026-09-06T12:00:00Z");
    expect(
      classifyEventTiming(new Date("2026-11-06T18:00:00Z"), null, now)
    ).toBe("upcoming");
  });

  it("créé il y a 1 an mais événement demain → À venir", () => {
    const now = new Date("2026-09-06T12:00:00Z");
    expect(
      classifyEventTiming(new Date("2026-09-07T18:00:00Z"), null, now)
    ).toBe("upcoming");
  });

  it("créé aujourd'hui mais événement terminé hier → Passé", () => {
    const now = new Date("2026-09-06T12:00:00Z");
    expect(
      classifyEventTiming(
        new Date("2026-09-05T10:00:00Z"),
        new Date("2026-09-05T18:00:00Z"),
        now
      )
    ).toBe("past");
  });

  it("commencé aujourd'hui et fin demain → En cours", () => {
    const now = new Date("2026-09-06T12:00:00Z");
    expect(
      classifyEventTiming(
        new Date("2026-09-06T08:00:00Z"),
        new Date("2026-09-07T18:00:00Z"),
        now
      )
    ).toBe("ongoing");
  });

  it("scope where upcoming/past — dateDebut/dateFin, jamais createdAt", () => {
    const now = new Date("2026-09-06T12:00:00Z");
    const upcoming = buildEventScopeWhere("upcoming", now);
    const past = buildEventScopeWhere("past", now);
    expect(JSON.stringify(upcoming)).not.toMatch(/createdAt/);
    expect(JSON.stringify(past)).not.toMatch(/createdAt/);
    expect(JSON.stringify(upcoming)).not.toMatch(/dateAffichage/);
    expect(JSON.stringify(past)).not.toMatch(/dateAffichage/);
  });

  it("pagination max 50", () => {
    expect(parseEventPagination("999", "-1")).toEqual({ limit: 50, offset: 0 });
  });
});
