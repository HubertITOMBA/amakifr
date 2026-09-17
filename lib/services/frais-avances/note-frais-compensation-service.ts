/**
 * Exécution réelle d'une compensation de note VALIDEE (lot 4.1 + notif 4.5).
 * Modes choix : COMPENSATION | MIXTE (part compensation uniquement).
 * Aucun remboursement, PaiementCotisation, 2ᵉ Depense.
 * Notif + outbox atomiques sur exécution fresh uniquement.
 */
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  NotesFraisDisabledError,
  assertNotesFraisEnabled,
} from "@/lib/frais-avances/feature-flag";
import { canUserExecuteNoteFraisCompensation } from "@/lib/frais-avances/authz";
import { hashIdForLog } from "@/lib/frais-avances/storage";
import { lockUserRowForNotesFrais } from "@/lib/services/frais-avances/rgpd-account-deletion";
import { normalizeNotesFraisMontant } from "@/lib/services/frais-avances/note-frais-decision-service";
import {
  applyCompensationReglementInTx,
  lockCompensationTargetsInTx,
  prepareCompensationLignesInTx,
} from "@/lib/services/frais-avances/note-frais-reglement-apply";
import { createNoteFraisReglementNotificationInTx } from "@/lib/services/frais-avances/note-frais-reglement-notify";

export type NotesFraisCompensationActionResult<T = unknown> =
  | { success: true; data: T; message?: string }
  | { success: false; error: string; code?: string };

export const NOTES_FRAIS_COMP_VERSION_CONFLICT =
  "Conflit de version — rechargez la note et réessayez";

export const NOTES_FRAIS_COMP_IDEMPOTENCY_CONFLICT =
  "Clé d'idempotence déjà utilisée avec un contenu de compensation différent";

export const NOTES_FRAIS_COMP_REFRESH_REQUIRED =
  "Montant demandé supérieur au restant actuel — actualisez les cibles et réessayez";

export type CompensationLigneInput = {
  typeCible: "COTISATION_MENSUELLE" | "DETTE_INITIALE";
  cibleId: string;
  /** Chaîne décimale préférée ; number accepté pour rétrocompat. */
  montant: string | number;
  rang: number;
};

export type ExecuteCompensationInput = {
  actorUserId: string;
  noteId: string;
  expectedNoteVersion: number;
  idempotencyKey: string;
  lignes: CompensationLigneInput[];
  client?: typeof db;
  beforeDemandeurLock?: () => Promise<void>;
  afterDemandeurLock?: () => Promise<void>;
  beforeNoteLock?: () => Promise<void>;
  afterNoteLock?: () => Promise<void>;
  /** Hook tests : appelé avant l'application de chaque ligne (index 0-based). */
  beforeApplyLigne?: (index: number) => Promise<void>;
  /** Hook tests : après notif+outbox, avant commit — erreur ⇒ rollback intégral. */
  afterNotifyOutbox?: () => Promise<void>;
};

export type CompensationExecutionDto = {
  reglementId: string;
  noteId: string;
  choixId: string;
  montantTotal: string;
  version: number;
  alreadyExecuted: boolean;
  lignes: Array<{
    typeCible: string;
    cibleId: string;
    montant: string;
    rang: number;
  }>;
};

function money(v: Prisma.Decimal | number | string): Prisma.Decimal {
  return new Prisma.Decimal(v);
}

function disabledResult(): NotesFraisCompensationActionResult<never> {
  return {
    success: false,
    error: "Le module frais avancés n'est pas activé.",
    code: "NOTES_FRAIS_DISABLED",
  };
}

function mapError(error: unknown): NotesFraisCompensationActionResult<never> {
  if (error instanceof NotesFraisDisabledError) return disabledResult();
  if (error instanceof Error) {
    let code: string | undefined;
    if (error.message === NOTES_FRAIS_COMP_VERSION_CONFLICT) {
      code = "VERSION_CONFLICT";
    }
    if (error.message === NOTES_FRAIS_COMP_IDEMPOTENCY_CONFLICT) {
      code = "IDEMPOTENCY_CONFLICT";
    }
    if (error.message === NOTES_FRAIS_COMP_REFRESH_REQUIRED) {
      code = "REFRESH_REQUIRED";
    }
    if (error.message.includes("Non autorisé")) code = "FORBIDDEN";
    if (error.message.includes("Auto-exécution")) {
      code = "AUTO_EXECUTION_FORBIDDEN";
    }
    return { success: false, error: error.message, code };
  }
  return { success: false, error: "Erreur inattendue" };
}

type NormalizedLigne = {
  typeCible: "COTISATION_MENSUELLE" | "DETTE_INITIALE";
  cibleId: string;
  montant: string;
  rang: number;
};

/**
 * Normalise et valide le payload lignes (sans accès DB).
 *
 * @param lignes - Lignes demandées
 * @returns Lignes normalisées triées par rang
 */
export function normalizeCompensationLignes(
  lignes: CompensationLigneInput[]
): NormalizedLigne[] {
  if (!Array.isArray(lignes) || lignes.length === 0) {
    throw new Error("Au moins une ligne de compensation est requise");
  }
  const seen = new Set<string>();
  const out: NormalizedLigne[] = [];
  for (const l of lignes) {
    if (
      l.typeCible !== "COTISATION_MENSUELLE" &&
      l.typeCible !== "DETTE_INITIALE"
    ) {
      throw new Error("Type de cible invalide");
    }
    if (!l.cibleId?.trim()) throw new Error("Identifiant de cible requis");
    if (!Number.isInteger(l.rang) || l.rang < 1) {
      throw new Error("Rang de ligne invalide");
    }
    const montantNorm = normalizeNotesFraisMontant(l.montant);
    if (!montantNorm) {
      throw new Error("Montant de ligne invalide");
    }
    const m = money(montantNorm);
    if (!(m.gt(0))) {
      throw new Error("Chaque montant de ligne doit être strictement positif");
    }
    const key = `${l.typeCible}:${l.cibleId}`;
    if (seen.has(key)) {
      throw new Error("Cible dupliquée dans les lignes");
    }
    seen.add(key);
    out.push({
      typeCible: l.typeCible,
      cibleId: l.cibleId.trim(),
      montant: montantNorm,
      rang: l.rang,
    });
  }
  out.sort((a, b) => a.rang - b.rang || a.cibleId.localeCompare(b.cibleId));
  return out;
}

/**
 * Somme exacte des montants normalisés.
 */
export function sumNormalizedLignes(lignes: NormalizedLigne[]): string {
  return lignes
    .reduce((acc, l) => acc.plus(money(l.montant)), money(0))
    .toFixed(2);
}

function sameCompensationContent(
  a: NormalizedLigne[],
  b: Array<{
    typeCible: string;
    cibleId: string;
    montant: Prisma.Decimal | number | string;
    rang: number;
  }>
): boolean {
  if (a.length !== b.length) return false;
  const nb = b
    .map((l) => ({
      typeCible: l.typeCible,
      cibleId: l.cibleId,
      montant: normalizeNotesFraisMontant(l.montant) ?? "0.00",
      rang: l.rang,
    }))
    .sort((x, y) => x.rang - y.rang || x.cibleId.localeCompare(y.cibleId));
  for (let i = 0; i < a.length; i++) {
    if (
      a[i]!.typeCible !== nb[i]!.typeCible ||
      a[i]!.cibleId !== nb[i]!.cibleId ||
      a[i]!.montant !== nb[i]!.montant ||
      a[i]!.rang !== nb[i]!.rang
    ) {
      return false;
    }
  }
  return true;
}

/**
 * Authz complète : auto-exécution + rôle/permission executeNoteFraisCompensation.
 */
async function assertExecutorAuthorized(
  actorUserId: string,
  demandeurUserId: string,
  client: typeof db
): Promise<void> {
  if (demandeurUserId === actorUserId) {
    throw new Error(
      "Auto-exécution interdite : l'exécuteur ne peut pas être le demandeur"
    );
  }
  const allowed = await canUserExecuteNoteFraisCompensation(
    actorUserId,
    client
  );
  if (!allowed) {
    throw new Error("Non autorisé à exécuter une compensation de note de frais");
  }
}

function isIdempotencyKeyUniqueViolation(error: unknown): boolean {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== "P2002"
  ) {
    return false;
  }
  const target = error.meta?.target;
  if (typeof target === "string") {
    return target.toLowerCase().includes("idempotency");
  }
  if (Array.isArray(target)) {
    return target.some(
      (t) =>
        typeof t === "string" && t.toLowerCase().includes("idempotency")
    );
  }
  // Ne pas masquer un P2002 d'eventKey outbox / autre contrainte.
  return false;
}

type ReglementWithLignes = {
  id: string;
  noteFraisId: string;
  choixId: string;
  type: string;
  montantTotal: Prisma.Decimal;
  Lignes: Array<{
    typeCible: string;
    cibleId: string;
    montant: Prisma.Decimal;
    rang: number;
  }>;
};

/**
 * Replay / conflit idempotent : authz d'abord, puis comparaison contenu.
 */
async function resolveIdempotentReglement(params: {
  client: typeof db;
  actorUserId: string;
  noteId: string;
  normalized: NormalizedLigne[];
  byKey: ReglementWithLignes;
}): Promise<NotesFraisCompensationActionResult<CompensationExecutionDto>> {
  const { client, actorUserId, noteId, normalized, byKey } = params;
  const note = await client.noteFrais.findUnique({
    where: { id: noteId },
    select: { version: true, demandeurUserId: true },
  });
  if (!note) throw new Error("Note introuvable");
  await assertExecutorAuthorized(actorUserId, note.demandeurUserId, client);

  if (byKey.noteFraisId !== noteId) {
    throw new Error("Clé d'idempotence déjà utilisée");
  }
  if (
    byKey.type === "COMPENSATION" &&
    sameCompensationContent(normalized, byKey.Lignes)
  ) {
    return {
      success: true,
      data: {
        reglementId: byKey.id,
        noteId,
        choixId: byKey.choixId,
        montantTotal: byKey.montantTotal.toFixed(2),
        version: note.version,
        alreadyExecuted: true,
        lignes: byKey.Lignes.map((l) => ({
          typeCible: l.typeCible,
          cibleId: l.cibleId,
          montant: l.montant.toFixed(2),
          rang: l.rang,
        })),
      },
      message: "Déjà exécutée",
    };
  }
  throw new Error(NOTES_FRAIS_COMP_IDEMPOTENCY_CONFLICT);
}

/**
 * Exécute une compensation (partielle ou totale) sur le choix ACTIF.
 *
 * @param input - Acteur, note, version OCC, clé d'idempotence, lignes
 */
export async function executeNoteFraisCompensation(
  input: ExecuteCompensationInput
): Promise<NotesFraisCompensationActionResult<CompensationExecutionDto>> {
  const client = input.client ?? db;
  try {
    assertNotesFraisEnabled();
    const key = input.idempotencyKey?.trim();
    if (!key || key.length < 8 || key.length > 64) {
      throw new Error("Clé d'idempotence requise (8–64 caractères)");
    }
    if (
      !Number.isInteger(input.expectedNoteVersion) ||
      input.expectedNoteVersion < 1
    ) {
      throw new Error("Version de note invalide");
    }

    const normalized = normalizeCompensationLignes(input.lignes);
    const montantTotal = sumNormalizedLignes(normalized);

    const byKey = await client.noteFraisReglement.findUnique({
      where: { idempotencyKey: key },
      include: { Lignes: true },
    });
    if (byKey) {
      return await resolveIdempotentReglement({
        client,
        actorUserId: input.actorUserId,
        noteId: input.noteId,
        normalized,
        byKey,
      });
    }

    const notePreview = await client.noteFrais.findUnique({
      where: { id: input.noteId },
      select: {
        id: true,
        statut: true,
        version: true,
        demandeurUserId: true,
        adherentId: true,
      },
    });
    if (!notePreview) throw new Error("Note introuvable");
    await assertExecutorAuthorized(
      input.actorUserId,
      notePreview.demandeurUserId,
      client
    );
    if (notePreview.statut !== "VALIDEE") {
      throw new Error("Seules les notes validées peuvent être compensées");
    }

    let result: {
      kind: "already" | "fresh";
      reglementId: string;
      choixId: string;
      montantTotal: string;
      version: number;
      lignes:
        | NormalizedLigne[]
        | Array<{
            typeCible: string;
            cibleId: string;
            montant: Prisma.Decimal;
            rang: number;
          }>;
    };
    try {
      result = await client.$transaction(async (tx) => {
      if (input.beforeDemandeurLock) await input.beforeDemandeurLock();
      await lockUserRowForNotesFrais(tx, notePreview.demandeurUserId);
      if (input.afterDemandeurLock) await input.afterDemandeurLock();

      if (input.beforeNoteLock) await input.beforeNoteLock();
      await tx.$executeRaw`
        SELECT id FROM notes_frais WHERE id = ${input.noteId} FOR UPDATE
      `;
      if (input.afterNoteLock) await input.afterNoteLock();

      const note = await tx.noteFrais.findUnique({
        where: { id: input.noteId },
      });
      if (!note) throw new Error("Note introuvable");
      if (note.demandeurUserId === input.actorUserId) {
        throw new Error(
          "Auto-exécution interdite : l'exécuteur ne peut pas être le demandeur"
        );
      }
      if (note.statut !== "VALIDEE") {
        throw new Error("Seules les notes validées peuvent être compensées");
      }

      // Idempotence avant OCC : un concurrent avec la même clé rejoue sans
      // être bloqué par l'incrément de version du vainqueur.
      const existingKey = await tx.noteFraisReglement.findUnique({
        where: { idempotencyKey: key },
        include: { Lignes: true },
      });
      if (existingKey) {
        if (
          existingKey.noteFraisId === input.noteId &&
          sameCompensationContent(normalized, existingKey.Lignes)
        ) {
          return {
            kind: "already" as const,
            reglementId: existingKey.id,
            choixId: existingKey.choixId,
            montantTotal: existingKey.montantTotal.toFixed(2),
            version: note.version,
            lignes: existingKey.Lignes,
          };
        }
        throw new Error(NOTES_FRAIS_COMP_IDEMPOTENCY_CONFLICT);
      }

      if (note.version !== input.expectedNoteVersion) {
        throw new Error(NOTES_FRAIS_COMP_VERSION_CONFLICT);
      }

      await tx.$executeRaw`
        SELECT id FROM notes_frais_choix_reglement
        WHERE "noteFraisId" = ${input.noteId} AND statut = 'ACTIF'
        FOR UPDATE
      `;

      const choix = await tx.noteFraisChoixReglement.findFirst({
        where: { noteFraisId: input.noteId, statut: "ACTIF" },
        include: {
          Cibles: { orderBy: { rang: "asc" } },
        },
      });
      if (!choix) {
        throw new Error("Aucun choix de règlement ACTIF pour cette note");
      }
      if (choix.mode !== "COMPENSATION" && choix.mode !== "MIXTE") {
        throw new Error(
          "Compensation réservée aux choix COMPENSATION ou MIXTE"
        );
      }
      if (!(money(choix.montantCompensation).gt(0))) {
        throw new Error("Ce choix n'autorise aucune compensation");
      }

      await tx.$executeRaw`
        SELECT id FROM notes_frais_choix_reglement_cibles
        WHERE "choixId" = ${choix.id}
        ORDER BY rang ASC
        FOR UPDATE
      `;

      // Verrou dettes/CM ordre déterministe type puis id
      await lockCompensationTargetsInTx(tx, normalized);

      // Recharger choix/cibles après locks (compteurs)
      const choixFresh = await tx.noteFraisChoixReglement.findUniqueOrThrow({
        where: { id: choix.id },
        include: { Cibles: true },
      });
      const ciblesFresh = new Map(
        choixFresh.Cibles.map((c) => [`${c.typeCible}:${c.cibleId}`, c])
      );

      const plafondRestant = money(choixFresh.montantCompensation).minus(
        money(choixFresh.montantCompensationUtilise)
      );
      if (money(montantTotal).gt(plafondRestant)) {
        throw new Error(
          "Le total dépasse le montant de compensation encore disponible sur le choix"
        );
      }

      const prepared = await prepareCompensationLignesInTx({
        tx,
        adherentId: note.adherentId,
        normalized,
        ciblesFresh,
      });

      const executeAt = new Date();
      const claimed = await tx.noteFrais.updateMany({
        where: {
          id: input.noteId,
          statut: "VALIDEE",
          version: input.expectedNoteVersion,
        },
        data: { version: { increment: 1 } },
      });
      if (claimed.count !== 1) {
        throw new Error(NOTES_FRAIS_COMP_VERSION_CONFLICT);
      }

      const { reglementId } = await applyCompensationReglementInTx({
        tx,
        noteId: input.noteId,
        adherentId: note.adherentId,
        choixId: choixFresh.id,
        executeurUserId: input.actorUserId,
        executeAt,
        montantTotal,
        prepared,
        idempotencyKey: key,
        operationId: null,
        beforeApplyLigne: input.beforeApplyLigne,
      });

      await tx.noteFraisChoixReglement.update({
        where: { id: choixFresh.id },
        data: {
          montantCompensationUtilise: { increment: money(montantTotal) },
        },
      });

      await createNoteFraisReglementNotificationInTx(tx, {
        noteId: input.noteId,
        demandeurUserId: note.demandeurUserId,
        kind: "REGLEMENT_COMPENSATION",
        anchorId: reglementId,
      });
      if (input.afterNotifyOutbox) await input.afterNotifyOutbox();

      return {
        kind: "fresh" as const,
        reglementId,
        choixId: choixFresh.id,
        montantTotal,
        version: input.expectedNoteVersion + 1,
        lignes: normalized,
      };
      });
    } catch (txError) {
      // Filet concurrent : unique idempotencyKey après rollback TX
      if (!isIdempotencyKeyUniqueViolation(txError)) throw txError;
      const existing = await client.noteFraisReglement.findUnique({
        where: { idempotencyKey: key },
        include: { Lignes: true },
      });
      if (!existing) throw txError;
      return await resolveIdempotentReglement({
        client,
        actorUserId: input.actorUserId,
        noteId: input.noteId,
        normalized,
        byKey: existing,
      });
    }

    if (result.kind === "already") {
      return {
        success: true,
        data: {
          reglementId: result.reglementId,
          noteId: input.noteId,
          choixId: result.choixId,
          montantTotal: result.montantTotal,
          version: result.version,
          alreadyExecuted: true,
          lignes: result.lignes.map((l) => ({
            typeCible: l.typeCible,
            cibleId: l.cibleId,
            montant:
              typeof l.montant === "string"
                ? l.montant
                : l.montant.toFixed(2),
            rang: l.rang,
          })),
        },
        message: "Déjà exécutée",
      };
    }

    if (!input.client) {
      void import("@/lib/services/frais-avances/note-frais-service")
        .then(({ processNoteFraisOutboxOnce }) => processNoteFraisOutboxOnce())
        .catch((err) => {
          console.error("[notes-frais] outbox kick failed after compensation", {
            note: hashIdForLog(input.noteId),
            err: err instanceof Error ? err.message.slice(0, 120) : "unknown",
          });
        });
    }

    return {
      success: true,
      data: {
        reglementId: result.reglementId,
        noteId: input.noteId,
        choixId: result.choixId,
        montantTotal: result.montantTotal,
        version: result.version,
        alreadyExecuted: false,
        lignes: result.lignes as NormalizedLigne[],
      },
      message: "Compensation exécutée",
    };
  } catch (error) {
    return mapError(error);
  }
}
