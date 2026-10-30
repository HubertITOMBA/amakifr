import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const {
  $transaction,
  $queryRaw,
  findUniqueAdherent,
  findFirstCm,
  findFirstDi,
  findFirstGel,
  findUniqueGel,
  createGel,
  updateGel,
  findUniqueGelRevision,
  createGelRevision,
  updateGelRevision,
  callOrder,
} = vi.hoisted(() => {
  const callOrder: string[] = [];
  return {
    callOrder,
    $transaction: vi.fn(),
    $queryRaw: vi.fn(async () => {
      callOrder.push("lock");
      return [{ id: "adh-1" }];
    }),
    findUniqueAdherent: vi.fn(async () => {
      callOrder.push("adherent.findUnique");
      return { id: "adh-1" };
    }),
    findFirstCm: vi.fn(async () => {
      callOrder.push("cm.findFirst");
      return { id: "cm-1" };
    }),
    findFirstDi: vi.fn(async () => {
      callOrder.push("di.findFirst");
      return { id: "di-1" };
    }),
    findFirstGel: vi.fn(async () => {
      callOrder.push("gel.findFirst");
      return null;
    }),
    findUniqueGel: vi.fn(async () => {
      callOrder.push("gel.findUnique");
      return null;
    }),
    createGel: vi.fn(async (args: { data: Record<string, unknown> }) => {
      callOrder.push("gel.create");
      return {
        id: "gel-1",
        scope: args.data.scope,
        statut: "ACTIF",
        adherentId: args.data.adherentId,
      };
    }),
    updateGel: vi.fn(async () => {
      callOrder.push("gel.update");
      return {
        id: "gel-1",
        scope: "ADHERENT",
        statut: "LEVE",
        adherentId: "adh-1",
      };
    }),
    findUniqueGelRevision: vi.fn(async () => {
      callOrder.push("gelRevision.findUnique");
      return { revision: BigInt(2) };
    }),
    createGelRevision: vi.fn(async () => {
      callOrder.push("gelRevision.create");
      return {};
    }),
    updateGelRevision: vi.fn(async () => {
      callOrder.push("gelRevision.update");
      return {};
    }),
  };
});

vi.mock("@/lib/db", () => ({
  db: {
    $transaction: (...a: unknown[]) => $transaction(...a),
  },
}));

import {
  isActiveGelUniqueViolation,
  leveRappelDetteGel,
  poseRappelDetteGel,
} from "@/lib/services/cotisations/rappel-dette/rappel-dette-gel-mutate";
import { RAPPEL_DETTE_GEL_MUTATION_DISABLED_MESSAGE } from "@/lib/services/cotisations/rappel-dette/rappel-dette-gel-mutation-activation";

const ACTOR_ADMIN = { userId: "admin-1", role: "ADMIN" };
const ACTOR_PRESID = { userId: "pres-1", role: "PRESID" };
const ACTOR_TRESOR = { userId: "tre-1", role: "TRESOR" };
const DEPS_ON = { isMutationEnabled: true as const };

function mockTx() {
  $transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
    const tx = {
      $queryRaw,
      adherent: { findUnique: findUniqueAdherent },
      cotisationMensuelle: { findFirst: findFirstCm },
      detteInitiale: { findFirst: findFirstDi },
      rappelDetteGel: {
        findFirst: findFirstGel,
        findUnique: findUniqueGel,
        create: createGel,
        update: updateGel,
      },
      rappelDetteGelRevision: {
        findUnique: findUniqueGelRevision,
        create: createGelRevision,
        update: updateGelRevision,
      },
    };
    return fn(tx);
  });
}

describe("rappel-dette-gel-mutate", () => {
  beforeEach(() => {
    callOrder.length = 0;
    $transaction.mockReset();
    $queryRaw.mockReset();
    $queryRaw.mockImplementation(async () => {
      callOrder.push("lock");
      return [{ id: "adh-1" }];
    });
    findUniqueAdherent.mockReset();
    findUniqueAdherent.mockImplementation(async () => {
      callOrder.push("adherent.findUnique");
      return { id: "adh-1" };
    });
    findFirstCm.mockReset();
    findFirstCm.mockImplementation(async () => {
      callOrder.push("cm.findFirst");
      return { id: "cm-1" };
    });
    findFirstDi.mockReset();
    findFirstDi.mockImplementation(async () => {
      callOrder.push("di.findFirst");
      return { id: "di-1" };
    });
    findFirstGel.mockReset();
    findFirstGel.mockImplementation(async () => {
      callOrder.push("gel.findFirst");
      return null;
    });
    findUniqueGel.mockReset();
    createGel.mockReset();
    createGel.mockImplementation(
      async (args: { data: Record<string, unknown> }) => {
        callOrder.push("gel.create");
        return {
          id: "gel-1",
          scope: args.data.scope,
          statut: "ACTIF",
          adherentId: args.data.adherentId,
        };
      }
    );
    updateGel.mockReset();
    updateGel.mockImplementation(async () => {
      callOrder.push("gel.update");
      return {
        id: "gel-1",
        scope: "ADHERENT",
        statut: "LEVE",
        adherentId: "adh-1",
      };
    });
    findUniqueGelRevision.mockReset();
    findUniqueGelRevision.mockImplementation(async () => {
      callOrder.push("gelRevision.findUnique");
      return { revision: BigInt(2) };
    });
    createGelRevision.mockReset();
    createGelRevision.mockImplementation(async () => {
      callOrder.push("gelRevision.create");
      return {};
    });
    updateGelRevision.mockReset();
    updateGelRevision.mockImplementation(async () => {
      callOrder.push("gelRevision.update");
      return {};
    });
    mockTx();
  });

  it("flag mutation off → GEL_MUTATION_DISABLED avant métier", async () => {
    const r = await poseRappelDetteGel({
      actor: ACTOR_ADMIN,
      target: { scope: "ADHERENT", adherentId: "adh-1" },
      motifCode: "CONTESTATION",
      motifTexte: "dossier en cours",
    });
    expect(r).toMatchObject({
      ok: false,
      code: "GEL_MUTATION_DISABLED",
      message: RAPPEL_DETTE_GEL_MUTATION_DISABLED_MESSAGE,
    });
    expect($transaction).not.toHaveBeenCalled();
  });

  it("rôle refusé → FORBIDDEN avant métier", async () => {
    const r = await poseRappelDetteGel(
      {
        actor: ACTOR_TRESOR,
        target: { scope: "ADHERENT", adherentId: "adh-1" },
        motifCode: "AUTRE",
        motifTexte: "x",
      },
      DEPS_ON
    );
    expect(r).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect($transaction).not.toHaveBeenCalled();
  });

  it("acteur absent → UNAUTHENTICATED", async () => {
    const r = await poseRappelDetteGel(
      {
        actor: null,
        target: { scope: "ADHERENT", adherentId: "adh-1" },
        motifCode: "AUTRE",
        motifTexte: "x",
      },
      DEPS_ON
    );
    expect(r).toMatchObject({ ok: false, code: "UNAUTHENTICATED" });
  });

  it("pose ADHERENT (y compris inactif existant) → posed ; lock avant métier", async () => {
    const r = await poseRappelDetteGel(
      {
        actor: ACTOR_ADMIN,
        target: { scope: "ADHERENT", adherentId: "adh-1" },
        motifCode: "VERIFICATION_ADMINISTRATIVE",
        motifTexte: "contrôle interne",
        referenceDossier: " DOS-1 ",
      },
      DEPS_ON
    );
    expect(r).toMatchObject({
      ok: true,
      outcome: "posed",
      gelId: "gel-1",
      adherentId: "adh-1",
      scope: "ADHERENT",
      statut: "ACTIF",
      gelsRevision: "2",
    });
    expect(callOrder[0]).toBe("lock");
    expect(callOrder.indexOf("lock")).toBeLessThan(
      callOrder.indexOf("adherent.findUnique")
    );
    expect(createGel).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          motifTexte: "contrôle interne",
          referenceDossier: "DOS-1",
          poseParUserId: "admin-1",
          statut: "ACTIF",
        }),
      })
    );
    expect(createGelRevision).not.toHaveBeenCalled();
    expect(updateGelRevision).not.toHaveBeenCalled();
  });

  it("pose LIGNE CM + appartenance OK", async () => {
    const r = await poseRappelDetteGel(
      {
        actor: ACTOR_PRESID,
        target: {
          scope: "LIGNE",
          adherentId: "adh-1",
          lineSource: "cotisation_mensuelle",
          cotisationMensuelleId: "cm-1",
        },
        motifCode: "CONTESTATION",
        motifTexte: "litige période",
      },
      DEPS_ON
    );
    expect(r).toMatchObject({ ok: true, outcome: "posed", scope: "LIGNE" });
    expect(findFirstCm).toHaveBeenCalled();
  });

  it("ligne d’un autre adhérent → TARGET_MISMATCH", async () => {
    findFirstCm.mockResolvedValue(null);
    const r = await poseRappelDetteGel(
      {
        actor: ACTOR_ADMIN,
        target: {
          scope: "LIGNE",
          adherentId: "adh-1",
          lineSource: "cotisation_mensuelle",
          cotisationMensuelleId: "cm-x",
        },
        motifCode: "AUTRE",
        motifTexte: "x",
      },
      DEPS_ON
    );
    expect(r).toMatchObject({ ok: false, code: "TARGET_MISMATCH" });
    expect(createGel).not.toHaveBeenCalled();
  });

  it("cibles exclusives invalides → VALIDATION_ERROR", async () => {
    const r = await poseRappelDetteGel(
      {
        actor: ACTOR_ADMIN,
        target: {
          scope: "LIGNE",
          adherentId: "adh-1",
          lineSource: "cotisation_mensuelle",
          cotisationMensuelleId: "cm-1",
          detteInitialeId: "di-1",
        },
        motifCode: "AUTRE",
        motifTexte: "x",
      },
      DEPS_ON
    );
    expect(r).toMatchObject({ ok: false, code: "VALIDATION_ERROR" });
    expect($transaction).not.toHaveBeenCalled();
  });

  it("motif vide → VALIDATION_ERROR", async () => {
    const r = await poseRappelDetteGel(
      {
        actor: ACTOR_ADMIN,
        target: { scope: "ADHERENT", adherentId: "adh-1" },
        motifCode: "AUTRE",
        motifTexte: "   ",
      },
      DEPS_ON
    );
    expect(r).toMatchObject({ ok: false, code: "VALIDATION_ERROR" });
  });

  it("pose répétée ACTIF → already_active sans UPDATE motif", async () => {
    findFirstGel.mockResolvedValue({
      id: "gel-existing",
      scope: "ADHERENT",
      statut: "ACTIF",
      adherentId: "adh-1",
    });
    const r = await poseRappelDetteGel(
      {
        actor: ACTOR_ADMIN,
        target: { scope: "ADHERENT", adherentId: "adh-1" },
        motifCode: "AUTRE",
        motifTexte: "nouveau motif différent",
      },
      DEPS_ON
    );
    expect(r).toMatchObject({
      ok: true,
      outcome: "already_active",
      gelId: "gel-existing",
      gelsRevision: "2",
    });
    expect(createGel).not.toHaveBeenCalled();
    expect(updateGel).not.toHaveBeenCalled();
    expect(createGelRevision).not.toHaveBeenCalled();
    expect(updateGelRevision).not.toHaveBeenCalled();
  });

  it("P2002 unique → nouvelle TX + already_active (pas relecture TX morte)", async () => {
    const p2002 = new Prisma.PrismaClientKnownRequestError("unique", {
      code: "P2002",
      clientVersion: "test",
      meta: { target: ["rappel_dette_gels_one_active_adherent"] },
    });
    let txCalls = 0;
    $transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
      txCalls += 1;
      const tx = {
        $queryRaw,
        adherent: { findUnique: findUniqueAdherent },
        cotisationMensuelle: { findFirst: findFirstCm },
        detteInitiale: { findFirst: findFirstDi },
        rappelDetteGel: {
          findFirst: findFirstGel,
          findUnique: findUniqueGel,
          create: createGel,
          update: updateGel,
        },
        rappelDetteGelRevision: {
          findUnique: findUniqueGelRevision,
          create: createGelRevision,
          update: updateGelRevision,
        },
      };
      if (txCalls === 1) {
        findFirstGel.mockResolvedValueOnce(null);
        createGel.mockRejectedValueOnce(p2002);
        return fn(tx);
      }
      // Recovery TX
      findFirstGel.mockResolvedValueOnce({
        id: "gel-race",
        scope: "ADHERENT",
        statut: "ACTIF",
        adherentId: "adh-1",
      });
      return fn(tx);
    });

    const r = await poseRappelDetteGel(
      {
        actor: ACTOR_ADMIN,
        target: { scope: "ADHERENT", adherentId: "adh-1" },
        motifCode: "CONTESTATION",
        motifTexte: "race",
      },
      { ...DEPS_ON, maxUniqueAttempts: 3 }
    );
    expect(r).toMatchObject({
      ok: true,
      outcome: "already_active",
      gelId: "gel-race",
    });
    expect(txCalls).toBe(2);
  });

  it("P2002 autre contrainte → INTERNAL_ERROR (non masquée)", async () => {
    const p2002 = new Prisma.PrismaClientKnownRequestError("unique", {
      code: "P2002",
      clientVersion: "test",
      meta: { target: ["some_other_unique"] },
    });
    createGel.mockRejectedValue(p2002);
    const r = await poseRappelDetteGel(
      {
        actor: ACTOR_ADMIN,
        target: { scope: "ADHERENT", adherentId: "adh-1" },
        motifCode: "AUTRE",
        motifTexte: "x",
      },
      DEPS_ON
    );
    expect(r).toMatchObject({ ok: false, code: "INTERNAL_ERROR" });
  });

  it("isActiveGelUniqueViolation reconnaît les index ACTIF", () => {
    expect(
      isActiveGelUniqueViolation(
        new Prisma.PrismaClientKnownRequestError("u", {
          code: "P2002",
          clientVersion: "t",
          meta: { target: ["cotisationMensuelleId"] },
        })
      )
    ).toBe(true);
    expect(
      isActiveGelUniqueViolation(
        new Prisma.PrismaClientKnownRequestError("u", {
          code: "P2003",
          clientVersion: "t",
        })
      )
    ).toBe(false);
  });

  it("levée ACTIF → lifted ; pas d’écriture révision", async () => {
    findUniqueGel.mockResolvedValue({
      id: "gel-1",
      scope: "ADHERENT",
      statut: "ACTIF",
      adherentId: "adh-1",
    });
    const r = await leveRappelDetteGel(
      { actor: ACTOR_ADMIN, adherentId: "adh-1", gelId: "gel-1" },
      DEPS_ON
    );
    expect(r).toMatchObject({
      ok: true,
      outcome: "lifted",
      statut: "LEVE",
      gelsRevision: "2",
    });
    expect(updateGel).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          statut: "LEVE",
          leveParUserId: "admin-1",
        }),
      })
    );
    const updateData = updateGel.mock.calls[0][0].data;
    expect(updateData).not.toHaveProperty("motifCode");
    expect(updateData).not.toHaveProperty("motifTexte");
    expect(createGelRevision).not.toHaveBeenCalled();
    expect(updateGelRevision).not.toHaveBeenCalled();
  });

  it("levée répétée → already_lifted ; révision stable ; pas d’UPDATE", async () => {
    findUniqueGel.mockResolvedValue({
      id: "gel-1",
      scope: "ADHERENT",
      statut: "LEVE",
      adherentId: "adh-1",
    });
    findUniqueGelRevision.mockResolvedValue({ revision: BigInt(5) });
    const r = await leveRappelDetteGel(
      { actor: ACTOR_PRESID, adherentId: "adh-1", gelId: "gel-1" },
      DEPS_ON
    );
    expect(r).toMatchObject({
      ok: true,
      outcome: "already_lifted",
      gelsRevision: "5",
    });
    expect(updateGel).not.toHaveBeenCalled();
  });

  it("levée mauvais adherentId → NOT_FOUND", async () => {
    findUniqueGel.mockResolvedValue({
      id: "gel-1",
      scope: "ADHERENT",
      statut: "ACTIF",
      adherentId: "adh-other",
    });
    const r = await leveRappelDetteGel(
      { actor: ACTOR_ADMIN, adherentId: "adh-1", gelId: "gel-1" },
      DEPS_ON
    );
    expect(r).toMatchObject({ ok: false, code: "NOT_FOUND" });
  });

  it("logs d’erreur ne contiennent ni motif ni référence", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    createGel.mockRejectedValue(new Error("boom"));
    await poseRappelDetteGel(
      {
        actor: ACTOR_ADMIN,
        target: { scope: "ADHERENT", adherentId: "adh-1" },
        motifCode: "CONTESTATION",
        motifTexte: "SECRET_MOTIF_XYZ",
        referenceDossier: "SECRET_REF_ABC",
      },
      DEPS_ON
    );
    const dumped = JSON.stringify(spy.mock.calls);
    expect(dumped).not.toContain("SECRET_MOTIF_XYZ");
    expect(dumped).not.toContain("SECRET_REF_ABC");
    spy.mockRestore();
  });
});
