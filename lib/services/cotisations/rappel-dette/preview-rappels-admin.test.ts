import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma, UserRole } from "@prisma/client";
import { ServiceError } from "@/lib/service-error";
import { parisCivilDate } from "@/lib/services/cotisations/rappel-dette/paris-calendar";

const {
  findManyAdherent,
  computeDetteRappelable,
  createRelance,
  createNotification,
  createEmail,
  updateRelance,
  sendEmail,
  sendPushToUser,
} = vi.hoisted(() => ({
  findManyAdherent: vi.fn(),
  computeDetteRappelable: vi.fn(),
  createRelance: vi.fn(),
  createNotification: vi.fn(),
  createEmail: vi.fn(),
  updateRelance: vi.fn(),
  sendEmail: vi.fn(),
  sendPushToUser: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    adherent: { findMany: findManyAdherent },
    relanceCotisationMensuelle: {
      create: createRelance,
      update: updateRelance,
    },
    notification: { create: createNotification },
    email: { create: createEmail },
  },
}));

vi.mock("@/lib/services/cotisations/rappel-dette/compute-dette-rappelable", () => ({
  computeDetteRappelable,
}));

vi.mock("@/lib/mail", () => ({
  sendEmail,
  sendCustomEmailToUsers: vi.fn(),
  sendRappelDetailleCotisationEmail: vi.fn(),
}));

vi.mock("@/lib/services/push/send-push", () => ({
  sendPushToUser,
  sendPushToUsers: vi.fn(),
}));

import {
  PREVIEW_INCOMPLETE_ALERT,
  PREVIEW_RAPPELS_BANNER,
  previewRappelsDetteAdmin,
} from "@/lib/services/cotisations/rappel-dette/preview-rappels-admin";
import {
  buildHomonymFicheReferences,
  formatPreviewAmountDisplay,
  formatPreviewComputedAt,
  formatPreviewDueDisplay,
  formatPreviewEuroAmount,
  HOMONYM_DISPLAY_NOTICE,
  PREVIEW_REFRESH_INCOMPLETE_TOAST,
  PREVIEW_REFRESH_SUCCESS_TOAST,
} from "@/lib/services/cotisations/rappel-dette/preview-display";
import { labelGlobalReason } from "@/lib/services/cotisations/rappel-dette/reason-labels";

function adminActor() {
  return { userId: "admin-1", role: UserRole.ADMIN };
}

function baseResult(
  overrides: Partial<{
    eligible: boolean;
    adherentId: string;
    montantBrut: Prisma.Decimal;
    avoirDisponible: Prisma.Decimal;
    detteNette: Prisma.Decimal;
    globalReasons: string[];
    ignoredReasons: string[];
  }> = {}
) {
  const ignoredReasons = overrides.ignoredReasons ?? [];
  return {
    eligible: overrides.eligible ?? false,
    adherentId: overrides.adherentId ?? "adh-1",
    montantBrut: overrides.montantBrut ?? new Prisma.Decimal("0"),
    avoirDisponible: overrides.avoirDisponible ?? new Prisma.Decimal("0"),
    detteNette: overrides.detteNette ?? new Prisma.Decimal("0"),
    retainedLines:
      overrides.eligible === true
        ? [
            {
              source: "cotisation_mensuelle" as const,
              id: "cm-1",
              montantRestant: overrides.montantBrut ?? new Prisma.Decimal("15"),
              dueDate: parisCivilDate(2024, 5, 1),
              daysPastDue: 20,
            },
          ]
        : [],
    ignoredLines: ignoredReasons.map((reason) => ({
      source: "cotisation_mensuelle" as const,
      id: "cm-x",
      montantRestant: new Prisma.Decimal("5"),
      dueDate: parisCivilDate(2024, 6, 20),
      reason: reason as "NOT_YET_DUE_J15",
    })),
    earliestDueDate: overrides.eligible ? parisCivilDate(2024, 5, 1) : null,
    nextEligibleReminderAt: null,
    lastReminderSentAt: null,
    globalReasons: overrides.globalReasons ?? ["NO_RETAINED_LINES"],
  };
}

describe("previewRappelsDetteAdmin", () => {
  beforeEach(() => {
    findManyAdherent.mockReset();
    computeDetteRappelable.mockReset();
    createRelance.mockReset();
    createNotification.mockReset();
    createEmail.mockReset();
    updateRelance.mockReset();
    sendEmail.mockReset();
    sendPushToUser.mockReset();
  });

  it("refuse un acteur non authentifié avant toute lecture", async () => {
    await expect(
      previewRappelsDetteAdmin({ userId: "", role: UserRole.ADMIN })
    ).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    expect(findManyAdherent).not.toHaveBeenCalled();
    expect(computeDetteRappelable).not.toHaveBeenCalled();
  });

  it("refuse tous les rôles hors ADMIN/PRESID avant toute lecture", async () => {
    const denied = [
      UserRole.MEMBRE,
      UserRole.INVITE,
      UserRole.VICEPR,
      UserRole.SECRET,
      UserRole.VICESE,
      UserRole.COMCPT,
      UserRole.TRESOR,
      UserRole.VTRESO,
    ] as const;

    for (const role of denied) {
      findManyAdherent.mockClear();
      computeDetteRappelable.mockClear();
      await expect(
        previewRappelsDetteAdmin({ userId: "u1", role })
      ).rejects.toMatchObject({
        code: "FORBIDDEN",
        message: "Accès réservé aux administrateurs et au président.",
      });
      expect(findManyAdherent).not.toHaveBeenCalled();
      expect(computeDetteRappelable).not.toHaveBeenCalled();
    }
  });

  it("accepte PRESID et lit les adhérents (même chemin qu’ADMIN)", async () => {
    findManyAdherent.mockResolvedValue([]);
    const preview = await previewRappelsDetteAdmin({
      userId: "pres-1",
      role: UserRole.PRESID,
    });
    expect(preview.mode).toBe("dry-run");
    expect(preview.banner).toBe(PREVIEW_RAPPELS_BANNER);
    expect(findManyAdherent).toHaveBeenCalledTimes(1);
    expect(computeDetteRappelable).not.toHaveBeenCalled();
    expect(createRelance).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("éligible avec lignes ignorées : motifs globaux et lignes séparés + labels FR", async () => {
    const now = parisCivilDate(2024, 6, 30);
    findManyAdherent.mockResolvedValue([
      { id: "adh-a", firstname: "Ada", lastname: "Lovelace" },
    ]);
    computeDetteRappelable.mockResolvedValue(
      baseResult({
        eligible: true,
        adherentId: "adh-a",
        montantBrut: new Prisma.Decimal("40"),
        avoirDisponible: new Prisma.Decimal("10"),
        detteNette: new Prisma.Decimal("30"),
        globalReasons: ["ELIGIBLE"],
        ignoredReasons: ["NOT_YET_DUE_J15", "PENDING_PAYMENT"],
      })
    );

    const preview = await previewRappelsDetteAdmin(adminActor(), { now });

    expect(preview.eligible).toHaveLength(1);
    expect(preview.excluded).toHaveLength(0);
    expect(preview.failed).toHaveLength(0);
    const row = preview.eligible[0]!;
    expect(row.globalReasons).toEqual(["ELIGIBLE"]);
    expect(row.ignoredReasons).toEqual(["NOT_YET_DUE_J15", "PENDING_PAYMENT"]);
    expect(row.globalReasonLabels[0]?.label).toBe("Éligible au rappel");
    expect(row.ignoredReasonLabels.map((l) => l.label)).toEqual([
      "Échéance non atteinte (avant J+15)",
      "Paiement en cours ou justificatif en attente",
    ]);
    // Un motif de ligne n’est pas présenté comme motif global
    expect(row.globalReasons).not.toContain("NOT_YET_DUE_J15");
    expect(preview.totals.montantBrutEligibleTotal).toBe("40");
    expect(preview.totals.detteNetteEligibleTotal).toBe("30");
    expect(preview.incomplete).toBe(false);
  });

  it("PRISMA_ERROR → failed (pas exclusion métier) et totaux partiels", async () => {
    findManyAdherent.mockResolvedValue([
      { id: "adh-ok", firstname: "Ada", lastname: "Lovelace" },
      { id: "adh-err", firstname: "Bob", lastname: "Martin" },
    ]);
    computeDetteRappelable
      .mockResolvedValueOnce(
        baseResult({
          eligible: true,
          adherentId: "adh-ok",
          montantBrut: new Prisma.Decimal("15"),
          detteNette: new Prisma.Decimal("15"),
          globalReasons: ["ELIGIBLE"],
        })
      )
      .mockResolvedValueOnce(
        baseResult({
          eligible: false,
          adherentId: "adh-err",
          globalReasons: ["PRISMA_ERROR"],
        })
      );

    const preview = await previewRappelsDetteAdmin(adminActor(), {
      now: parisCivilDate(2024, 6, 30),
    });

    expect(preview.eligible).toHaveLength(1);
    expect(preview.excluded).toHaveLength(0);
    expect(preview.failed).toHaveLength(1);
    expect(preview.failed[0]?.adherentId).toBe("adh-err");
    expect(preview.failed[0]?.computationKind).toBe("failed");
    expect(preview.incomplete).toBe(true);
    expect(preview.incompleteAlert).toBe(PREVIEW_INCOMPLETE_ALERT);
    expect(preview.totals.totalsPartial).toBe(true);
    expect(preview.totals.failedCount).toBe(1);
    expect(preview.totals.detteNetteEligibleTotal).toBe("15");
    expect(preview.banner).toBe(PREVIEW_RAPPELS_BANNER);
  });

  it("throw de compute → failed technique générique", async () => {
    findManyAdherent.mockResolvedValue([
      { id: "adh-1", firstname: "Camille", lastname: "Dupont" },
    ]);
    computeDetteRappelable.mockRejectedValue(new Error("boom"));

    const preview = await previewRappelsDetteAdmin(adminActor());
    expect(preview.failed).toHaveLength(1);
    expect(preview.failed[0]?.globalReasons).toEqual(["PRISMA_ERROR"]);
    expect(preview.incomplete).toBe(true);
  });

  it("échec scan global → ServiceError INTERNAL sans totaux trompeurs", async () => {
    findManyAdherent.mockRejectedValue(new Error("db down"));
    await expect(previewRappelsDetteAdmin(adminActor())).rejects.toBeInstanceOf(
      ServiceError
    );
    await expect(previewRappelsDetteAdmin(adminActor())).rejects.toMatchObject({
      code: "INTERNAL_ERROR",
    });
  });

  it("n’écrit aucune donnée et n’appelle aucun service d’envoi", async () => {
    findManyAdherent.mockResolvedValue([
      { id: "adh-1", firstname: "Ada", lastname: "Lovelace" },
    ]);
    computeDetteRappelable.mockResolvedValue(
      baseResult({
        eligible: true,
        montantBrut: new Prisma.Decimal("15"),
        detteNette: new Prisma.Decimal("15"),
        globalReasons: ["ELIGIBLE"],
      })
    );

    await previewRappelsDetteAdmin(adminActor());

    expect(createRelance).not.toHaveBeenCalled();
    expect(updateRelance).not.toHaveBeenCalled();
    expect(createNotification).not.toHaveBeenCalled();
    expect(createEmail).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
    expect(sendPushToUser).not.toHaveBeenCalled();
  });

  it("scénario combiné : 2 éligibles décimaux + exclu métier + échec, now partagé, { now } seul", async () => {
    const now = parisCivilDate(2024, 6, 30);
    findManyAdherent.mockResolvedValue([
      { id: "adh-e1", firstname: "Ada", lastname: "Eligible" },
      { id: "adh-e2", firstname: "Bob", lastname: "Eligible" },
      { id: "adh-x", firstname: "Cara", lastname: "Exclue" },
      { id: "adh-f", firstname: "Dan", lastname: "Failed" },
    ]);
    computeDetteRappelable
      .mockResolvedValueOnce(
        baseResult({
          eligible: true,
          adherentId: "adh-e1",
          montantBrut: new Prisma.Decimal("12.50"),
          avoirDisponible: new Prisma.Decimal("2.25"),
          detteNette: new Prisma.Decimal("10.25"),
          globalReasons: ["ELIGIBLE"],
        })
      )
      .mockResolvedValueOnce(
        baseResult({
          eligible: true,
          adherentId: "adh-e2",
          montantBrut: new Prisma.Decimal("7.35"),
          avoirDisponible: new Prisma.Decimal("0"),
          detteNette: new Prisma.Decimal("7.35"),
          globalReasons: ["ELIGIBLE"],
        })
      )
      .mockResolvedValueOnce(
        baseResult({
          eligible: false,
          adherentId: "adh-x",
          montantBrut: new Prisma.Decimal("0"),
          detteNette: new Prisma.Decimal("0"),
          globalReasons: ["COVERED_BY_AVOIR"],
        })
      )
      .mockResolvedValueOnce(
        baseResult({
          eligible: false,
          adherentId: "adh-f",
          montantBrut: new Prisma.Decimal("0"),
          detteNette: new Prisma.Decimal("0"),
          globalReasons: ["PRISMA_ERROR"],
        })
      );

    const preview = await previewRappelsDetteAdmin(adminActor(), { now });

    expect(preview.eligible).toHaveLength(2);
    expect(preview.excluded).toHaveLength(1);
    expect(preview.failed).toHaveLength(1);
    expect(preview.totals.eligibleCount).toBe(2);
    expect(preview.totals.excludedCount).toBe(1);
    expect(preview.totals.failedCount).toBe(1);
    expect(preview.totals.adherentsScanned).toBe(
      preview.totals.eligibleCount +
        preview.totals.excludedCount +
        preview.totals.failedCount
    );
    expect(preview.totals.adherentsScanned).toBe(4);
    // Sommes exactes des seuls éligibles (pas l’exclu ni l’échec)
    expect(preview.totals.montantBrutEligibleTotal).toBe("19.85");
    // Decimal.toString() : 10.25 + 7.35 → "17.6" (pas "17.60")
    expect(preview.totals.detteNetteEligibleTotal).toBe("17.6");
    expect(preview.incomplete).toBe(true);
    expect(preview.totals.totalsPartial).toBe(true);

    expect(computeDetteRappelable).toHaveBeenCalledTimes(4);
    for (const call of computeDetteRappelable.mock.calls) {
      expect(call[1]).toEqual({ now });
      expect(call[1]).not.toHaveProperty("frozenAdherent");
      expect(call[1]).not.toHaveProperty("frozenLineKeys");
      expect(Object.keys(call[1] as object).sort()).toEqual(["now"]);
    }
    expect(computeDetteRappelable.mock.calls[0]![1].now).toBe(now);
    expect(computeDetteRappelable.mock.calls[1]![1].now).toBe(now);
    expect(computeDetteRappelable.mock.calls[2]![1].now).toBe(now);
    expect(computeDetteRappelable.mock.calls[3]![1].now).toBe(now);

    // Rendu « Non calculé » pour l’échec (DTO conserve les 0 de repli)
    const failed = preview.failed[0]!;
    expect(failed.computationKind).toBe("failed");
    expect(failed.montantBrut).toBe("0");
    expect(formatPreviewAmountDisplay(failed.montantBrut, failed.computationKind)).toBe(
      "Non calculé"
    );
    expect(
      formatPreviewAmountDisplay(failed.avoirDisponible, failed.computationKind)
    ).toBe("Non calculé");
    expect(
      formatPreviewAmountDisplay(failed.detteNette, failed.computationKind)
    ).toBe("Non calculé");
    expect(
      formatPreviewDueDisplay(
        failed.earliestDueDate ?? "—",
        failed.computationKind
      )
    ).toBe("Non calculé");
  });
});

describe("formatPreviewEuroAmount / formatPreviewAmountDisplay", () => {
  const NBSP = "\u00a0";
  const THIN = "\u202f";

  it("formate avec attentes explicites (FR, 2 décimales, espaces insécables)", () => {
    expect(formatPreviewEuroAmount("240")).toBe(`240,00${NBSP}€`);
    expect(formatPreviewEuroAmount("0")).toBe(`0,00${NBSP}€`);
    expect(formatPreviewEuroAmount("17.6")).toBe(`17,60${NBSP}€`);
    expect(formatPreviewEuroAmount("7635")).toBe(`7${THIN}635,00${NBSP}€`);
    // Arrondi half-up
    expect(formatPreviewEuroAmount("1.995")).toBe(`2,00${NBSP}€`);
    // Au-delà de Number.MAX_SAFE_INTEGER (9007199254740991) — format exact par chaînes
    expect(formatPreviewEuroAmount("9007199254740993")).toBe(
      `9${THIN}007${THIN}199${THIN}254${THIN}740${THIN}993,00${NBSP}€`
    );
    expect(formatPreviewEuroAmount("not-a-number")).toBe("Non calculé");
    expect(formatPreviewEuroAmount("")).toBe("Non calculé");
  });

  it("affiche Non calculé pour failed et le format EUR pour eligible/excluded", () => {
    expect(formatPreviewAmountDisplay("0", "failed")).toBe("Non calculé");
    expect(formatPreviewAmountDisplay("12.50", "failed")).toBe("Non calculé");
    expect(formatPreviewAmountDisplay("240", "eligible")).toBe(
      `240,00${NBSP}€`
    );
    expect(formatPreviewAmountDisplay("0", "eligible")).toBe(`0,00${NBSP}€`);
    expect(formatPreviewAmountDisplay("70", "excluded")).toBe(`70,00${NBSP}€`);
    expect(formatPreviewDueDisplay("—", "failed")).toBe("Non calculé");
    expect(formatPreviewDueDisplay("01 juin 2024", "eligible")).toBe(
      "01 juin 2024"
    );
  });
});

describe("formatPreviewComputedAt", () => {
  it("affiche date, heure, minutes et secondes en Europe/Paris depuis l’ISO serveur", () => {
    // 2024-06-30T12:00:00.000Z = 14:00:00 Europe/Paris (été)
    const formatted = formatPreviewComputedAt("2024-06-30T12:00:00.000Z");
    expect(formatted).toMatch(/30/);
    expect(formatted).toMatch(/2024/);
    expect(formatted).toMatch(/14/);
    expect(formatted).toMatch(/00/);
    // Contient des secondes (deux derniers groupes numériques type :ss)
    expect(formatted).toMatch(/\d{2}:\d{2}:\d{2}/);
  });

  it("retourne — pour null ou invalide", () => {
    expect(formatPreviewComputedAt(null)).toBe("—");
    expect(formatPreviewComputedAt("not-a-date")).toBe("—");
  });

  it("expose les libellés toast Actualiser", () => {
    expect(PREVIEW_REFRESH_SUCCESS_TOAST).toBe("Prévisualisation actualisée.");
    expect(PREVIEW_REFRESH_INCOMPLETE_TOAST).toBe(
      "Prévisualisation actualisée, mais certains calculs n’ont pas abouti."
    );
  });
});

describe("buildHomonymFicheReferences", () => {
  it("attribue des Fiche N distinctes aux homonymes répartis eligible/excluded", () => {
    const refs = buildHomonymFicheReferences([
      { adherentId: "id-b", displayName: "Ada Lovelace" },
      { adherentId: "id-unique", displayName: "Seul Unique" },
      { adherentId: "id-a", displayName: "Ada Lovelace" },
    ]);
    expect(refs.get("id-unique")).toBeUndefined();
    expect(refs.has("id-unique")).toBe(false);
    // Tri déterministe des adherentId : id-a avant id-b
    expect(refs.get("id-a")).toBe("Fiche 1");
    expect(refs.get("id-b")).toBe("Fiche 2");
    expect(refs.get("id-a")).not.toBe(refs.get("id-b"));
    expect(HOMONYM_DISPLAY_NOTICE).toBe("Plusieurs fiches portent ce nom.");
  });

  it("n’ajoute aucune référence pour un nom unique", () => {
    const refs = buildHomonymFicheReferences([
      { adherentId: "only-1", displayName: "Camille Dupont" },
    ]);
    expect(refs.size).toBe(0);
  });
});

describe("labelGlobalReason", () => {
  it("conserve un code inconnu avec libellé de repli", () => {
    expect(labelGlobalReason("FOO_BAR")).toEqual({
      code: "FOO_BAR",
      label: "Motif inconnu (FOO_BAR)",
    });
  });
});
