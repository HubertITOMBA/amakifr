import { describe, expect, it } from "vitest";
import {
  computeEventFinancialSummary,
  computeEventParticipationSummary,
  eventPaymentDestinationLabel,
  inscriptionParticipantKindLabel,
  matchesPaymentDomaineFilter,
  matchesPaymentPersonTypeFilter,
  normalizePersonTypeFilterForDomaine,
  resolveInscriptionParticipantKind,
  resolvePaymentDomaine,
  resolvePaymentPersonKind,
  shouldShowPaymentPersonTypeFilter,
} from "@/lib/services/evenements/admin-event-stats";

describe("admin-event-stats — type participant", () => {
  it("adherentId non null → Adhérent ; null → Visiteur", () => {
    expect(resolveInscriptionParticipantKind("adh-1")).toBe("Adherent");
    expect(resolveInscriptionParticipantKind(null)).toBe("Visiteur");
    expect(resolveInscriptionParticipantKind(undefined)).toBe("Visiteur");
    expect(resolveInscriptionParticipantKind("")).toBe("Visiteur");
    expect(inscriptionParticipantKindLabel("Adherent")).toBe("Adhérent");
    expect(inscriptionParticipantKindLabel("Visiteur")).toBe("Visiteur");
  });
});

describe("admin-event-stats — synthèse participation", () => {
  it("2 adhérents + 3 visiteurs : inscriptions ≠ personnes", () => {
    const summary = computeEventParticipationSummary([
      { adherentId: "a1", nombrePersonnes: 3 },
      { adherentId: "a2", nombrePersonnes: 1 },
      { adherentId: null, nombrePersonnes: 2 },
      { adherentId: null, nombrePersonnes: 1 },
      { adherentId: null, nombrePersonnes: 4 },
    ]);
    expect(summary.inscriptionsAdherents).toBe(2);
    expect(summary.inscriptionsVisiteurs).toBe(3);
    expect(summary.totalInscriptions).toBe(5);
    expect(summary.personnesAdherents).toBe(4);
    expect(summary.personnesVisiteurs).toBe(7);
    expect(summary.totalPersonnes).toBe(11);
  });
});

describe("admin-event-stats — agrégats financiers", () => {
  it("attendu / payé / reste / en attente exacts (isolation événement)", () => {
    const fin = computeEventFinancialSummary({
      inscriptions: [
        { adherentId: "a1", nombrePersonnes: 1, montantAttendu: 30, montantPaye: 30 },
        { adherentId: null, nombrePersonnes: 2, montantAttendu: 60, montantPaye: 20 },
        { adherentId: "a2", nombrePersonnes: 1, montantAttendu: 0, montantPaye: 0 },
      ],
      montantEnAttenteValidation: 15,
    });
    expect(fin.montantAttenduTotal).toBe(90);
    expect(fin.montantPayeTotal).toBe(50);
    expect(fin.montantRestantTotal).toBe(40);
    expect(fin.montantEnAttenteValidation).toBe(15);
    expect(fin.isPayant).toBe(true);
  });

  it("gratuit → isPayant false", () => {
    const fin = computeEventFinancialSummary({
      inscriptions: [
        { adherentId: "a1", nombrePersonnes: 2, montantAttendu: 0, montantPaye: 0 },
      ],
      montantEnAttenteValidation: 0,
    });
    expect(fin.isPayant).toBe(false);
  });
});

describe("admin-event-stats — filtre domaine paiements", () => {
  it("filtre événements exclut cotisations et inverse", () => {
    const evt = { inscriptionEvenementId: "ins1", InscriptionEvenement: { id: "ins1" } };
    const cot = { inscriptionEvenementId: null, InscriptionEvenement: null };
    expect(resolvePaymentDomaine(evt)).toBe("evenements");
    expect(resolvePaymentDomaine(cot)).toBe("cotisations");
    expect(matchesPaymentDomaineFilter(evt, "evenements")).toBe(true);
    expect(matchesPaymentDomaineFilter(cot, "evenements")).toBe(false);
    expect(matchesPaymentDomaineFilter(evt, "cotisations")).toBe(false);
    expect(matchesPaymentDomaineFilter(cot, "cotisations")).toBe(true);
    expect(matchesPaymentDomaineFilter(evt, "all")).toBe(true);
  });

  it("destinationLabel toujours Événement — titre", () => {
    expect(eventPaymentDestinationLabel("Gala")).toBe("Événement — Gala");
    expect(eventPaymentDestinationLabel("  ")).toBe("Événement");
  });
});

describe("admin-event-stats — filtre Type Adhérent/Visiteur", () => {
  const cotAdh = {
    inscriptionEvenementId: null,
    InscriptionEvenement: null,
  };
  const evtAdh = {
    inscriptionEvenementId: "ins-a",
    InscriptionEvenement: { adherentId: "adh-1" },
  };
  const evtVis = {
    inscriptionEvenementId: "ins-v",
    InscriptionEvenement: { adherentId: null },
  };

  it("détecte adhérent via adherentId ; visiteur via null", () => {
    expect(resolvePaymentPersonKind(cotAdh)).toBe("Adherent");
    expect(resolvePaymentPersonKind(evtAdh)).toBe("Adherent");
    expect(resolvePaymentPersonKind(evtVis)).toBe("Visiteur");
  });

  it("Événements + Adhérents / Visiteurs", () => {
    expect(matchesPaymentPersonTypeFilter(evtAdh, "adherents", "evenements")).toBe(true);
    expect(matchesPaymentPersonTypeFilter(evtVis, "adherents", "evenements")).toBe(false);
    expect(matchesPaymentPersonTypeFilter(evtVis, "visiteurs", "evenements")).toBe(true);
    expect(matchesPaymentPersonTypeFilter(evtAdh, "visiteurs", "evenements")).toBe(false);
  });

  it("Tous + Adhérents / Visiteurs", () => {
    expect(matchesPaymentPersonTypeFilter(cotAdh, "adherents", "all")).toBe(true);
    expect(matchesPaymentPersonTypeFilter(evtAdh, "adherents", "all")).toBe(true);
    expect(matchesPaymentPersonTypeFilter(evtVis, "adherents", "all")).toBe(false);
    expect(matchesPaymentPersonTypeFilter(evtVis, "visiteurs", "all")).toBe(true);
    expect(matchesPaymentPersonTypeFilter(cotAdh, "visiteurs", "all")).toBe(false);
  });

  it("Cotisations : Type ignoré + reset Visiteurs + UI masquée", () => {
    expect(matchesPaymentPersonTypeFilter(cotAdh, "visiteurs", "cotisations")).toBe(true);
    expect(matchesPaymentPersonTypeFilter(cotAdh, "adherents", "cotisations")).toBe(true);
    expect(shouldShowPaymentPersonTypeFilter("cotisations")).toBe(false);
    expect(shouldShowPaymentPersonTypeFilter("evenements")).toBe(true);
    expect(shouldShowPaymentPersonTypeFilter("all")).toBe(true);
    expect(normalizePersonTypeFilterForDomaine("cotisations", "visiteurs")).toBe("all");
    expect(normalizePersonTypeFilterForDomaine("evenements", "visiteurs")).toBe("visiteurs");
  });
});
