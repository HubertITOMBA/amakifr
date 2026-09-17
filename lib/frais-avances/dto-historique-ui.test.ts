import { describe, expect, it } from "vitest";
import { enrichNoteFraisFinancierDto } from "@/lib/frais-avances/dto";
import { messageErreurNoteFrais } from "@/components/frais-avances/note-frais-badges";
import { isNotesFraisEnabledClientHint } from "@/lib/frais-avances/feature-flag-client";

describe("historique règlements DTO — pas de double total / fuite référence", () => {
  const baseNote = {
    id: "n1",
    libelle: "x",
    description: null,
    dateDepense: new Date("2026-01-01"),
    montantDemande: "100.00",
    statut: "VALIDEE",
    version: 2,
    soumiseAt: null,
    alerteSansDestinataire: false,
    montantAccepte: "100.00",
    motifDecision: null,
    decideeAt: null,
    decideurUserId: null,
    corrigeNoteFraisId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    Justificatifs: [],
    ChoixReglementActif: {
      id: "c1",
      mode: "MIXTE",
      statut: "ACTIF",
      montantReference: "100.00",
      montantRemboursement: "40.00",
      montantCompensation: "60.00",
      montantRembourseUtilise: "40.00",
      montantCompensationUtilise: "60.00",
      remplaceChoixId: null,
      choisiAt: new Date(),
      Cibles: [],
    },
  };

  it("membre : mixte groupé une fois, sans clé référence", () => {
    const dto = enrichNoteFraisFinancierDto(baseNote as never, {
      includeReference: false,
      remboursements: [
        {
          id: "r-child",
          montantTotal: "40.00",
          moyen: "VIREMENT",
          executeAt: new Date("2026-06-02T10:00:00.000Z"),
          reference: "SECRET-REF",
          operationId: "op1",
          executeurLabel: "Tresor",
        },
        {
          id: "r-simple",
          montantTotal: "10.00",
          moyen: "ESPECES",
          executeAt: new Date("2026-06-03T10:00:00.000Z"),
          reference: "OTHER",
          operationId: null,
          executeurLabel: "Tresor",
        },
      ],
      compensations: [
        {
          id: "c-child",
          montantTotal: "60.00",
          executeAt: new Date("2026-06-02T10:00:00.000Z"),
          operationId: "op1",
          executeurLabel: "Tresor",
          Lignes: [],
        },
      ],
      operationsMixte: [
        {
          id: "op1",
          executeAt: new Date("2026-06-02T10:00:00.000Z"),
          remboursementMontant: "40.00",
          compensationMontant: "60.00",
          moyen: "VIREMENT",
          reference: "SECRET-REF",
          executeurLabel: "Tresor",
          cibles: [
            {
              typeCible: "DETTE_INITIALE",
              libelle: "Dette cotisation",
              montant: "60.00",
            },
          ],
        },
      ],
    });

    expect(dto.historiqueReglements).toHaveLength(2);
    const mixte = dto.historiqueReglements!.find((h) => h.kind === "MIXTE");
    const simple = dto.historiqueReglements!.find(
      (h) => h.kind === "REMBOURSEMENT_SIMPLE"
    );
    expect(mixte).toBeTruthy();
    expect(simple?.montantRemboursement).toBe("10.00");
    expect(Object.prototype.hasOwnProperty.call(mixte!, "reference")).toBe(
      false
    );
    expect(Object.prototype.hasOwnProperty.call(simple!, "reference")).toBe(
      false
    );
    expect(JSON.stringify(dto)).not.toContain("SECRET-REF");
    expect(dto.Remboursements?.some((r) => r.id === "r-child")).toBeFalsy();
  });

  it("finance : référence présente uniquement si includeReference", () => {
    const dto = enrichNoteFraisFinancierDto(baseNote as never, {
      includeReference: true,
      remboursements: [
        {
          id: "r1",
          montantTotal: "40.00",
          moyen: "VIREMENT",
          executeAt: new Date("2026-06-02T10:00:00.000Z"),
          reference: "VIR-OK",
          operationId: null,
          executeurLabel: "Tresor",
        },
      ],
      compensations: [],
      operationsMixte: [],
    });
    expect(dto.historiqueReglements![0].reference).toBe("VIR-OK");
  });
});

describe("messages UI sans données sensibles", () => {
  it("mappe REFRESH / VERSION / IDEMPOTENCY", () => {
    expect(messageErreurNoteFrais("REFRESH_REQUIRED")).toMatch(/actualisez/i);
    expect(messageErreurNoteFrais("VERSION_CONFLICT")).toMatch(/version/i);
    expect(messageErreurNoteFrais("IDEMPOTENCY_CONFLICT")).toMatch(/déjà/i);
    expect(messageErreurNoteFrais("REFRESH_REQUIRED", "VIR-SECRET")).not.toContain(
      "VIR-SECRET"
    );
  });
});

describe("hint client NEXT_PUBLIC", () => {
  it("n'autorise rien sans true", () => {
    const prev = process.env.NEXT_PUBLIC_NOTES_FRAIS_ENABLED;
    delete process.env.NEXT_PUBLIC_NOTES_FRAIS_ENABLED;
    expect(isNotesFraisEnabledClientHint()).toBe(false);
    process.env.NEXT_PUBLIC_NOTES_FRAIS_ENABLED = "true";
    expect(isNotesFraisEnabledClientHint()).toBe(true);
    if (prev === undefined) delete process.env.NEXT_PUBLIC_NOTES_FRAIS_ENABLED;
    else process.env.NEXT_PUBLIC_NOTES_FRAIS_ENABLED = prev;
  });
});
