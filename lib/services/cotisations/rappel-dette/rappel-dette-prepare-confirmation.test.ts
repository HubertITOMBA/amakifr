import { describe, expect, it, vi } from "vitest";
import { Prisma, UserRole } from "@prisma/client";
import { prepareRappelDetteConfirmation } from "@/lib/services/cotisations/rappel-dette/rappel-dette-prepare-confirmation";
import { RAPPEL_DETTE_ORCHESTRATE_TEMPLATE_V2 } from "@/lib/services/cotisations/rappel-dette/rappel-dette-orchestrate-send";
import { verifyRappelDetteConfirmationToken } from "@/lib/services/cotisations/rappel-dette/rappel-dette-confirmation-token";

const SECRET = "prepare-test-secret";
const NOW = new Date("2026-10-30T12:00:00.000Z");

function eligibleCompute() {
  return {
    eligible: true,
    adherentId: "adh-1",
    montantBrut: new Prisma.Decimal("100.00"),
    avoirDisponible: new Prisma.Decimal("0.00"),
    detteNette: new Prisma.Decimal("100.00"),
    retainedLines: [
      {
        source: "CotisationMensuelle" as const,
        id: "cm-1",
        montantRestant: new Prisma.Decimal("100.00"),
        dueDate: new Date("2026-01-01T00:00:00.000Z"),
        daysPastDue: 30,
      },
    ],
    ignoredLines: [],
    earliestDueDate: new Date("2026-01-01T00:00:00.000Z"),
    nextEligibleReminderAt: null,
    lastReminderSentAt: null,
    globalReasons: [] as never[],
  };
}

describe("prepareRappelDetteConfirmation", () => {
  it("flag off → refus avant lecture métier", async () => {
    const loadRecipient = vi.fn();
    const compute = vi.fn();
    const r = await prepareRappelDetteConfirmation({
      actor: { userId: "a1", role: UserRole.ADMIN },
      adherentId: "adh-1",
      getNow: () => NOW,
      deps: {
        isEnvoiEnabled: () => false,
        loadRecipient,
        compute,
        hmacSecret: SECRET,
      },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("ENVOI_DISABLED");
    expect(loadRecipient).not.toHaveBeenCalled();
    expect(compute).not.toHaveBeenCalled();
  });

  it("refuse TRESOR avant métier", async () => {
    const loadRecipient = vi.fn();
    const r = await prepareRappelDetteConfirmation({
      actor: { userId: "t1", role: UserRole.TRESOR },
      adherentId: "adh-1",
      deps: {
        isEnvoiEnabled: () => true,
        loadRecipient,
        hmacSecret: SECRET,
      },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("FORBIDDEN");
    expect(loadRecipient).not.toHaveBeenCalled();
  });

  it("prépare sans mutation : token + masque + nette (0 reserve)", async () => {
    const r = await prepareRappelDetteConfirmation({
      actor: { userId: "admin-1", role: UserRole.ADMIN },
      adherentId: "adh-1",
      getNow: () => NOW,
      deps: {
        isEnvoiEnabled: () => true,
        hmacSecret: SECRET,
        randomConfirmationId: () => "22222222-2222-4222-8222-222222222222",
        loadRecipient: async () => ({
          ok: true as const,
          recipientUserId: "u-1",
          recipientEmail: "jean.dupont@example.test",
        }),
        resolveGels: async () => ({
          ok: true as const,
          gelsRevision: BigInt(0),
          gelsRevisionDecimal: "0",
          frozenAdherent: false,
          frozenLineKeys: new Set<string>(),
        }),
        compute: async () => eligibleCompute(),
      },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.detteNette).toBe("100.00");
    expect(r.gelsRevision).toBe("0");
    expect(r.recipientMasked).toBe("j***@example.test");
    expect(r.templateVersion).toBe(RAPPEL_DETTE_ORCHESTRATE_TEMPLATE_V2);
    expect(r.confirmationToken).toMatch(/^rdc1\./);
    expect(r.claims.v).toBe(2);
    expect(r.claims.gelsRevision).toBe("0");
    expect(JSON.stringify(r)).not.toMatch(/jean\.dupont@example\.test/);
    expect(r.claims).not.toHaveProperty("email");
    expect(r.claims).not.toHaveProperty("recipientEmail");
    expect(JSON.stringify(r.claims)).not.toMatch(/@example\.|jean\.dupont/i);

    const v = verifyRappelDetteConfirmationToken({
      token: r.confirmationToken,
      actorUserId: "admin-1",
      now: NOW,
      secret: SECRET,
    });
    expect(v.ok).toBe(true);
  });

  it("source gels KO → GEL_SOURCE_UNAVAILABLE fail-closed", async () => {
    const compute = vi.fn();
    const r = await prepareRappelDetteConfirmation({
      actor: { userId: "admin-1", role: UserRole.ADMIN },
      adherentId: "adh-1",
      getNow: () => NOW,
      deps: {
        isEnvoiEnabled: () => true,
        hmacSecret: SECRET,
        loadRecipient: async () => ({
          ok: true as const,
          recipientUserId: "u-1",
          recipientEmail: "x@y.z",
        }),
        resolveGels: async () => ({
          ok: false as const,
          code: "GEL_SOURCE_UNAVAILABLE" as const,
          message: "Source des gels indisponible",
        }),
        compute,
      },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("GEL_SOURCE_UNAVAILABLE");
    expect(compute).not.toHaveBeenCalled();
  });

  it("non éligible → NOT_ELIGIBLE sans token", async () => {
    const r = await prepareRappelDetteConfirmation({
      actor: { userId: "admin-1", role: UserRole.PRESID },
      adherentId: "adh-1",
      getNow: () => NOW,
      deps: {
        isEnvoiEnabled: () => true,
        hmacSecret: SECRET,
        loadRecipient: async () => ({
          ok: true as const,
          recipientUserId: "u-1",
          recipientEmail: "x@y.z",
        }),
        resolveGels: async () => ({
          ok: true as const,
          gelsRevision: BigInt(0),
          gelsRevisionDecimal: "0",
          frozenAdherent: false,
          frozenLineKeys: new Set<string>(),
        }),
        compute: async () => ({
          ...eligibleCompute(),
          eligible: false,
          detteNette: new Prisma.Decimal("0"),
          retainedLines: [],
          globalReasons: ["NO_RETAINED_LINES"] as never[],
        }),
      },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("NOT_ELIGIBLE");
  });

  it("secret manquant → refus borné", async () => {
    const r = await prepareRappelDetteConfirmation({
      actor: { userId: "admin-1", role: UserRole.ADMIN },
      adherentId: "adh-1",
      getNow: () => NOW,
      deps: {
        isEnvoiEnabled: () => true,
        hmacSecret: null,
        loadRecipient: async () => ({
          ok: true as const,
          recipientUserId: "u-1",
          recipientEmail: "a@b.c",
        }),
        resolveGels: async () => ({
          ok: true as const,
          gelsRevision: BigInt(0),
          gelsRevisionDecimal: "0",
          frozenAdherent: false,
          frozenLineKeys: new Set<string>(),
        }),
        compute: async () => eligibleCompute(),
      },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("CONFIRMATION_SECRET_MISSING");
  });
});
