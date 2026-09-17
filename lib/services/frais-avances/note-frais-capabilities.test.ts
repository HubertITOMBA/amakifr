import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  noteFindUnique,
  reglementFindMany,
  canReadSubmitted,
  canReadFinancial,
  canDecide,
  canExecComp,
  canExecRemb,
  canExecMixte,
  canCorrect,
} = vi.hoisted(() => ({
  noteFindUnique: vi.fn(),
  reglementFindMany: vi.fn(),
  canReadSubmitted: vi.fn(),
  canReadFinancial: vi.fn(),
  canDecide: vi.fn(),
  canExecComp: vi.fn(),
  canExecRemb: vi.fn(),
  canExecMixte: vi.fn(),
  canCorrect: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    noteFrais: { findUnique: (...a: unknown[]) => noteFindUnique(...a) },
    noteFraisReglement: {
      findMany: (...a: unknown[]) => reglementFindMany(...a),
    },
  },
}));

vi.mock("@/lib/frais-avances/feature-flag", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/frais-avances/feature-flag")
  >("@/lib/frais-avances/feature-flag");
  return {
    ...actual,
    assertNotesFraisEnabled: vi.fn(),
    isNotesFraisEnabled: () => true,
  };
});

vi.mock("@/lib/frais-avances/authz", () => ({
  canUserReadSubmittedNotesFrais: (...a: unknown[]) => canReadSubmitted(...a),
  canUserReadNoteFraisFinancialView: (...a: unknown[]) =>
    canReadFinancial(...a),
  canUserDecideNoteFrais: (...a: unknown[]) => canDecide(...a),
  canUserExecuteNoteFraisCompensation: (...a: unknown[]) => canExecComp(...a),
  canUserExecuteNoteFraisRemboursement: (...a: unknown[]) => canExecRemb(...a),
  canUserExecuteNoteFraisReglementMixte: (...a: unknown[]) => canExecMixte(...a),
  canUserCorrectNoteFraisReglement: (...a: unknown[]) => canCorrect(...a),
}));

import { getNoteFraisCapabilities } from "@/lib/services/frais-avances/note-frais-capabilities-service";

describe("getNoteFraisCapabilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    canReadSubmitted.mockResolvedValue(false);
    canReadFinancial.mockResolvedValue(false);
    canDecide.mockResolvedValue(false);
    canExecComp.mockResolvedValue(false);
    canExecRemb.mockResolvedValue(false);
    canExecMixte.mockResolvedValue(false);
    canCorrect.mockResolvedValue(false);
    reglementFindMany.mockResolvedValue([]);
  });

  it("owner : canReadLive sans rôle lecteur ; PRESID sans exécution", async () => {
    noteFindUnique.mockResolvedValue({
      id: "n1",
      statut: "VALIDEE",
      demandeurUserId: "owner",
      ChoixReglements: [
        {
          mode: "MIXTE",
          montantRemboursement: "40.00",
          montantCompensation: "60.00",
          montantRembourseUtilise: "0.00",
          montantCompensationUtilise: "0.00",
        },
      ],
    });

    const owner = await getNoteFraisCapabilities({
      userId: "owner",
      noteId: "n1",
    });
    expect(owner.success).toBe(true);
    if (!owner.success) return;
    expect(owner.data.isOwner).toBe(true);
    expect(owner.data.canReadLive).toBe(true);
    expect(owner.data.canDecide).toBe(false);
    expect(owner.data.canExecuteMixte).toBe(false);
    expect(canReadSubmitted).not.toHaveBeenCalled();

    canReadSubmitted.mockResolvedValue(true);
    noteFindUnique.mockResolvedValue({
      id: "n1",
      statut: "VALIDEE",
      demandeurUserId: "other",
      ChoixReglements: [
        {
          mode: "MIXTE",
          montantRemboursement: "40.00",
          montantCompensation: "60.00",
          montantRembourseUtilise: "0.00",
          montantCompensationUtilise: "0.00",
        },
      ],
    });
    const presid = await getNoteFraisCapabilities({
      userId: "presid",
      noteId: "n1",
    });
    expect(presid.success).toBe(true);
    if (!presid.success) return;
    expect(presid.data.canReadLive).toBe(true);
    expect(presid.data.canExecuteCompensation).toBe(false);
    expect(presid.data.canExecuteRemboursement).toBe(false);
    expect(presid.data.canExecuteMixte).toBe(false);
  });

  it("TRESOR : boutons exécution si VALIDEE + plafonds > 0", async () => {
    canReadSubmitted.mockResolvedValue(true);
    canExecComp.mockResolvedValue(true);
    canExecRemb.mockResolvedValue(true);
    canExecMixte.mockResolvedValue(true);
    noteFindUnique.mockResolvedValue({
      id: "n2",
      statut: "VALIDEE",
      demandeurUserId: "m",
      ChoixReglements: [
        {
          mode: "MIXTE",
          montantRemboursement: "40.00",
          montantCompensation: "60.00",
          montantRembourseUtilise: "10.00",
          montantCompensationUtilise: "0.00",
        },
      ],
    });

    const res = await getNoteFraisCapabilities({
      userId: "tres",
      noteId: "n2",
    });
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.canExecuteRemboursement).toBe(true);
    expect(res.data.canExecuteCompensation).toBe(true);
    expect(res.data.canExecuteMixte).toBe(true);
    expect(res.data.plafondRemboursementRestant).toBe("30.00");
    expect(res.data.plafondCompensationRestant).toBe("60.00");
  });

  it("canDecide uniquement SOUMISE + helper décideur", async () => {
    canDecide.mockResolvedValue(true);
    noteFindUnique.mockResolvedValue({
      id: "n3",
      statut: "SOUMISE",
      demandeurUserId: "m",
      ChoixReglements: [],
    });
    const ok = await getNoteFraisCapabilities({ userId: "t", noteId: "n3" });
    expect(ok.success && ok.data.canDecide).toBe(true);

    noteFindUnique.mockResolvedValue({
      id: "n3",
      statut: "VALIDEE",
      demandeurUserId: "m",
      ChoixReglements: [],
    });
    const no = await getNoteFraisCapabilities({ userId: "t", noteId: "n3" });
    expect(no.success && no.data.canDecide).toBe(false);
  });

  it("COMCPT : financial sans live ni exécution", async () => {
    canReadFinancial.mockResolvedValue(true);
    noteFindUnique.mockResolvedValue({
      id: "n4",
      statut: "VALIDEE",
      demandeurUserId: "m",
      ChoixReglements: [
        {
          mode: "REMBOURSEMENT",
          montantRemboursement: "100.00",
          montantCompensation: "0.00",
          montantRembourseUtilise: "0.00",
          montantCompensationUtilise: "0.00",
        },
      ],
    });
    const res = await getNoteFraisCapabilities({
      userId: "compt",
      noteId: "n4",
    });
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.canReadFinancial).toBe(true);
    expect(res.data.canReadLive).toBe(false);
    expect(res.data.canExecuteRemboursement).toBe(false);
  });
});
