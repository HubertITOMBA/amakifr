import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import {
  addCivilDaysParis,
  parisCivilDate,
} from "@/lib/services/cotisations/rappel-dette/paris-calendar";
import { frozenLineKey } from "@/lib/services/cotisations/rappel-dette/types";

const {
  findUniqueAdherent,
  findManyCm,
  findManyDette,
  findManyAssistance,
  findManyPaiement,
  findManyAvoir,
  findFirstRelance,
} = vi.hoisted(() => ({
  findUniqueAdherent: vi.fn(),
  findManyCm: vi.fn(),
  findManyDette: vi.fn(),
  findManyAssistance: vi.fn(),
  findManyPaiement: vi.fn(),
  findManyAvoir: vi.fn(),
  findFirstRelance: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    adherent: { findUnique: findUniqueAdherent },
    cotisationMensuelle: { findMany: findManyCm },
    detteInitiale: { findMany: findManyDette },
    assistance: { findMany: findManyAssistance },
    paiementCotisation: { findMany: findManyPaiement },
    avoir: { findMany: findManyAvoir },
    relanceCotisationMensuelle: { findFirst: findFirstRelance },
    // Garde anti-régression : ObligationCotisation ne doit jamais être interrogée.
    obligationCotisation: {
      findMany: vi.fn(() => {
        throw new Error("ObligationCotisation ne doit pas être lue");
      }),
    },
  },
}));

import { computeDetteRappelable } from "@/lib/services/cotisations/rappel-dette/compute-dette-rappelable";

const ADH = "adh-1";
const NOW = parisCivilDate(2024, 6, 30);

function dec(v: string | number) {
  return new Prisma.Decimal(v);
}

function mockActif() {
  findUniqueAdherent.mockResolvedValue({
    id: ADH,
    User: { status: "Actif" },
  });
}

function mockEmptySources() {
  findManyCm.mockResolvedValue([]);
  findManyDette.mockResolvedValue([]);
  findManyAssistance.mockResolvedValue([]);
  findManyPaiement.mockResolvedValue([]);
  findManyAvoir.mockResolvedValue([]);
  findFirstRelance.mockResolvedValue(null);
}

describe("computeDetteRappelable", () => {
  beforeEach(() => {
    findUniqueAdherent.mockReset();
    findManyCm.mockReset();
    findManyDette.mockReset();
    findManyAssistance.mockReset();
    findManyPaiement.mockReset();
    findManyAvoir.mockReset();
    findFirstRelance.mockReset();
    mockEmptySources();
  });

  it("ADHERENT_NOT_FOUND si id inconnu", async () => {
    findUniqueAdherent.mockResolvedValue(null);
    const r = await computeDetteRappelable(ADH, { now: NOW });
    expect(r.eligible).toBe(false);
    expect(r.globalReasons).toContain("ADHERENT_NOT_FOUND");
  });

  it("USER_INACTIVE si User.status !== Actif", async () => {
    findUniqueAdherent.mockResolvedValue({
      id: ADH,
      User: { status: "Inactif" },
    });
    const r = await computeDetteRappelable(ADH, { now: NOW });
    expect(r.eligible).toBe(false);
    expect(r.globalReasons).toContain("USER_INACTIVE");
    expect(findManyCm).not.toHaveBeenCalled();
  });

  it("CotisationMensuelle seule : éligible à J+15 exact", async () => {
    mockActif();
    const due = parisCivilDate(2024, 6, 15); // J+15 le 30/06
    findManyCm.mockResolvedValue([
      {
        id: "cm-1",
        adherentId: ADH,
        adherentBeneficiaireId: null,
        montantRestant: dec("15.00"),
        statut: "EnAttente",
        dateEcheance: due,
      },
    ]);

    const atJ14 = await computeDetteRappelable(ADH, {
      now: parisCivilDate(2024, 6, 29),
    });
    expect(atJ14.eligible).toBe(false);
    expect(atJ14.ignoredLines[0]?.reason).toBe("NOT_YET_DUE_J15");

    const atJ15 = await computeDetteRappelable(ADH, { now: NOW });
    expect(atJ15.eligible).toBe(true);
    expect(atJ15.globalReasons).toEqual(["ELIGIBLE"]);
    expect(atJ15.detteNette.toString()).toBe("15");
    expect(atJ15.retainedLines).toHaveLength(1);

    const atJ16 = await computeDetteRappelable(ADH, {
      now: parisCivilDate(2024, 7, 1),
    });
    expect(atJ16.eligible).toBe(true);
  });

  it("DetteInitiale seule : échéance 01/01/(annee+1) Paris, frontière J+15", async () => {
    mockActif();
    // due = 2024-01-01 00:00 Paris ; J+15 = 2024-01-16
    findManyDette.mockResolvedValue([
      { id: "di-1", annee: 2023, montantRestant: dec("100.00") },
    ]);

    const atJ14 = await computeDetteRappelable(ADH, {
      now: parisCivilDate(2024, 1, 15),
    });
    expect(atJ14.eligible).toBe(false);
    expect(atJ14.ignoredLines[0]?.reason).toBe("NOT_YET_DUE_J15");

    const atJ15 = await computeDetteRappelable(ADH, {
      now: parisCivilDate(2024, 1, 16),
    });
    expect(atJ15.eligible).toBe(true);
    expect(atJ15.retainedLines[0]?.source).toBe("dette_initiale");
    expect(atJ15.montantBrut.toString()).toBe("100");
  });

  it("Assistance seule : due = dateEvenement", async () => {
    mockActif();
    findManyAssistance.mockResolvedValue([
      {
        id: "as-1",
        montantRestant: dec("50"),
        statut: "EnAttente",
        dateEvenement: parisCivilDate(2024, 6, 1),
      },
    ]);

    const r = await computeDetteRappelable(ADH, {
      now: parisCivilDate(2024, 6, 16),
    });
    expect(r.eligible).toBe(true);
    expect(r.retainedLines[0]?.source).toBe("assistance");
  });

  it("combine les trois sources et ignore ObligationCotisation", async () => {
    mockActif();
    findManyCm.mockResolvedValue([
      {
        id: "cm-1",
        adherentId: ADH,
        adherentBeneficiaireId: null,
        montantRestant: dec("15"),
        statut: "EnRetard",
        dateEcheance: parisCivilDate(2024, 5, 1),
      },
    ]);
    findManyDette.mockResolvedValue([
      { id: "di-1", annee: 2022, montantRestant: dec("40") },
    ]);
    findManyAssistance.mockResolvedValue([
      {
        id: "as-1",
        montantRestant: dec("50"),
        statut: "EnAttente",
        dateEvenement: parisCivilDate(2024, 4, 1),
      },
    ]);

    const r = await computeDetteRappelable(ADH, { now: NOW });
    expect(r.eligible).toBe(true);
    expect(r.montantBrut.toString()).toBe("105");
    expect(r.retainedLines.map((l) => l.source).sort()).toEqual([
      "assistance",
      "cotisation_mensuelle",
      "dette_initiale",
    ]);
    // ordre déterministe : dueDate ASC
    expect(r.retainedLines.map((l) => l.id)).toEqual([
      "di-1",
      "as-1",
      "cm-1",
    ]);
    expect(r.earliestDueDate?.getTime()).toBe(
      r.retainedLines[0]!.dueDate.getTime()
    );
  });

  it("avoir total → non éligible COVERED_BY_AVOIR", async () => {
    mockActif();
    findManyCm.mockResolvedValue([
      {
        id: "cm-1",
        adherentId: ADH,
        adherentBeneficiaireId: null,
        montantRestant: dec("30"),
        statut: "EnAttente",
        dateEcheance: parisCivilDate(2024, 5, 1),
      },
    ]);
    findManyAvoir.mockResolvedValue([{ montantRestant: dec("30") }]);

    const r = await computeDetteRappelable(ADH, { now: NOW });
    expect(r.eligible).toBe(false);
    expect(r.detteNette.toString()).toBe("0");
    expect(r.globalReasons).toContain("COVERED_BY_AVOIR");
  });

  it("avoir partiel → dette nette restante", async () => {
    mockActif();
    findManyCm.mockResolvedValue([
      {
        id: "cm-1",
        adherentId: ADH,
        adherentBeneficiaireId: null,
        montantRestant: dec("40"),
        statut: "PartiellementPaye",
        dateEcheance: parisCivilDate(2024, 5, 1),
      },
    ]);
    findManyAvoir.mockResolvedValue([{ montantRestant: dec("10.50") }]);

    const r = await computeDetteRappelable(ADH, { now: NOW });
    expect(r.eligible).toBe(true);
    expect(r.avoirDisponible.toString()).toBe("10.5");
    expect(r.detteNette.toString()).toBe("29.5");
  });

  it("cooldown : EnAttente ne bloque pas (pas de preuve d’envoi)", async () => {
    mockActif();
    findManyCm.mockResolvedValue([
      {
        id: "cm-1",
        adherentId: ADH,
        adherentBeneficiaireId: null,
        montantRestant: dec("15"),
        statut: "EnAttente",
        dateEcheance: parisCivilDate(2024, 5, 1),
      },
    ]);
    // findFirst avec filtre statut Envoye|Lu|Repondu → null (EnAttente exclus)
    findFirstRelance.mockResolvedValue(null);

    const r = await computeDetteRappelable(ADH, { now: NOW });
    expect(r.eligible).toBe(true);
    expect(r.lastReminderSentAt).toBeNull();
    expect(r.globalReasons).not.toContain("REMINDER_COOLDOWN_30D");
    expect(findFirstRelance).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          statut: { in: ["Envoye", "Lu", "Repondu"] },
          dateEnvoi: { not: null },
        }),
      })
    );
  });

  it("cooldown : échec / statut non envoyé ne bloque pas même avec dateEnvoi", async () => {
    mockActif();
    findManyCm.mockResolvedValue([
      {
        id: "cm-1",
        adherentId: ADH,
        adherentBeneficiaireId: null,
        montantRestant: dec("15"),
        statut: "EnAttente",
        dateEcheance: parisCivilDate(2024, 5, 1),
      },
    ]);
    // Le service ne reçoit que les lignes filtrées Envoye|Lu|Repondu ;
    // un échec (hors liste) n’est jamais retourné par la requête → null.
    findFirstRelance.mockResolvedValue(null);

    const r = await computeDetteRappelable(ADH, { now: NOW });
    expect(r.eligible).toBe(true);
    expect(r.globalReasons).not.toContain("REMINDER_COOLDOWN_30D");
  });

  it("cooldown : envoyée J+29 bloque, J+30 autorise", async () => {
    mockActif();
    findManyCm.mockResolvedValue([
      {
        id: "cm-1",
        adherentId: ADH,
        adherentBeneficiaireId: null,
        montantRestant: dec("15"),
        statut: "EnAttente",
        dateEcheance: parisCivilDate(2024, 1, 1),
      },
    ]);
    const sentAt = parisCivilDate(2024, 6, 1);
    findFirstRelance.mockResolvedValue({
      dateEnvoi: sentAt,
      statut: "Envoye",
    });

    const at29 = await computeDetteRappelable(ADH, {
      now: addCivilDaysParis(sentAt, 29),
    });
    expect(at29.eligible).toBe(false);
    expect(at29.globalReasons).toContain("REMINDER_COOLDOWN_30D");
    expect(at29.nextEligibleReminderAt?.getTime()).toBe(
      addCivilDaysParis(sentAt, 30).getTime()
    );

    const at30 = await computeDetteRappelable(ADH, {
      now: addCivilDaysParis(sentAt, 30),
    });
    expect(at30.eligible).toBe(true);
    expect(at30.globalReasons).toEqual(["ELIGIBLE"]);
  });

  it("paiement EnCours / EnAttente → ligne PENDING_PAYMENT", async () => {
    mockActif();
    findManyCm.mockResolvedValue([
      {
        id: "cm-1",
        adherentId: ADH,
        adherentBeneficiaireId: null,
        montantRestant: dec("15"),
        statut: "EnAttente",
        dateEcheance: parisCivilDate(2024, 5, 1),
      },
    ]);
    findManyPaiement.mockResolvedValue([
      {
        cotisationMensuelleId: "cm-1",
        detteInitialeId: null,
        assistanceId: null,
      },
    ]);

    const r = await computeDetteRappelable(ADH, { now: NOW });
    expect(r.eligible).toBe(false);
    expect(r.ignoredLines[0]?.reason).toBe("PENDING_PAYMENT");
  });

  it("bénéficiaire Assistance (CM) → ASSISTANCE_BENEFICIARY", async () => {
    mockActif();
    findManyCm.mockResolvedValue([
      {
        id: "cm-ben",
        adherentId: ADH,
        adherentBeneficiaireId: ADH,
        montantRestant: dec("20"),
        statut: "EnAttente",
        dateEcheance: parisCivilDate(2024, 5, 1),
      },
    ]);

    const r = await computeDetteRappelable(ADH, { now: NOW });
    expect(r.eligible).toBe(false);
    expect(r.ignoredLines[0]?.reason).toBe("ASSISTANCE_BENEFICIARY");
  });

  it("ligne Paye / solde nul → ignorée", async () => {
    mockActif();
    findManyCm.mockResolvedValue([
      {
        id: "cm-paye",
        adherentId: ADH,
        adherentBeneficiaireId: null,
        montantRestant: dec("0"),
        statut: "Paye",
        dateEcheance: parisCivilDate(2024, 5, 1),
      },
      {
        id: "cm-zero",
        adherentId: ADH,
        adherentBeneficiaireId: null,
        montantRestant: dec("0"),
        statut: "EnAttente",
        dateEcheance: parisCivilDate(2024, 5, 1),
      },
    ]);
    findManyAssistance.mockResolvedValue([
      {
        id: "as-annule",
        montantRestant: dec("50"),
        statut: "Annule",
        dateEvenement: parisCivilDate(2024, 5, 1),
      },
    ]);

    const r = await computeDetteRappelable(ADH, { now: NOW });
    expect(r.eligible).toBe(false);
    const reasons = r.ignoredLines.map((l) => l.reason).sort();
    expect(reasons).toEqual([
      "STATUS_CLOSED",
      "STATUS_CLOSED",
      "ZERO_OR_NEGATIVE_REMAINING",
    ]);
  });

  it("dette nette jamais négative (avoir > brut)", async () => {
    mockActif();
    findManyCm.mockResolvedValue([
      {
        id: "cm-1",
        adherentId: ADH,
        adherentBeneficiaireId: null,
        montantRestant: dec("10"),
        statut: "EnAttente",
        dateEcheance: parisCivilDate(2024, 5, 1),
      },
    ]);
    findManyAvoir.mockResolvedValue([{ montantRestant: dec("99") }]);

    const r = await computeDetteRappelable(ADH, { now: NOW });
    expect(r.detteNette.toString()).toBe("0");
    expect(r.eligible).toBe(false);
  });

  it("gel contestation injecté (pas de migration) → FROZEN_CONTESTED", async () => {
    mockActif();
    findManyCm.mockResolvedValue([
      {
        id: "cm-1",
        adherentId: ADH,
        adherentBeneficiaireId: null,
        montantRestant: dec("15"),
        statut: "EnAttente",
        dateEcheance: parisCivilDate(2024, 5, 1),
      },
    ]);

    const lineFrozen = await computeDetteRappelable(ADH, {
      now: NOW,
      frozenLineKeys: new Set([
        frozenLineKey("cotisation_mensuelle", "cm-1"),
      ]),
    });
    expect(lineFrozen.eligible).toBe(false);
    expect(lineFrozen.ignoredLines[0]?.reason).toBe("FROZEN_CONTESTED");

    const adhFrozen = await computeDetteRappelable(ADH, {
      now: NOW,
      frozenAdherent: true,
    });
    expect(adhFrozen.eligible).toBe(false);
    expect(adhFrozen.globalReasons).toContain("FROZEN_CONTESTED");
  });

  it("plusieurs lignes : ordre déterministe dueDate ASC, source, id", async () => {
    mockActif();
    findManyCm.mockResolvedValue([
      {
        id: "cm-b",
        adherentId: ADH,
        adherentBeneficiaireId: null,
        montantRestant: dec("10"),
        statut: "EnAttente",
        dateEcheance: parisCivilDate(2024, 5, 10),
      },
      {
        id: "cm-a",
        adherentId: ADH,
        adherentBeneficiaireId: null,
        montantRestant: dec("10"),
        statut: "EnAttente",
        dateEcheance: parisCivilDate(2024, 5, 10),
      },
    ]);

    const r = await computeDetteRappelable(ADH, { now: NOW });
    expect(r.retainedLines.map((l) => l.id)).toEqual(["cm-a", "cm-b"]);
  });

  it("Prisma fail-closed → PRISMA_ERROR, non éligible", async () => {
    findUniqueAdherent.mockRejectedValue(new Error("db down"));
    const r = await computeDetteRappelable(ADH, { now: NOW });
    expect(r.eligible).toBe(false);
    expect(r.globalReasons).toEqual(["PRISMA_ERROR"]);
  });

  it("n’interroge jamais obligationCotisation (mock throw)", async () => {
    mockActif();
    findManyCm.mockResolvedValue([
      {
        id: "cm-1",
        adherentId: ADH,
        adherentBeneficiaireId: null,
        montantRestant: dec("15"),
        statut: "EnAttente",
        dateEcheance: parisCivilDate(2024, 5, 1),
      },
    ]);
    const r = await computeDetteRappelable(ADH, { now: NOW });
    expect(r.eligible).toBe(true);
  });

  it("montants en Decimal (pas de float)", async () => {
    mockActif();
    findManyCm.mockResolvedValue([
      {
        id: "cm-1",
        adherentId: ADH,
        adherentBeneficiaireId: null,
        montantRestant: dec("10.10"),
        statut: "EnAttente",
        dateEcheance: parisCivilDate(2024, 5, 1),
      },
    ]);
    findManyDette.mockResolvedValue([
      { id: "di-1", annee: 2020, montantRestant: dec("0.20") },
    ]);

    const r = await computeDetteRappelable(ADH, { now: NOW });
    expect(r.montantBrut).toBeInstanceOf(Prisma.Decimal);
    expect(r.montantBrut.toString()).toBe("10.3");
  });
});
