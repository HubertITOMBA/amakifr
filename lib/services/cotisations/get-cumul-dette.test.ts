import { beforeEach, describe, expect, it, vi } from "vitest";
import { Decimal } from "@prisma/client/runtime/library";

const {
  authMock,
  canReadMock,
  findUniqueAdherent,
  findManyDette,
  findManyCotisation,
  findManyAssistance,
  findManyObligation,
  findManyAvoir,
} = vi.hoisted(() => ({
  authMock: vi.fn(),
  canReadMock: vi.fn(),
  findUniqueAdherent: vi.fn(),
  findManyDette: vi.fn(),
  findManyCotisation: vi.fn(),
  findManyAssistance: vi.fn(),
  findManyObligation: vi.fn(),
  findManyAvoir: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: authMock }));

vi.mock("@/lib/dynamic-permissions", () => ({
  canRead: canReadMock,
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    adherent: { findUnique: findUniqueAdherent },
    detteInitiale: { findMany: findManyDette },
    cotisationMensuelle: { findMany: findManyCotisation },
    assistance: { findMany: findManyAssistance },
    obligationCotisation: { findMany: findManyObligation },
    avoir: { findMany: findManyAvoir },
  },
}));

vi.mock("@/lib/activity-logger", () => ({
  logCreation: vi.fn(),
  logModification: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { getCumulDette } from "@/actions/paiements/index";

function resetFinancialMocks() {
  findManyDette.mockReset();
  findManyCotisation.mockReset();
  findManyAssistance.mockReset();
  findManyObligation.mockReset();
  findManyAvoir.mockReset();
}

beforeEach(() => {
  authMock.mockReset();
  canReadMock.mockReset();
  findUniqueAdherent.mockReset();
  resetFinancialMocks();
});

describe("getCumulDette — ownership + finance", () => {
  it("session absente → Non autorisé, aucune lecture financière", async () => {
    authMock.mockResolvedValue(null);
    const r = await getCumulDette("adh-B");
    expect(r).toEqual({ success: false, error: "Non autorisé" });
    expect(findUniqueAdherent).not.toHaveBeenCalled();
    expect(findManyDette).not.toHaveBeenCalled();
    expect(findManyCotisation).not.toHaveBeenCalled();
    expect(findManyAssistance).not.toHaveBeenCalled();
    expect(findManyObligation).not.toHaveBeenCalled();
    expect(findManyAvoir).not.toHaveBeenCalled();
  });

  it("tiers non autorisé → Non autorisé, aucune lecture financière du tiers", async () => {
    authMock.mockResolvedValue({ user: { id: "user-A" } });
    findUniqueAdherent.mockResolvedValue({ id: "adh-A" });
    canReadMock.mockResolvedValue(false);

    const r = await getCumulDette("adh-B");
    expect(r).toEqual({ success: false, error: "Non autorisé" });
    expect(canReadMock).toHaveBeenCalledWith(
      "user-A",
      "getAdherentFinancialItems"
    );
    expect(findManyDette).not.toHaveBeenCalled();
    expect(findManyCotisation).not.toHaveBeenCalled();
    expect(findManyAssistance).not.toHaveBeenCalled();
    expect(findManyObligation).not.toHaveBeenCalled();
    expect(findManyAvoir).not.toHaveBeenCalled();
  });

  it("self autorisé : Assistance listée mais hors totalDette/detteNette", async () => {
    authMock.mockResolvedValue({ user: { id: "user-A" } });
    findUniqueAdherent.mockResolvedValue({ id: "adh-A" });

    findManyDette.mockResolvedValue([
      {
        id: "di1",
        adherentId: "adh-A",
        annee: 2024,
        montant: new Decimal("100"),
        montantPaye: new Decimal("40"),
        montantRestant: new Decimal("60"),
        description: null,
      },
    ]);
    findManyCotisation.mockResolvedValue([
      {
        id: "cm1",
        adherentId: "adh-A",
        adherentBeneficiaireId: null,
        montantAttendu: new Decimal("20"),
        montantPaye: new Decimal("0"),
        montantRestant: new Decimal("20"),
        statut: "EnAttente",
      },
    ]);
    findManyAssistance.mockResolvedValue([
      {
        id: "as1",
        adherentId: "adh-A",
        montant: new Decimal("50"),
        montantPaye: new Decimal("0"),
        montantRestant: new Decimal("50"),
        statut: "EnAttente",
      },
    ]);
    findManyObligation.mockResolvedValue([]);
    findManyAvoir.mockResolvedValue([
      {
        id: "av1",
        adherentId: "adh-A",
        montantRestant: new Decimal("15"),
        statut: "Disponible",
      },
    ]);

    const r = await getCumulDette("adh-A");
    expect(r.success).toBe(true);
    if (!r.success || !r.data) throw new Error("expected success");

    // 60+20 − 15 ; Assistance 50 hors total
    expect(r.data.totalDette).toBe(80);
    expect(r.data.totalAvoirs).toBe(15);
    expect(r.data.detteNette).toBe(65);
    expect(r.data.assistances).toHaveLength(1);
    expect(r.data.assistances[0].montantRestant).toBe(50);
    expect(r.data).toHaveProperty("dettesInitiales");
    expect(r.data).toHaveProperty("cotisationsMensuelles");
    expect(r.data).toHaveProperty("obligations");
  });

  it("admin canRead(getAdherentFinancialItems) peut lire une fiche tierce", async () => {
    authMock.mockResolvedValue({ user: { id: "user-admin" } });
    findUniqueAdherent.mockResolvedValue(null);
    canReadMock.mockResolvedValue(true);

    findManyDette.mockResolvedValue([]);
    findManyCotisation.mockResolvedValue([]);
    findManyAssistance.mockResolvedValue([]);
    findManyObligation.mockResolvedValue([]);
    findManyAvoir.mockResolvedValue([]);

    const r = await getCumulDette("adh-B");
    expect(r.success).toBe(true);
    expect(canReadMock).toHaveBeenCalledWith(
      "user-admin",
      "getAdherentFinancialItems"
    );
    expect(findManyDette).toHaveBeenCalledWith(
      expect.objectContaining({ where: { adherentId: "adh-B" } })
    );
  });

  it("CM auto-bénéfice exclue du total ; CM tiers conservée", async () => {
    authMock.mockResolvedValue({ user: { id: "user-A" } });
    findUniqueAdherent.mockResolvedValue({ id: "adh-A" });

    findManyDette.mockResolvedValue([]);
    findManyCotisation.mockResolvedValue([
      {
        id: "cm-self",
        adherentId: "adh-A",
        adherentBeneficiaireId: "adh-A",
        montantAttendu: new Decimal("50"),
        montantPaye: new Decimal("0"),
        montantRestant: new Decimal("50"),
        statut: "EnAttente",
      },
      {
        id: "cm-tiers",
        adherentId: "adh-A",
        adherentBeneficiaireId: "adh-B",
        montantAttendu: new Decimal("30"),
        montantPaye: new Decimal("0"),
        montantRestant: new Decimal("30"),
        statut: "EnAttente",
      },
    ]);
    findManyAssistance.mockResolvedValue([]);
    findManyObligation.mockResolvedValue([
      {
        id: "ob1",
        adherentId: "adh-A",
        montantAttendu: new Decimal("5"),
        montantPaye: new Decimal("0"),
        montantRestant: new Decimal("5"),
        statut: "EnAttente",
      },
    ]);
    findManyAvoir.mockResolvedValue([]);

    const r = await getCumulDette("adh-A");
    expect(r.success).toBe(true);
    if (!r.success || !r.data) throw new Error("expected success");
    // 30 CM tiers + 5 obligation ; 50 auto-bénéfice exclu
    expect(r.data.totalDette).toBe(35);
    expect(r.data.detteNette).toBe(35);
    expect(r.data.cotisationsMensuelles).toHaveLength(2);
  });
});
