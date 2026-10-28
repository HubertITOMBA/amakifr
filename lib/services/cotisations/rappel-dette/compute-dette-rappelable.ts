import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  addCivilDaysParis,
  civilDaysBetweenParis,
} from "@/lib/services/cotisations/rappel-dette/paris-calendar";
import {
  resolveCotisationMensuelleDueDate,
  resolveDetteInitialeDueDate,
} from "@/lib/services/cotisations/rappel-dette/resolve-due-date";
import {
  RAPPEL_COOLDOWN_DAYS,
  RAPPEL_J_PLUS_DAYS,
  RAPPEL_SENT_STATUSES,
  PENDING_PAYMENT_STATUSES,
  frozenLineKey,
  type ComputeDetteRappelableOptions,
  type ComputeDetteRappelableResult,
  type RappelGlobalReason,
  type RappelIgnoredLine,
  type RappelRetainedLine,
} from "@/lib/services/cotisations/rappel-dette/types";

const ZERO = new Prisma.Decimal(0);

const CM_OPEN_STATUSES = new Set([
  "EnAttente",
  "PartiellementPaye",
  "EnRetard",
]);

function d(value: Prisma.Decimal | string | number | null | undefined): Prisma.Decimal {
  if (value instanceof Prisma.Decimal) return value;
  return new Prisma.Decimal(value ?? 0);
}

function sortRetained(a: RappelRetainedLine, b: RappelRetainedLine): number {
  const t = a.dueDate.getTime() - b.dueDate.getTime();
  if (t !== 0) return t;
  if (a.source !== b.source) return a.source.localeCompare(b.source);
  return a.id.localeCompare(b.id);
}

function sortIgnored(a: RappelIgnoredLine, b: RappelIgnoredLine): number {
  const ta = a.dueDate?.getTime() ?? Number.POSITIVE_INFINITY;
  const tb = b.dueDate?.getTime() ?? Number.POSITIVE_INFINITY;
  if (ta !== tb) return ta - tb;
  if (a.source !== b.source) return a.source.localeCompare(b.source);
  return a.id.localeCompare(b.id);
}

function emptyResult(
  adherentId: string,
  globalReasons: RappelGlobalReason[]
): ComputeDetteRappelableResult {
  return {
    eligible: false,
    adherentId,
    montantBrut: ZERO,
    avoirDisponible: ZERO,
    detteNette: ZERO,
    retainedLines: [],
    ignoredLines: [],
    earliestDueDate: null,
    nextEligibleReminderAt: null,
    lastReminderSentAt: null,
    globalReasons,
  };
}

/**
 * Plus récente des dates de preuve (null si aucune).
 *
 * @param a - Première date candidate
 * @param b - Seconde date candidate
 * @returns La date max, ou null
 */
function maxProofDate(
  a: Date | null | undefined,
  b: Date | null | undefined
): Date | null {
  if (!a) return b ?? null;
  if (!b) return a;
  return a.getTime() >= b.getTime() ? a : b;
}

/**
 * Calcule l’éligibilité d’un adhérent au rappel de cotisations/dettes (Lot 1 + 3.2).
 *
 * Sources : CotisationMensuelle, DetteInitiale uniquement.
 * L’entité `Assistance` (prestation versée au bénéficiaire) n’est **pas** une dette
 * du bénéficiaire — décision métier 2026-10-28. Les CM d’assistance dues par les
 * autres adhérents restent des dettes (source cotisation_mensuelle).
 * Exclut ObligationCotisation (legacy). Aucune mutation DB, aucun envoi.
 * Aucune lecture de la table `assistances`.
 *
 * Cooldown 30 j : `lastReminderSentAt` = max des preuves :
 * - RelanceCotisationMensuelle : statut ∈ Envoye|Lu|Repondu ET dateEnvoi ≠ null ;
 * - RappelDetteEnvoi : emailStatus=Accepted ET emailAcceptedAt ≠ null
 *   (notif NotStarted / closedAt null ouverts encore le cooldown).
 * Non-preuves : Reserved, Calling, Unknown, DefinitelyNotAccepted, Abandoned,
 * EnAttente legacy / date orpheline. Tentatives bloquantes = futur service d’envoi.
 *
 * `options.frozenAdherent` / `frozenLineKeys` / `prisma` : paramètres
 * **internes serveur** uniquement — ne jamais les lire depuis un body/query client.
 * `options.prisma` : client de lecture (ex. TransactionClient) ; défaut = `db`.
 * Aucune transaction ni verrou ouverts ici ; orchestration hors calcul.
 *
 * @param adherentId - Identifiant adhérent
 * @param options - Horloge, gels et client de lecture (injection serveur / tests)
 * @returns Résultat structuré (éligible, montants Decimal, lignes, reasons)
 */
export async function computeDetteRappelable(
  adherentId: string,
  options: ComputeDetteRappelableOptions = {}
): Promise<ComputeDetteRappelableResult> {
  const now = options.now ?? new Date();
  const frozenLineKeys = options.frozenLineKeys ?? new Set<string>();
  // Client injecté exclusif si fourni — aucun fallback vers `db` en cas d’échec.
  const client = options.prisma ?? db;

  if (!adherentId || adherentId.trim() === "") {
    return emptyResult("", ["ADHERENT_NOT_FOUND"]);
  }

  try {
    const adherent = await client.adherent.findUnique({
      where: { id: adherentId },
      select: {
        id: true,
        User: { select: { status: true } },
      },
    });

    if (!adherent) {
      return emptyResult(adherentId, ["ADHERENT_NOT_FOUND"]);
    }

    if (adherent.User?.status !== "Actif") {
      return emptyResult(adherentId, ["USER_INACTIVE"]);
    }

    if (options.frozenAdherent === true) {
      return emptyResult(adherentId, ["FROZEN_CONTESTED"]);
    }

    const [
      cotisations,
      dettes,
      pendingPayments,
      avoirs,
      lastRelance,
      lastRappelDetteEnvoi,
    ] = await Promise.all([
      client.cotisationMensuelle.findMany({
        where: { adherentId },
        select: {
          id: true,
          adherentId: true,
          adherentBeneficiaireId: true,
          montantRestant: true,
          statut: true,
          dateEcheance: true,
        },
      }),
      client.detteInitiale.findMany({
        where: { adherentId },
        select: {
          id: true,
          annee: true,
          montantRestant: true,
        },
      }),
      client.paiementCotisation.findMany({
        where: {
          adherentId,
          statut: { in: [...PENDING_PAYMENT_STATUSES] },
          OR: [
            { cotisationMensuelleId: { not: null } },
            { detteInitialeId: { not: null } },
          ],
        },
        select: {
          cotisationMensuelleId: true,
          detteInitialeId: true,
        },
      }),
      client.avoir.findMany({
        where: {
          adherentId,
          statut: "Disponible",
          montantRestant: { gt: 0 },
        },
        select: { montantRestant: true },
      }),
      // Preuve legacy : Envoye|Lu|Repondu + dateEnvoi (EnAttente exclus).
      client.relanceCotisationMensuelle.findFirst({
        where: {
          adherentId,
          statut: { in: [...RAPPEL_SENT_STATUSES] },
          dateEnvoi: { not: null },
        },
        orderBy: { dateEnvoi: "desc" },
        select: { dateEnvoi: true, statut: true },
      }),
      // Preuve Lot 3 : Accepted + emailAcceptedAt (indépendant notif/closedAt).
      // Nécessite table RappelDetteEnvoi (migration 3.1) — fail-closed si absente.
      client.rappelDetteEnvoi.findFirst({
        where: {
          adherentId,
          emailStatus: "Accepted",
          emailAcceptedAt: { not: null },
        },
        orderBy: { emailAcceptedAt: "desc" },
        select: { emailAcceptedAt: true, emailStatus: true },
      }),
    ]);

    const pendingCm = new Set<string>();
    const pendingDette = new Set<string>();
    for (const p of pendingPayments) {
      if (p.cotisationMensuelleId) pendingCm.add(p.cotisationMensuelleId);
      if (p.detteInitialeId) pendingDette.add(p.detteInitialeId);
    }

    const retained: RappelRetainedLine[] = [];
    const ignored: RappelIgnoredLine[] = [];

    const pushIgnored = (
      line: Omit<RappelIgnoredLine, "reason"> & { reason: RappelIgnoredLine["reason"] }
    ) => {
      ignored.push(line);
    };

    const tryRetain = (params: {
      source: RappelRetainedLine["source"];
      id: string;
      montantRestant: Prisma.Decimal;
      dueDate: Date;
      pending: boolean;
      closed: boolean;
      beneficiary: boolean;
    }) => {
      const key = frozenLineKey(params.source, params.id);

      if (params.beneficiary) {
        pushIgnored({
          source: params.source,
          id: params.id,
          montantRestant: params.montantRestant,
          dueDate: params.dueDate,
          reason: "ASSISTANCE_BENEFICIARY",
        });
        return;
      }

      if (frozenLineKeys.has(key)) {
        pushIgnored({
          source: params.source,
          id: params.id,
          montantRestant: params.montantRestant,
          dueDate: params.dueDate,
          reason: "FROZEN_CONTESTED",
        });
        return;
      }

      if (params.closed) {
        pushIgnored({
          source: params.source,
          id: params.id,
          montantRestant: params.montantRestant,
          dueDate: params.dueDate,
          reason: "STATUS_CLOSED",
        });
        return;
      }

      if (params.montantRestant.lte(0)) {
        pushIgnored({
          source: params.source,
          id: params.id,
          montantRestant: params.montantRestant,
          dueDate: params.dueDate,
          reason: "ZERO_OR_NEGATIVE_REMAINING",
        });
        return;
      }

      if (params.pending) {
        pushIgnored({
          source: params.source,
          id: params.id,
          montantRestant: params.montantRestant,
          dueDate: params.dueDate,
          reason: "PENDING_PAYMENT",
        });
        return;
      }

      const daysPastDue = civilDaysBetweenParis(params.dueDate, now);
      if (daysPastDue < RAPPEL_J_PLUS_DAYS) {
        pushIgnored({
          source: params.source,
          id: params.id,
          montantRestant: params.montantRestant,
          dueDate: params.dueDate,
          reason: "NOT_YET_DUE_J15",
        });
        return;
      }

      retained.push({
        source: params.source,
        id: params.id,
        montantRestant: params.montantRestant,
        dueDate: params.dueDate,
        daysPastDue,
      });
    };

    for (const row of cotisations) {
      const restant = d(row.montantRestant);
      const dueDate = resolveCotisationMensuelleDueDate(row.dateEcheance);
      const isBeneficiary =
        row.adherentBeneficiaireId != null &&
        row.adherentBeneficiaireId === row.adherentId;
      const closed = !CM_OPEN_STATUSES.has(row.statut);
      tryRetain({
        source: "cotisation_mensuelle",
        id: row.id,
        montantRestant: restant,
        dueDate,
        pending: pendingCm.has(row.id),
        closed,
        beneficiary: isBeneficiary,
      });
    }

    for (const row of dettes) {
      const restant = d(row.montantRestant);
      const dueDate = resolveDetteInitialeDueDate(row.annee);
      // Pas de statut : fermé si solde ≤ 0 uniquement.
      tryRetain({
        source: "dette_initiale",
        id: row.id,
        montantRestant: restant,
        dueDate,
        pending: pendingDette.has(row.id),
        closed: false,
        beneficiary: false,
      });
    }

    retained.sort(sortRetained);
    ignored.sort(sortIgnored);

    let montantBrut = ZERO;
    for (const line of retained) {
      montantBrut = montantBrut.plus(line.montantRestant);
    }

    let avoirDisponible = ZERO;
    for (const a of avoirs) {
      avoirDisponible = avoirDisponible.plus(d(a.montantRestant));
    }

    const detteNetteRaw = montantBrut.minus(avoirDisponible);
    const detteNette = detteNetteRaw.gt(0) ? detteNetteRaw : ZERO;

    const earliestDueDate =
      retained.length > 0 ? retained[0]!.dueDate : null;

    const lastReminderSentAt = maxProofDate(
      lastRelance?.dateEnvoi,
      lastRappelDetteEnvoi?.emailAcceptedAt
    );

    const globalReasons: RappelGlobalReason[] = [];

    let cooldownBlocks = false;
    let cooldownUntil: Date | null = null;
    if (lastReminderSentAt) {
      const daysSinceReminder = civilDaysBetweenParis(lastReminderSentAt, now);
      if (daysSinceReminder < RAPPEL_COOLDOWN_DAYS) {
        cooldownBlocks = true;
        cooldownUntil = addCivilDaysParis(
          lastReminderSentAt,
          RAPPEL_COOLDOWN_DAYS
        );
        globalReasons.push("REMINDER_COOLDOWN_30D");
      }
    }

    let j15Until: Date | null = null;
    if (retained.length === 0) {
      globalReasons.push("NO_RETAINED_LINES");
      const notYet = ignored
        .filter((l) => l.reason === "NOT_YET_DUE_J15" && l.dueDate)
        .map((l) => addCivilDaysParis(l.dueDate!, RAPPEL_J_PLUS_DAYS));
      if (notYet.length > 0) {
        notYet.sort((a, b) => a.getTime() - b.getTime());
        j15Until = notYet[0]!;
      }
    }

    if (retained.length > 0 && detteNette.lte(0)) {
      globalReasons.push("COVERED_BY_AVOIR");
    }

    const eligible =
      retained.length > 0 && detteNette.gt(0) && !cooldownBlocks;

    let nextEligibleReminderAt: Date | null = null;
    if (eligible) {
      globalReasons.length = 0;
      globalReasons.push("ELIGIBLE");
      nextEligibleReminderAt = parisCivilNow(now);
    } else {
      const candidates = [cooldownUntil, j15Until].filter(
        (x): x is Date => x != null
      );
      if (candidates.length > 0) {
        candidates.sort((a, b) => a.getTime() - b.getTime());
        // Les deux garde-fous doivent être levés → date la plus tardive.
        nextEligibleReminderAt = candidates[candidates.length - 1]!;
      }
    }

    return {
      eligible,
      adherentId,
      montantBrut,
      avoirDisponible,
      detteNette,
      retainedLines: retained,
      ignoredLines: ignored,
      earliestDueDate,
      nextEligibleReminderAt,
      lastReminderSentAt,
      globalReasons: uniqueReasons(globalReasons),
    };
  } catch (error) {
    // Fail-closed : aucune éligibilité si la lecture échoue. Pas de PII.
    console.error("[computeDetteRappelable]", {
      category: "prisma_error",
      adherentIdLength: adherentId.length,
      name: error instanceof Error ? error.name : "unknown",
    });
    return emptyResult(adherentId, ["PRISMA_ERROR"]);
  }
}

function parisCivilNow(now: Date): Date {
  return addCivilDaysParis(now, 0);
}

function uniqueReasons(reasons: RappelGlobalReason[]): RappelGlobalReason[] {
  return [...new Set(reasons)];
}
