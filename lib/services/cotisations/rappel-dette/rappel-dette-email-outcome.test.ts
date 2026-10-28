import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  $transaction,
  $queryRaw,
  findUniqueEnvoi,
  updateManyEnvoi,
  notificationCreate,
  notificationUpdate,
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
    findUniqueEnvoi: vi.fn(async () => {
      callOrder.push("envoi.findUnique");
      return null;
    }),
    updateManyEnvoi: vi.fn(async () => {
      callOrder.push("envoi.updateMany");
      return { count: 1 };
    }),
    notificationCreate: vi.fn(async () => {
      callOrder.push("notification.create");
      return {};
    }),
    notificationUpdate: vi.fn(async () => {
      callOrder.push("notification.update");
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
  RAPPEL_DETTE_EMAIL_ACCEPTED_AT_SEMANTICS,
  persistRappelDetteEmailOutcome,
  type PersistRappelDetteEmailOutcomeCaller,
  type RappelDetteEmailOutcome,
} from "@/lib/services/cotisations/rappel-dette/rappel-dette-email-outcome";

const ADH = "adh-1";
const ENVOI = "envoi-1";
const FIXED_NOW = new Date("2024-07-01T12:00:00.000Z");
const ACCEPTED_AT = new Date("2024-06-30T10:00:00.000Z");
const CLOSED_AT = new Date("2024-06-29T09:00:00.000Z");
const UNKNOWN_AT = new Date("2024-06-28T08:00:00.000Z");

const SERVER_CALLER: PersistRappelDetteEmailOutcomeCaller = {
  kind: "server_adapter",
  correlationId: "corr-1",
};

function callingRow(overrides: Record<string, unknown> = {}) {
  return {
    id: ENVOI,
    adherentId: ADH,
    reservationStatus: "Calling",
    emailStatus: "Calling",
    notifStatus: "NotStarted",
    callingAt: new Date("2024-06-30T09:00:00.000Z"),
    emailAcceptedAt: null,
    closedAt: null,
    unknownAt: null,
    reconciledAt: null,
    reconciledByUserId: null,
    reconciliationDecisionCode: null,
    technicalResultCode: null,
    notificationId: null,
    notificationCreatedAt: null,
    ...overrides,
  };
}

function mockTx() {
  $transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
    const tx = {
      $queryRaw: async (...args: unknown[]) => {
        callOrder.push("lock");
        return $queryRaw(...args);
      },
      rappelDetteEnvoi: {
        findUnique: async (...args: unknown[]) => {
          callOrder.push("envoi.findUnique");
          return findUniqueEnvoi(...args);
        },
        updateMany: async (...args: unknown[]) => {
          callOrder.push("envoi.updateMany");
          return updateManyEnvoi(...args);
        },
      },
      notification: {
        create: (...a: unknown[]) => notificationCreate(...a),
        update: (...a: unknown[]) => notificationUpdate(...a),
      },
    };
    return fn(tx);
  });

  $queryRaw.mockImplementation(async () => [{ id: ADH }]);
  findUniqueEnvoi.mockImplementation(async () => callingRow());
  updateManyEnvoi.mockImplementation(async () => ({ count: 1 }));
}

async function persist(
  outcome: RappelDetteEmailOutcome,
  overrides: Partial<Parameters<typeof persistRappelDetteEmailOutcome>[0]> = {}
) {
  return persistRappelDetteEmailOutcome({
    caller: SERVER_CALLER,
    envoiId: ENVOI,
    adherentId: ADH,
    outcome,
    getNow: () => {
      callOrder.push("getNow");
      return FIXED_NOW;
    },
    ...overrides,
  });
}

describe("persistRappelDetteEmailOutcome", () => {
  beforeEach(() => {
    callOrder.length = 0;
    $transaction.mockReset();
    $queryRaw.mockReset();
    findUniqueEnvoi.mockReset();
    updateManyEnvoi.mockReset();
    notificationCreate.mockReset();
    notificationUpdate.mockReset();
    mockTx();
  });

  it("documente la sémantique emailAcceptedAt (acceptation fournisseur observée)", () => {
    expect(RAPPEL_DETTE_EMAIL_ACCEPTED_AT_SEMANTICS).toBe(
      "provider_acceptance_observed"
    );
  });

  it("refuse avant toute lecture métier si caller ≠ server_adapter", async () => {
    const r1 = await persistRappelDetteEmailOutcome({
      caller: null,
      envoiId: ENVOI,
      adherentId: ADH,
      outcome: { kind: "Accepted" },
    });
    const r2 = await persistRappelDetteEmailOutcome({
      caller: { kind: "http_client" } as unknown as PersistRappelDetteEmailOutcomeCaller,
      envoiId: ENVOI,
      adherentId: ADH,
      outcome: { kind: "Accepted" },
    });
    expect(r1).toEqual({
      ok: false,
      code: "FORBIDDEN",
      message: "Persistance réservée à l’adaptateur serveur",
    });
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.code).toBe("FORBIDDEN");
    expect($transaction).not.toHaveBeenCalled();
    expect(findUniqueEnvoi).not.toHaveBeenCalled();
  });

  it("verrouille avant lecture, horloge après verrou, lectures/écritures via tx uniquement", async () => {
    findUniqueEnvoi.mockResolvedValueOnce(callingRow());
    const r = await persist({ kind: "Accepted" });
    expect(r.ok).toBe(true);
    expect(callOrder.indexOf("lock")).toBeLessThan(callOrder.indexOf("getNow"));
    expect(callOrder.indexOf("getNow")).toBeLessThan(
      callOrder.indexOf("envoi.findUnique")
    );
    expect(callOrder.indexOf("envoi.findUnique")).toBeLessThan(
      callOrder.indexOf("envoi.updateMany")
    );
    // Un seul $transaction ; pas d’accès db hors tx (mock n’expose que $transaction).
    expect($transaction).toHaveBeenCalledTimes(1);
  });

  it("Calling → Accepted : Completed/Accepted + emailAcceptedAt ; notif NotStarted ; closedAt null", async () => {
    const r = await persist({ kind: "Accepted" });
    expect(r).toMatchObject({
      ok: true,
      outcome: "persisted",
      reservationStatus: "Completed",
      emailStatus: "Accepted",
      emailAcceptedAt: FIXED_NOW,
      closedAt: null,
      unknownAt: null,
      notifStatus: "NotStarted",
    });
    expect(updateManyEnvoi).toHaveBeenCalledWith({
      where: {
        id: ENVOI,
        adherentId: ADH,
        reservationStatus: "Calling",
      },
      data: expect.objectContaining({
        reservationStatus: "Completed",
        emailStatus: "Accepted",
        emailAcceptedAt: FIXED_NOW,
        notifStatus: "NotStarted",
        closedAt: null,
      }),
    });
    expect(notificationCreate).not.toHaveBeenCalled();
    expect(notificationUpdate).not.toHaveBeenCalled();
  });

  it("Calling → DefinitelyNotAccepted : Failed + closedAt ; pas de preuve cooldown ni notif", async () => {
    const r = await persist({
      kind: "DefinitelyNotAccepted",
      technicalCode: "PROVIDER_REJECTED",
    });
    expect(r).toMatchObject({
      ok: true,
      outcome: "persisted",
      reservationStatus: "Failed",
      emailStatus: "DefinitelyNotAccepted",
      emailAcceptedAt: null,
      closedAt: FIXED_NOW,
      notifStatus: "NotStarted",
    });
    expect(updateManyEnvoi).toHaveBeenCalledWith({
      where: expect.objectContaining({ reservationStatus: "Calling" }),
      data: expect.objectContaining({
        reservationStatus: "Failed",
        emailStatus: "DefinitelyNotAccepted",
        closedAt: FIXED_NOW,
        emailAcceptedAt: null,
        technicalResultCode: "PROVIDER_REJECTED",
        notifStatus: "NotStarted",
      }),
    });
    expect(notificationCreate).not.toHaveBeenCalled();
  });

  it("Calling → Unknown : Unknown + unknownAt ; closedAt et réconciliation restent null", async () => {
    const r = await persist({
      kind: "Unknown",
      technicalCode: "TIMEOUT_AMBIGUOUS",
    });
    expect(r).toMatchObject({
      ok: true,
      outcome: "persisted",
      reservationStatus: "Unknown",
      emailStatus: "Unknown",
      emailAcceptedAt: null,
      closedAt: null,
      unknownAt: FIXED_NOW,
      notifStatus: "NotStarted",
    });
    expect(updateManyEnvoi).toHaveBeenCalledWith({
      where: expect.objectContaining({ reservationStatus: "Calling" }),
      data: expect.objectContaining({
        reservationStatus: "Unknown",
        emailStatus: "Unknown",
        unknownAt: FIXED_NOW,
        closedAt: null,
        reconciledAt: null,
        reconciledByUserId: null,
        reconciliationDecisionCode: null,
        technicalResultCode: "TIMEOUT_AMBIGUOUS",
      }),
    });
  });

  it("rejeu Accepted conserve exactement emailAcceptedAt (no-op)", async () => {
    findUniqueEnvoi.mockResolvedValueOnce(
      callingRow({
        reservationStatus: "Completed",
        emailStatus: "Accepted",
        emailAcceptedAt: ACCEPTED_AT,
        closedAt: null,
      })
    );
    const r = await persist({ kind: "Accepted" });
    expect(r).toMatchObject({
      ok: true,
      outcome: "idempotent",
      emailAcceptedAt: ACCEPTED_AT,
      reservationStatus: "Completed",
      emailStatus: "Accepted",
      notifStatus: "NotStarted",
    });
    if (r.ok) {
      expect(r.emailAcceptedAt).toBe(ACCEPTED_AT);
    }
    expect(updateManyEnvoi).not.toHaveBeenCalled();
  });

  it("Accepted rejoué après notification Created : notifStatus réel, dates conservées, zéro écriture", async () => {
    const notifCreatedAt = new Date("2024-06-30T11:00:00.000Z");
    const closedAtAfterNotif = new Date("2024-06-30T11:00:00.000Z");
    findUniqueEnvoi.mockResolvedValueOnce(
      callingRow({
        reservationStatus: "Completed",
        emailStatus: "Accepted",
        emailAcceptedAt: ACCEPTED_AT,
        notifStatus: "Created",
        notificationCreatedAt: notifCreatedAt,
        closedAt: closedAtAfterNotif,
      })
    );
    const r = await persist({ kind: "Accepted" });
    expect(r).toEqual({
      ok: true,
      outcome: "idempotent",
      envoiId: ENVOI,
      adherentId: ADH,
      reservationStatus: "Completed",
      emailStatus: "Accepted",
      emailAcceptedAt: ACCEPTED_AT,
      closedAt: closedAtAfterNotif,
      unknownAt: null,
      notifStatus: "Created",
    });
    if (r.ok) {
      expect(r.emailAcceptedAt).toBe(ACCEPTED_AT);
      expect(r.closedAt).toBe(closedAtAfterNotif);
      expect(r.notifStatus).toBe("Created");
    }
    expect(updateManyEnvoi).not.toHaveBeenCalled();
    expect(notificationCreate).not.toHaveBeenCalled();
    expect(notificationUpdate).not.toHaveBeenCalled();
  });

  it("Accepted rejoué après notification Failed : notifStatus réel, dates conservées, zéro écriture", async () => {
    const closedAtFailedNotif = new Date("2024-06-30T12:00:00.000Z");
    findUniqueEnvoi.mockResolvedValueOnce(
      callingRow({
        reservationStatus: "Completed",
        emailStatus: "Accepted",
        emailAcceptedAt: ACCEPTED_AT,
        notifStatus: "Failed",
        notificationCreatedAt: null,
        closedAt: closedAtFailedNotif,
      })
    );
    const r = await persist({ kind: "Accepted" });
    expect(r).toEqual({
      ok: true,
      outcome: "idempotent",
      envoiId: ENVOI,
      adherentId: ADH,
      reservationStatus: "Completed",
      emailStatus: "Accepted",
      emailAcceptedAt: ACCEPTED_AT,
      closedAt: closedAtFailedNotif,
      unknownAt: null,
      notifStatus: "Failed",
    });
    if (r.ok) {
      expect(r.emailAcceptedAt).toBe(ACCEPTED_AT);
      expect(r.closedAt).toBe(closedAtFailedNotif);
      expect(r.notifStatus).toBe("Failed");
    }
    expect(updateManyEnvoi).not.toHaveBeenCalled();
    expect(notificationCreate).not.toHaveBeenCalled();
    expect(notificationUpdate).not.toHaveBeenCalled();
  });

  it("rejeu Failed idempotent conserve closedAt", async () => {
    findUniqueEnvoi.mockResolvedValueOnce(
      callingRow({
        reservationStatus: "Failed",
        emailStatus: "DefinitelyNotAccepted",
        closedAt: CLOSED_AT,
        emailAcceptedAt: null,
      })
    );
    const r = await persist({
      kind: "DefinitelyNotAccepted",
      technicalCode: "PROVIDER_REJECTED",
    });
    expect(r).toMatchObject({
      ok: true,
      outcome: "idempotent",
      closedAt: CLOSED_AT,
      reservationStatus: "Failed",
    });
    if (r.ok) expect(r.closedAt).toBe(CLOSED_AT);
    expect(updateManyEnvoi).not.toHaveBeenCalled();
  });

  it("rejeu Unknown idempotent conserve unknownAt ; blocage conservé", async () => {
    findUniqueEnvoi.mockResolvedValueOnce(
      callingRow({
        reservationStatus: "Unknown",
        emailStatus: "Unknown",
        unknownAt: UNKNOWN_AT,
        closedAt: null,
      })
    );
    const r = await persist({
      kind: "Unknown",
      technicalCode: "TIMEOUT_AMBIGUOUS",
    });
    expect(r).toMatchObject({
      ok: true,
      outcome: "idempotent",
      unknownAt: UNKNOWN_AT,
      closedAt: null,
      reservationStatus: "Unknown",
    });
    if (r.ok) expect(r.unknownAt).toBe(UNKNOWN_AT);
    expect(updateManyEnvoi).not.toHaveBeenCalled();
  });

  it("contradiction Completed/Accepted vs Failed : CONFLICT sans écriture", async () => {
    findUniqueEnvoi.mockResolvedValueOnce(
      callingRow({
        reservationStatus: "Completed",
        emailStatus: "Accepted",
        emailAcceptedAt: ACCEPTED_AT,
      })
    );
    const r = await persist({
      kind: "DefinitelyNotAccepted",
      technicalCode: "PROVIDER_REJECTED",
    });
    expect(r).toEqual({
      ok: false,
      code: "CONFLICT",
      message: "Résultat contradictoire — aucune écriture",
    });
    expect(updateManyEnvoi).not.toHaveBeenCalled();
  });

  it("contradiction Failed vs Accepted : CONFLICT sans écriture", async () => {
    findUniqueEnvoi.mockResolvedValueOnce(
      callingRow({
        reservationStatus: "Failed",
        emailStatus: "DefinitelyNotAccepted",
        closedAt: CLOSED_AT,
      })
    );
    const r = await persist({ kind: "Accepted" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("CONFLICT");
    expect(updateManyEnvoi).not.toHaveBeenCalled();
  });

  it("Unknown → Accepted ordinaire : REQUIRES_OPS_RECONCILIATION sans écriture ni champs ops", async () => {
    findUniqueEnvoi.mockResolvedValueOnce(
      callingRow({
        reservationStatus: "Unknown",
        emailStatus: "Unknown",
        unknownAt: UNKNOWN_AT,
      })
    );
    const r = await persist({ kind: "Accepted" });
    expect(r).toEqual({
      ok: false,
      code: "REQUIRES_OPS_RECONCILIATION",
      message: "Unknown bloquant — réconciliation ops tracée requise",
    });
    expect(updateManyEnvoi).not.toHaveBeenCalled();
  });

  it("Unknown → DefinitelyNotAccepted ordinaire : REQUIRES_OPS_RECONCILIATION (pas de libération)", async () => {
    findUniqueEnvoi.mockResolvedValueOnce(
      callingRow({
        reservationStatus: "Unknown",
        emailStatus: "Unknown",
        unknownAt: UNKNOWN_AT,
      })
    );
    const r = await persist({
      kind: "DefinitelyNotAccepted",
      technicalCode: "PROVIDER_REJECTED",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("REQUIRES_OPS_RECONCILIATION");
    expect(updateManyEnvoi).not.toHaveBeenCalled();
  });

  it("Reserved : INVALID_STATE sans écriture", async () => {
    findUniqueEnvoi.mockResolvedValueOnce(
      callingRow({
        reservationStatus: "Reserved",
        emailStatus: "NotStarted",
        callingAt: null,
      })
    );
    const r = await persist({ kind: "Accepted" });
    expect(r).toMatchObject({
      ok: false,
      code: "INVALID_STATE",
    });
    expect(updateManyEnvoi).not.toHaveBeenCalled();
  });

  it("Abandoned : INVALID_STATE sans écriture", async () => {
    findUniqueEnvoi.mockResolvedValueOnce(
      callingRow({
        reservationStatus: "Abandoned",
        emailStatus: "NotStarted",
        callingAt: null,
        closedAt: CLOSED_AT,
      })
    );
    const r = await persist({
      kind: "Unknown",
      technicalCode: "TIMEOUT_AMBIGUOUS",
    });
    expect(r).toMatchObject({
      ok: false,
      code: "INVALID_STATE",
    });
    expect(updateManyEnvoi).not.toHaveBeenCalled();
  });

  it("erreur transaction : INTERNAL_ERROR sans fallback hors tx", async () => {
    $transaction.mockRejectedValueOnce(new Error("tx boom"));
    const r = await persist({ kind: "Accepted" });
    expect(r).toEqual({
      ok: false,
      code: "INTERNAL_ERROR",
      message: "Échec de la persistance du résultat email",
    });
    expect(updateManyEnvoi).not.toHaveBeenCalled();
  });

  it("échec commit après callback TX : INTERNAL_ERROR sans log de succès durable", async () => {
    const logSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    findUniqueEnvoi.mockResolvedValueOnce(callingRow());
    $transaction.mockImplementationOnce(async (fn: (tx: unknown) => unknown) => {
      const tx = {
        $queryRaw: async () => {
          callOrder.push("lock");
          return [{ id: ADH }];
        },
        rappelDetteEnvoi: {
          findUnique: async (...args: unknown[]) => {
            callOrder.push("envoi.findUnique");
            return findUniqueEnvoi(...args);
          },
          updateMany: async (...args: unknown[]) => {
            callOrder.push("envoi.updateMany");
            return updateManyEnvoi(...args);
          },
        },
      };
      // Callback métier OK (écriture simulée), puis échec commit.
      await fn(tx);
      throw new Error("commit failed after callback");
    });

    const r = await persist({ kind: "Accepted" });
    expect(r).toEqual({
      ok: false,
      code: "INTERNAL_ERROR",
      message: "Échec de la persistance du résultat email",
    });
    expect(updateManyEnvoi).toHaveBeenCalledTimes(1);
    const persistedLogs = logSpy.mock.calls.filter(
      (args) =>
        args[0] === "[persistRappelDetteEmailOutcome]" &&
        typeof args[1] === "object" &&
        args[1] !== null &&
        (args[1] as { category?: string }).category === "email_outcome_persisted"
    );
    expect(persistedLogs).toHaveLength(0);
    const errorLogs = logSpy.mock.calls.filter(
      (args) =>
        args[0] === "[persistRappelDetteEmailOutcome]" &&
        typeof args[1] === "object" &&
        args[1] !== null &&
        (args[1] as { category?: string }).category === "transaction_error"
    );
    expect(errorLogs.length).toBeGreaterThanOrEqual(1);
    logSpy.mockRestore();
  });

  it("valide les codes techniques bornés", async () => {
    const bad = await persist({
      kind: "Unknown",
      technicalCode: "bad-code!",
    });
    expect(bad).toMatchObject({ ok: false, code: "VALIDATION_ERROR" });
    expect($transaction).not.toHaveBeenCalled();

    const empty = await persist({
      kind: "DefinitelyNotAccepted",
      technicalCode: "",
    });
    expect(empty).toMatchObject({ ok: false, code: "VALIDATION_ERROR" });
  });

  it("aucun appel de canal externe (pas de notification mockée)", async () => {
    await persist({ kind: "Accepted" });
    await persist({
      kind: "DefinitelyNotAccepted",
      technicalCode: "PROVIDER_REJECTED",
    });
    findUniqueEnvoi.mockResolvedValueOnce(callingRow());
    await persist({
      kind: "Unknown",
      technicalCode: "TIMEOUT_AMBIGUOUS",
    });
    expect(notificationCreate).not.toHaveBeenCalled();
    expect(notificationUpdate).not.toHaveBeenCalled();
  });

  it("cible introuvable / mauvais adhérent : NOT_FOUND", async () => {
    findUniqueEnvoi.mockResolvedValueOnce(null);
    const r1 = await persist({ kind: "Accepted" });
    expect(r1).toMatchObject({ ok: false, code: "NOT_FOUND" });

    findUniqueEnvoi.mockResolvedValueOnce(
      callingRow({ adherentId: "other-adh" })
    );
    const r2 = await persist({ kind: "Accepted" });
    expect(r2).toMatchObject({ ok: false, code: "NOT_FOUND" });
    expect(updateManyEnvoi).not.toHaveBeenCalled();
  });

  it("adhérent absent au verrou : NOT_FOUND", async () => {
    $queryRaw.mockResolvedValueOnce([]);
    // mockTx wrapper still pushes lock — override $transaction to use empty lock
    $transaction.mockImplementationOnce(async (fn: (tx: unknown) => unknown) => {
      const tx = {
        $queryRaw: async () => {
          callOrder.push("lock");
          return [];
        },
        rappelDetteEnvoi: {
          findUnique: findUniqueEnvoi,
          updateMany: updateManyEnvoi,
        },
      };
      return fn(tx);
    });
    const r = await persist({ kind: "Accepted" });
    expect(r).toMatchObject({ ok: false, code: "NOT_FOUND" });
    expect(findUniqueEnvoi).not.toHaveBeenCalled();
    expect(updateManyEnvoi).not.toHaveBeenCalled();
  });
});
