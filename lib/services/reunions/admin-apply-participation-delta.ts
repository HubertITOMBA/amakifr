import { type StatutParticipationReunion } from "@prisma/client";

export type AdminExpectedParticipation =
  | { kind: "absent" }
  | {
      kind: "row";
      statut: StatutParticipationReunion | "Present" | "Absent" | "Excuse" | "NonRepondu";
      justificatifFournit: boolean;
    };

export type AdminParticipationDeltaItem = {
  adherentId: string;
  statut: "Present" | "Absent" | "Excuse" | "NonRepondu";
  justificatifFournit?: boolean;
  justificatifNote?: string | null;
  commentaire?: string | null;
  expected: AdminExpectedParticipation;
};

export class ParticipationConflictError extends Error {
  constructor(message = "PARTICIPATION_CONFLICT") {
    super(message);
    this.name = "ParticipationConflictError";
  }
}

/** Nom exact de l'index unique Prisma/PG sur (reunionId, adherentId). */
export const PARTICIPATION_REUNION_ADHERENT_UNIQUE_INDEX =
  "participations_reunion_reunionId_adherentId_key";

/** Client TX minimal — compatible Prisma sans forcer les types CreateInput. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ParticipationTx = { participationReunion: any };

/**
 * Paire exacte des champs de l'unicité participation (ordre indifférent).
 */
function isExactParticipationFieldPair(fields: string[]): boolean {
  if (fields.length !== 2) return false;
  const set = new Set(fields);
  return set.has("reunionId") && set.has("adherentId");
}

/**
 * Indique si l'erreur est une collision unique sur la participation
 * `(reunionId, adherentId)` — seule collision assimilable à un conflit
 * concurrent. Validation **structurelle** (pas d'`instanceof` Prisma) :
 * objet non null, `code === "P2002"`, `meta.target` reconnu.
 *
 * Formes acceptées de `meta.target` :
 * - `["reunionId", "adherentId"]` (ordre libre) ;
 * - `["participations_reunion_reunionId_adherentId_key"]` ;
 * - `"participations_reunion_reunionId_adherentId_key"`.
 *
 * Tout autre P2002 (autre contrainte, target absent/malformé) → false.
 */
export function isParticipationUniqueViolation(error: unknown): boolean {
  if (error === null || typeof error !== "object") {
    return false;
  }
  const record = error as { code?: unknown; meta?: unknown };
  if (record.code !== "P2002") {
    return false;
  }
  if (record.meta === null || typeof record.meta !== "object") {
    return false;
  }
  const target = (record.meta as { target?: unknown }).target;

  if (Array.isArray(target)) {
    const fields = target.map(String);
    if (
      fields.length === 1 &&
      fields[0] === PARTICIPATION_REUNION_ADHERENT_UNIQUE_INDEX
    ) {
      return true;
    }
    return isExactParticipationFieldPair(fields);
  }

  if (typeof target === "string") {
    return target === PARTICIPATION_REUNION_ADHERENT_UNIQUE_INDEX;
  }

  return false;
}

/**
 * Applique un item du delta admin avec écritures conditionnelles.
 * Prérequis : verrou réunion (+ participations) déjà acquis dans la TX.
 *
 * - expected `row` + réponse : `updateMany` filtré par état attendu ;
 * - expected `row` + NonRepondu : `deleteMany` filtré par état attendu ;
 * - expected `absent` + réponse : `create` seul (P2002 participation → conflit) ;
 * - expected `absent` + NonRepondu : **lecture sous verrou** — absence → no-op
 *   sans écriture ; ligne apparue → CONFLICT. Jamais de delete/create sonde.
 *
 * count ≠ 1 → {@link ParticipationConflictError}.
 * Autres erreurs SQL : propagées telles quelles (aucun retry / relecture
 * après échec d'écriture dans la TX).
 *
 * Limite documentée : sans version, un aller-retour A→B→A n'est pas détecté.
 */
export async function applyAdminParticipationDeltaItem(
  tx: ParticipationTx,
  reunionId: string,
  item: AdminParticipationDeltaItem
): Promise<void> {
  const justificatifFournit = item.justificatifFournit ?? false;

  if (item.expected.kind === "row") {
    const expectedWhere = {
      reunionId,
      adherentId: item.adherentId,
      statut: item.expected.statut,
      justificatifFournit: item.expected.justificatifFournit,
    };

    if (item.statut === "NonRepondu") {
      const deleted = await tx.participationReunion.deleteMany({
        where: expectedWhere,
      });
      if (deleted.count !== 1) {
        throw new ParticipationConflictError();
      }
      return;
    }

    const updated = await tx.participationReunion.updateMany({
      where: expectedWhere,
      data: {
        statut: item.statut as StatutParticipationReunion,
        justificatifFournit,
        ...(item.justificatifNote !== undefined
          ? { justificatifNote: item.justificatifNote }
          : {}),
        ...(item.commentaire !== undefined
          ? { commentaire: item.commentaire }
          : {}),
      },
    });
    if (updated.count !== 1) {
      throw new ParticipationConflictError();
    }
    return;
  }

  // expected.kind === "absent"
  if (item.statut === "NonRepondu") {
    const existing = await tx.participationReunion.findUnique({
      where: {
        reunionId_adherentId: {
          reunionId,
          adherentId: item.adherentId,
        },
      },
      select: { adherentId: true },
    });
    if (existing) {
      throw new ParticipationConflictError();
    }
    // Absence confirmée sous verrou → no-op (aucune écriture)
    return;
  }

  try {
    await tx.participationReunion.create({
      data: {
        reunionId,
        adherentId: item.adherentId,
        statut: item.statut as StatutParticipationReunion,
        justificatifFournit,
        justificatifNote: item.justificatifNote ?? null,
        commentaire: item.commentaire ?? null,
      },
    });
  } catch (error) {
    // Classer au plus près du create — pas de retry / findUnique ici
    if (isParticipationUniqueViolation(error)) {
      throw new ParticipationConflictError();
    }
    throw error;
  }
}
