import { describe, expect, it } from "vitest";
import { buildCompensationLignesFromAllocations } from "@/components/frais-avances/CompensationCiblesFields";

describe("Dialogs mixte / compensation — payload", () => {
  it("buildCompensationLignesFromAllocations conserve des chaînes", () => {
    const lignes = buildCompensationLignesFromAllocations(
      [
        {
          typeCible: "DETTE_INITIALE",
          cibleId: "d1",
          libelle: "Dette",
          plafondRestant: "10.00",
        },
      ],
      { "DETTE_INITIALE:d1": "0.29" }
    );
    expect(lignes).toEqual([
      {
        typeCible: "DETTE_INITIALE",
        cibleId: "d1",
        montant: "0.29",
        rang: 1,
      },
    ]);
  });

  it("ids accessibilité documentés", () => {
    expect([
      "mixte-montant-remb",
      "mixte-moyen",
      "mixte-ref",
      "mixte-date",
    ]).toHaveLength(4);
  });
});
