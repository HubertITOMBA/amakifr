/**
 * Tests unitaires lot 4.5 — helper + intégration notif/outbox / kick / flag.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma, TypeNotification } from "@prisma/client";

const {
  $transaction,
  $executeRaw,
  noteFindUnique,
  noteUpdateMany,
  reglementFindUnique,
  reglementCreate,
  ligneCreate,
  choixFindFirst,
  choixUpdate,
  userFindUnique,
  userAdminRoleFindMany,
  resolveActionPermissionConfig,
  notificationCreate,
  outboxCreate,
  processNoteFraisOutboxOnce,
  assertNotesFraisEnabled,
} = vi.hoisted(() => ({
  $transaction: vi.fn(),
  $executeRaw: vi.fn(),
  noteFindUnique: vi.fn(),
  noteUpdateMany: vi.fn(),
  reglementFindUnique: vi.fn(),
  reglementCreate: vi.fn(),
  ligneCreate: vi.fn(),
  choixFindFirst: vi.fn(),
  choixUpdate: vi.fn(),
  userFindUnique: vi.fn(),
  userAdminRoleFindMany: vi.fn(),
  resolveActionPermissionConfig: vi.fn(),
  notificationCreate: vi.fn(),
  outboxCreate: vi.fn(),
  processNoteFraisOutboxOnce: vi.fn().mockResolvedValue(0),
  assertNotesFraisEnabled: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    $transaction: (...a: unknown[]) => $transaction(...a),
    $executeRaw: (...a: unknown[]) => $executeRaw(...a),
    noteFrais: {
      findUnique: (...a: unknown[]) => noteFindUnique(...a),
      updateMany: (...a: unknown[]) => noteUpdateMany(...a),
    },
    noteFraisReglement: {
      findUnique: (...a: unknown[]) => reglementFindUnique(...a),
      create: (...a: unknown[]) => reglementCreate(...a),
    },
    noteFraisReglementLigne: {
      create: (...a: unknown[]) => ligneCreate(...a),
    },
    noteFraisChoixReglement: {
      findFirst: (...a: unknown[]) => choixFindFirst(...a),
      update: (...a: unknown[]) => choixUpdate(...a),
    },
    user: { findUnique: (...a: unknown[]) => userFindUnique(...a) },
    userAdminRole: { findMany: (...a: unknown[]) => userAdminRoleFindMany(...a) },
    notification: { create: (...a: unknown[]) => notificationCreate(...a) },
    noteFraisOutboxEvent: { create: (...a: unknown[]) => outboxCreate(...a) },
  },
}));

vi.mock("@/lib/frais-avances/feature-flag", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/frais-avances/feature-flag")
  >("@/lib/frais-avances/feature-flag");
  return {
    ...actual,
    assertNotesFraisEnabled: (...a: unknown[]) => assertNotesFraisEnabled(...a),
    isNotesFraisEnabled: () => true,
  };
});

vi.mock("@/lib/dynamic-permissions", () => ({
  canRead: vi.fn().mockResolvedValue(false),
  canWrite: vi.fn().mockResolvedValue(false),
  resolveActionPermissionConfig: (...a: unknown[]) =>
    resolveActionPermissionConfig(...a),
}));

vi.mock("@/lib/services/frais-avances/note-frais-service", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/services/frais-avances/note-frais-service")
  >("@/lib/services/frais-avances/note-frais-service");
  return {
    ...actual,
    processNoteFraisOutboxOnce: (...a: unknown[]) =>
      processNoteFraisOutboxOnce(...a),
  };
});

import {
  REGLEMENT_NOTIFY_MESSAGE,
  REGLEMENT_NOTIFY_TITRE,
  buildNoteFraisReglementNotifyLien,
  buildNoteFraisReglementOutboxEventKey,
  createNoteFraisReglementNotificationInTx,
} from "@/lib/services/frais-avances/note-frais-reglement-notify";
import { executeNoteFraisRemboursement } from "@/lib/services/frais-avances/note-frais-remboursement-service";
import { NotesFraisDisabledError } from "@/lib/frais-avances/feature-flag";

const executeAtIso = "2026-06-01T12:00:00.000Z";

describe("note-frais-reglement-notify helper", () => {
  it("construit lien et eventKeys exacts", () => {
    expect(buildNoteFraisReglementNotifyLien("n1")).toBe(
      "/user/frais-avances/n1"
    );
    expect(
      buildNoteFraisReglementOutboxEventKey(
        "REGLEMENT_COMPENSATION",
        "n1",
        "r1"
      )
    ).toBe("note:n1:reglement:r1:compensation");
    expect(
      buildNoteFraisReglementOutboxEventKey(
        "REGLEMENT_REMBOURSEMENT",
        "n1",
        "r2"
      )
    ).toBe("note:n1:reglement:r2:remboursement");
    expect(
      buildNoteFraisReglementOutboxEventKey("REGLEMENT_MIXTE", "n1", "op1")
    ).toBe("note:n1:operation:op1:mixte");
  });

  it("crée notif + outbox génériques sans donnée sensible", async () => {
    const tx = {
      notification: { create: notificationCreate },
      noteFraisOutboxEvent: { create: outboxCreate },
    };
    notificationCreate.mockResolvedValue({ id: "n" });
    outboxCreate.mockResolvedValue({ id: "o" });

    await createNoteFraisReglementNotificationInTx(tx as never, {
      noteId: "note-abc",
      demandeurUserId: "user-dem",
      kind: "REGLEMENT_REMBOURSEMENT",
      anchorId: "reg-xyz",
    });

    expect(notificationCreate).toHaveBeenCalledWith({
      data: {
        userId: "user-dem",
        type: TypeNotification.Action,
        titre: REGLEMENT_NOTIFY_TITRE,
        message: REGLEMENT_NOTIFY_MESSAGE,
        lien: "/user/frais-avances/note-abc",
        lue: false,
      },
    });
    const outbox = outboxCreate.mock.calls[0]![0] as {
      data: {
        kind: string;
        eventKey: string;
        payload: Record<string, unknown>;
      };
    };
    expect(outbox.data.kind).toBe("REGLEMENT_REMBOURSEMENT");
    expect(outbox.data.eventKey).toBe(
      "note:note-abc:reglement:reg-xyz:remboursement"
    );
    const dumped = JSON.stringify(outbox.data.payload);
    expect(dumped).not.toMatch(
      /montant|VIREMENT|ESPECES|référence|DETTE|COTISATION|motif/i
    );
    expect(outbox.data.payload.titre).toBe(REGLEMENT_NOTIFY_TITRE);
    expect(outbox.data.payload.message).toBe(REGLEMENT_NOTIFY_MESSAGE);
    expect(outbox.data.payload.lien).toBe("/user/frais-avances/note-abc");
  });
});

describe("kick outbox après remboursement fresh", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    assertNotesFraisEnabled.mockImplementation(() => undefined);
    resolveActionPermissionConfig.mockResolvedValue({ status: "absent" });
    userFindUnique.mockResolvedValue({ role: "TRESOR", status: "Actif" });
    userAdminRoleFindMany.mockResolvedValue([]);
    reglementFindUnique.mockResolvedValue(null);
    $executeRaw.mockResolvedValue(undefined);
    noteUpdateMany.mockResolvedValue({ count: 1 });
    reglementCreate.mockResolvedValue({ id: "reg1" });
    ligneCreate.mockResolvedValue({ id: "lig1" });
    choixUpdate.mockResolvedValue({});
    notificationCreate.mockResolvedValue({ id: "notif1" });
    outboxCreate.mockResolvedValue({ id: "ob1" });
    processNoteFraisOutboxOnce.mockResolvedValue(1);
    noteFindUnique.mockResolvedValue({
      id: "n1",
      statut: "VALIDEE",
      version: 3,
      demandeurUserId: "dem",
      decideeAt: new Date("2026-05-01T00:00:00.000Z"),
      montantAccepte: new Prisma.Decimal(50),
    });
    choixFindFirst.mockResolvedValue({
      id: "ch1",
      mode: "REMBOURSEMENT",
      montantRemboursement: new Prisma.Decimal(50),
      montantRembourseUtilise: new Prisma.Decimal(0),
      montantCompensationUtilise: new Prisma.Decimal(0),
    });
    $transaction.mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          $executeRaw,
          noteFrais: {
            findUnique: noteFindUnique,
            updateMany: noteUpdateMany,
          },
          noteFraisReglement: {
            findUnique: reglementFindUnique,
            create: reglementCreate,
          },
          noteFraisReglementLigne: { create: ligneCreate },
          noteFraisChoixReglement: {
            findFirst: choixFindFirst,
            update: choixUpdate,
          },
          notification: { create: notificationCreate },
          noteFraisOutboxEvent: { create: outboxCreate },
        };
        return fn(tx);
      }
    );
  });

  it("kick après commit fresh sans client injecté", async () => {
    const res = await executeNoteFraisRemboursement({
      actorUserId: "tres",
      noteId: "n1",
      expectedNoteVersion: 3,
      idempotencyKey: "remb-kick-01",
      montant: "10.00",
      moyen: "VIREMENT",
      reference: "REF-KICK",
      executeAt: executeAtIso,
      clock: { now: () => new Date(executeAtIso) },
    });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.alreadyExecuted).toBe(false);
    expect(notificationCreate).toHaveBeenCalledTimes(1);
    expect(outboxCreate).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => {
      expect(processNoteFraisOutboxOnce).toHaveBeenCalled();
    });
  });

  it("pas de kick avec client injecté", async () => {
    const fakeClient = {
      $transaction,
      noteFrais: { findUnique: noteFindUnique },
      noteFraisReglement: { findUnique: reglementFindUnique },
      user: { findUnique: userFindUnique },
      userAdminRole: { findMany: userAdminRoleFindMany },
    } as unknown as typeof import("@/lib/db").db;

    const res = await executeNoteFraisRemboursement({
      actorUserId: "tres",
      noteId: "n1",
      expectedNoteVersion: 3,
      idempotencyKey: "remb-kick-02",
      montant: "10.00",
      moyen: "ESPECES",
      reference: "REF-NOKICK",
      executeAt: executeAtIso,
      clock: { now: () => new Date(executeAtIso) },
      client: fakeClient,
    });
    expect(res.success).toBe(true);
    await new Promise((r) => setTimeout(r, 30));
    expect(processNoteFraisOutboxOnce).not.toHaveBeenCalled();
  });

  it("flag off refuse avant TX", async () => {
    assertNotesFraisEnabled.mockImplementation(() => {
      throw new NotesFraisDisabledError();
    });
    const res = await executeNoteFraisRemboursement({
      actorUserId: "tres",
      noteId: "n1",
      expectedNoteVersion: 3,
      idempotencyKey: "remb-flag-off",
      montant: "10.00",
      moyen: "VIREMENT",
      reference: "REF-OFF",
      executeAt: executeAtIso,
    });
    expect(res.success).toBe(false);
    if (!res.success) expect(res.code).toBe("NOTES_FRAIS_DISABLED");
    expect($transaction).not.toHaveBeenCalled();
    expect(notificationCreate).not.toHaveBeenCalled();
  });

  it("afterNotifyOutbox qui throw → erreur TX (rollback mock)", async () => {
    $transaction.mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          $executeRaw,
          noteFrais: {
            findUnique: noteFindUnique,
            updateMany: noteUpdateMany,
          },
          noteFraisReglement: {
            findUnique: reglementFindUnique,
            create: reglementCreate,
          },
          noteFraisReglementLigne: { create: ligneCreate },
          noteFraisChoixReglement: {
            findFirst: choixFindFirst,
            update: choixUpdate,
          },
          notification: { create: notificationCreate },
          noteFraisOutboxEvent: { create: outboxCreate },
        };
        return fn(tx);
      }
    );

    const res = await executeNoteFraisRemboursement({
      actorUserId: "tres",
      noteId: "n1",
      expectedNoteVersion: 3,
      idempotencyKey: "remb-hook-fail",
      montant: "10.00",
      moyen: "VIREMENT",
      reference: "REF-HOOK",
      executeAt: executeAtIso,
      clock: { now: () => new Date(executeAtIso) },
      afterNotifyOutbox: async () => {
        throw new Error("forced_notify_rollback");
      },
    });
    expect(res.success).toBe(false);
    expect(processNoteFraisOutboxOnce).not.toHaveBeenCalled();
  });
});
