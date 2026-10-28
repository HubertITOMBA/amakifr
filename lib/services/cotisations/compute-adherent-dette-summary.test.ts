import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import {
  computeAdherentDetteSummary,
  computeDetteNette,
  isSelfBeneficiaryCotisation,
} from "@/lib/services/cotisations/compute-adherent-dette-summary";

const d = (v: string) => new Prisma.Decimal(v);

describe("computeAdherentDetteSummary (finance)", () => {
  it("assistance reçue seule (pas de DI/CM/obligation) → dette 0", () => {
    // L’entité Assistance n’est pas un paramètre du helper : hors dette
    const summary = computeAdherentDetteSummary({
      dettesInitiales: [],
      cotisationsOuvertes: [],
      obligationsOuvertes: [],
      avoirsDisponibles: [],
    });
    expect(summary.detteBrute.toString()).toBe("0");
    expect(summary.detteNette.toString()).toBe("0");
  });

  it("DI + CM + avoirs : résultat exact, net plancher 0", () => {
    const summary = computeAdherentDetteSummary({
      dettesInitiales: [{ montantRestant: d("60") }],
      cotisationsOuvertes: [
        {
          adherentId: "adh-A",
          adherentBeneficiaireId: null,
          montantRestant: d("20"),
        },
      ],
      obligationsOuvertes: [],
      avoirsDisponibles: [{ montantRestant: d("15") }],
    });
    expect(summary.detteBrute.toString()).toBe("80");
    expect(summary.avoirDisponible.toString()).toBe("15");
    expect(summary.detteNette.toString()).toBe("65");
  });

  it("avoirs > brute → detteNette = 0 (plancher)", () => {
    expect(computeDetteNette(d("10"), d("50")).toString()).toBe("0");
    const summary = computeAdherentDetteSummary({
      dettesInitiales: [{ montantRestant: d("10") }],
      cotisationsOuvertes: [],
      obligationsOuvertes: [],
      avoirsDisponibles: [{ montantRestant: d("50") }],
    });
    expect(summary.detteNette.toString()).toBe("0");
  });

  it("CM assistance tiers (bénéficiaire ≠ payeur) conservée", () => {
    const summary = computeAdherentDetteSummary({
      dettesInitiales: [],
      cotisationsOuvertes: [
        {
          adherentId: "adh-payer",
          adherentBeneficiaireId: "adh-benef",
          montantRestant: d("50"),
        },
      ],
      obligationsOuvertes: [],
      avoirsDisponibles: [],
    });
    expect(summary.detteBrute.toString()).toBe("50");
    expect(
      isSelfBeneficiaryCotisation({
        adherentId: "adh-payer",
        adherentBeneficiaireId: "adh-benef",
      })
    ).toBe(false);
  });

  it("propre CM bénéficiaire (auto-bénéfice) exclue du total", () => {
    const summary = computeAdherentDetteSummary({
      dettesInitiales: [{ montantRestant: d("10") }],
      cotisationsOuvertes: [
        {
          adherentId: "adh-A",
          adherentBeneficiaireId: "adh-A",
          montantRestant: d("50"),
        },
        {
          adherentId: "adh-A",
          adherentBeneficiaireId: "adh-B",
          montantRestant: d("30"),
        },
      ],
      obligationsOuvertes: [],
      avoirsDisponibles: [],
    });
    // 10 DI + 30 CM tiers ; 50 auto-bénéfice exclu
    expect(summary.detteBrute.toString()).toBe("40");
    expect(
      isSelfBeneficiaryCotisation({
        adherentId: "adh-A",
        adherentBeneficiaireId: "adh-A",
      })
    ).toBe(true);
  });

  it("Obligations legacy conservées dans le total", () => {
    const summary = computeAdherentDetteSummary({
      dettesInitiales: [],
      cotisationsOuvertes: [],
      obligationsOuvertes: [{ montantRestant: d("12.5") }],
      avoirsDisponibles: [],
    });
    expect(summary.detteBrute.toString()).toBe("12.5");
    expect(summary.detteNette.toString()).toBe("12.5");
  });

  it("composition complète Decimal sans dérive", () => {
    const summary = computeAdherentDetteSummary({
      dettesInitiales: [{ montantRestant: d("100.10") }],
      cotisationsOuvertes: [
        {
          adherentId: "a",
          adherentBeneficiaireId: null,
          montantRestant: d("0.20"),
        },
      ],
      obligationsOuvertes: [{ montantRestant: d("0.03") }],
      avoirsDisponibles: [{ montantRestant: d("0.05") }],
    });
    expect(summary.detteBrute.toString()).toBe("100.33");
    expect(summary.detteNette.toString()).toBe("100.28");
  });
});
