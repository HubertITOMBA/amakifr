import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const {
  findUniqueAdherent,
  findUniqueEnvoi,
  findManyEnvoi,
  findUniqueGel,
  findManyGel,
  isRappelDetteEnvoiEnabled,
  isRappelDetteGelMutationEnabled,
} = vi.hoisted(() => ({
  findUniqueAdherent: vi.fn(),
  findUniqueEnvoi: vi.fn(),
  findManyEnvoi: vi.fn(),
  findUniqueGel: vi.fn(),
  findManyGel: vi.fn(),
  isRappelDetteEnvoiEnabled: vi.fn(() => false),
  isRappelDetteGelMutationEnabled: vi.fn(() => false),
}));

vi.mock("@/lib/db", () => ({
  db: {
    adherent: { findUnique: (...a: unknown[]) => findUniqueAdherent(...a) },
    rappelDetteEnvoi: {
      findUnique: (...a: unknown[]) => findUniqueEnvoi(...a),
      findMany: (...a: unknown[]) => findManyEnvoi(...a),
    },
    rappelDetteGel: {
      findUnique: (...a: unknown[]) => findUniqueGel(...a),
      findMany: (...a: unknown[]) => findManyGel(...a),
    },
  },
}));

vi.mock(
  "@/lib/services/cotisations/rappel-dette/rappel-dette-activation",
  () => ({
    isRappelDetteEnvoiEnabled,
    RAPPEL_DETTE_ENVOI_ENABLED: false,
    RAPPEL_DETTE_ENVOI_DISABLED_MESSAGE: "envoi off",
  })
);

vi.mock(
  "@/lib/services/cotisations/rappel-dette/rappel-dette-gel-mutation-activation",
  () => ({
    isRappelDetteGelMutationEnabled,
    RAPPEL_DETTE_GEL_MUTATION_ENABLED: false,
    RAPPEL_DETTE_GEL_MUTATION_DISABLED_MESSAGE: "gel mutation off",
  })
);

import {
  assertAdminReadActor,
  canResumeNotif,
  decodeAndValidateEnvoiCursor,
  decodeAndValidateGelCursor,
  getRappelDetteAdminCapabilities,
  listRappelDetteEnvoisByAdherent,
  listRappelDetteGelsByAdherent,
  notifResumeEligible,
  RAPPEL_DETTE_ADMIN_READ_ACCESS_DENIED_MESSAGE,
  RAPPEL_DETTE_ADMIN_READ_KIND_ENVOIS,
  RAPPEL_DETTE_ADMIN_READ_KIND_GELS,
  RAPPEL_DETTE_ADMIN_READ_MAX_PAGE_SIZE,
  RAPPEL_DETTE_ADMIN_READ_SOURCE_UNAVAILABLE,
  RAPPEL_DETTE_EMAIL_ACCEPTED_MEANING,
} from "@/lib/services/cotisations/rappel-dette/rappel-dette-admin-reads";

const ACTOR_ADMIN = { userId: "admin-1", role: "ADMIN" };
const ACTOR_PRESID = { userId: "pres-1", role: "PRESID" };
const ACTOR_TRESOR = { userId: "tre-1", role: "TRESOR" };

function encodeCursor(payload: object): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function envoiCursor(partial: {
  adherentId?: string;
  reservedAt: string;
  id: string;
  kind?: string;
  v?: number;
  filters?: object;
}): string {
  return encodeCursor({
    v: partial.v ?? 1,
    kind: partial.kind ?? RAPPEL_DETTE_ADMIN_READ_KIND_ENVOIS,
    adherentId: partial.adherentId ?? "adh-1",
    filters: partial.filters ?? {},
    reservedAt: partial.reservedAt,
    id: partial.id,
  });
}

function gelCursor(partial: {
  adherentId?: string;
  posedAt: string;
  id: string;
  kind?: string;
  v?: number;
  filters?: object;
}): string {
  return encodeCursor({
    v: partial.v ?? 1,
    kind: partial.kind ?? RAPPEL_DETTE_ADMIN_READ_KIND_GELS,
    adherentId: partial.adherentId ?? "adh-1",
    filters: partial.filters ?? {},
    posedAt: partial.posedAt,
    id: partial.id,
  });
}

function makeEnvoiRow(
  overrides: Partial<{
    id: string;
    adherentId: string;
    reservationStatus: string;
    emailStatus: string;
    notifStatus: string;
    detteNette: Prisma.Decimal;
    gelsRevision: bigint | null;
    recipientEmail: string;
    reservedAt: Date;
    callingAt: Date | null;
    emailAcceptedAt: Date | null;
    closedAt: Date | null;
    unknownAt: Date | null;
  }> = {}
) {
  return {
    id: overrides.id ?? "envoi-1",
    adherentId: overrides.adherentId ?? "adh-1",
    reservationStatus: overrides.reservationStatus ?? "Completed",
    emailStatus: overrides.emailStatus ?? "Accepted",
    notifStatus: overrides.notifStatus ?? "NotStarted",
    detteNette: overrides.detteNette ?? new Prisma.Decimal("42.50"),
    gelsRevision:
      overrides.gelsRevision === undefined
        ? BigInt(3)
        : overrides.gelsRevision,
    recipientEmail: overrides.recipientEmail ?? "hubert@example.com",
    reservedAt: overrides.reservedAt ?? new Date("2026-10-01T10:00:00.000Z"),
    callingAt: overrides.callingAt ?? null,
    emailAcceptedAt:
      overrides.emailAcceptedAt === undefined
        ? new Date("2026-10-01T10:01:00.000Z")
        : overrides.emailAcceptedAt,
    closedAt: overrides.closedAt ?? null,
    unknownAt: overrides.unknownAt ?? null,
  };
}

function makeGelRow(
  overrides: Partial<{
    id: string;
    adherentId: string;
    scope: "ADHERENT" | "LIGNE";
    statut: "ACTIF" | "LEVE";
    lineSource: "cotisation_mensuelle" | "dette_initiale" | null;
    cotisationMensuelleId: string | null;
    detteInitialeId: string | null;
    motifCode: string;
    motifTexte: string;
    referenceDossier: string | null;
    posedAt: Date;
    poseParUserId: string;
    leveAt: Date | null;
    leveParUserId: string | null;
  }> = {}
) {
  return {
    id: overrides.id ?? "gel-1",
    adherentId: overrides.adherentId ?? "adh-1",
    scope: overrides.scope ?? "ADHERENT",
    statut: overrides.statut ?? "ACTIF",
    lineSource: overrides.lineSource ?? null,
    cotisationMensuelleId: overrides.cotisationMensuelleId ?? null,
    detteInitialeId: overrides.detteInitialeId ?? null,
    motifCode: overrides.motifCode ?? "AUTRE",
    motifTexte: overrides.motifTexte ?? "Motif secret test",
    referenceDossier: overrides.referenceDossier ?? "REF-SEC-99",
    posedAt: overrides.posedAt ?? new Date("2026-09-15T08:00:00.000Z"),
    poseParUserId: overrides.poseParUserId ?? "admin-1",
    leveAt: overrides.leveAt ?? null,
    leveParUserId: overrides.leveParUserId ?? null,
    PosePar: { name: "Admin Test", email: "admin@example.com" },
    LevePar: null,
    CotisationMensuelle: null,
    DetteInitiale: null,
  };
}

describe("assertAdminReadActor / capabilities", () => {
  beforeEach(() => {
    findUniqueAdherent.mockReset();
    findUniqueEnvoi.mockReset();
    findManyEnvoi.mockReset();
    findUniqueGel.mockReset();
    findManyGel.mockReset();
    isRappelDetteEnvoiEnabled.mockReset();
    isRappelDetteGelMutationEnabled.mockReset();
    isRappelDetteEnvoiEnabled.mockReturnValue(false);
    isRappelDetteGelMutationEnabled.mockReturnValue(false);
  });

  it("refuse acteur sans userId avant lecture", () => {
    expect(assertAdminReadActor(null)).toMatchObject({
      ok: false,
      code: "UNAUTHENTICATED",
    });
  });

  it("refuse rôle non ADMIN/PRESID avant lecture", () => {
    expect(assertAdminReadActor(ACTOR_TRESOR)).toMatchObject({
      ok: false,
      code: "FORBIDDEN",
      message: RAPPEL_DETTE_ADMIN_READ_ACCESS_DENIED_MESSAGE,
    });
  });

  it("capacités : flags off, canProposeResend false", () => {
    expect(getRappelDetteAdminCapabilities(ACTOR_ADMIN)).toEqual({
      ok: true,
      data: {
        canAccess: true,
        envoiEnabled: false,
        gelMutationEnabled: false,
        canProposeResend: false,
      },
    });
  });

  it("capacités : flags on n’ouvrent pas le renvoi", () => {
    isRappelDetteEnvoiEnabled.mockReturnValue(true);
    isRappelDetteGelMutationEnabled.mockReturnValue(true);
    expect(getRappelDetteAdminCapabilities(ACTOR_PRESID)).toMatchObject({
      ok: true,
      data: {
        envoiEnabled: true,
        gelMutationEnabled: true,
        canProposeResend: false,
      },
    });
  });

  it("capacités : trésorier refusé sans lecture métier", () => {
    expect(getRappelDetteAdminCapabilities(ACTOR_TRESOR)).toMatchObject({
      ok: false,
      code: "FORBIDDEN",
    });
  });
});

describe("notifResumeEligible / canResumeNotif", () => {
  const base = {
    reservationStatus: "Completed",
    emailStatus: "Accepted",
    notifStatus: "NotStarted",
    emailAcceptedAt: new Date("2026-10-01T10:01:00.000Z"),
  };

  it("éligible uniquement Completed + Accepted + emailAcceptedAt + NotStarted|Failed", () => {
    expect(notifResumeEligible(base)).toBe(true);
    expect(
      notifResumeEligible({ ...base, notifStatus: "Failed" })
    ).toBe(true);
    expect(
      notifResumeEligible({ ...base, notifStatus: "Created" })
    ).toBe(false);
    expect(
      notifResumeEligible({ ...base, emailAcceptedAt: null })
    ).toBe(false);
    expect(
      notifResumeEligible({
        ...base,
        reservationStatus: "Calling",
      })
    ).toBe(false);
    expect(
      notifResumeEligible({
        ...base,
        reservationStatus: "Unknown",
      })
    ).toBe(false);
  });

  it("Created non éligible même sans notificationId (non consulté)", () => {
    expect(
      notifResumeEligible({
        ...base,
        notifStatus: "Created",
      })
    ).toBe(false);
  });

  it("canResumeNotif = éligible ET flag envoi", () => {
    expect(canResumeNotif(base, false)).toBe(false);
    expect(canResumeNotif(base, true)).toBe(true);
    expect(
      canResumeNotif({ ...base, notifStatus: "Created" }, true)
    ).toBe(false);
  });
});

describe("decode curseurs", () => {
  it("refuse mauvais kind / autre adhérent / structure", () => {
    expect(
      decodeAndValidateEnvoiCursor(
        gelCursor({
          posedAt: "2026-10-01T00:00:00.000Z",
          id: "g1",
        }),
        "adh-1",
        {}
      )
    ).toMatchObject({ ok: false, code: "VALIDATION_ERROR" });

    expect(
      decodeAndValidateEnvoiCursor(
        envoiCursor({
          adherentId: "adh-other",
          reservedAt: "2026-10-01T00:00:00.000Z",
          id: "e1",
        }),
        "adh-1",
        {}
      )
    ).toMatchObject({
      ok: false,
      message: "Curseur incompatible avec l’adhérent demandé",
    });

    expect(
      decodeAndValidateGelCursor(
        envoiCursor({
          reservedAt: "2026-10-01T00:00:00.000Z",
          id: "e1",
        }),
        "adh-1",
        {}
      )
    ).toMatchObject({ ok: false, code: "VALIDATION_ERROR" });
  });
});

describe("listRappelDetteEnvoisByAdherent", () => {
  beforeEach(() => {
    findUniqueAdherent.mockReset();
    findUniqueEnvoi.mockReset();
    findManyEnvoi.mockReset();
    findUniqueGel.mockReset();
    findManyGel.mockReset();
    isRappelDetteEnvoiEnabled.mockReset();
    isRappelDetteEnvoiEnabled.mockReturnValue(false);
    findUniqueAdherent.mockResolvedValue({ id: "adh-1" });
  });

  it("accès refusé avant toute lecture DB", async () => {
    const r = await listRappelDetteEnvoisByAdherent({
      actor: ACTOR_TRESOR,
      adherentId: "adh-1",
    });
    expect(r).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(findUniqueAdherent).not.toHaveBeenCalled();
  });

  it("DTO : masque, dualité notif, Accepted meaning, pas de renvoi", async () => {
    findManyEnvoi.mockResolvedValue([makeEnvoiRow()]);
    const r = await listRappelDetteEnvoisByAdherent({
      actor: ACTOR_ADMIN,
      adherentId: "adh-1",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const item = r.data.items[0];
    expect(item.recipientMasked).toBe("h***@example.com");
    expect(JSON.stringify(item)).not.toContain("hubert@example.com");
    expect(item.emailAcceptedMeaning).toBe(RAPPEL_DETTE_EMAIL_ACCEPTED_MEANING);
    expect(item.notifResumeEligible).toBe(true);
    expect(item.canResumeNotif).toBe(false); // flag off
    expect(item.canProposeResend).toBe(false);
  });

  it("canResumeNotif true seulement si flag on + éligible", async () => {
    isRappelDetteEnvoiEnabled.mockReturnValue(true);
    findManyEnvoi.mockResolvedValue([makeEnvoiRow()]);
    const r = await listRappelDetteEnvoisByAdherent({
      actor: ACTOR_ADMIN,
      adherentId: "adh-1",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.items[0].notifResumeEligible).toBe(true);
    expect(r.data.items[0].canResumeNotif).toBe(true);
  });

  it("Accepted sans emailAcceptedAt : non éligible", async () => {
    findManyEnvoi.mockResolvedValue([
      makeEnvoiRow({ emailAcceptedAt: null }),
    ]);
    const r = await listRappelDetteEnvoisByAdherent({
      actor: ACTOR_ADMIN,
      adherentId: "adh-1",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.items[0].notifResumeEligible).toBe(false);
    expect(r.data.items[0].canResumeNotif).toBe(false);
  });

  it("Created + Accepted : non éligible même flag on", async () => {
    isRappelDetteEnvoiEnabled.mockReturnValue(true);
    findManyEnvoi.mockResolvedValue([
      makeEnvoiRow({ notifStatus: "Created" }),
    ]);
    const r = await listRappelDetteEnvoisByAdherent({
      actor: ACTOR_ADMIN,
      adherentId: "adh-1",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.items[0].notifResumeEligible).toBe(false);
    expect(r.data.items[0].canResumeNotif).toBe(false);
  });

  it("dates identiques : multi-pages sans doublon ni omission", async () => {
    const T0 = new Date("2026-10-01T12:00:00.000Z");
    // Ordre lexicographique DESC des ids à date égale : e-a4, e-a3, e-a2, e-a1
    const rows = ["e-a4", "e-a3", "e-a2", "e-a1"].map((id) =>
      makeEnvoiRow({ id, reservedAt: T0 })
    );

    findManyEnvoi.mockResolvedValueOnce([rows[0], rows[1], rows[2]]); // take 3
    const page1 = await listRappelDetteEnvoisByAdherent({
      actor: ACTOR_ADMIN,
      adherentId: "adh-1",
      pageSize: 2,
    });
    expect(page1.ok).toBe(true);
    if (!page1.ok) return;
    expect(page1.data.items.map((i) => i.id)).toEqual(["e-a4", "e-a3"]);
    expect(page1.data.hasMore).toBe(true);
    expect(page1.data.nextCursor).toBeTruthy();

    const decoded = decodeAndValidateEnvoiCursor(
      page1.data.nextCursor!,
      "adh-1",
      {}
    );
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.cursor.kind).toBe(RAPPEL_DETTE_ADMIN_READ_KIND_ENVOIS);
    expect(decoded.cursor.adherentId).toBe("adh-1");
    expect(decoded.cursor.id).toBe("e-a3");

    findUniqueEnvoi.mockResolvedValue({
      id: "e-a3",
      adherentId: "adh-1",
      reservedAt: T0,
    });
    findManyEnvoi.mockResolvedValueOnce([rows[2], rows[3]]);
    const page2 = await listRappelDetteEnvoisByAdherent({
      actor: ACTOR_ADMIN,
      adherentId: "adh-1",
      pageSize: 2,
      cursor: page1.data.nextCursor,
    });
    expect(page2.ok).toBe(true);
    if (!page2.ok) return;
    expect(page2.data.items.map((i) => i.id)).toEqual(["e-a2", "e-a1"]);
    expect(page2.data.hasMore).toBe(false);
    expect(page2.data.nextCursor).toBeNull();

    const all = [
      ...page1.data.items.map((i) => i.id),
      ...page2.data.items.map((i) => i.id),
    ];
    expect(new Set(all).size).toBe(4);
    expect(all.sort()).toEqual(["e-a1", "e-a2", "e-a3", "e-a4"].sort());
  });

  it("changement d’adhérent : curseur refusé explicitement", async () => {
    const cur = envoiCursor({
      adherentId: "adh-1",
      reservedAt: "2026-10-01T12:00:00.000Z",
      id: "e-a3",
    });
    findUniqueAdherent.mockResolvedValue({ id: "adh-2" });
    const r = await listRappelDetteEnvoisByAdherent({
      actor: ACTOR_ADMIN,
      adherentId: "adh-2",
      cursor: cur,
    });
    expect(r).toMatchObject({
      ok: false,
      code: "VALIDATION_ERROR",
      message: "Curseur incompatible avec l’adhérent demandé",
    });
    expect(findManyEnvoi).not.toHaveBeenCalled();
  });

  it("mauvais type d’historique (gels → envois) : erreur", async () => {
    const cur = gelCursor({
      posedAt: "2026-10-01T12:00:00.000Z",
      id: "g1",
    });
    const r = await listRappelDetteEnvoisByAdherent({
      actor: ACTOR_ADMIN,
      adherentId: "adh-1",
      cursor: cur,
    });
    expect(r).toMatchObject({
      ok: false,
      code: "VALIDATION_ERROR",
      message: "Curseur de pagination invalide",
    });
    expect(findUniqueAdherent).not.toHaveBeenCalled();
  });

  it("ancre absente : erreur bornée, pas de page silencieuse", async () => {
    const cur = envoiCursor({
      reservedAt: "2026-10-01T12:00:00.000Z",
      id: "e-missing",
    });
    findUniqueEnvoi.mockResolvedValue(null);
    const r = await listRappelDetteEnvoisByAdherent({
      actor: ACTOR_ADMIN,
      adherentId: "adh-1",
      cursor: cur,
    });
    expect(r).toMatchObject({
      ok: false,
      code: "VALIDATION_ERROR",
      message: "Ancre de pagination introuvable ou supprimée",
    });
    expect(findManyEnvoi).not.toHaveBeenCalled();
  });

  it("historique vide uniquement après requête OK", async () => {
    findManyEnvoi.mockResolvedValue([]);
    const r = await listRappelDetteEnvoisByAdherent({
      actor: ACTOR_ADMIN,
      adherentId: "adh-1",
    });
    expect(r).toEqual({
      ok: true,
      data: {
        items: [],
        pageSize: 20,
        hasMore: false,
        nextCursor: null,
      },
    });
    expect(findManyEnvoi).toHaveBeenCalledOnce();
  });

  it("pageSize borné ; source KO ≠ vide ; adhérent NOT_FOUND", async () => {
    findManyEnvoi.mockResolvedValue([]);
    await listRappelDetteEnvoisByAdherent({
      actor: ACTOR_ADMIN,
      adherentId: "adh-1",
      pageSize: 999,
    });
    expect(
      (findManyEnvoi.mock.calls[0][0] as { take: number }).take
    ).toBe(RAPPEL_DETTE_ADMIN_READ_MAX_PAGE_SIZE + 1);

    findUniqueAdherent.mockResolvedValue(null);
    expect(
      await listRappelDetteEnvoisByAdherent({
        actor: ACTOR_ADMIN,
        adherentId: "missing",
      })
    ).toMatchObject({ ok: false, code: "NOT_FOUND" });

    findUniqueAdherent.mockResolvedValue({ id: "adh-1" });
    findManyEnvoi.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("x", {
        code: "P2021",
        clientVersion: "test",
      })
    );
    expect(
      await listRappelDetteEnvoisByAdherent({
        actor: ACTOR_ADMIN,
        adherentId: "adh-1",
      })
    ).toMatchObject({
      ok: false,
      code: RAPPEL_DETTE_ADMIN_READ_SOURCE_UNAVAILABLE,
    });
  });
});

describe("listRappelDetteGelsByAdherent", () => {
  beforeEach(() => {
    findUniqueAdherent.mockReset();
    findUniqueEnvoi.mockReset();
    findManyEnvoi.mockReset();
    findUniqueGel.mockReset();
    findManyGel.mockReset();
    findUniqueAdherent.mockResolvedValue({ id: "adh-1" });
  });

  it("dates identiques multi-pages + mauvais kind + ancre absente", async () => {
    const T1 = new Date("2026-09-01T00:00:00.000Z");
    const rows = ["g-a2", "g-a1"].map((id) =>
      makeGelRow({ id, posedAt: T1 })
    );
    findManyGel.mockResolvedValueOnce([rows[0], rows[1]]);
    const page1 = await listRappelDetteGelsByAdherent({
      actor: ACTOR_ADMIN,
      adherentId: "adh-1",
      pageSize: 1,
    });
    expect(page1.ok).toBe(true);
    if (!page1.ok) return;
    expect(page1.data.items.map((i) => i.id)).toEqual(["g-a2"]);
    expect(page1.data.nextCursor).toBeTruthy();

    findUniqueGel.mockResolvedValue({
      id: "g-a2",
      adherentId: "adh-1",
      posedAt: T1,
    });
    findManyGel.mockResolvedValueOnce([rows[1]]);
    const page2 = await listRappelDetteGelsByAdherent({
      actor: ACTOR_ADMIN,
      adherentId: "adh-1",
      pageSize: 1,
      cursor: page1.data.nextCursor,
    });
    expect(page2.ok).toBe(true);
    if (!page2.ok) return;
    expect(page2.data.items.map((i) => i.id)).toEqual(["g-a1"]);
    expect(page2.data.hasMore).toBe(false);

    expect(
      await listRappelDetteGelsByAdherent({
        actor: ACTOR_ADMIN,
        adherentId: "adh-1",
        cursor: envoiCursor({
          reservedAt: T1.toISOString(),
          id: "e1",
        }),
      })
    ).toMatchObject({ ok: false, code: "VALIDATION_ERROR" });

    const cur = gelCursor({
      posedAt: T1.toISOString(),
      id: "g-gone",
    });
    findUniqueGel.mockResolvedValue(null);
    expect(
      await listRappelDetteGelsByAdherent({
        actor: ACTOR_PRESID,
        adherentId: "adh-1",
        cursor: cur,
      })
    ).toMatchObject({
      ok: false,
      message: "Ancre de pagination introuvable ou supprimée",
    });
  });

  it("motifs ADMIN ; logs sans motif ; source KO", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    findManyGel.mockResolvedValue([makeGelRow()]);
    const r = await listRappelDetteGelsByAdherent({
      actor: ACTOR_ADMIN,
      adherentId: "adh-1",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.items[0].motifTexte).toBe("Motif secret test");
    for (const call of consoleSpy.mock.calls) {
      expect(JSON.stringify(call)).not.toContain("Motif secret test");
    }
    consoleSpy.mockRestore();

    findManyGel.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("x", {
        code: "P2022",
        clientVersion: "test",
      })
    );
    expect(
      await listRappelDetteGelsByAdherent({
        actor: ACTOR_ADMIN,
        adherentId: "adh-1",
      })
    ).toMatchObject({
      ok: false,
      code: RAPPEL_DETTE_ADMIN_READ_SOURCE_UNAVAILABLE,
    });
  });

  it("PRESID voit motifs ; labels sans email clair", async () => {
    findManyGel.mockResolvedValue([
      {
        ...makeGelRow(),
        PosePar: { name: null, email: "poseur@example.com" },
      },
    ]);
    const r = await listRappelDetteGelsByAdherent({
      actor: ACTOR_PRESID,
      adherentId: "adh-1",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.items[0].motifCode).toBe("AUTRE");
    expect(r.data.items[0].poseParLabel).toBe("p***@example.com");
    expect(JSON.stringify(r.data.items[0])).not.toContain(
      "poseur@example.com"
    );
  });

  it("ligne CM label ; flags off OK", async () => {
    findManyGel.mockResolvedValue([
      {
        ...makeGelRow({
          scope: "LIGNE",
          lineSource: "cotisation_mensuelle",
          cotisationMensuelleId: "cm-abcdef12",
        }),
        CotisationMensuelle: {
          periode: "2026-03",
          annee: 2026,
          mois: 3,
        },
      },
    ]);
    const r = await listRappelDetteGelsByAdherent({
      actor: ACTOR_ADMIN,
      adherentId: "adh-1",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.items[0].lineLabel).toBe("CM 2026-03");
  });
});
