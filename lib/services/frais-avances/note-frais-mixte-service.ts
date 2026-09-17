/**
 * Exécution mixte atomique (lot 4.3 + notif 4.5) — parent Operation + 2 règlements enfants.
 * Ne appelle pas les services publics compensation/remboursement.
 * Une seule notif/outbox sur l'opération parente (jamais par enfant).
 */
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  NotesFraisDisabledError,
  assertNotesFraisEnabled,
} from "@/lib/frais-avances/feature-flag";
import { canUserExecuteNoteFraisReglementMixte } from "@/lib/frais-avances/authz";
import { hashIdForLog } from "@/lib/frais-avances/storage";
import { lockUserRowForNotesFrais } from "@/lib/services/frais-avances/rgpd-account-deletion";
import { normalizeNotesFraisMontant } from "@/lib/services/frais-avances/note-frais-decision-service";
import {
  NOTES_FRAIS_COMP_REFRESH_REQUIRED,
  normalizeCompensationLignes,
  sumNormalizedLignes,
  type CompensationLigneInput,
} from "@/lib/services/frais-avances/note-frais-compensation-service";
import {
  normalizeRemboursementReference,
  parseAndCanonicalizeExecuteAt,
  type MoyenRemboursementNoteFrais,
  type NotesFraisClock,
} from "@/lib/services/frais-avances/note-frais-remboursement-service";
import {
  applyCompensationReglementInTx,
  createRemboursementReglementInTx,
  lockCompensationTargetsInTx,
  prepareCompensationLignesInTx,
} from "@/lib/services/frais-avances/note-frais-reglement-apply";
import { createNoteFraisReglementNotificationInTx } from "@/lib/services/frais-avances/note-frais-reglement-notify";

export type NotesFraisMixteActionResult<T = unknown> =
  | { success: true; data: T; message?: string }
  | { success: false; error: string; code?: string };

export const NOTES_FRAIS_MIXTE_VERSION_CONFLICT =
  "Conflit de version — rechargez la note et réessayez";

export const NOTES_FRAIS_MIXTE_IDEMPOTENCY_CONFLICT =
  "Clé d'idempotence déjà utilisée avec un contenu mixte différent";

export const NOTES_FRAIS_MIXTE_USE_SIMPLE =
  "Exécution MIXTE refusée : une partie est nulle — utilisez le service simple correspondant";

/** Parent trouvé sans exactement un COMPENSATION et un REMBOURSEMENT — fail-closed. */
export const NOTES_FRAIS_MIXTE_OPERATION_INCOMPLETE =
  "NOTES_FRAIS_MIXTE_OPERATION_INCOMPLETE";

const defaultClock: NotesFraisClock = { now: () => new Date() };

function money(v: Prisma.Decimal | number | string): Prisma.Decimal {
  return new Prisma.Decimal(v);
}

export type ExecuteMixteInput = {
  actorUserId: string;
  noteId: string;
  expectedNoteVersion: number;
  idempotencyKey: string;
  montantRembourse: string | number;
  moyen: MoyenRemboursementNoteFrais;
  reference: string;
  executeAt: string;
  lignesCompensation: CompensationLigneInput[];
  client?: typeof db;
  clock?: NotesFraisClock;
  beforeDemandeurLock?: () => Promise<void>;
  afterDemandeurLock?: () => Promise<void>;
  beforeNoteLock?: () => Promise<void>;
  afterNoteLock?: () => Promise<void>;
  /** Hook tests : après enfant compensation, avant remboursement. */
  afterCompensationChild?: () => Promise<void>;
  /** Hook tests : après les deux enfants, avant notif/compteurs. */
  afterBothChildren?: () => Promise<void>;
  /** Hook tests : après notif+outbox, avant commit — erreur ⇒ rollback intégral. */
  afterNotifyOutbox?: () => Promise<void>;
};

export type MixteExecutionDto = {
  operationId: string;
  noteId: string;
  choixId: string;
  executeAt: string;
  version: number;
  alreadyExecuted: boolean;
  compensation: {
    reglementId: string;
    montantTotal: string;
  };
  remboursement: {
    reglementId: string;
    montantTotal: string;
    moyen: MoyenRemboursementNoteFrais;
  };
};

function disabledResult(): NotesFraisMixteActionResult<never> {
  return {
    success: false,
    error: "Le module frais avancés n'est pas activé.",
    code: "NOTES_FRAIS_DISABLED",
  };
}

function mapError(error: unknown): NotesFraisMixteActionResult<never> {
  if (error instanceof NotesFraisDisabledError) return disabledResult();
  if (error instanceof Error) {
    let code: string | undefined;
    if (error.message === NOTES_FRAIS_MIXTE_VERSION_CONFLICT) {
      code = "VERSION_CONFLICT";
    }
    if (error.message === NOTES_FRAIS_MIXTE_IDEMPOTENCY_CONFLICT) {
      code = "IDEMPOTENCY_CONFLICT";
    }
    if (
      error.message === NOTES_FRAIS_COMP_REFRESH_REQUIRED ||
      error.message.includes("actualisez les cibles")
    ) {
      code = "REFRESH_REQUIRED";
    }
    if (error.message === NOTES_FRAIS_MIXTE_USE_SIMPLE) {
      code = "USE_SIMPLE_SERVICE";
    }
    if (error.message === NOTES_FRAIS_MIXTE_OPERATION_INCOMPLETE) {
      code = NOTES_FRAIS_MIXTE_OPERATION_INCOMPLETE;
    }
    if (error.message.includes("Non autorisé")) code = "FORBIDDEN";
    if (error.message.includes("Auto-exécution")) {
      code = "AUTO_EXECUTION_FORBIDDEN";
    }
    if (error.message.includes("référence") || error.message.includes("Référence")) {
      code = "REFERENCE_INVALIDE";
    }
    if (error.message.includes("date") || error.message.includes("Date")) {
      code = "DATE_INVALIDE";
    }
    if (error.message.includes("moyen") || error.message.includes("Moyen")) {
      code = "MOYEN_INVALIDE";
    }
    return { success: false, error: error.message, code };
  }
  return { success: false, error: "Erreur inattendue" };
}

type IdempotentMixteContent = {
  noteId: string;
  montantRembourse: string;
  lignes: ReturnType<typeof normalizeCompensationLignes>;
  moyen: MoyenRemboursementNoteFrais;
  referenceNormalisee: string;
  executeAtIso: string;
};

function sameMixteContent(
  a: IdempotentMixteContent,
  op: {
    noteFraisId: string;
    executeAt: Date;
    Reglements: Array<{
      type: string;
      montantTotal: Prisma.Decimal;
      moyen: string | null;
      referenceNormalisee: string | null;
      executeAt: Date;
      Lignes: Array<{
        typeCible: string | null;
        cibleId: string | null;
        montant: Prisma.Decimal;
        rang: number;
      }>;
    }>;
  }
): boolean {
  if (op.noteFraisId !== a.noteId) return false;
  if (op.executeAt.toISOString() !== a.executeAtIso) return false;
  const remb = op.Reglements.find((r) => r.type === "REMBOURSEMENT");
  const comp = op.Reglements.find((r) => r.type === "COMPENSATION");
  // Précondition : assertOperationChildrenComplete déjà appelée.
  if (!remb || !comp) return false;
  if ((normalizeNotesFraisMontant(remb.montantTotal) ?? "") !== a.montantRembourse) {
    return false;
  }
  if (remb.moyen !== a.moyen) return false;
  if ((remb.referenceNormalisee ?? "") !== a.referenceNormalisee) return false;
  if (remb.executeAt.toISOString() !== a.executeAtIso) return false;
  if (comp.executeAt.toISOString() !== a.executeAtIso) return false;
  const compLignes = comp.Lignes.filter((l) => l.typeCible && l.cibleId).map(
    (l) => ({
      typeCible: l.typeCible!,
      cibleId: l.cibleId!,
      montant: l.montant,
      rang: l.rang,
    })
  );
  if (a.lignes.length !== compLignes.length) return false;
  const sorted = [...compLignes].sort(
    (x, y) => x.rang - y.rang || x.cibleId.localeCompare(y.cibleId)
  );
  for (let i = 0; i < a.lignes.length; i++) {
    if (
      a.lignes[i]!.typeCible !== sorted[i]!.typeCible ||
      a.lignes[i]!.cibleId !== sorted[i]!.cibleId ||
      a.lignes[i]!.montant !==
        (normalizeNotesFraisMontant(sorted[i]!.montant) ?? "") ||
      a.lignes[i]!.rang !== sorted[i]!.rang
    ) {
      return false;
    }
  }
  return true;
}

type OpReglementChild = {
  id: string;
  type: string;
  montantTotal: Prisma.Decimal;
  moyen: string | null;
  referenceNormalisee: string | null;
  executeAt: Date;
  Lignes: Array<{
    typeCible: string | null;
    cibleId: string | null;
    montant: Prisma.Decimal;
    rang: number;
  }>;
};

/**
 * Fail-closed : exactement un COMPENSATION et un REMBOURSEMENT.
 * Aucune réparation automatique.
 */
function assertOperationChildrenComplete(reglements: OpReglementChild[]): {
  remb: OpReglementChild;
  comp: OpReglementChild;
} {
  const comps = reglements.filter((r) => r.type === "COMPENSATION");
  const rembs = reglements.filter((r) => r.type === "REMBOURSEMENT");
  if (comps.length !== 1 || rembs.length !== 1) {
    throw new Error(NOTES_FRAIS_MIXTE_OPERATION_INCOMPLETE);
  }
  return { remb: rembs[0]!, comp: comps[0]! };
}

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
  const allowed = await canUserExecuteNoteFraisReglementMixte(
    actorUserId,
    client
  );
  if (!allowed) {
    throw new Error("Non autorisé à exécuter un règlement mixte de note de frais");
  }
}

function isOperationIdempotencyUniqueViolation(error: unknown): boolean {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== "P2002"
  ) {
    return false;
  }
  const target = error.meta?.target;
  const hay = Array.isArray(target)
    ? target.join(" ").toLowerCase()
    : String(target ?? "").toLowerCase();
  // Ne pas transformer unique(operationId,type) en replay.
  if (hay.includes("operationid") && hay.includes("type")) return false;
  return hay.includes("idempotency");
}

async function resolveIdempotentOperation(params: {
  client: typeof db;
  actorUserId: string;
  content: IdempotentMixteContent;
  byKey: {
    id: string;
    noteFraisId: string;
    choixId: string;
    executeAt: Date;
    Reglements: Array<{
      id: string;
      type: string;
      montantTotal: Prisma.Decimal;
      moyen: string | null;
      referenceNormalisee: string | null;
      executeAt: Date;
      Lignes: Array<{
        typeCible: string | null;
        cibleId: string | null;
        montant: Prisma.Decimal;
        rang: number;
      }>;
    }>;
  };
}): Promise<NotesFraisMixteActionResult<MixteExecutionDto>> {
  const { client, actorUserId, content, byKey } = params;
  const note = await client.noteFrais.findUnique({
    where: { id: content.noteId },
    select: { version: true, demandeurUserId: true },
  });
  if (!note) throw new Error("Note introuvable");
  await assertExecutorAuthorized(actorUserId, note.demandeurUserId, client);

  if (byKey.noteFraisId !== content.noteId) {
    throw new Error(NOTES_FRAIS_MIXTE_IDEMPOTENCY_CONFLICT);
  }
  const { remb, comp } = assertOperationChildrenComplete(byKey.Reglements);
  if (sameMixteContent(content, byKey)) {
    return {
      success: true,
      data: {
        operationId: byKey.id,
        noteId: content.noteId,
        choixId: byKey.choixId,
        executeAt: byKey.executeAt.toISOString(),
        version: note.version,
        alreadyExecuted: true,
        compensation: {
          reglementId: comp.id,
          montantTotal: comp.montantTotal.toFixed(2),
        },
        remboursement: {
          reglementId: remb.id,
          montantTotal: remb.montantTotal.toFixed(2),
          moyen: remb.moyen as MoyenRemboursementNoteFrais,
        },
      },
      message: "Déjà exécuté",
    };
  }
  throw new Error(NOTES_FRAIS_MIXTE_IDEMPOTENCY_CONFLICT);
}

/**
 * Exécute compensation + remboursement dans une seule TX (mode MIXTE).
 */
export async function executeNoteFraisReglementMixte(
  input: ExecuteMixteInput
): Promise<NotesFraisMixteActionResult<MixteExecutionDto>> {
  const client = input.client ?? db;
  const clock = input.clock ?? defaultClock;
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
    if (input.moyen !== "VIREMENT" && input.moyen !== "ESPECES") {
      throw new Error("Moyen de règlement invalide (VIREMENT ou ESPECES)");
    }

    const montantRembNorm = normalizeNotesFraisMontant(input.montantRembourse);
    if (!montantRembNorm || !money(montantRembNorm).gt(0)) {
      throw new Error(NOTES_FRAIS_MIXTE_USE_SIMPLE);
    }
    const normalizedComp = normalizeCompensationLignes(
      input.lignesCompensation
    );
    const montantCompNorm = sumNormalizedLignes(normalizedComp);
    if (!money(montantCompNorm).gt(0)) {
      throw new Error(NOTES_FRAIS_MIXTE_USE_SIMPLE);
    }

    const { brute, normalisee } = normalizeRemboursementReference(
      input.reference
    );
    const { date: executeAtDate, canonicalIso } = parseAndCanonicalizeExecuteAt(
      input.executeAt
    );
    const nowMs = clock.now().getTime();
    const maxFutureMs = nowMs + 5 * 60 * 1000;

    const content: IdempotentMixteContent = {
      noteId: input.noteId,
      montantRembourse: montantRembNorm,
      lignes: normalizedComp,
      moyen: input.moyen,
      referenceNormalisee: normalisee,
      executeAtIso: canonicalIso,
    };

    const byKey = await client.noteFraisReglementOperation.findUnique({
      where: { idempotencyKey: key },
      include: {
        Reglements: { include: { Lignes: true } },
      },
    });
    if (byKey) {
      return await resolveIdempotentOperation({
        client,
        actorUserId: input.actorUserId,
        content,
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
        decideeAt: true,
        montantAccepte: true,
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
      throw new Error("Seules les notes validées peuvent être réglées");
    }
    if (!notePreview.decideeAt) {
      throw new Error("Date de décision manquante sur la note");
    }
    if (executeAtDate.getTime() < notePreview.decideeAt.getTime()) {
      throw new Error("Date d'exécution antérieure à la décision de la note");
    }
    if (executeAtDate.getTime() > maxFutureMs) {
      throw new Error(
        "Date d'exécution trop dans le futur (tolérance 5 minutes)"
      );
    }

    let result: {
      kind: "already" | "fresh";
      operationId: string;
      choixId: string;
      executeAt: string;
      version: number;
      compensationId: string;
      compensationTotal: string;
      remboursementId: string;
      remboursementTotal: string;
      moyen: MoyenRemboursementNoteFrais;
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
          throw new Error("Seules les notes validées peuvent être réglées");
        }
        if (note.montantAccepte == null) {
          throw new Error("Montant accepté manquant");
        }

        // Idempotence avant OCC : un concurrent avec la même clé rejoue sans
        // être bloqué par l'incrément de version du vainqueur.
        const existingOp = await tx.noteFraisReglementOperation.findUnique({
          where: { idempotencyKey: key },
          include: { Reglements: { include: { Lignes: true } } },
        });
        if (existingOp) {
          if (existingOp.noteFraisId !== input.noteId) {
            throw new Error(NOTES_FRAIS_MIXTE_IDEMPOTENCY_CONFLICT);
          }
          const { remb, comp } = assertOperationChildrenComplete(
            existingOp.Reglements
          );
          if (sameMixteContent(content, existingOp)) {
            return {
              kind: "already" as const,
              operationId: existingOp.id,
              choixId: existingOp.choixId,
              executeAt: existingOp.executeAt.toISOString(),
              version: note.version,
              compensationId: comp.id,
              compensationTotal: comp.montantTotal.toFixed(2),
              remboursementId: remb.id,
              remboursementTotal: remb.montantTotal.toFixed(2),
              moyen: remb.moyen as MoyenRemboursementNoteFrais,
            };
          }
          throw new Error(NOTES_FRAIS_MIXTE_IDEMPOTENCY_CONFLICT);
        }

        if (note.version !== input.expectedNoteVersion) {
          throw new Error(NOTES_FRAIS_MIXTE_VERSION_CONFLICT);
        }

        await tx.$executeRaw`
          SELECT id FROM notes_frais_choix_reglement
          WHERE "noteFraisId" = ${input.noteId} AND statut = 'ACTIF'
          FOR UPDATE
        `;

        const choix = await tx.noteFraisChoixReglement.findFirst({
          where: { noteFraisId: input.noteId, statut: "ACTIF" },
          include: { Cibles: { orderBy: { rang: "asc" } } },
        });
        if (!choix) {
          throw new Error("Aucun choix de règlement ACTIF pour cette note");
        }
        if (choix.mode !== "MIXTE") {
          throw new Error("Exécution mixte réservée au choix MIXTE");
        }

        await tx.$executeRaw`
          SELECT id FROM notes_frais_choix_reglement_cibles
          WHERE "choixId" = ${choix.id}
          ORDER BY rang ASC
          FOR UPDATE
        `;

        await lockCompensationTargetsInTx(tx, normalizedComp);

        const choixFresh = await tx.noteFraisChoixReglement.findUniqueOrThrow({
          where: { id: choix.id },
          include: { Cibles: true },
        });
        const ciblesFresh = new Map(
          choixFresh.Cibles.map((c) => [`${c.typeCible}:${c.cibleId}`, c])
        );

        const plafondComp = money(choixFresh.montantCompensation).minus(
          money(choixFresh.montantCompensationUtilise)
        );
        const plafondRemb = money(choixFresh.montantRemboursement).minus(
          money(choixFresh.montantRembourseUtilise)
        );
        if (money(montantCompNorm).gt(plafondComp)) {
          throw new Error(
            "Le total dépasse le montant de compensation encore disponible sur le choix"
          );
        }
        if (money(montantRembNorm).gt(plafondRemb)) {
          throw new Error(
            "Montant supérieur au remboursement encore disponible sur le choix"
          );
        }

        const consommeApres = money(choixFresh.montantRembourseUtilise)
          .plus(money(choixFresh.montantCompensationUtilise))
          .plus(money(montantRembNorm))
          .plus(money(montantCompNorm));
        if (consommeApres.gt(money(note.montantAccepte))) {
          throw new Error(
            "Le total remboursé + compensé dépasserait le montant accepté"
          );
        }

        if (note.decideeAt && executeAtDate.getTime() < note.decideeAt.getTime()) {
          throw new Error(
            "Date d'exécution antérieure à la décision de la note"
          );
        }
        if (executeAtDate.getTime() > maxFutureMs) {
          throw new Error(
            "Date d'exécution trop dans le futur (tolérance 5 minutes)"
          );
        }

        const prepared = await prepareCompensationLignesInTx({
          tx,
          adherentId: note.adherentId,
          normalized: normalizedComp,
          ciblesFresh,
        });

        // --- aucune écriture avant ici ---
        const claimed = await tx.noteFrais.updateMany({
          where: {
            id: input.noteId,
            statut: "VALIDEE",
            version: input.expectedNoteVersion,
          },
          data: { version: { increment: 1 } },
        });
        if (claimed.count !== 1) {
          throw new Error(NOTES_FRAIS_MIXTE_VERSION_CONFLICT);
        }

        const operation = await tx.noteFraisReglementOperation.create({
          data: {
            noteFraisId: input.noteId,
            choixId: choixFresh.id,
            type: "MIXTE",
            idempotencyKey: key,
            executeurUserId: input.actorUserId,
            executeAt: executeAtDate,
          },
        });

        const { reglementId: compensationId } =
          await applyCompensationReglementInTx({
            tx,
            noteId: input.noteId,
            adherentId: note.adherentId,
            choixId: choixFresh.id,
            executeurUserId: input.actorUserId,
            executeAt: executeAtDate,
            montantTotal: montantCompNorm,
            prepared,
            idempotencyKey: null,
            operationId: operation.id,
          });

        if (input.afterCompensationChild) {
          await input.afterCompensationChild();
        }

        const { reglementId: remboursementId } =
          await createRemboursementReglementInTx({
            tx,
            noteId: input.noteId,
            choixId: choixFresh.id,
            executeurUserId: input.actorUserId,
            executeAt: executeAtDate,
            montant: montantRembNorm,
            moyen: input.moyen,
            reference: brute,
            referenceNormalisee: normalisee,
            idempotencyKey: null,
            operationId: operation.id,
          });

        if (input.afterBothChildren) {
          await input.afterBothChildren();
        }

        await tx.noteFraisChoixReglement.update({
          where: { id: choixFresh.id },
          data: {
            montantCompensationUtilise: { increment: money(montantCompNorm) },
            montantRembourseUtilise: { increment: money(montantRembNorm) },
          },
        });

        await createNoteFraisReglementNotificationInTx(tx, {
          noteId: input.noteId,
          demandeurUserId: note.demandeurUserId,
          kind: "REGLEMENT_MIXTE",
          anchorId: operation.id,
        });
        if (input.afterNotifyOutbox) await input.afterNotifyOutbox();

        return {
          kind: "fresh" as const,
          operationId: operation.id,
          choixId: choixFresh.id,
          executeAt: canonicalIso,
          version: input.expectedNoteVersion + 1,
          compensationId,
          compensationTotal: montantCompNorm,
          remboursementId,
          remboursementTotal: montantRembNorm,
          moyen: input.moyen,
        };
      });
    } catch (txError) {
      if (!isOperationIdempotencyUniqueViolation(txError)) throw txError;
      const existing = await client.noteFraisReglementOperation.findUnique({
        where: { idempotencyKey: key },
        include: { Reglements: { include: { Lignes: true } } },
      });
      if (!existing) throw txError;
      return await resolveIdempotentOperation({
        client,
        actorUserId: input.actorUserId,
        content,
        byKey: existing,
      });
    }

    if (result.kind === "already") {
      return {
        success: true,
        data: {
          operationId: result.operationId,
          noteId: input.noteId,
          choixId: result.choixId,
          executeAt: result.executeAt,
          version: result.version,
          alreadyExecuted: true,
          compensation: {
            reglementId: result.compensationId,
            montantTotal: result.compensationTotal,
          },
          remboursement: {
            reglementId: result.remboursementId,
            montantTotal: result.remboursementTotal,
            moyen: result.moyen,
          },
        },
        message: "Déjà exécuté",
      };
    }

    if (!input.client) {
      void import("@/lib/services/frais-avances/note-frais-service")
        .then(({ processNoteFraisOutboxOnce }) => processNoteFraisOutboxOnce())
        .catch((err) => {
          console.error("[notes-frais] outbox kick failed after mixte", {
            note: hashIdForLog(input.noteId),
            err: err instanceof Error ? err.message.slice(0, 120) : "unknown",
          });
        });
    }

    return {
      success: true,
      data: {
        operationId: result.operationId,
        noteId: input.noteId,
        choixId: result.choixId,
        executeAt: result.executeAt,
        version: result.version,
        alreadyExecuted: false,
        compensation: {
          reglementId: result.compensationId,
          montantTotal: result.compensationTotal,
        },
        remboursement: {
          reglementId: result.remboursementId,
          montantTotal: result.remboursementTotal,
          moyen: result.moyen,
        },
      },
      message: "Règlement mixte exécuté",
    };
  } catch (error) {
    return mapError(error);
  }
}
