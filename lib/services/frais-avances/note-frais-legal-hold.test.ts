/**
 * Tests unitaires legal hold (lot 4.10).
 */
import { describe, expect, it, vi } from "vitest";
import {
  hasActiveLegalHoldOnArchive,
  hasActiveLegalHoldOnPeriode,
  NOTES_FRAIS_LEGAL_HOLD_CONFLICT,
  PoseLegalHoldArchiveSchema,
} from "@/lib/services/frais-avances/note-frais-legal-hold-service";

describe("legal hold", () => {
  it("détecte hold ACTIF archive", async () => {
    const client = {
      noteFraisLegalHold: {
        findFirst: vi.fn().mockResolvedValue({ id: "h1" }),
      },
    };
    expect(await hasActiveLegalHoldOnArchive("a1", client as never)).toBe(true);
  });

  it("pas de hold → false", async () => {
    const client = {
      noteFraisLegalHold: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    };
    expect(await hasActiveLegalHoldOnArchive("a1", client as never)).toBe(false);
    expect(await hasActiveLegalHoldOnPeriode("2026", client as never)).toBe(
      false
    );
  });

  it("validation motif obligatoire", () => {
    expect(() =>
      PoseLegalHoldArchiveSchema.parse({
        archiveId: "a1",
        motif: "ab",
      })
    ).toThrow();
    expect(
      PoseLegalHoldArchiveSchema.parse({
        archiveId: "a1",
        motif: "motif valide de hold",
      }).motif
    ).toBe("motif valide de hold");
  });

  it("constante conflit exposée", () => {
    expect(NOTES_FRAIS_LEGAL_HOLD_CONFLICT).toBe(
      "NOTES_FRAIS_LEGAL_HOLD_CONFLICT"
    );
  });
});
