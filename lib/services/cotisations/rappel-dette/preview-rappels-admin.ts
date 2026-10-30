import { Prisma } from "@prisma/client";
import type { AuthContext } from "@/lib/auth-context";
import { db } from "@/lib/db";
import { ServiceError } from "@/lib/service-error";
import { decimalToMoneyString } from "@/lib/services/cotisations/decimal-to-money-string";
import { computeDetteRappelable } from "@/lib/services/cotisations/rappel-dette/compute-dette-rappelable";
import {
  canAccessPreviewRappelsDette,
  PREVIEW_RAPPELS_ACCESS_DENIED_MESSAGE,
} from "@/lib/services/cotisations/rappel-dette/preview-access";
import {
  isTechnicalComputationFailure,
  labelGlobalReason,
  labelLineIgnoreReason,
  type LabeledReason,
} from "@/lib/services/cotisations/rappel-dette/reason-labels";
import {
  resolveRappelDetteGels,
} from "@/lib/services/cotisations/rappel-dette/rappel-dette-gel-resolve";
import {
  RAPPEL_DETTE_TIMEZONE,
  type ComputeDetteRappelableResult,
  type RappelGlobalReason,
  type RappelLineIgnoreReason,
} from "@/lib/services/cotisations/rappel-dette/types";

const ZERO = new Prisma.Decimal(0);

export const PREVIEW_RAPPELS_BANNER =
  "Prévisualisation — aucun envoi" as const;

export const PREVIEW_INCOMPLETE_ALERT =
  "Prévisualisation incomplète" as const;

export type PreviewComputationKind = "eligible" | "excluded" | "failed";

export type PreviewRappelAdherentRow = {
  adherentId: string;
  displayName: string;
  eligible: boolean;
  /** Classification : éligible métier, exclusion métier, ou échec technique. */
  computationKind: PreviewComputationKind;
  montantBrut: string;
  avoirDisponible: string;
  detteNette: string;
  /** Codes bruts (contrat Lot 1). */
  globalReasons: RappelGlobalReason[];
  ignoredReasons: RappelLineIgnoreReason[];
  /** Libellés FR des motifs globaux (adhérent). */
  globalReasonLabels: LabeledReason[];
  /** Libellés FR des motifs de lignes ignorées (pas une exclusion globale). */
  ignoredReasonLabels: LabeledReason[];
  retainedLineCount: number;
  earliestDueDate: string | null;
  nextEligibleReminderAt: string | null;
  lastReminderSentAt: string | null;
};

export type PreviewRappelsDetteResult = {
  mode: "dry-run";
  banner: typeof PREVIEW_RAPPELS_BANNER;
  /** Instant de référence du calcul (ISO). */
  computedAt: string;
  timezone: typeof RAPPEL_DETTE_TIMEZONE;
  /** True si au moins un calcul adhérent a échoué techniquement. */
  incomplete: boolean;
  incompleteAlert: typeof PREVIEW_INCOMPLETE_ALERT | null;
  totals: {
    adherentsScanned: number;
    eligibleCount: number;
    excludedCount: number;
    failedCount: number;
    /** Totaux éligibles partiels si incomplete. */
    totalsPartial: boolean;
    montantBrutEligibleTotal: string;
    detteNetteEligibleTotal: string;
  };
  eligible: PreviewRappelAdherentRow[];
  /** Exclusions métier uniquement (pas les échecs techniques). */
  excluded: PreviewRappelAdherentRow[];
  /** Calculs n’ayant pas abouti (ex. PRISMA_ERROR). */
  failed: PreviewRappelAdherentRow[];
};

export type PreviewRappelsDetteAdminOptions = {
  /** Horloge injectable (tests). Jamais fournie par le client HTTP. */
  now?: Date;
};

/**
 * Garde Lot 2 : ADMIN ou PRESID uniquement, avant toute lecture métier.
 * N’élargit pas les permissions globales (authorize / ROLE_PERMISSIONS).
 */
function assertPreviewActor(
  actor: Pick<AuthContext, "userId" | "role"> | null | undefined
): void {
  if (!actor?.userId || String(actor.userId).trim() === "") {
    throw new ServiceError("UNAUTHENTICATED", "Non authentifié");
  }
  if (!canAccessPreviewRappelsDette(actor.role)) {
    throw new ServiceError(
      "FORBIDDEN",
      PREVIEW_RAPPELS_ACCESS_DENIED_MESSAGE
    );
  }
}

function toIso(d: Date | null): string | null {
  return d ? d.toISOString() : null;
}

function uniqueIgnoredReasons(
  result: ComputeDetteRappelableResult
): RappelLineIgnoreReason[] {
  const set = new Set<RappelLineIgnoreReason>();
  for (const line of result.ignoredLines) {
    set.add(line.reason);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

function mapRow(
  adherent: { id: string; firstname: string; lastname: string },
  result: ComputeDetteRappelableResult,
  computationKind: PreviewComputationKind
): PreviewRappelAdherentRow {
  const ignoredReasons = uniqueIgnoredReasons(result);
  const globalReasons = [...result.globalReasons];
  return {
    adherentId: adherent.id,
    displayName: `${adherent.firstname} ${adherent.lastname}`.trim(),
    eligible: result.eligible,
    computationKind,
    montantBrut: decimalToMoneyString(result.montantBrut),
    avoirDisponible: decimalToMoneyString(result.avoirDisponible),
    detteNette: decimalToMoneyString(result.detteNette),
    globalReasons,
    ignoredReasons,
    globalReasonLabels: globalReasons.map(labelGlobalReason),
    ignoredReasonLabels: ignoredReasons.map(labelLineIgnoreReason),
    retainedLineCount: result.retainedLines.length,
    earliestDueDate: toIso(result.earliestDueDate),
    nextEligibleReminderAt: toIso(result.nextEligibleReminderAt),
    lastReminderSentAt: toIso(result.lastReminderSentAt),
  };
}

function technicalFailureRow(
  adherent: { id: string; firstname: string; lastname: string },
  reasonCode: RappelGlobalReason = "PRISMA_ERROR"
): PreviewRappelAdherentRow {
  const globalReasons: RappelGlobalReason[] = [reasonCode];
  return {
    adherentId: adherent.id,
    displayName: `${adherent.firstname} ${adherent.lastname}`.trim(),
    eligible: false,
    computationKind: "failed",
    montantBrut: "0",
    avoirDisponible: "0",
    detteNette: "0",
    globalReasons,
    ignoredReasons: [],
    globalReasonLabels: globalReasons.map(labelGlobalReason),
    ignoredReasonLabels: [],
    retainedLineCount: 0,
    earliestDueDate: null,
    nextEligibleReminderAt: null,
    lastReminderSentAt: null,
  };
}

/**
 * Prévisualisation admin dry-run des rappels cotisations/dettes (R1 Lot 2).
 *
 * Lecture seule : réutilise {@link computeDetteRappelable} sans duplication des règles.
 * N’accepte **aucun** paramètre de gel / contestation.
 * Sépare exclusions métier et échecs techniques (totaux partiels).
 *
 * @param actor - Contexte auth (ADMIN ou PRESID requis)
 * @param options - Horloge serveur injectable (tests)
 */
export async function previewRappelsDetteAdmin(
  actor: Pick<AuthContext, "userId" | "role">,
  options: PreviewRappelsDetteAdminOptions = {}
): Promise<PreviewRappelsDetteResult> {
  assertPreviewActor(actor);

  const now = options.now ?? new Date();

  let adherents: { id: string; firstname: string; lastname: string }[];
  try {
    adherents = await db.adherent.findMany({
      select: {
        id: true,
        firstname: true,
        lastname: true,
      },
      orderBy: [{ lastname: "asc" }, { firstname: "asc" }, { id: "asc" }],
    });
  } catch (error) {
    console.error("[previewRappelsDetteAdmin]", {
      category: "scan_failed",
      name: error instanceof Error ? error.name : "unknown",
    });
    throw new ServiceError(
      "INTERNAL_ERROR",
      "Impossible de charger la liste des adhérents (prévisualisation interrompue)"
    );
  }

  const eligible: PreviewRappelAdherentRow[] = [];
  const excluded: PreviewRappelAdherentRow[] = [];
  const failed: PreviewRappelAdherentRow[] = [];
  let brutEligible = ZERO;
  let netteEligible = ZERO;

  for (const adherent of adherents) {
    let result: ComputeDetteRappelableResult;
    try {
      // Gels : résolveur serveur uniquement — jamais depuis HTTP client.
      const gels = await resolveRappelDetteGels({
        prisma: db,
        adherentId: adherent.id,
      });
      if (!gels.ok) {
        console.error("[previewRappelsDetteAdmin]", {
          category: "gel_source_unavailable",
          adherentIdLength: adherent.id.length,
          code: gels.code,
        });
        failed.push(technicalFailureRow(adherent));
        continue;
      }

      result = await computeDetteRappelable(adherent.id, {
        now,
        frozenAdherent: gels.frozenAdherent,
        frozenLineKeys: gels.frozenLineKeys,
      });
    } catch (error) {
      console.error("[previewRappelsDetteAdmin]", {
        category: "compute_throw",
        adherentIdLength: adherent.id.length,
        name: error instanceof Error ? error.name : "unknown",
      });
      failed.push(technicalFailureRow(adherent));
      continue;
    }

    if (isTechnicalComputationFailure(result.globalReasons)) {
      failed.push(mapRow(adherent, result, "failed"));
      continue;
    }

    if (result.eligible) {
      const row = mapRow(adherent, result, "eligible");
      eligible.push(row);
      brutEligible = brutEligible.plus(result.montantBrut);
      netteEligible = netteEligible.plus(result.detteNette);
    } else {
      excluded.push(mapRow(adherent, result, "excluded"));
    }
  }

  const incomplete = failed.length > 0;

  return {
    mode: "dry-run",
    banner: PREVIEW_RAPPELS_BANNER,
    computedAt: now.toISOString(),
    timezone: RAPPEL_DETTE_TIMEZONE,
    incomplete,
    incompleteAlert: incomplete ? PREVIEW_INCOMPLETE_ALERT : null,
    totals: {
      adherentsScanned: adherents.length,
      eligibleCount: eligible.length,
      excludedCount: excluded.length,
      failedCount: failed.length,
      totalsPartial: incomplete,
      montantBrutEligibleTotal: decimalToMoneyString(brutEligible),
      detteNetteEligibleTotal: decimalToMoneyString(netteEligible),
    },
    eligible,
    excluded,
    failed,
  };
}
