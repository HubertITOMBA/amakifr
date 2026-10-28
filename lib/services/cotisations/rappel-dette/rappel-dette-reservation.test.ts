import { readFileSync } from "fs";
import path from "path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { parisCivilDate } from "@/lib/services/cotisations/rappel-dette/paris-calendar";
import {
  RAPPEL_DETTE_TEMPLATE_DETAIL_LINK_CONTRACT,
  RAPPEL_DETTE_TEMPLATE_REGISTRY,
  computeRappelDetteFingerprint,
  resolveTemplateDetailLinkContract,
} from "@/lib/services/cotisations/rappel-dette/payload-fingerprint";

const {
  $transaction,
  $queryRaw,
  findUniqueEnvoi,
  findFirstEnvoi,
  createEnvoi,
  updateEnvoi,
  updateManyEnvoi,
  findUniqueAdherent,
  computeDetteRappelable,
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
    findFirstEnvoi: vi.fn(async () => {
      callOrder.push("envoi.findFirst");
      return null;
    }),
    createEnvoi: vi.fn(async (args: { data: Record<string, unknown> }) => {
      callOrder.push("envoi.create");
      return { id: "envoi-1", ...args.data };
    }),
    updateEnvoi: vi.fn(async () => {
      callOrder.push("envoi.update");
      return {};
    }),
    updateManyEnvoi: vi.fn(async () => {
      callOrder.push("envoi.updateMany");
      return { count: 1 };
    }),
    findUniqueAdherent: vi.fn(async () => {
      callOrder.push("adherent.findUnique");
      return {
        id: "adh-1",
        userId: "user-recipient",
        User: {
          id: "user-recipient",
          email: "Destinataire@Example.COM",
          status: "Actif",
        },
      };
    }),
    computeDetteRappelable: vi.fn(),
  };
});

vi.mock("@/lib/db", () => ({
  db: {
    $transaction: (...a: unknown[]) => $transaction(...a),
  },
}));

vi.mock("@/lib/services/cotisations/rappel-dette/compute-dette-rappelable", () => ({
  computeDetteRappelable: (...a: unknown[]) => computeDetteRappelable(...a),
}));

import {
  RAPPEL_DETTE_RESERVED_ON_PRECALLING_REFUSAL,
  RAPPEL_DETTE_RESERVED_TTL_MS,
  authorizeRappelDetteCalling,
  reserveRappelDetteEnvoi,
} from "@/lib/services/cotisations/rappel-dette/rappel-dette-reservation";

const ADH = "adh-1";
const ACTOR_ADMIN = { userId: "admin-1", role: "ADMIN" };
const ACTOR_PRESID = { userId: "pres-1", role: "PRESID" };
const ACTOR_TRESOR = { userId: "tre-1", role: "TRESOR" };
const T0 = parisCivilDate(2024, 6, 30);
const KEY = "conf-key-aaaaaaaa";
const TEMPLATE = "email-rappel-dette-v1";

function eligibleCompute(overrides: Record<string, unknown> = {}) {
  return {
    eligible: true,
    adherentId: ADH,
    montantBrut: new Prisma.Decimal("15.00"),
    avoirDisponible: new Prisma.Decimal("0.00"),
    detteNette: new Prisma.Decimal("15.00"),
    retainedLines: [
      {
        source: "cotisation_mensuelle" as const,
        id: "cm-1",
        montantRestant: new Prisma.Decimal("15.00"),
        dueDate: parisCivilDate(2024, 5, 1),
        daysPastDue: 60,
      },
    ],
    ignoredLines: [],
    earliestDueDate: parisCivilDate(2024, 5, 1),
    nextEligibleReminderAt: T0,
    lastReminderSentAt: null,
    globalReasons: ["ELIGIBLE" as const],
    ...overrides,
  };
}

function fingerprintFor(
  compute = eligibleCompute(),
  recipient = {
    recipientUserId: "user-recipient",
    recipientEmail: "destinataire@example.com",
  }
) {
  return computeRappelDetteFingerprint({
    adherentId: ADH,
    recipientUserId: recipient.recipientUserId,
    recipientEmail: recipient.recipientEmail,
    templateVersion: TEMPLATE,
    templateDetailLinkContract: RAPPEL_DETTE_TEMPLATE_DETAIL_LINK_CONTRACT,
    montantBrut: compute.montantBrut as Prisma.Decimal,
    avoirDisponible: compute.avoirDisponible as Prisma.Decimal,
    detteNette: compute.detteNette as Prisma.Decimal,
    retainedLines: compute.retainedLines as ReturnType<
      typeof eligibleCompute
    >["retainedLines"],
  }).fingerprint;
}

function reservedRow(overrides: Record<string, unknown> = {}) {
  const compute = eligibleCompute();
  const fp = fingerprintFor(compute);
  return {
    id: "envoi-1",
    adherentId: ADH,
    reservationStatus: "Reserved",
    lockExpiresAt: new Date(T0.getTime() + RAPPEL_DETTE_RESERVED_TTL_MS),
    callingAt: null,
    payloadFingerprint: fp,
    templateVersion: TEMPLATE,
    recipientUserId: "user-recipient",
    recipientEmail: "destinataire@example.com",
    montantBrut: compute.montantBrut,
    avoirDisponible: compute.avoirDisponible,
    detteNette: compute.detteNette,
    ...overrides,
  };
}

function mockTx() {
  $transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
    const tx = {
      $queryRaw,
      rappelDetteEnvoi: {
        findUnique: findUniqueEnvoi,
        findFirst: findFirstEnvoi,
        create: createEnvoi,
        update: updateEnvoi,
        updateMany: updateManyEnvoi,
      },
      adherent: { findUnique: findUniqueAdherent },
    };
    return fn(tx);
  });
}

describe("reserveRappelDetteEnvoi / authorizeRappelDetteCalling", () => {
  beforeEach(() => {
    callOrder.length = 0;
    $transaction.mockReset();
    $queryRaw.mockReset();
    $queryRaw.mockImplementation(async () => {
      callOrder.push("lock");
      return [{ id: ADH }];
    });
    findUniqueEnvoi.mockReset();
    findUniqueEnvoi.mockImplementation(async () => {
      callOrder.push("envoi.findUnique");
      return null;
    });
    findFirstEnvoi.mockReset();
    findFirstEnvoi.mockImplementation(async () => {
      callOrder.push("envoi.findFirst");
      return null;
    });
    createEnvoi.mockReset();
    createEnvoi.mockImplementation(async (args: { data: Record<string, unknown> }) => {
      callOrder.push("envoi.create");
      return { id: "envoi-1", ...args.data };
    });
    updateEnvoi.mockReset();
    updateEnvoi.mockImplementation(async () => {
      callOrder.push("envoi.update");
      return {};
    });
    updateManyEnvoi.mockReset();
    updateManyEnvoi.mockImplementation(async () => {
      callOrder.push("envoi.updateMany");
      return { count: 1 };
    });
    findUniqueAdherent.mockReset();
    findUniqueAdherent.mockImplementation(async () => {
      callOrder.push("adherent.findUnique");
      return {
        id: ADH,
        userId: "user-recipient",
        User: {
          id: "user-recipient",
          email: "Destinataire@Example.COM",
          status: "Actif",
        },
      };
    });
    computeDetteRappelable.mockReset();
    computeDetteRappelable.mockImplementation(async () => {
      callOrder.push("compute");
      return eligibleCompute();
    });
    mockTx();
  });

  it("refuse les rôles non ADMIN/PRESID avant toute transaction", async () => {
    const r = await reserveRappelDetteEnvoi({
      actor: ACTOR_TRESOR,
      adherentId: ADH,
      clientConfirmationId: KEY,
      expectedFingerprint: "abc",
      templateVersion: TEMPLATE,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("FORBIDDEN");
    expect($transaction).not.toHaveBeenCalled();
  });

  it("absence de session refusée avant transaction", async () => {
    for (const actor of [null, undefined] as const) {
      $transaction.mockClear();
      const r = await reserveRappelDetteEnvoi({
        actor,
        adherentId: ADH,
        clientConfirmationId: KEY,
        expectedFingerprint: fingerprintFor(),
        templateVersion: TEMPLATE,
      });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.code).toBe("UNAUTHENTICATED");
      expect($transaction).not.toHaveBeenCalled();
    }
  });

  it("autorise ADMIN et PRESID (garde avant TX)", async () => {
    const fp = fingerprintFor();
    for (const actor of [ACTOR_ADMIN, ACTOR_PRESID]) {
      $transaction.mockClear();
      const r = await reserveRappelDetteEnvoi({
        actor,
        adherentId: ADH,
        clientConfirmationId: `${KEY}-${actor.role}`,
        expectedFingerprint: fp,
        templateVersion: TEMPLATE,
        getNow: () => T0,
      });
      expect(r.ok).toBe(true);
      expect($transaction).toHaveBeenCalledTimes(1);
    }
  });

  it("horloge post-verrou : avance pendant l’attente simulée du verrou", async () => {
    let clock = T0.getTime();
    const getNow = () => new Date(clock);
    $queryRaw.mockImplementation(async () => {
      // Simule l’attente du verrou : l’horloge avance avant getNow post-lock.
      clock = T0.getTime() + 45_000;
      callOrder.push("lock");
      return [{ id: ADH }];
    });
    const fp = fingerprintFor();
    await reserveRappelDetteEnvoi({
      actor: ACTOR_ADMIN,
      adherentId: ADH,
      clientConfirmationId: KEY,
      expectedFingerprint: fp,
      templateVersion: TEMPLATE,
      getNow,
      reservedTtlMs: 120_000,
    });
    expect(callOrder[0]).toBe("lock");
    expect(computeDetteRappelable).toHaveBeenCalledWith(
      ADH,
      expect.objectContaining({
        now: new Date(T0.getTime() + 45_000),
        prisma: expect.anything(),
      })
    );
    expect(createEnvoi).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reservedAt: new Date(T0.getTime() + 45_000),
          lockExpiresAt: new Date(T0.getTime() + 45_000 + 120_000),
        }),
      })
    );
  });

  it("idempotence : même clé + empreinte + template/contrat → état existant", async () => {
    const fp = fingerprintFor();
    findUniqueEnvoi.mockImplementation(async () => {
      callOrder.push("envoi.findUnique");
      return reservedRow({ payloadFingerprint: fp });
    });
    const r = await reserveRappelDetteEnvoi({
      actor: ACTOR_ADMIN,
      adherentId: ADH,
      clientConfirmationId: KEY,
      expectedFingerprint: fp,
      templateVersion: TEMPLATE,
      getNow: () => T0,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.outcome).toBe("idempotent");
      expect(r.templateDetailLinkContract).toBe(
        RAPPEL_DETTE_TEMPLATE_DETAIL_LINK_CONTRACT
      );
      expect(r.providerCallAuthorized).toBe(false);
    }
    expect(createEnvoi).not.toHaveBeenCalled();
  });

  it("même clé mais template/contrat incohérent → CONFLICT", async () => {
    const fp = fingerprintFor();
    findUniqueEnvoi.mockImplementation(async () =>
      reservedRow({
        payloadFingerprint: fp,
        // Version différente ⇒ contrat catalogue différent / incohérent.
        templateVersion: "autre-template-v9",
      })
    );
    const r = await reserveRappelDetteEnvoi({
      actor: ACTOR_ADMIN,
      adherentId: ADH,
      clientConfirmationId: KEY,
      expectedFingerprint: fp,
      templateVersion: TEMPLATE,
      getNow: () => T0,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("CONFLICT");
    expect(createEnvoi).not.toHaveBeenCalled();
  });

  it("conflit générique : même clé, autre empreinte", async () => {
    findUniqueEnvoi.mockImplementation(async () =>
      reservedRow({ payloadFingerprint: "other-fp" })
    );
    const r = await reserveRappelDetteEnvoi({
      actor: ACTOR_ADMIN,
      adherentId: ADH,
      clientConfirmationId: KEY,
      expectedFingerprint: fingerprintFor(),
      templateVersion: TEMPLATE,
      getNow: () => T0,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("CONFLICT");
  });

  it("Unknown bloquant → UNRESOLVED_UNCERTAINTY", async () => {
    findFirstEnvoi.mockImplementation(async () => ({
      id: "envoi-unk",
      adherentId: ADH,
      reservationStatus: "Unknown",
      lockExpiresAt: new Date(T0.getTime() + 60_000),
    }));
    const r = await reserveRappelDetteEnvoi({
      actor: ACTOR_ADMIN,
      adherentId: ADH,
      clientConfirmationId: KEY,
      expectedFingerprint: fingerprintFor(),
      templateVersion: TEMPLATE,
      getNow: () => T0,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("UNRESOLVED_UNCERTAINTY");
  });

  it("Reserved non expiré bloque une deuxième clé", async () => {
    findFirstEnvoi.mockImplementation(async () =>
      reservedRow({ id: "envoi-block" })
    );
    const r = await reserveRappelDetteEnvoi({
      actor: ACTOR_ADMIN,
      adherentId: ADH,
      clientConfirmationId: "conf-key-bbbbbbbb",
      expectedFingerprint: fingerprintFor(),
      templateVersion: TEMPLATE,
      getNow: () => T0,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("BLOCKED_ATTEMPT");
    expect(createEnvoi).not.toHaveBeenCalled();
  });

  it("drift à la réservation → REQUIRES_RECONFIRM sans création", async () => {
    const r = await reserveRappelDetteEnvoi({
      actor: ACTOR_ADMIN,
      adherentId: ADH,
      clientConfirmationId: KEY,
      expectedFingerprint: "0".repeat(64),
      templateVersion: TEMPLATE,
      getNow: () => T0,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("REQUIRES_RECONFIRM");
    expect(createEnvoi).not.toHaveBeenCalled();
  });

  it("erreur de transaction → INTERNAL_ERROR", async () => {
    $transaction.mockRejectedValue(new Error("tx boom"));
    const r = await reserveRappelDetteEnvoi({
      actor: ACTOR_ADMIN,
      adherentId: ADH,
      clientConfirmationId: KEY,
      expectedFingerprint: fingerprintFor(),
      templateVersion: TEMPLATE,
      getNow: () => T0,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("INTERNAL_ERROR");
  });

  it("persiste templateVersion ; contrat dérivable du catalogue (snapshot reconstructible)", async () => {
    const fp = fingerprintFor();
    const r = await reserveRappelDetteEnvoi({
      actor: ACTOR_ADMIN,
      adherentId: ADH,
      clientConfirmationId: KEY,
      expectedFingerprint: fp,
      templateVersion: TEMPLATE,
      getNow: () => T0,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.templateDetailLinkContract).toBe(
        RAPPEL_DETTE_TEMPLATE_DETAIL_LINK_CONTRACT
      );
    }
    expect(createEnvoi).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          templateVersion: TEMPLATE,
          payloadFingerprint: fp,
        }),
      })
    );
    // Pas de colonne libre : le contrat n’est pas écrit comme champ arbitraire.
    const createdData = createEnvoi.mock.calls[0]![0].data as Record<
      string,
      unknown
    >;
    expect(createdData).not.toHaveProperty("templateDetailLinkContract");
  });

  it("version template hors catalogue refusée avant transaction", async () => {
    const r = await reserveRappelDetteEnvoi({
      actor: ACTOR_ADMIN,
      adherentId: ADH,
      clientConfirmationId: KEY,
      expectedFingerprint: fingerprintFor(),
      templateVersion: "template-inconnu-xyz",
      getNow: () => T0,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("VALIDATION_ERROR");
    expect($transaction).not.toHaveBeenCalled();
  });

  it("snapshot inchangé → Calling avec une seule autorisation", async () => {
    findUniqueEnvoi.mockImplementation(async () => reservedRow());
    const r = await authorizeRappelDetteCalling({
      actor: ACTOR_ADMIN,
      envoiId: "envoi-1",
      adherentId: ADH,
      getNow: () => T0,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.outcome).toBe("authorized");
      expect(r.providerCallAuthorized).toBe(true);
    }
    expect(updateManyEnvoi).toHaveBeenCalled();
    expect(computeDetteRappelable).toHaveBeenCalledWith(
      ADH,
      expect.objectContaining({ prisma: expect.anything(), now: T0 })
    );
  });

  it("réservation puis paiement (inéligible) → Calling refusé, Reserved conservé", async () => {
    findUniqueEnvoi.mockImplementation(async () => reservedRow());
    computeDetteRappelable.mockImplementation(async () =>
      eligibleCompute({
        eligible: false,
        detteNette: new Prisma.Decimal("0"),
        globalReasons: ["COVERED_BY_AVOIR"],
      })
    );
    const r = await authorizeRappelDetteCalling({
      actor: ACTOR_ADMIN,
      envoiId: "envoi-1",
      adherentId: ADH,
      getNow: () => T0,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe("NOT_ELIGIBLE");
      expect(r.reservedFate).toBe(RAPPEL_DETTE_RESERVED_ON_PRECALLING_REFUSAL);
    }
    expect(updateManyEnvoi).not.toHaveBeenCalled();
  });

  it("réservation puis changement destinataire → REQUIRES_RECONFIRM", async () => {
    findUniqueEnvoi.mockImplementation(async () => reservedRow());
    findUniqueAdherent.mockImplementation(async () => ({
      id: ADH,
      userId: "user-recipient",
      User: {
        id: "user-recipient",
        email: "nouvelle@adresse.fr",
        status: "Actif",
      },
    }));
    const r = await authorizeRappelDetteCalling({
      actor: ACTOR_ADMIN,
      envoiId: "envoi-1",
      adherentId: ADH,
      getNow: () => T0,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe("REQUIRES_RECONFIRM");
      expect(r.reservedFate).toBe(RAPPEL_DETTE_RESERVED_ON_PRECALLING_REFUSAL);
    }
    expect(updateManyEnvoi).not.toHaveBeenCalled();
  });

  it("gel serveur apparu → Calling refusé", async () => {
    findUniqueEnvoi.mockImplementation(async () => reservedRow());
    computeDetteRappelable.mockImplementation(async (_id, opts) => {
      if (opts?.frozenAdherent === true) {
        return eligibleCompute({
          eligible: false,
          globalReasons: ["FROZEN_CONTESTED"],
        });
      }
      return eligibleCompute();
    });
    const r = await authorizeRappelDetteCalling({
      actor: ACTOR_ADMIN,
      envoiId: "envoi-1",
      adherentId: ADH,
      getNow: () => T0,
      frozenAdherent: true,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe("NOT_ELIGIBLE");
      expect(r.reservedFate).toBe(RAPPEL_DETTE_RESERVED_ON_PRECALLING_REFUSAL);
    }
    expect(updateManyEnvoi).not.toHaveBeenCalled();
  });

  it("erreur au recalcul pré-Calling → aucune autorisation ni fallback", async () => {
    findUniqueEnvoi.mockImplementation(async () => reservedRow());
    computeDetteRappelable.mockImplementation(async () =>
      eligibleCompute({
        eligible: false,
        globalReasons: ["PRISMA_ERROR"],
      })
    );
    const r = await authorizeRappelDetteCalling({
      actor: ACTOR_ADMIN,
      envoiId: "envoi-1",
      adherentId: ADH,
      getNow: () => T0,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe("COMPUTE_ERROR");
      expect(r.reservedFate).toBe(RAPPEL_DETTE_RESERVED_ON_PRECALLING_REFUSAL);
    }
    expect(updateManyEnvoi).not.toHaveBeenCalled();
  });

  it("répétition Calling → already_started sans seconde autorisation", async () => {
    findUniqueEnvoi.mockImplementation(async () =>
      reservedRow({
        reservationStatus: "Calling",
        callingAt: T0,
      })
    );
    const r = await authorizeRappelDetteCalling({
      actor: ACTOR_ADMIN,
      envoiId: "envoi-1",
      adherentId: ADH,
      getNow: () => T0,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.outcome).toBe("already_started");
      expect(r.providerCallAuthorized).toBe(false);
    }
    expect(updateManyEnvoi).not.toHaveBeenCalled();
    expect(computeDetteRappelable).not.toHaveBeenCalled();
  });

  it("Calling refusé si Reserved expiré", async () => {
    findUniqueEnvoi.mockImplementation(async () =>
      reservedRow({ lockExpiresAt: new Date(T0.getTime() - 1) })
    );
    const r = await authorizeRappelDetteCalling({
      actor: ACTOR_ADMIN,
      envoiId: "envoi-1",
      adherentId: ADH,
      getNow: () => T0,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("EXPIRED");
    expect(updateManyEnvoi).not.toHaveBeenCalled();
  });

  it("Completed/Failed/Abandoned/Unknown : aucun nouveau Calling", async () => {
    for (const status of [
      "Completed",
      "Failed",
      "Abandoned",
      "Unknown",
    ] as const) {
      findUniqueEnvoi.mockImplementation(async () =>
        reservedRow({
          reservationStatus: status,
          callingAt: status === "Abandoned" ? null : T0,
        })
      );
      updateManyEnvoi.mockClear();
      computeDetteRappelable.mockClear();
      const r = await authorizeRappelDetteCalling({
        actor: ACTOR_ADMIN,
        envoiId: "envoi-1",
        adherentId: ADH,
        getNow: () => T0,
      });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.code).toBe("CONFLICT");
      expect(updateManyEnvoi).not.toHaveBeenCalled();
      expect(computeDetteRappelable).not.toHaveBeenCalled();
    }
  });
});

describe("catalogue template (propriétés propres uniquement)", () => {
  it("résout la version catalogue et refuse constructor/toString/__proto__", () => {
    expect(Object.isFrozen(RAPPEL_DETTE_TEMPLATE_REGISTRY)).toBe(true);
    expect(resolveTemplateDetailLinkContract(TEMPLATE)).toBe(
      RAPPEL_DETTE_TEMPLATE_DETAIL_LINK_CONTRACT
    );
    expect(resolveTemplateDetailLinkContract("email-rappel-dette-v2")).toBe(
      "rappel-dette.detail-link.v2.web-profile-cotisations"
    );
    expect(RAPPEL_DETTE_TEMPLATE_REGISTRY["email-rappel-dette-v1"]).toBe(
      "rappel-dette.detail-link.v1.pending-integration"
    );
    for (const inherited of ["constructor", "toString", "__proto__"]) {
      expect(resolveTemplateDetailLinkContract(inherited)).toBeNull();
    }
    expect(resolveTemplateDetailLinkContract("")).toBeNull();
  });
});

describe("absence d’imports canaux externes (garantie explicite)", () => {
  it("les sources réservation/empreinte/verrou n’importent pas mail/notif/push", () => {
    const root = path.join(
      process.cwd(),
      "lib/services/cotisations/rappel-dette"
    );
    const files = [
      "rappel-dette-reservation.ts",
      "payload-fingerprint.ts",
      "adherent-lock.ts",
    ];
    const forbidden = [
      /from\s+["']@\/lib\/mail/,
      /from\s+["']@\/lib\/services\/push/,
      /from\s+["'].*createNotification/,
      /from\s+["'].*sendEmail/,
      /from\s+["'].*pushAfterInternalNotification/,
      /require\(["'][^"']*mail/,
    ];
    for (const file of files) {
      const src = readFileSync(path.join(root, file), "utf8");
      for (const re of forbidden) {
        expect(src, `${file} ne doit pas matcher ${re}`).not.toMatch(re);
      }
    }
    // Garantie : absence d’import statique vers les modules d’envoi/notif/push
    // dans ces trois fichiers. Ne prouve pas l’absence d’appels dynamiques futurs.
  });
});
