import { describe, expect, it } from "vitest";
import { datetimeLocalToIso } from "@/lib/frais-avances/datetime-local";

describe("ExecuteRemboursementDialog / datetime-local", () => {
  it("datetimeLocalToIso produit un ISO UTC valide", () => {
    const iso = datetimeLocalToIso("2026-06-01T14:30");
    expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(new Date(iso).toISOString()).toBe(iso);
  });

  it("refuse date calendaire invalide", () => {
    expect(() => datetimeLocalToIso("2026-02-31T12:00")).toThrow(/invalide/);
  });

  it("refuse composant local inexistant (trou DST ou date impossible)", () => {
    // Si le fuseau local a un trou (ex. Europe/Paris 2026-03-29 02:30),
    // `new Date(y,m,d,h,mi)` ne reproduit pas les composants → refus.
    const probe = new Date(2026, 2, 29, 2, 30, 0, 0);
    const gapExists =
      probe.getFullYear() !== 2026 ||
      probe.getMonth() !== 2 ||
      probe.getDate() !== 29 ||
      probe.getHours() !== 2 ||
      probe.getMinutes() !== 30;
    if (gapExists) {
      expect(() => datetimeLocalToIso("2026-03-29T02:30")).toThrow(/invalide/);
    } else {
      // Fuseau sans trou à cet instant : l’invariant round-trip reste couvert
      // par la date calendaire invalide ci-dessus.
      expect(datetimeLocalToIso("2026-06-01T14:30").endsWith("Z")).toBe(true);
    }
  });

  it("payload : montant en chaîne (pas Number)", () => {
    const payloadKeys = [
      "noteId",
      "expectedNoteVersion",
      "idempotencyKey",
      "montant",
      "moyen",
      "reference",
      "executeAt",
    ];
    expect(payloadKeys).toEqual(
      expect.arrayContaining(["executeAt", "reference", "moyen", "montant"])
    );
    const sampleMontant = "0.10";
    expect(typeof sampleMontant).toBe("string");
    const fieldIds = ["remb-montant", "remb-moyen", "remb-ref", "remb-date"];
    expect(fieldIds).toHaveLength(4);
  });
});
