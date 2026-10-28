import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "fs";
import path from "path";

const {
  $transaction,
  findUniqueEnvoi,
  updateManyEnvoi,
  notificationCreate,
  callOrder,
} = vi.hoisted(() => {
  const callOrder: string[] = [];
  return {
    callOrder,
    $transaction: vi.fn(),
    findUniqueEnvoi: vi.fn(),
    updateManyEnvoi: vi.fn(),
    notificationCreate: vi.fn(),
  };
});

vi.mock("@/lib/db", () => ({
  db: {
    $transaction: (...a: unknown[]) => $transaction(...a),
  },
}));

import {
  RAPPEL_DETTE_NOTIFICATION_LIEN_CONTRACT,
  RAPPEL_DETTE_NOTIFICATION_LIEN_ROUTE_READY,
  RAPPEL_DETTE_NOTIFICATION_MESSAGE,
  RAPPEL_DETTE_NOTIFICATION_TITRE,
  ensureRappelDetteInternalNotification,
  type EnsureRappelDetteNotificationCaller,
} from "@/lib/services/cotisations/rappel-dette/rappel-dette-notification";
import { RAPPEL_DETTE_TEMPLATE_DETAIL_LINK_CONTRACT } from "@/lib/services/cotisations/rappel-dette/payload-fingerprint";

const ADH = "adh-1";
const ENVOI = "envoi-1";
const RECIPIENT = "user-recipient";
const FIXED_NOW = new Date("2024-07-01T12:00:00.000Z");
const ACCEPTED_AT = new Date("2024-06-30T10:00:00.000Z");
const NOTIF_CREATED_AT = new Date("2024-06-30T11:00:00.000Z");
const CLOSED_AT = new Date("2024-06-30T11:00:00.000Z");

const SERVER_CALLER: EnsureRappelDetteNotificationCaller = {
  kind: "server_adapter",
  correlationId: "corr-notif-1",
};

function completedAcceptedRow(overrides: Record<string, unknown> = {}) {
  return {
    id: ENVOI,
    adherentId: ADH,
    recipientUserId: RECIPIENT,
    reservationStatus: "Completed",
    emailStatus: "Accepted",
    emailAcceptedAt: ACCEPTED_AT,
    notifStatus: "NotStarted",
    notificationId: null,
    notificationCreatedAt: null,
    closedAt: null,
    unknownAt: null,
    reconciledAt: null,
    reconciledByUserId: null,
    reconciliationDecisionCode: null,
    callingAt: new Date("2024-06-30T09:00:00.000Z"),
    ...overrides,
  };
}

function buildTx(opts?: {
  lockRows?: Array<{ id: string }>;
  onAfterCallback?: () => void;
}) {
  const lockRows = opts?.lockRows ?? [{ id: ADH }];
  return {
    $queryRaw: async () => {
      callOrder.push("lock");
      return lockRows;
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
      create: async (...args: unknown[]) => {
        callOrder.push("notification.create");
        return notificationCreate(...args);
      },
    },
  };
}

function mockHappyTx() {
  $transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
    return fn(buildTx());
  });
}

async function ensure(
  overrides: Partial<
    Parameters<typeof ensureRappelDetteInternalNotification>[0]
  > = {}
) {
  return ensureRappelDetteInternalNotification({
    caller: SERVER_CALLER,
    envoiId: ENVOI,
    adherentId: ADH,
    getNow: () => {
      callOrder.push("getNow");
      return FIXED_NOW;
    },
    ...overrides,
  });
}

describe("ensureRappelDetteInternalNotification", () => {
  beforeEach(() => {
    callOrder.length = 0;
    $transaction.mockReset();
    findUniqueEnvoi.mockReset();
    updateManyEnvoi.mockReset();
    notificationCreate.mockReset();
    mockHappyTx();
    findUniqueEnvoi.mockResolvedValue(completedAcceptedRow());
    updateManyEnvoi.mockResolvedValue({ count: 1 });
    notificationCreate.mockResolvedValue({ id: "notif-1" });
  });

  it("documente le contrat lien pending et l’absence de route réelle", () => {
    expect(RAPPEL_DETTE_NOTIFICATION_LIEN_ROUTE_READY).toBe(false);
    expect(RAPPEL_DETTE_NOTIFICATION_LIEN_CONTRACT).toBe(
      RAPPEL_DETTE_TEMPLATE_DETAIL_LINK_CONTRACT
    );
    expect(RAPPEL_DETTE_NOTIFICATION_TITRE).not.toMatch(/\d+[.,]\d{2}/);
    expect(RAPPEL_DETTE_NOTIFICATION_MESSAGE).not.toMatch(/\d+[.,]\d{2}/);
    expect(RAPPEL_DETTE_NOTIFICATION_MESSAGE.toLowerCase()).not.toContain(
      "€"
    );
  });

  it("refuse avant TX si caller ≠ server_adapter", async () => {
    const r = await ensureRappelDetteInternalNotification({
      caller: null,
      envoiId: ENVOI,
      adherentId: ADH,
    });
    expect(r).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect($transaction).not.toHaveBeenCalled();
  });

  it("verrouille avant lectures, horloge post-verrou, usage exclusif de tx", async () => {
    const r = await ensure();
    expect(r.ok).toBe(true);
    expect(callOrder.indexOf("lock")).toBeLessThan(callOrder.indexOf("getNow"));
    expect(callOrder.indexOf("getNow")).toBeLessThan(
      callOrder.indexOf("envoi.findUnique")
    );
    expect(callOrder.indexOf("envoi.findUnique")).toBeLessThan(
      callOrder.indexOf("notification.create")
    );
    expect(callOrder.indexOf("notification.create")).toBeLessThan(
      callOrder.indexOf("envoi.updateMany")
    );
    expect($transaction).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["Reserved", { reservationStatus: "Reserved", emailStatus: "NotStarted", emailAcceptedAt: null }],
    ["Calling", { reservationStatus: "Calling", emailStatus: "Calling", emailAcceptedAt: null }],
    ["Unknown", { reservationStatus: "Unknown", emailStatus: "Unknown", emailAcceptedAt: null, unknownAt: FIXED_NOW }],
    ["Failed", { reservationStatus: "Failed", emailStatus: "DefinitelyNotAccepted", emailAcceptedAt: null, closedAt: FIXED_NOW }],
    ["Abandoned", { reservationStatus: "Abandoned", emailStatus: "NotStarted", emailAcceptedAt: null, callingAt: null, closedAt: FIXED_NOW }],
  ] as const)(
    "refuse %s avant création",
    async (_label, overrides) => {
      findUniqueEnvoi.mockResolvedValueOnce(
        completedAcceptedRow(overrides as Record<string, unknown>)
      );
      const r = await ensure();
      expect(r).toMatchObject({ ok: false, code: "INVALID_STATE" });
      expect(notificationCreate).not.toHaveBeenCalled();
      expect(updateManyEnvoi).not.toHaveBeenCalled();
    }
  );

  it("refuse Completed sans preuve email Accepted", async () => {
    findUniqueEnvoi.mockResolvedValueOnce(
      completedAcceptedRow({
        emailStatus: "Accepted",
        emailAcceptedAt: null,
      })
    );
    const r = await ensure();
    expect(r).toMatchObject({ ok: false, code: "INVALID_STATE" });
    expect(notificationCreate).not.toHaveBeenCalled();
  });

  it("création atomique : notification + preuve Created + closedAt ; lien null (route non prête)", async () => {
    const r = await ensure();
    expect(r).toEqual({
      ok: true,
      outcome: "created",
      envoiId: ENVOI,
      adherentId: ADH,
      notifStatus: "Created",
      notificationId: "notif-1",
      notificationCreatedAt: FIXED_NOW,
      closedAt: FIXED_NOW,
      emailAcceptedAt: ACCEPTED_AT,
      opsTracesPreserved: false,
    });
    expect(notificationCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: RECIPIENT,
        type: "Cotisation",
        titre: RAPPEL_DETTE_NOTIFICATION_TITRE,
        message: RAPPEL_DETTE_NOTIFICATION_MESSAGE,
        lien: null,
        lue: false,
      }),
    });
    expect(updateManyEnvoi).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: ENVOI,
        adherentId: ADH,
        reservationStatus: "Completed",
        emailStatus: "Accepted",
        notificationCreatedAt: null,
        notifStatus: { in: ["NotStarted", "Failed"] },
      }),
      data: expect.objectContaining({
        notificationId: "notif-1",
        notificationCreatedAt: FIXED_NOW,
        notifStatus: "Created",
        closedAt: FIXED_NOW,
      }),
    });
  });

  it("Created avec lien présent : no-op idempotent", async () => {
    findUniqueEnvoi.mockResolvedValueOnce(
      completedAcceptedRow({
        notifStatus: "Created",
        notificationId: "notif-live",
        notificationCreatedAt: NOTIF_CREATED_AT,
        closedAt: CLOSED_AT,
      })
    );
    const r = await ensure();
    expect(r).toMatchObject({
      ok: true,
      outcome: "idempotent",
      notificationId: "notif-live",
      notificationCreatedAt: NOTIF_CREATED_AT,
      closedAt: CLOSED_AT,
      emailAcceptedAt: ACCEPTED_AT,
      notifStatus: "Created",
    });
    if (r.ok) {
      expect(r.notificationCreatedAt).toBe(NOTIF_CREATED_AT);
      expect(r.emailAcceptedAt).toBe(ACCEPTED_AT);
    }
    expect(notificationCreate).not.toHaveBeenCalled();
    expect(updateManyEnvoi).not.toHaveBeenCalled();
  });

  it("Created après purge (lien null) : no-op, ne recrée pas", async () => {
    findUniqueEnvoi.mockResolvedValueOnce(
      completedAcceptedRow({
        notifStatus: "Created",
        notificationId: null,
        notificationCreatedAt: NOTIF_CREATED_AT,
        closedAt: CLOSED_AT,
      })
    );
    const r = await ensure();
    expect(r).toMatchObject({
      ok: true,
      outcome: "idempotent",
      notificationId: null,
      notificationCreatedAt: NOTIF_CREATED_AT,
    });
    expect(notificationCreate).not.toHaveBeenCalled();
    expect(updateManyEnvoi).not.toHaveBeenCalled();
  });

  it("reprise Failed : une création, aucun email", async () => {
    findUniqueEnvoi.mockResolvedValueOnce(
      completedAcceptedRow({
        notifStatus: "Failed",
        closedAt: CLOSED_AT,
        notificationId: null,
        notificationCreatedAt: null,
      })
    );
    const r = await ensure();
    expect(r).toMatchObject({
      ok: true,
      outcome: "created",
      notificationId: "notif-1",
      notifStatus: "Created",
      emailAcceptedAt: ACCEPTED_AT,
    });
    expect(notificationCreate).toHaveBeenCalledTimes(1);
    expect(updateManyEnvoi).toHaveBeenCalledTimes(1);
  });

  it("conserve preuve email et traces ops", async () => {
    const unknownAt = new Date("2024-06-28T08:00:00.000Z");
    const reconciledAt = new Date("2024-06-29T08:00:00.000Z");
    findUniqueEnvoi.mockResolvedValueOnce(
      completedAcceptedRow({
        unknownAt,
        reconciledAt,
        reconciledByUserId: "ops-1",
        reconciliationDecisionCode: "OPS_ACCEPTED_LATE",
      })
    );
    const r = await ensure();
    expect(r).toMatchObject({
      ok: true,
      emailAcceptedAt: ACCEPTED_AT,
      opsTracesPreserved: true,
    });
    if (r.ok) expect(r.emailAcceptedAt).toBe(ACCEPTED_AT);
    const updateData = updateManyEnvoi.mock.calls[0][0].data;
    expect(updateData).not.toHaveProperty("emailAcceptedAt");
    expect(updateData).not.toHaveProperty("unknownAt");
    expect(updateData).not.toHaveProperty("reconciledAt");
    expect(updateData).not.toHaveProperty("reconciledByUserId");
    expect(updateData).not.toHaveProperty("reconciliationDecisionCode");
  });

  it("échec insertion notification : rollback (pas de succès) puis marquage Failed", async () => {
    notificationCreate.mockRejectedValueOnce(new Error("insert boom"));
    // 1ère TX throw → catch ; 2e TX = mark Failed
    let txCount = 0;
    $transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
      txCount += 1;
      if (txCount === 1) {
        return fn(buildTx());
      }
      // mark Failed TX
      findUniqueEnvoi.mockResolvedValueOnce(
        completedAcceptedRow({ notifStatus: "NotStarted" })
      );
      updateManyEnvoi.mockResolvedValueOnce({ count: 1 });
      return fn(buildTx());
    });

    const r = await ensure();
    expect(r).toMatchObject({
      ok: false,
      code: "NOTIF_MARKED_FAILED",
    });
    expect(txCount).toBe(2);
  });

  it("échec mise à jour lien (CAS) : throw → rollback création, marquage Failed", async () => {
    updateManyEnvoi.mockResolvedValueOnce({ count: 0 });
    let txCount = 0;
    $transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
      txCount += 1;
      if (txCount === 1) {
        return fn(buildTx());
      }
      findUniqueEnvoi.mockResolvedValueOnce(
        completedAcceptedRow({ notifStatus: "NotStarted" })
      );
      updateManyEnvoi.mockResolvedValueOnce({ count: 1 });
      return fn(buildTx());
    });
    const r = await ensure();
    expect(r).toMatchObject({ ok: false, code: "NOTIF_MARKED_FAILED" });
  });

  it("marquage Failed protégé contre Created concurrent", async () => {
    notificationCreate.mockRejectedValueOnce(new Error("insert boom"));
    let txCount = 0;
    $transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
      txCount += 1;
      if (txCount === 1) {
        return fn(buildTx());
      }
      // Concurrent Created déjà posé
      findUniqueEnvoi.mockResolvedValueOnce(
        completedAcceptedRow({
          notifStatus: "Created",
          notificationId: "notif-other",
          notificationCreatedAt: NOTIF_CREATED_AT,
          closedAt: CLOSED_AT,
        })
      );
      return fn(buildTx());
    });
    const r = await ensure();
    expect(r).toMatchObject({ ok: false, code: "CONFLICT" });
    // updateMany du mark ne doit pas rétrograder : early return avant update
    // (2e TX : findUnique only, pas d'update si Created détecté)
    expect(txCount).toBe(2);
  });

  it("échec du marquage Failed : incertitude technique explicitement restituée", async () => {
    notificationCreate.mockRejectedValueOnce(new Error("insert boom"));
    let txCount = 0;
    $transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
      txCount += 1;
      if (txCount === 1) {
        return fn(buildTx());
      }
      throw new Error("mark failed tx boom");
    });
    const r = await ensure();
    expect(r).toMatchObject({
      ok: false,
      code: "NOTIF_FAILED_MARK_UNCERTAIN",
    });
    expect(r.ok === false && r.message).toMatch(/non confirmé|incertitude/i);
  });

  it("aucun email ni push (imports source + pas d’appel createNotification)", async () => {
    const src = readFileSync(
      path.join(
        process.cwd(),
        "lib/services/cotisations/rappel-dette/rappel-dette-notification.ts"
      ),
      "utf8"
    );
    expect(src).not.toMatch(
      /from\s+["']@\/actions\/notifications/
    );
    expect(src).not.toMatch(
      /from\s+["'][^"']*create-notification/
    );
    expect(src).not.toMatch(
      /from\s+["'][^"']*push-after-internal-notification/
    );
    expect(src).not.toMatch(/sendEmail|nodemailer|resend/i);
    expect(src).toMatch(/tx\.notification\.create/);

    await ensure();
    expect(notificationCreate).toHaveBeenCalledTimes(1);
  });

  it("deux appels simulés : idempotence (créé puis no-op)", async () => {
    const first = await ensure();
    expect(first).toMatchObject({ ok: true, outcome: "created" });

    findUniqueEnvoi.mockResolvedValueOnce(
      completedAcceptedRow({
        notifStatus: "Created",
        notificationId: "notif-1",
        notificationCreatedAt: FIXED_NOW,
        closedAt: FIXED_NOW,
      })
    );
    const second = await ensure();
    expect(second).toMatchObject({
      ok: true,
      outcome: "idempotent",
      notificationId: "notif-1",
      notificationCreatedAt: FIXED_NOW,
    });
    expect(notificationCreate).toHaveBeenCalledTimes(1);
  });

  it("adhérent absent au verrou : NOT_FOUND", async () => {
    $transaction.mockImplementationOnce(async (fn: (tx: unknown) => unknown) =>
      fn(buildTx({ lockRows: [] }))
    );
    const r = await ensure();
    expect(r).toMatchObject({ ok: false, code: "NOT_FOUND" });
    expect(findUniqueEnvoi).not.toHaveBeenCalled();
  });
});

describe("limites mocks", () => {
  it("documente que les mocks ne prouvent pas la concurrence PG réelle", () => {
    expect(true).toBe(true);
  });
});
