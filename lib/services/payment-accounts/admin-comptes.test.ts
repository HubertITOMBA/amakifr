import { beforeEach, describe, expect, it, vi } from "vitest";
import { ServiceError } from "@/lib/service-error";
import type { AuthContext } from "@/lib/auth-context";

const {
  findMany,
  findFirst,
  findUnique,
  create,
  update,
  updateMany,
  transaction,
  authorizeMock,
} = vi.hoisted(() => ({
  findMany: vi.fn(),
  findFirst: vi.fn(),
  findUnique: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  updateMany: vi.fn(),
  transaction: vi.fn(),
  authorizeMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    comptePaiementAssociation: {
      findMany,
      findFirst,
      findUnique,
      create,
      update,
      updateMany,
    },
    $transaction: transaction,
  },
}));

vi.mock("@/lib/authorize", () => ({
  authorize: authorizeMock,
}));

import {
  createComptePaiement,
  deactivateComptePaiement,
  listComptesPaiement,
  updateComptePaiement,
} from "@/lib/services/payment-accounts/admin-comptes";
import { getActiveAssociationPaymentAccount } from "@/lib/services/payment-accounts/get-active-payment-account";
import {
  CreateComptePaiementSchema,
  maskIban,
} from "@/lib/services/payment-accounts/types";

function adminActor(): AuthContext {
  return {
    userId: "admin-1",
    role: "ADMIN",
    status: "Actif",
    email: "a@a.fr",
    name: "Admin",
    sessionId: null,
    adminRoles: [],
    adherentId: null,
    channel: "web",
  };
}

function memberActor(): AuthContext {
  return { ...adminActor(), userId: "user-1", role: "MEMBRE" };
}

function compteRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "c1",
    libelle: "Principal",
    titulaire: "AMAKI",
    iban: "FR7612345678901234567890185",
    bic: "AGRIFRPP",
    codeBanque: null,
    codeGuichet: null,
    numeroCompte: null,
    cleRib: null,
    telephoneWero: null,
    weroActif: false,
    actifPourPaiement: false,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    createdBy: "admin-1",
    ...overrides,
  };
}

beforeEach(() => {
  findMany.mockReset();
  findFirst.mockReset();
  findUnique.mockReset();
  create.mockReset();
  update.mockReset();
  updateMany.mockReset();
  transaction.mockReset();
  authorizeMock.mockReset();
  authorizeMock.mockResolvedValue(undefined);
  transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
    fn({
      comptePaiementAssociation: {
        updateMany,
        create,
        update,
      },
    })
  );
});

describe("maskIban", () => {
  it("masque le milieu", () => {
    const m = maskIban("FR7612345678901234567890185");
    expect(m.startsWith("FR76")).toBe(true);
    expect(m.endsWith("185")).toBe(true);
    expect(m).toContain("•");
    expect(m).not.toContain("1234567890");
  });
});

describe("CreateComptePaiementSchema", () => {
  it("refuse Wero sans téléphone", () => {
    const r = CreateComptePaiementSchema.safeParse({
      libelle: "Principal",
      titulaire: "AMAKI",
      iban: "FR7612345678901234567890185",
      bic: "AGRIFRPP",
      weroActif: true,
      telephoneWero: null,
    });
    expect(r.success).toBe(false);
  });

  it("accepte Wero avec téléphone normalisé", () => {
    const r = CreateComptePaiementSchema.safeParse({
      libelle: "Principal",
      titulaire: "AMAKI",
      iban: "FR14 2004 1010 0505 0001 3M02 606",
      bic: "PSSTFRPPXXX",
      weroActif: true,
      telephoneWero: "0612345678",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.telephoneWero).toBe("+33612345678");
      expect(r.data.iban).toBe("FR1420041010050500013M02606");
    }
  });

  it("création compte valide sans Wero", () => {
    const r = CreateComptePaiementSchema.safeParse({
      libelle: "A",
      titulaire: "AMAKI",
      iban: "FR7612345678901234567890185",
      bic: "AGRIFRPP",
      weroActif: false,
      actifPourPaiement: true,
    });
    expect(r.success).toBe(true);
  });
});

describe("permissions admin comptes", () => {
  it("non-admin refusé à la liste", async () => {
    authorizeMock.mockRejectedValue(
      new ServiceError("FORBIDDEN", "Accès refusé")
    );
    await expect(listComptesPaiement(memberActor())).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("admin autorisé liste les comptes", async () => {
    findMany.mockResolvedValue([
      compteRow({ id: "a", actifPourPaiement: true }),
      compteRow({ id: "b", libelle: "Secondaire" }),
    ]);
    const rows = await listComptesPaiement(adminActor());
    expect(rows).toHaveLength(2);
    expect(authorizeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        permissionKey: "createPaiement",
        type: "WRITE",
      })
    );
  });
});

describe("createComptePaiement", () => {
  it("création compte valide", async () => {
    create.mockResolvedValue(
      compteRow({ id: "new", actifPourPaiement: false })
    );
    const r = await createComptePaiement(adminActor(), {
      libelle: "A",
      titulaire: "AMAKI",
      iban: "FR7612345678901234567890185",
      bic: "AGRIFRPP",
      weroActif: false,
      actifPourPaiement: false,
    });
    expect(r.id).toBe("new");
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("Wero actif sans téléphone → refus", async () => {
    await expect(
      createComptePaiement(adminActor(), {
        libelle: "A",
        titulaire: "AMAKI",
        iban: "FR7612345678901234567890185",
        bic: "AGRIFRPP",
        weroActif: true,
        telephoneWero: null,
      })
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("création compte Wero valide", async () => {
    create.mockResolvedValue(
      compteRow({
        id: "w1",
        weroActif: true,
        telephoneWero: "+33612345678",
        actifPourPaiement: true,
      })
    );
    const r = await createComptePaiement(adminActor(), {
      libelle: "Wero",
      titulaire: "AMAKI",
      iban: "FR7612345678901234567890185",
      bic: "AGRIFRPP",
      weroActif: true,
      telephoneWero: "0612345678",
      actifPourPaiement: true,
    });
    expect(r.weroActif).toBe(true);
    expect(r.telephoneWero).toBe("+33612345678");
    expect(updateMany).toHaveBeenCalledWith({
      where: { actifPourPaiement: true },
      data: { actifPourPaiement: false },
    });
  });

  it("activation compte A à la création", async () => {
    create.mockResolvedValue(compteRow({ id: "a", actifPourPaiement: true }));
    await createComptePaiement(adminActor(), {
      libelle: "A",
      titulaire: "AMAKI",
      iban: "FR7612345678901234567890185",
      bic: "AGRIFRPP",
      actifPourPaiement: true,
      weroActif: false,
    });
    expect(updateMany).toHaveBeenCalled();
  });
});

describe("updateComptePaiement", () => {
  it("activation B désactive A", async () => {
    findUnique.mockResolvedValue(compteRow({ id: "b", libelle: "B" }));
    update.mockResolvedValue(
      compteRow({ id: "b", libelle: "B", actifPourPaiement: true })
    );
    await updateComptePaiement(adminActor(), {
      id: "b",
      actifPourPaiement: true,
    });
    expect(updateMany).toHaveBeenCalledWith({
      where: { actifPourPaiement: true, NOT: { id: "b" } },
      data: { actifPourPaiement: false },
    });
  });

  it("modification IBAN/BIC", async () => {
    findUnique.mockResolvedValue(compteRow({ id: "c1" }));
    update.mockResolvedValue(
      compteRow({
        id: "c1",
        iban: "FR1420041010050500013M02606",
        bic: "PSSTFRPP",
      })
    );
    const r = await updateComptePaiement(adminActor(), {
      id: "c1",
      iban: "FR14 2004 1010 0505 0001 3M02 606",
      bic: "PSSTFRPP",
    });
    expect(r.iban).toBe("FR1420041010050500013M02606");
    expect(r.bic).toBe("PSSTFRPP");
  });

  it("désactivation Wero", async () => {
    findUnique.mockResolvedValue(
      compteRow({
        id: "c1",
        weroActif: true,
        telephoneWero: "+33612345678",
      })
    );
    update.mockResolvedValue(
      compteRow({ id: "c1", weroActif: false, telephoneWero: "+33612345678" })
    );
    const r = await updateComptePaiement(adminActor(), {
      id: "c1",
      weroActif: false,
    });
    expect(r.weroActif).toBe(false);
  });

  it("Wero actif sans téléphone en update → refus", async () => {
    findUnique.mockResolvedValue(
      compteRow({ id: "c1", telephoneWero: null, weroActif: false })
    );
    await expect(
      updateComptePaiement(adminActor(), {
        id: "c1",
        weroActif: true,
        telephoneWero: null,
      })
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });
});

describe("deactivateComptePaiement", () => {
  it("désactive compte et Wero", async () => {
    findUnique.mockResolvedValue(
      compteRow({
        id: "c1",
        actifPourPaiement: true,
        weroActif: true,
        telephoneWero: "+33612345678",
      })
    );
    update.mockResolvedValue(
      compteRow({
        id: "c1",
        actifPourPaiement: false,
        weroActif: false,
        telephoneWero: "+33612345678",
      })
    );
    const r = await deactivateComptePaiement(adminActor(), "c1");
    expect(r.actifPourPaiement).toBe(false);
    expect(r.weroActif).toBe(false);
    expect(update).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: { actifPourPaiement: false, weroActif: false },
    });
  });
});

describe("getActiveAssociationPaymentAccount (self-service)", () => {
  it("aucun compte actif → null", async () => {
    findFirst.mockResolvedValue(null);
    const r = await getActiveAssociationPaymentAccount(adminActor());
    expect(r).toBeNull();
  });

  it("plusieurs comptes stockés → un seul actif exposé", async () => {
    findFirst.mockResolvedValue(
      compteRow({
        id: "actif",
        libelle: "Actif",
        actifPourPaiement: true,
        weroActif: true,
        telephoneWero: "+33611111111",
      })
    );
    const r = await getActiveAssociationPaymentAccount(memberActor());
    expect(r?.libelle).toBe("Actif");
    expect(r).not.toHaveProperty("id");
    expect(r).not.toHaveProperty("actifPourPaiement");
    expect(findFirst).toHaveBeenCalledWith({
      where: { actifPourPaiement: true },
    });
  });

  it("masque téléphone si Wero inactif", async () => {
    findFirst.mockResolvedValue(
      compteRow({
        telephoneWero: "+33612345678",
        weroActif: false,
        actifPourPaiement: true,
      })
    );
    const r = await getActiveAssociationPaymentAccount(adminActor());
    expect(r?.weroActif).toBe(false);
    expect(r?.telephoneWero).toBeNull();
  });
});
