import { describe, expect, it } from "vitest";
import {
  formatEventPeriod,
  placesLabel,
  shouldShowHomeEventsBanner,
  evenementErrorMessage,
  classifyEventTimingFromIso,
  formatEventStatusLabel,
  eventStatusTone,
  formatEventPrix,
  formatEventTotalEstimate,
  eventPaymentStatusLabel,
  eventScopeTabLabel,
} from "./evenements-state";
import { badgeDisplayLabel } from "@/components/ui/status-badge-label";

describe("evenements-state", () => {
  it("période même jour", () => {
    const out = formatEventPeriod(
      "2026-09-06T16:30:00.000Z",
      "2026-09-06T19:00:00.000Z"
    );
    expect(out).toMatch(/06\/09\/2026/);
    expect(out).toMatch(/→/);
  });

  it("places label", () => {
    expect(placesLabel(3, 10)).toMatch(/3/);
    expect(placesLabel(null, null)).toBeNull();
  });

  it("banner home", () => {
    expect(shouldShowHomeEventsBanner(0)).toBe(false);
    expect(shouldShowHomeEventsBanner(2)).toBe(true);
  });

  it("erreur capacité", () => {
    expect(
      evenementErrorMessage({
        status: 403,
        code: "FORBIDDEN",
        message: "Pas assez de places disponibles",
      })
    ).toMatch(/places/i);
  });

  it("format statut À venir — texte complet, jamais « À »", () => {
    const now = new Date("2026-09-06T12:00:00.000Z");
    const label = formatEventStatusLabel(
      "2026-11-06T18:00:00.000Z",
      null,
      now
    );
    expect(label).toBe("À venir");
    expect(label.length).toBeGreaterThan(1);
    expect(label).not.toBe("À");
  });

  it("format statut En cours", () => {
    const now = new Date("2026-09-06T12:00:00.000Z");
    expect(
      formatEventStatusLabel(
        "2026-09-06T08:00:00.000Z",
        "2026-09-07T18:00:00.000Z",
        now
      )
    ).toBe("En cours");
  });

  it("format statut Terminé", () => {
    const now = new Date("2026-09-06T12:00:00.000Z");
    expect(
      formatEventStatusLabel(
        "2026-09-05T10:00:00.000Z",
        "2026-09-05T18:00:00.000Z",
        now
      )
    ).toBe("Terminé");
  });

  it("classification utilise dateDebut/dateFin — createdAt n'influence pas", () => {
    const now = new Date("2026-09-06T12:00:00.000Z");
    expect(
      classifyEventTimingFromIso("2026-11-06T18:00:00.000Z", null, now)
    ).toBe("upcoming");
  });

  it("tones pastel cohérents", () => {
    expect(eventStatusTone("À venir")).toBe("primary");
    expect(eventStatusTone("En cours")).toBe("success");
    expect(eventStatusTone("Terminé")).toBe("neutral");
  });

  it("onglet À venir / Passés complets (NBSP)", () => {
    expect(eventScopeTabLabel("upcoming")).toBe("À venir");
    expect(eventScopeTabLabel("past")).toBe("Passés");
    const tab = badgeDisplayLabel(eventScopeTabLabel("upcoming"));
    expect(tab).toBe("À\u00A0venir");
    expect(tab).not.toBe("À");
    expect(tab).not.toBe("A");
  });

  it("tarif et total estimé N personnes", () => {
    expect(formatEventPrix("15.5")).toBe("15,50 €");
    expect(formatEventPrix("0")).toBeNull();
    expect(formatEventPrix(null)).toBeNull();
    expect(formatEventTotalEstimate("25", 2)).toBe("50,00 €");
    expect(eventPaymentStatusLabel("APayer")).toBe("À payer");
    expect(eventPaymentStatusLabel("EnAttenteValidation")).toBe(
      "En attente de validation"
    );
  });
});
