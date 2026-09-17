import { describe, expect, it } from "vitest";
import {
  computeChargesFromDepensesValides,
  computeSoldeBancaireEstime,
  withCompensationsNotesFrais,
  withDecaissementsNotesFrais,
  withRestantDuNotesFrais,
  withRestitutionsNotesFrais,
} from "@/lib/financial/synthese-charges";

describe("computeChargesFromDepensesValides (lot 4.0)", () => {
  it("agrège totalCharges et ORDINAIRE ; FRAIS_AVANCE hors décaissement", () => {
    const ind = computeChargesFromDepensesValides([
      { montant: 100, origine: "ORDINAIRE" },
      { montant: 40, origine: "FRAIS_AVANCE" },
      { montant: 10.5, origine: "ORDINAIRE" },
    ]);
    expect(ind.totalCharges).toBe(150.5);
    expect(ind.depensesOrdinairesDecaissees).toBe(110.5);
    expect(ind.decaissementsNotesFrais).toBe(0);
    expect(ind.compensationsNotesFrais).toBe(0);
    expect(ind.restitutionsNotesFrais).toBe(0);
    expect(ind.restantDuNotesFrais).toBe(0);
  });

  it("synthèse Decimal : chaînes décimales sans flottant intermédiaire", () => {
    const base = computeChargesFromDepensesValides([
      { montant: "0.10", origine: "ORDINAIRE" },
      { montant: "0.20", origine: "FRAIS_AVANCE" },
    ]);
    expect(base.totalCharges).toBe(0.3);
    const withNets = withDecaissementsNotesFrais(
      withCompensationsNotesFrais(base, "-0.05"),
      "10.10"
    );
    expect(withNets.compensationsNotesFrais).toBe(-0.05);
    expect(withNets.decaissementsNotesFrais).toBe(10.1);
    expect(computeSoldeBancaireEstime("100.00", withNets)).toBe(89.8);
  });

  it("lot 4.7 : restitutions séparées des décaissements ; solde exact", () => {
    const base = computeChargesFromDepensesValides([
      { montant: "30.00", origine: "ORDINAIRE" },
    ]);
    const withDec = withDecaissementsNotesFrais(base, "100.00");
    const withRest = withRestitutionsNotesFrais(withDec, "25.00");
    expect(withRest.decaissementsNotesFrais).toBe(100);
    expect(withRest.restitutionsNotesFrais).toBe(25);
    // recettes 200 − ordinaires 30 − décaissements 100 + restitutions 25 = 95
    expect(computeSoldeBancaireEstime("200.00", withRest)).toBe(95);
    const withRestant = withRestantDuNotesFrais(withRest, "40.00");
    expect(withRestant.restantDuNotesFrais).toBe(40);
  });


  it("ne classe jamais par noteFraisId (origine seule)", () => {
    const ind = computeChargesFromDepensesValides([
      { montant: 25, origine: "FRAIS_AVANCE" },
    ]);
    expect(ind.totalCharges).toBe(25);
    expect(ind.depensesOrdinairesDecaissees).toBe(0);
  });

  it("solde : FRAIS_AVANCE n'abaisse pas ; ORDINAIRE abaisse", () => {
    const withFa = computeChargesFromDepensesValides([
      { montant: 50, origine: "FRAIS_AVANCE" },
    ]);
    expect(computeSoldeBancaireEstime(200, withFa)).toBe(200);

    const withOrd = computeChargesFromDepensesValides([
      { montant: 30, origine: "ORDINAIRE" },
      { montant: 50, origine: "FRAIS_AVANCE" },
    ]);
    expect(computeSoldeBancaireEstime(200, withOrd)).toBe(170);
  });
});
