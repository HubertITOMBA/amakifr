import {
  canUpdateParticipation,
  isReunionPast,
} from "@/lib/services/reunions/reunion-helpers";

/**
 * Client transactionnel minimal pour le protocole de verrou réunion.
 * Tous les accès métier de la TX doivent passer par ce `tx` (pas le client global).
 */
export type ReunionLockTx = {
  $queryRaw: <T = unknown>(
    query: TemplateStringsArray,
    ...values: unknown[]
  ) => Promise<T>;
  reunionMensuelle: {
    findUnique: (args: unknown) => Promise<unknown>;
    update: (args: unknown) => Promise<unknown>;
  };
  participationReunion?: {
    findUnique?: (args: unknown) => Promise<unknown>;
    findMany?: (args: unknown) => Promise<unknown>;
    $queryRaw?: ReunionLockTx["$queryRaw"];
  };
};

export type LockedReunionParticipationFields = {
  id: string;
  statut: string;
  dateReunion: Date | null;
};

/**
 * Erreur métier : réunion non modifiable pour une participation
 * (annulée, non confirmée, passée, etc.) — distincte d'un CONFLICT de delta.
 */
export class ReunionParticipationNotWritableError extends Error {
  readonly code = "REUNION_NOT_WRITABLE" as const;
  constructor(
    message = "Modification de participation non autorisée pour cette réunion."
  ) {
    super(message);
    this.name = "ReunionParticipationNotWritableError";
  }
}

/**
 * Acquiert un verrou ligne `FOR UPDATE` sur `reunions_mensuelles`.
 *
 * **Ordre de verrouillage commun** : toujours la réunion en premier, puis les
 * participations (adherentId ASC). Un seul `reunionId` par transaction →
 * pas de cycle multi-réunions. Les writers ne doivent pas `FOR UPDATE` une
 * autre réunion dans la même TX.
 *
 * @returns `true` si la ligne existe et est verrouillée
 */
export async function lockReunionRowForUpdate(
  tx: Pick<ReunionLockTx, "$queryRaw">,
  reunionId: string
): Promise<boolean> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM reunions_mensuelles WHERE id = ${reunionId} FOR UPDATE
  `;
  return rows.length > 0;
}

/**
 * Sous verrou réunion déjà acquis : verrouille les lignes participation
 * existantes pour les `adherentId` donnés, dans un ordre déterministe (ASC).
 *
 * Les adherentId sans ligne ne sont pas verrouillés (création ultérieure
 * sérialisée par le verrou réunion parent). Une requête par id (paramétrée)
 * garantit l'ordre d'acquisition.
 */
export async function lockParticipationRowsSequentially(
  tx: Pick<ReunionLockTx, "$queryRaw">,
  reunionId: string,
  adherentIds: string[]
): Promise<void> {
  for (const adherentId of sortAdherentIdsDeterministic(adherentIds)) {
    await tx.$queryRaw`
      SELECT id FROM participations_reunion
      WHERE "reunionId" = ${reunionId} AND "adherentId" = ${adherentId}
      FOR UPDATE
    `;
  }
}

/**
 * Tri déterministe des adherentId pour l'ordre de verrou / écriture.
 */
export function sortAdherentIdsDeterministic(adherentIds: string[]): string[] {
  return [...new Set(adherentIds.filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "en")
  );
}

/**
 * Tri déterministe d'un delta admin par adherentId.
 */
export function sortParticipationDeltaByAdherentId<
  T extends { adherentId: string },
>(items: T[]): T[] {
  return [...items].sort((a, b) =>
    a.adherentId.localeCompare(b.adherentId, "en")
  );
}

/**
 * Relit les règles de participation sous verrou (DateConfirmee + jour civil Paris).
 * @throws {ReunionParticipationNotWritableError}
 */
export function assertReunionAllowsParticipationWrite(
  reunion: LockedReunionParticipationFields,
  now: Date = new Date()
): void {
  if (reunion.statut !== "DateConfirmee") {
    throw new ReunionParticipationNotWritableError(
      reunion.statut === "Annulee"
        ? "Cette réunion est annulée. Vous ne pouvez plus modifier votre participation."
        : "La date de la réunion n'est pas encore confirmée. Vous pourrez confirmer votre présence une fois la date validée."
    );
  }
  if (!reunion.dateReunion || isReunionPast(reunion.dateReunion, now)) {
    throw new ReunionParticipationNotWritableError(
      "Cette réunion est passée. Vous ne pouvez plus modifier votre participation."
    );
  }
  if (
    !canUpdateParticipation({
      statut: reunion.statut,
      dateReunion: reunion.dateReunion,
      now,
    })
  ) {
    throw new ReunionParticipationNotWritableError();
  }
}

/**
 * Protocole participation : verrou réunion → relecture → assert →
 * verrous participation (ids triés) → callback d'écriture (toujours via `tx`).
 *
 * Aucun appel externe (mail, HTTP) dans le callback.
 */
export async function withReunionParticipationLocks<T>(
  tx: ReunionLockTx,
  reunionId: string,
  adherentIds: string[],
  run: (reunion: LockedReunionParticipationFields) => Promise<T>,
  now: Date = new Date()
): Promise<T> {
  const locked = await lockReunionRowForUpdate(tx, reunionId);
  if (!locked) {
    throw new ReunionParticipationNotWritableError("Réunion non trouvée");
  }

  const reunion = (await tx.reunionMensuelle.findUnique({
    where: { id: reunionId },
    select: { id: true, statut: true, dateReunion: true },
  })) as LockedReunionParticipationFields | null;

  if (!reunion) {
    throw new ReunionParticipationNotWritableError("Réunion non trouvée");
  }

  assertReunionAllowsParticipationWrite(reunion, now);

  await lockParticipationRowsSequentially(tx, reunionId, adherentIds);

  return run(reunion);
}

/**
 * Protocole writers date/statut : verrou réunion → callback (relecture + écriture via `tx`).
 * Pas d'assert participation ; le callback décide des règles métier.
 * Aucun appel externe dans le callback.
 */
export async function withReunionRowLock<T>(
  tx: ReunionLockTx,
  reunionId: string,
  run: () => Promise<T>
): Promise<T> {
  const locked = await lockReunionRowForUpdate(tx, reunionId);
  if (!locked) {
    const err = new Error("REUNION_NOT_FOUND");
    err.name = "ReunionNotFoundError";
    throw err;
  }
  return run();
}
