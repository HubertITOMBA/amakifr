/**
 * Journal financier détaché + consolidation reports (lot 4.9).
 * Aucune identité / FK source. Source de synthèse post-archivage.
 */
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  computeRetentionEndsAt,
  type RetentionPolicyResolution,
} from "@/lib/frais-avances/retention-policy";
import { hasActiveLegalHoldOnPeriode } from "@/lib/services/frais-avances/note-frais-legal-hold-service";

export type KindJournal =
  | "REMBOURSEMENT_EXECUTE"
  | "COMPENSATION_EXECUTEE"
  | "CORRECTION_REMBOURSEMENT"
  | "CORRECTION_COMPENSATION"
  | "RESTITUTION";

export type JournalEvenementDraft = {
  kind: KindJournal;
  occurredAt: Date;
  periodeCle: string;
  montant: Prisma.Decimal;
  retentionEndsAt: Date;
  policyVersionId?: string | null;
  exerciceClotureAt?: Date | null;
};

export type JournalSnapshotTotals = {
  totalDecaissementsRemboursement: Prisma.Decimal;
  totalRestitutions: Prisma.Decimal;
  totalCompensationsNettes: Prisma.Decimal;
  events: JournalEvenementDraft[];
};

function money(v: Prisma.Decimal | number | string | null | undefined): Prisma.Decimal {
  return new Prisma.Decimal(v ?? 0);
}

export const NOTES_FRAIS_JOURNAL_SNAPSHOT_INCONSISTENT =
  "NOTES_FRAIS_JOURNAL_SNAPSHOT_INCONSISTENT";

export const NOTES_FRAIS_JOURNAL_COUNT_MISMATCH =
  "NOTES_FRAIS_JOURNAL_COUNT_MISMATCH";

export type JournalRetentionOverride = {
  retentionEndsAt: Date;
  policyVersionId: string;
  exerciceClotureAt: Date;
  resolvePeriodeCle?: (occurredAt: Date) => string;
};

/**
 * Calcule le snapshot journal d'une note (EXECUTE only, MIXTE enfants only).
 *
 * @param noteId - Note live
 * @param tx - Client TX
 * @param p3 - Politique P3 usable (injection) — ignorée si override fourni
 * @param archivedAt - Instant d'archivage (rétention injectée)
 * @param override - Snapshot calendaire 4.10 (immuable)
 */
export async function buildNoteFraisJournalSnapshot(
  noteId: string,
  tx: {
    noteFraisReglement: {
      findMany: typeof db.noteFraisReglement.findMany;
    };
  },
  p3: RetentionPolicyResolution,
  archivedAt: Date,
  override?: JournalRetentionOverride
): Promise<JournalSnapshotTotals> {
  let retentionEndsAt: Date;
  let policyVersionId: string | null = null;
  let exerciceClotureAt: Date | null = null;
  let resolvePeriodeCle: (d: Date) => string;

  if (override) {
    retentionEndsAt = override.retentionEndsAt;
    policyVersionId = override.policyVersionId;
    exerciceClotureAt = override.exerciceClotureAt;
    resolvePeriodeCle =
      override.resolvePeriodeCle ?? ((d: Date) => String(d.getUTCFullYear()));
  } else {
    const computed = computeRetentionEndsAt(archivedAt, p3);
    if (!computed || p3.status !== "validated_injected") {
      throw new Error(
        "Politique P3 journal sans durée calculable — archivage financier impossible"
      );
    }
    retentionEndsAt = computed;
    resolvePeriodeCle =
      p3.resolvePeriodeCle ?? ((d: Date) => String(d.getUTCFullYear()));
  }

  const reglements = await tx.noteFraisReglement.findMany({
    where: { noteFraisId: noteId, statut: "EXECUTE" },
    select: {
      id: true,
      type: true,
      montantTotal: true,
      executeAt: true,
      operationId: true,
      Corrections: {
        where: { type: "MONTANT_NEGATIF", montant: { not: null } },
        select: { montant: true, createdAt: true },
      },
      Restitutions: {
        select: { montant: true, dateRestitution: true },
      },
    },
    orderBy: { id: "asc" },
  });

  const events: JournalEvenementDraft[] = [];
  let remb = money(0);
  let restit = money(0);
  let comp = money(0);

  for (const r of reglements) {
    // Enfants MIXTE : comptés ; parent opération jamais journalisé ici.
    const occurredAt = r.executeAt;
    const periodeCle = resolvePeriodeCle(occurredAt);
    const brut = money(r.montantTotal);

    if (r.type === "REMBOURSEMENT") {
      if (brut.lte(0)) {
        throw new Error(NOTES_FRAIS_JOURNAL_SNAPSHOT_INCONSISTENT);
      }
      events.push({
        kind: "REMBOURSEMENT_EXECUTE",
        occurredAt,
        periodeCle,
        montant: brut,
        retentionEndsAt,
        policyVersionId,
        exerciceClotureAt,
      });
      remb = remb.plus(brut);
      for (const c of r.Corrections) {
        const m = money(c.montant);
        if (m.gte(0)) {
          throw new Error(NOTES_FRAIS_JOURNAL_SNAPSHOT_INCONSISTENT);
        }
        events.push({
          kind: "CORRECTION_REMBOURSEMENT",
          occurredAt: c.createdAt,
          periodeCle: resolvePeriodeCle(c.createdAt),
          montant: m,
          retentionEndsAt,
          policyVersionId,
          exerciceClotureAt,
        });
        remb = remb.plus(m);
      }
      for (const s of r.Restitutions) {
        const m = money(s.montant);
        if (m.lte(0)) {
          throw new Error(NOTES_FRAIS_JOURNAL_SNAPSHOT_INCONSISTENT);
        }
        events.push({
          kind: "RESTITUTION",
          occurredAt: s.dateRestitution,
          periodeCle: resolvePeriodeCle(s.dateRestitution),
          montant: m,
          retentionEndsAt,
          policyVersionId,
          exerciceClotureAt,
        });
        restit = restit.plus(m);
      }
    } else if (r.type === "COMPENSATION") {
      if (brut.lte(0)) {
        throw new Error(NOTES_FRAIS_JOURNAL_SNAPSHOT_INCONSISTENT);
      }
      events.push({
        kind: "COMPENSATION_EXECUTEE",
        occurredAt,
        periodeCle,
        montant: brut,
        retentionEndsAt,
        policyVersionId,
        exerciceClotureAt,
      });
      comp = comp.plus(brut);
      for (const c of r.Corrections) {
        const m = money(c.montant);
        if (m.gte(0)) {
          throw new Error(NOTES_FRAIS_JOURNAL_SNAPSHOT_INCONSISTENT);
        }
        events.push({
          kind: "CORRECTION_COMPENSATION",
          occurredAt: c.createdAt,
          periodeCle: resolvePeriodeCle(c.createdAt),
          montant: m,
          retentionEndsAt,
          policyVersionId,
          exerciceClotureAt,
        });
        comp = comp.plus(m);
      }
    }
  }

  if (remb.lt(0) || restit.lt(0) || comp.lt(0)) {
    throw new Error(NOTES_FRAIS_JOURNAL_SNAPSHOT_INCONSISTENT);
  }
  if (remb.lt(restit)) {
    throw new Error(NOTES_FRAIS_JOURNAL_SNAPSHOT_INCONSISTENT);
  }

  return {
    totalDecaissementsRemboursement: remb,
    totalRestitutions: restit,
    totalCompensationsNettes: comp,
    events,
  };
}

/**
 * Persiste les événements journal (aucune donnée source).
 *
 * @param tx - Client TX
 * @param events - Brouillons validés
 */
export async function insertJournalEvenementsInTx(
  tx: {
    noteFraisJournalFinancierEvenement: {
      createMany: typeof db.noteFraisJournalFinancierEvenement.createMany;
    };
  },
  events: JournalEvenementDraft[]
): Promise<number> {
  if (events.length === 0) return 0;
  const res = await tx.noteFraisJournalFinancierEvenement.createMany({
    data: events.map((e) => ({
      kind: e.kind,
      occurredAt: e.occurredAt,
      periodeCle: e.periodeCle,
      montant: e.montant,
      retentionEndsAt: e.retentionEndsAt,
      policyVersionId: e.policyVersionId ?? null,
      exerciceClotureAt: e.exerciceClotureAt ?? null,
    })),
  });
  return res.count;
}

type ConsolidationClient = {
  $executeRaw: typeof db.$executeRaw;
  $queryRaw: typeof db.$queryRaw;
  noteFraisJournalFinancierEvenement: {
    findMany: typeof db.noteFraisJournalFinancierEvenement.findMany;
    deleteMany: typeof db.noteFraisJournalFinancierEvenement.deleteMany;
  };
  noteFraisReportFinancierPeriode: {
    findUnique: typeof db.noteFraisReportFinancierPeriode.findUnique;
    create: typeof db.noteFraisReportFinancierPeriode.create;
    update: typeof db.noteFraisReportFinancierPeriode.update;
  };
};

/**
 * Consolide un batch d'événements expirés vers des reports de période.
 * Atomique : lock → agrégats → upsert/increment → delete exact.
 *
 * @param limit - Taille max du batch
 * @param client - Prisma (ou TX)
 * @param now - Instant courant
 */
export async function consolidateNoteFraisJournalFinancierOnce(
  limit = 100,
  client: ConsolidationClient | typeof db = db,
  now = new Date()
): Promise<{ consolidatedEvents: number; periodsTouched: number }> {
  return (client as typeof db).$transaction(async (tx) => {
    // Verrouiller un batch déterministe d'événements expirés.
    // Exclure les périodes sous legal hold ACTIF (P3).
    const locked = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT e.id FROM notes_frais_journal_financier_evenements e
      WHERE e."retentionEndsAt" <= ${now}
        AND NOT EXISTS (
          SELECT 1 FROM notes_frais_legal_holds h
          WHERE h."statut" = 'ACTIF'
            AND h."cibleType" = 'JOURNAL_PERIODE'
            AND h."periodeCle" = e."periodeCle"
        )
      ORDER BY e."retentionEndsAt" ASC, e.id ASC
      LIMIT ${limit}
      FOR UPDATE OF e
    `;
    if (locked.length === 0) {
      return { consolidatedEvents: 0, periodsTouched: 0 };
    }
    const ids = locked.map((r) => r.id);

    const events = await tx.noteFraisJournalFinancierEvenement.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        kind: true,
        periodeCle: true,
        montant: true,
      },
    });
    if (events.length !== ids.length) {
      throw new Error(NOTES_FRAIS_JOURNAL_COUNT_MISMATCH);
    }

    // Double-check holds (course) — skip périodes holdées
    const filtered: typeof events = [];
    for (const e of events) {
      if (await hasActiveLegalHoldOnPeriode(e.periodeCle, tx as never)) {
        continue;
      }
      filtered.push(e);
    }
    if (filtered.length === 0) {
      return { consolidatedEvents: 0, periodsTouched: 0 };
    }
    const filteredIds = filtered.map((e) => e.id);

    type Acc = {
      remb: Prisma.Decimal;
      restit: Prisma.Decimal;
      comp: Prisma.Decimal;
    };
    const byPeriod = new Map<string, Acc>();
    for (const e of filtered) {
      let acc = byPeriod.get(e.periodeCle);
      if (!acc) {
        acc = { remb: money(0), restit: money(0), comp: money(0) };
        byPeriod.set(e.periodeCle, acc);
      }
      const m = money(e.montant);
      switch (e.kind) {
        case "REMBOURSEMENT_EXECUTE":
        case "CORRECTION_REMBOURSEMENT":
          acc.remb = acc.remb.plus(m);
          break;
        case "RESTITUTION":
          acc.restit = acc.restit.plus(m);
          break;
        case "COMPENSATION_EXECUTEE":
        case "CORRECTION_COMPENSATION":
          acc.comp = acc.comp.plus(m);
          break;
        default:
          throw new Error(NOTES_FRAIS_JOURNAL_SNAPSHOT_INCONSISTENT);
      }
    }

    const consolidatedAt = now;
    for (const [periodeCle, acc] of byPeriod) {
      if (acc.remb.lt(0) || acc.restit.lt(0) || acc.comp.lt(0)) {
        throw new Error(NOTES_FRAIS_JOURNAL_SNAPSHOT_INCONSISTENT);
      }
      const existing = await tx.noteFraisReportFinancierPeriode.findUnique({
        where: { periodeCle },
      });
      if (!existing) {
        await tx.noteFraisReportFinancierPeriode.create({
          data: {
            periodeCle,
            totalDecaissementsRemboursement: acc.remb,
            totalRestitutions: acc.restit,
            totalCompensationsNettes: acc.comp,
            consolidatedAt,
          },
        });
      } else {
        await tx.noteFraisReportFinancierPeriode.update({
          where: { periodeCle },
          data: {
            totalDecaissementsRemboursement: money(
              existing.totalDecaissementsRemboursement
            ).plus(acc.remb),
            totalRestitutions: money(existing.totalRestitutions).plus(
              acc.restit
            ),
            totalCompensationsNettes: money(
              existing.totalCompensationsNettes
            ).plus(acc.comp),
            consolidatedAt,
          },
        });
      }
    }

    const del = await tx.noteFraisJournalFinancierEvenement.deleteMany({
      where: { id: { in: filteredIds } },
    });
    if (del.count !== filteredIds.length) {
      throw new Error(NOTES_FRAIS_JOURNAL_COUNT_MISMATCH);
    }

    return {
      consolidatedEvents: filteredIds.length,
      periodsTouched: byPeriod.size,
    };
  });
}

/**
 * Agrège le journal non consolidé pour la synthèse.
 */
export async function aggregateJournalFinancierForSynthese(
  client: {
    noteFraisJournalFinancierEvenement: {
      findMany: typeof db.noteFraisJournalFinancierEvenement.findMany;
    };
  } = db
): Promise<{
  totalDecaissementsRemboursement: string;
  totalRestitutions: string;
  totalCompensationsNettes: string;
}> {
  const rows = await client.noteFraisJournalFinancierEvenement.findMany({
    select: { kind: true, montant: true },
  });
  let remb = money(0);
  let restit = money(0);
  let comp = money(0);
  for (const r of rows) {
    const m = money(r.montant);
    switch (r.kind) {
      case "REMBOURSEMENT_EXECUTE":
      case "CORRECTION_REMBOURSEMENT":
        remb = remb.plus(m);
        break;
      case "RESTITUTION":
        restit = restit.plus(m);
        break;
      case "COMPENSATION_EXECUTEE":
      case "CORRECTION_COMPENSATION":
        comp = comp.plus(m);
        break;
    }
  }
  return {
    totalDecaissementsRemboursement: remb.toFixed(2),
    totalRestitutions: restit.toFixed(2),
    totalCompensationsNettes: comp.toFixed(2),
  };
}

/**
 * Agrège les reports de période pour la synthèse.
 */
export async function aggregateReportsFinancierForSynthese(
  client: {
    noteFraisReportFinancierPeriode: {
      findMany: typeof db.noteFraisReportFinancierPeriode.findMany;
    };
  } = db
): Promise<{
  totalDecaissementsRemboursement: string;
  totalRestitutions: string;
  totalCompensationsNettes: string;
}> {
  const rows = await client.noteFraisReportFinancierPeriode.findMany({
    select: {
      totalDecaissementsRemboursement: true,
      totalRestitutions: true,
      totalCompensationsNettes: true,
    },
  });
  let remb = money(0);
  let restit = money(0);
  let comp = money(0);
  for (const r of rows) {
    remb = remb.plus(money(r.totalDecaissementsRemboursement));
    restit = restit.plus(money(r.totalRestitutions));
    comp = comp.plus(money(r.totalCompensationsNettes));
  }
  return {
    totalDecaissementsRemboursement: remb.toFixed(2),
    totalRestitutions: restit.toFixed(2),
    totalCompensationsNettes: comp.toFixed(2),
  };
}
