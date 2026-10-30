import { describe, expect, it, vi } from "vitest";
import {
  formatGelsRevisionDecimal,
  gelsRevisionsEqual,
  parseGelsRevisionDecimal,
  resolveRappelDetteGels,
} from "@/lib/services/cotisations/rappel-dette/rappel-dette-gel-resolve";
import { frozenLineKey } from "@/lib/services/cotisations/rappel-dette/types";

describe("rappel-dette-gel-resolve", () => {
  it("absence de révision → 0 (décimal)", async () => {
    const prisma = {
      rappelDetteGel: {
        findMany: vi.fn(async () => []),
      },
      rappelDetteGelRevision: {
        findUnique: vi.fn(async () => null),
      },
    };
    const r = await resolveRappelDetteGels({
      prisma: prisma as never,
      adherentId: "adh-1",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.gelsRevision).toEqual(BigInt(0));
    expect(r.gelsRevisionDecimal).toBe("0");
    expect(r.frozenAdherent).toBe(false);
    expect(r.frozenLineKeys.size).toBe(0);
  });

  it("gel adhérent + ligne → frozen*", async () => {
    const prisma = {
      rappelDetteGel: {
        findMany: vi.fn(async () => [
          {
            scope: "ADHERENT",
            lineSource: null,
            cotisationMensuelleId: null,
            detteInitialeId: null,
          },
          {
            scope: "LIGNE",
            lineSource: "cotisation_mensuelle",
            cotisationMensuelleId: "cm-1",
            detteInitialeId: null,
          },
        ]),
      },
      rappelDetteGelRevision: {
        findUnique: vi.fn(async () => ({ revision: BigInt(4) })),
      },
    };
    const r = await resolveRappelDetteGels({
      prisma: prisma as never,
      adherentId: "adh-1",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.gelsRevisionDecimal).toBe("4");
    expect(r.frozenAdherent).toBe(true);
    expect(r.frozenLineKeys.has(frozenLineKey("cotisation_mensuelle", "cm-1"))).toBe(
      true
    );
  });

  it("erreur de lecture → GEL_SOURCE_UNAVAILABLE (≠ absence)", async () => {
    const prisma = {
      rappelDetteGel: {
        findMany: vi.fn(async () => {
          throw new Error("db down");
        }),
      },
      rappelDetteGelRevision: {
        findUnique: vi.fn(async () => null),
      },
    };
    const r = await resolveRappelDetteGels({
      prisma: prisma as never,
      adherentId: "adh-1",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("GEL_SOURCE_UNAVAILABLE");
  });

  it("sérialisation décimale sans Number", () => {
    expect(formatGelsRevisionDecimal(BigInt("9007199254740993"))).toBe(
      "9007199254740993"
    );
    expect(parseGelsRevisionDecimal("9007199254740993")).toEqual(
      BigInt("9007199254740993")
    );
    expect(parseGelsRevisionDecimal("01")).toEqual(BigInt(1));
    expect(parseGelsRevisionDecimal("-1")).toBeNull();
    expect(parseGelsRevisionDecimal("1.5")).toBeNull();
    expect(gelsRevisionsEqual(BigInt(2), BigInt(2))).toBe(true);
    expect(gelsRevisionsEqual(BigInt(2), BigInt(3))).toBe(false);
  });
});
