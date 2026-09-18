/**
 * Politiques de conservation DB (lot 4.10) — versionnement prospectif.
 * Fail-closed sans ACTIVE. Aucune durée via env / NEXT_PUBLIC.
 */
import { z } from "zod";
import { db } from "@/lib/db";
import {
  computeRetentionDeadlines,
  type ExerciceClotureConfig,
} from "@/lib/frais-avances/retention-calendar";

export const NOTES_FRAIS_RETENTION_POLICY_REQUIRED =
  "NOTES_FRAIS_RETENTION_POLICY_REQUIRED";
export const NOTES_FRAIS_RETENTION_POLICY_BOUNDS =
  "NOTES_FRAIS_RETENTION_POLICY_BOUNDS";
export const NOTES_FRAIS_RETENTION_POLICY_OCC_CONFLICT =
  "NOTES_FRAIS_RETENTION_POLICY_OCC_CONFLICT";
export const NOTES_FRAIS_RETENTION_POLICY_IDEMPOTENT =
  "NOTES_FRAIS_RETENTION_POLICY_IDEMPOTENT";
export const NOTES_FRAIS_RETENTION_POLICY_EFFECTIVE_AT_FUTURE =
  "NOTES_FRAIS_RETENTION_POLICY_EFFECTIVE_AT_FUTURE";
export const NOTES_FRAIS_RETENTION_REPORTS_MUST_BE_SANS_ECHEANCE =
  "NOTES_FRAIS_RETENTION_REPORTS_MUST_BE_SANS_ECHEANCE";

export type ActiveRetentionPolicy = {
  id: string;
  version: number;
  p1Years: number;
  p2Years: number;
  p3Years: number;
  exerciceClotureMois: number;
  exerciceClotureJour: number;
  reportsSansEcheance: boolean;
  motif: string;
  effectiveAt: Date;
  activatedAt: Date | null;
  occVersion: number;
};

export type RetentionSnapshot = {
  policyVersionId: string;
  exerciceClotureAt: Date;
  retentionEndsAtP1: Date;
  retentionEndsAtP2: Date;
  retentionEndsAtP3: Date;
};

const YearsSchema = z.number().int().min(1).max(50);
const ClotureMoisSchema = z.number().int().min(1).max(12);
const ClotureJourSchema = z.number().int().min(1).max(31);

/**
 * V1 : reportsSansEcheance doit être true (pas de purge reports).
 * false → refus fail-closed.
 */
export const CreateRetentionPolicyDraftSchema = z
  .object({
    p1Years: YearsSchema,
    p2Years: YearsSchema,
    p3Years: YearsSchema,
    exerciceClotureMois: ClotureMoisSchema.default(12),
    exerciceClotureJour: ClotureJourSchema.default(31),
    reportsSansEcheance: z.literal(true),
    motif: z.string().trim().min(10).max(4000),
    effectiveAt: z.coerce.date(),
  })
  .superRefine((data, ctx) => {
    const m = data.exerciceClotureMois;
    const j = data.exerciceClotureJour;
    const max =
      m === 2
        ? 29
        : m === 4 || m === 6 || m === 9 || m === 11
          ? 30
          : 31;
    if (j > max) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: NOTES_FRAIS_RETENTION_POLICY_BOUNDS,
        path: ["exerciceClotureJour"],
      });
    }
    // V1 : pas de planification — effectiveAt doit déjà être atteinte à la création du brouillon.
    if (data.effectiveAt.getTime() > Date.now()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: NOTES_FRAIS_RETENTION_POLICY_EFFECTIVE_AT_FUTURE,
        path: ["effectiveAt"],
      });
    }
  });

export type CreateRetentionPolicyDraftInput = z.infer<
  typeof CreateRetentionPolicyDraftSchema
>;

type PolicyClient = {
  noteFraisRetentionPolicyVersion: typeof db.noteFraisRetentionPolicyVersion;
  $transaction: typeof db.$transaction;
  $executeRaw: typeof db.$executeRaw;
  $queryRaw: typeof db.$queryRaw;
};

function toActivePolicy(row: {
  id: string;
  version: number;
  p1Years: number;
  p2Years: number;
  p3Years: number;
  exerciceClotureMois: number;
  exerciceClotureJour: number;
  reportsSansEcheance: boolean;
  motif: string;
  effectiveAt: Date;
  activatedAt: Date | null;
  occVersion: number;
}): ActiveRetentionPolicy | null {
  // V1 fail-closed : reports avec échéance non supportés.
  if (row.reportsSansEcheance !== true) {
    return null;
  }
  return {
    id: row.id,
    version: row.version,
    p1Years: row.p1Years,
    p2Years: row.p2Years,
    p3Years: row.p3Years,
    exerciceClotureMois: row.exerciceClotureMois,
    exerciceClotureJour: row.exerciceClotureJour,
    reportsSansEcheance: row.reportsSansEcheance,
    motif: row.motif,
    effectiveAt: row.effectiveAt,
    activatedAt: row.activatedAt,
    occVersion: row.occVersion,
  };
}

/**
 * Charge la politique ACTIVE utilisable (fail-closed si absente ou reportsSansEcheance≠true).
 * V1 : pas de politique planifiée — une ACTIVE s'applique immédiatement.
 */
export async function getActiveRetentionPolicy(
  client: {
    noteFraisRetentionPolicyVersion: {
      findFirst: typeof db.noteFraisRetentionPolicyVersion.findFirst;
    };
  } = db
): Promise<ActiveRetentionPolicy | null> {
  const row = await client.noteFraisRetentionPolicyVersion.findFirst({
    where: { statut: "ACTIVE" },
  });
  if (!row) return null;
  return toActivePolicy(row);
}

/**
 * Exige une politique ACTIVE — throw fail-closed.
 */
export async function requireActiveRetentionPolicy(
  client?: Parameters<typeof getActiveRetentionPolicy>[0]
): Promise<ActiveRetentionPolicy> {
  const p = await getActiveRetentionPolicy(client);
  if (!p) {
    throw new Error(NOTES_FRAIS_RETENTION_POLICY_REQUIRED);
  }
  return p;
}

/**
 * Calcule le snapshot immuable pour une date économique (typ. dateDepense).
 */
export function buildRetentionSnapshotFromPolicy(
  policy: ActiveRetentionPolicy,
  dateEconomique: Date
): RetentionSnapshot {
  const cloture: ExerciceClotureConfig = {
    mois: policy.exerciceClotureMois,
    jour: policy.exerciceClotureJour,
  };
  const d = computeRetentionDeadlines({
    dateEconomique,
    p1Years: policy.p1Years,
    p2Years: policy.p2Years,
    p3Years: policy.p3Years,
    cloture,
  });
  return {
    policyVersionId: policy.id,
    exerciceClotureAt: d.exerciceClotureAt,
    retentionEndsAtP1: d.retentionEndsAtP1,
    retentionEndsAtP2: d.retentionEndsAtP2,
    retentionEndsAtP3: d.retentionEndsAtP3,
  };
}

/**
 * Crée une version BROUILLON (jamais UPDATE de l'ACTIVE).
 */
export async function createRetentionPolicyDraft(
  input: CreateRetentionPolicyDraftInput,
  createdByUserId: string | null,
  client: typeof db = db
): Promise<{ id: string; version: number }> {
  const data = CreateRetentionPolicyDraftSchema.parse(input);
  const last = await client.noteFraisRetentionPolicyVersion.findFirst({
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const version = (last?.version ?? 0) + 1;
  const row = await client.noteFraisRetentionPolicyVersion.create({
    data: {
      version,
      statut: "BROUILLON",
      p1Years: data.p1Years,
      p2Years: data.p2Years,
      p3Years: data.p3Years,
      exerciceClotureMois: data.exerciceClotureMois,
      exerciceClotureJour: data.exerciceClotureJour,
      reportsSansEcheance: data.reportsSansEcheance,
      motif: data.motif,
      createdByUserId,
      effectiveAt: data.effectiveAt,
    },
  });
  return { id: row.id, version: row.version };
}

/**
 * Active atomiquement une version BROUILLON : ACTIVE précédente → REMPLACEE.
 * Idempotence via activationIdempotencyKey ; OCC via expectedOccVersion.
 *
 * V1 : effectiveAt doit être <= now (pas de politique planifiée).
 * Impact prospectif uniquement — aucune archive/journal existant n'est recalculé.
 */
export async function activateRetentionPolicyVersion(input: {
  policyId: string;
  activatedByUserId: string | null;
  activationIdempotencyKey: string;
  expectedOccVersion: number;
  now?: Date;
  client?: PolicyClient | typeof db;
}): Promise<{
  activatedId: string;
  replacedId: string | null;
  alreadyApplied: boolean;
}> {
  const client = (input.client ?? db) as typeof db;
  const key = input.activationIdempotencyKey.trim();
  if (!key || key.length > 64) {
    throw new Error(NOTES_FRAIS_RETENTION_POLICY_BOUNDS);
  }
  const now = input.now ?? new Date();

  return client.$transaction(async (tx) => {
    const existingByKey = await tx.noteFraisRetentionPolicyVersion.findFirst({
      where: { activationIdempotencyKey: key },
    });
    if (existingByKey) {
      if (existingByKey.id !== input.policyId) {
        throw new Error(NOTES_FRAIS_RETENTION_POLICY_IDEMPOTENT);
      }
      if (existingByKey.statut === "ACTIVE") {
        if (existingByKey.reportsSansEcheance !== true) {
          throw new Error(NOTES_FRAIS_RETENTION_REPORTS_MUST_BE_SANS_ECHEANCE);
        }
        return {
          activatedId: existingByKey.id,
          replacedId: null,
          alreadyApplied: true,
        };
      }
    }

    await tx.$executeRaw`
      SELECT id FROM notes_frais_retention_policy_versions
      WHERE id = ${input.policyId} OR statut = 'ACTIVE'
      ORDER BY id ASC
      FOR UPDATE
    `;

    const draft = await tx.noteFraisRetentionPolicyVersion.findUnique({
      where: { id: input.policyId },
    });
    if (!draft || draft.statut !== "BROUILLON") {
      throw new Error(NOTES_FRAIS_RETENTION_POLICY_REQUIRED);
    }
    if (draft.occVersion !== input.expectedOccVersion) {
      throw new Error(NOTES_FRAIS_RETENTION_POLICY_OCC_CONFLICT);
    }
    if (draft.reportsSansEcheance !== true) {
      throw new Error(NOTES_FRAIS_RETENTION_REPORTS_MUST_BE_SANS_ECHEANCE);
    }
    // V1 : pas de planification future — effet immédiat uniquement.
    if (draft.effectiveAt.getTime() > now.getTime()) {
      throw new Error(NOTES_FRAIS_RETENTION_POLICY_EFFECTIVE_AT_FUTURE);
    }

    const currentActive = await tx.noteFraisRetentionPolicyVersion.findFirst({
      where: { statut: "ACTIVE" },
    });

    if (currentActive) {
      await tx.noteFraisRetentionPolicyVersion.update({
        where: { id: currentActive.id },
        data: {
          statut: "REMPLACEE",
          occVersion: { increment: 1 },
        },
      });
    }

    const activated = await tx.noteFraisRetentionPolicyVersion.update({
      where: { id: draft.id },
      data: {
        statut: "ACTIVE",
        activatedAt: now,
        activatedByUserId: input.activatedByUserId,
        activationIdempotencyKey: key,
        occVersion: { increment: 1 },
      },
    });

    return {
      activatedId: activated.id,
      replacedId: currentActive?.id ?? null,
      alreadyApplied: false,
    };
  });
}

/**
 * Compteurs d'échéances sans PII (admin conservation).
 */
export async function countRetentionDueWithoutPii(
  now = new Date(),
  client: typeof db = db
): Promise<{
  archivesDueP2: number;
  piecesDueP1: number;
  journalDueP3: number;
  nextEndsAt: Date | null;
}> {
  const [archivesDueP2, piecesDueP1, journalDueP3, nextArchive, nextPj, nextJournal] =
    await Promise.all([
      client.noteFraisArchive.count({
        where: { retentionEndsAt: { lte: now } },
      }),
      client.justificatifNoteFraisArchive.count({
        where: { retentionEndsAtP1: { lte: now } },
      }),
      client.noteFraisJournalFinancierEvenement.count({
        where: { retentionEndsAt: { lte: now } },
      }),
      client.noteFraisArchive.findFirst({
        where: { retentionEndsAt: { gt: now } },
        orderBy: { retentionEndsAt: "asc" },
        select: { retentionEndsAt: true },
      }),
      client.justificatifNoteFraisArchive.findFirst({
        where: { retentionEndsAtP1: { gt: now } },
        orderBy: { retentionEndsAtP1: "asc" },
        select: { retentionEndsAtP1: true },
      }),
      client.noteFraisJournalFinancierEvenement.findFirst({
        where: { retentionEndsAt: { gt: now } },
        orderBy: { retentionEndsAt: "asc" },
        select: { retentionEndsAt: true },
      }),
    ]);

  const candidates = [
    nextArchive?.retentionEndsAt,
    nextPj?.retentionEndsAtP1,
    nextJournal?.retentionEndsAt,
  ].filter((d): d is Date => !!d);
  const nextEndsAt =
    candidates.length === 0
      ? null
      : new Date(Math.min(...candidates.map((d) => d.getTime())));

  return { archivesDueP2, piecesDueP1, journalDueP3, nextEndsAt };
}

/**
 * Liste les versions (ACTIVE en tête, puis historique lecture seule).
 */
export async function listRetentionPolicyVersions(
  client: typeof db = db
): Promise<
  Array<{
    id: string;
    version: number;
    statut: string;
    p1Years: number;
    p2Years: number;
    p3Years: number;
    exerciceClotureMois: number;
    exerciceClotureJour: number;
    reportsSansEcheance: boolean;
    motif: string;
    effectiveAt: Date;
    activatedAt: Date | null;
    occVersion: number;
  }>
> {
  return client.noteFraisRetentionPolicyVersion.findMany({
    orderBy: [{ statut: "asc" }, { version: "desc" }],
    select: {
      id: true,
      version: true,
      statut: true,
      p1Years: true,
      p2Years: true,
      p3Years: true,
      exerciceClotureMois: true,
      exerciceClotureJour: true,
      reportsSansEcheance: true,
      motif: true,
      effectiveAt: true,
      activatedAt: true,
      occVersion: true,
    },
  });
}
