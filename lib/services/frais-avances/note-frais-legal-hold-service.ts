/**
 * Legal hold notes de frais (lot 4.10) — append-only, audité.
 * Hold ACTIF bloque purge P1, purge P2 et consolidation P3 concernées.
 * Aucun effet sur montants / synthèse.
 */
import { z } from "zod";
import { db } from "@/lib/db";

export const NOTES_FRAIS_LEGAL_HOLD_REQUIRED = "NOTES_FRAIS_LEGAL_HOLD_REQUIRED";
export const NOTES_FRAIS_LEGAL_HOLD_CONFLICT = "NOTES_FRAIS_LEGAL_HOLD_CONFLICT";
export const NOTES_FRAIS_LEGAL_HOLD_ALREADY_LEVE =
  "NOTES_FRAIS_LEGAL_HOLD_ALREADY_LEVE";

const MotifSchema = z.string().trim().min(5).max(4000);
const RefSchema = z.string().trim().max(120).optional().nullable();

export const PoseLegalHoldArchiveSchema = z.object({
  archiveId: z.string().min(1),
  motif: MotifSchema,
  referenceDossier: RefSchema,
  expiresAt: z.coerce.date().optional().nullable(),
});

export const PoseLegalHoldPeriodeSchema = z.object({
  periodeCle: z.string().trim().min(1).max(16),
  motif: MotifSchema,
  referenceDossier: RefSchema,
  expiresAt: z.coerce.date().optional().nullable(),
});

/**
 * True si une hold ACTIF existe sur l'archive (ignore expiresAt — fail-safe).
 * L'expiration automatique lève le hold dans un cycle worker séparé.
 */
export async function hasActiveLegalHoldOnArchive(
  archiveId: string,
  client: {
    noteFraisLegalHold: {
      findFirst: typeof db.noteFraisLegalHold.findFirst;
    };
  } = db
): Promise<boolean> {
  const row = await client.noteFraisLegalHold.findFirst({
    where: {
      cibleType: "ARCHIVE",
      archiveId,
      statut: "ACTIF",
    },
    select: { id: true },
  });
  return !!row;
}

/**
 * True si hold ACTIF sur une période journal (P3).
 */
export async function hasActiveLegalHoldOnPeriode(
  periodeCle: string,
  client: {
    noteFraisLegalHold: {
      findFirst: typeof db.noteFraisLegalHold.findFirst;
    };
  } = db
): Promise<boolean> {
  const row = await client.noteFraisLegalHold.findFirst({
    where: {
      cibleType: "JOURNAL_PERIODE",
      periodeCle,
      statut: "ACTIF",
    },
    select: { id: true },
  });
  return !!row;
}

/**
 * Pose un hold ACTIF sur une archive (transactionnelle).
 */
export async function poseLegalHoldOnArchive(input: {
  archiveId: string;
  motif: string;
  referenceDossier?: string | null;
  expiresAt?: Date | null;
  poseParUserId: string | null;
  client?: typeof db;
}): Promise<{ id: string }> {
  const data = PoseLegalHoldArchiveSchema.parse({
    archiveId: input.archiveId,
    motif: input.motif,
    referenceDossier: input.referenceDossier,
    expiresAt: input.expiresAt,
  });
  const client = input.client ?? db;

  return client.$transaction(async (tx) => {
    const archive = await tx.noteFraisArchive.findUnique({
      where: { id: data.archiveId },
      select: { id: true },
    });
    if (!archive) {
      throw new Error(NOTES_FRAIS_LEGAL_HOLD_REQUIRED);
    }

    const existing = await tx.noteFraisLegalHold.findFirst({
      where: {
        cibleType: "ARCHIVE",
        archiveId: data.archiveId,
        statut: "ACTIF",
      },
    });
    if (existing) {
      throw new Error(NOTES_FRAIS_LEGAL_HOLD_CONFLICT);
    }

    const row = await tx.noteFraisLegalHold.create({
      data: {
        cibleType: "ARCHIVE",
        archiveId: data.archiveId,
        statut: "ACTIF",
        motif: data.motif,
        referenceDossier: data.referenceDossier ?? null,
        expiresAt: data.expiresAt ?? null,
        poseParUserId: input.poseParUserId,
      },
    });
    return { id: row.id };
  });
}

/**
 * Pose un hold ACTIF sur une période journal (bloque consolidation P3).
 */
export async function poseLegalHoldOnPeriode(input: {
  periodeCle: string;
  motif: string;
  referenceDossier?: string | null;
  expiresAt?: Date | null;
  poseParUserId: string | null;
  client?: typeof db;
}): Promise<{ id: string }> {
  const data = PoseLegalHoldPeriodeSchema.parse({
    periodeCle: input.periodeCle,
    motif: input.motif,
    referenceDossier: input.referenceDossier,
    expiresAt: input.expiresAt,
  });
  const client = input.client ?? db;

  return client.$transaction(async (tx) => {
    const existing = await tx.noteFraisLegalHold.findFirst({
      where: {
        cibleType: "JOURNAL_PERIODE",
        periodeCle: data.periodeCle,
        statut: "ACTIF",
      },
    });
    if (existing) {
      throw new Error(NOTES_FRAIS_LEGAL_HOLD_CONFLICT);
    }

    const row = await tx.noteFraisLegalHold.create({
      data: {
        cibleType: "JOURNAL_PERIODE",
        periodeCle: data.periodeCle,
        statut: "ACTIF",
        motif: data.motif,
        referenceDossier: data.referenceDossier ?? null,
        expiresAt: data.expiresAt ?? null,
        poseParUserId: input.poseParUserId,
      },
    });
    return { id: row.id };
  });
}

/**
 * Lève un hold ACTIF (pas de delete physique).
 */
export async function leverLegalHold(input: {
  holdId: string;
  leveParUserId: string | null;
  client?: typeof db;
}): Promise<{ id: string; alreadyLeve: boolean }> {
  const client = input.client ?? db;
  return client.$transaction(async (tx) => {
    const hold = await tx.noteFraisLegalHold.findUnique({
      where: { id: input.holdId },
    });
    if (!hold) {
      throw new Error(NOTES_FRAIS_LEGAL_HOLD_REQUIRED);
    }
    if (hold.statut === "LEVE") {
      return { id: hold.id, alreadyLeve: true };
    }
    await tx.noteFraisLegalHold.update({
      where: { id: hold.id },
      data: {
        statut: "LEVE",
        leveAt: new Date(),
        leveParUserId: input.leveParUserId,
      },
    });
    return { id: hold.id, alreadyLeve: false };
  });
}

/**
 * Expire les holds ACTIF dont expiresAt <= now.
 * Fail-safe : lève uniquement le statut — aucune purge/consolidation dans cette TX.
 * Le cycle worker suivant pourra opérer.
 *
 * @returns nombre de holds levés
 */
export async function expireLegalHoldsOnce(
  limit = 50,
  client: typeof db = db,
  now = new Date()
): Promise<number> {
  const due = await client.noteFraisLegalHold.findMany({
    where: {
      statut: "ACTIF",
      expiresAt: { lte: now },
    },
    take: limit,
    orderBy: { expiresAt: "asc" },
    select: { id: true },
  });

  let n = 0;
  for (const h of due) {
    await client.noteFraisLegalHold.update({
      where: { id: h.id },
      data: {
        statut: "LEVE",
        leveAt: now,
        leveParUserId: null,
      },
    });
    n += 1;
  }
  if (n > 0) {
    console.info("[notes-frais] legal_hold_expire", { count: n });
  }
  return n;
}

/**
 * SetNull acteurs hold lors de suppression compte (appelé depuis RGPD).
 */
export async function setNullLegalHoldActorsForUserInTx(
  tx: {
    noteFraisLegalHold: {
      updateMany: typeof db.noteFraisLegalHold.updateMany;
    };
  },
  userId: string
): Promise<void> {
  await tx.noteFraisLegalHold.updateMany({
    where: { poseParUserId: userId },
    data: { poseParUserId: null },
  });
  await tx.noteFraisLegalHold.updateMany({
    where: { leveParUserId: userId },
    data: { leveParUserId: null },
  });
}

/**
 * Liste les legal holds (opération admin).
 *
 * @param options - Filtre statut et limite
 * @param client - Prisma
 */
export async function listLegalHolds(
  options: { statut?: "ACTIF" | "LEVE" | "ALL"; limit?: number } = {},
  client: typeof db = db
): Promise<
  Array<{
    id: string;
    cibleType: string;
    archiveId: string | null;
    periodeCle: string | null;
    statut: string;
    motif: string;
    referenceDossier: string | null;
    posedAt: Date;
    leveAt: Date | null;
    expiresAt: Date | null;
  }>
> {
  const where =
    !options.statut || options.statut === "ALL"
      ? {}
      : { statut: options.statut };
  return client.noteFraisLegalHold.findMany({
    where,
    orderBy: [{ statut: "asc" }, { posedAt: "desc" }],
    take: Math.min(options.limit ?? 100, 200),
    select: {
      id: true,
      cibleType: true,
      archiveId: true,
      periodeCle: true,
      statut: true,
      motif: true,
      referenceDossier: true,
      posedAt: true,
      leveAt: true,
      expiresAt: true,
    },
  });
}
