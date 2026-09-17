/**
 * Restitutions réelles sur remboursements de notes de frais (lot 4.7).
 * Entrée bancaire append-only — distincte des corrections MONTANT_NEGATIF (4.6).
 */
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  NotesFraisDisabledError,
  assertNotesFraisEnabled,
} from "@/lib/frais-avances/feature-flag";
import { canUserRecordNoteFraisRestitution } from "@/lib/frais-avances/authz";
import { hashIdForLog } from "@/lib/frais-avances/storage";
import { lockUserRowForNotesFrais } from "@/lib/services/frais-avances/rgpd-account-deletion";
import { normalizeNotesFraisMontant } from "@/lib/services/frais-avances/note-frais-decision-service";
import {
  normalizeRemboursementReference,
  parseAndCanonicalizeExecuteAt,
  type MoyenRemboursementNoteFrais,
  type NotesFraisClock,
} from "@/lib/services/frais-avances/note-frais-remboursement-service";
import { computeReglementNetMontant } from "@/lib/services/frais-avances/note-frais-correction-service";
import { createNoteFraisReglementNotificationInTx } from "@/lib/services/frais-avances/note-frais-reglement-notify";

export type NotesFraisRestitutionActionResult<T = unknown> =
  | { success: true; data: T; message?: string }
  | { success: false; error: string; code?: string };

export const NOTES_FRAIS_RESTIT_VERSION_CONFLICT =
  "Conflit de version — rechargez la note et réessayez";

export const NOTES_FRAIS_RESTIT_IDEMPOTENCY_CONFLICT =
  "Clé d'idempotence déjà utilisée avec un contenu de restitution différent";

export const NOTES_FRAIS_RESTIT_EXCEEDS_REMAINING =
  "Montant supérieur au reste restituable sur ce remboursement";

export const NOTES_FRAIS_RESTIT_PLAFOND_INCOHERENT =
  "Compteur remboursement insuffisant pour cette restitution";

const defaultClock: NotesFraisClock = { now: () => new Date() };

export type RecordRestitutionInput = {
  actorUserId: string;
  noteId: string;
  reglementId: string;
  expectedNoteVersion: number;
  idempotencyKey: string;
  /** Chaîne décimale positive. */
  montant: string;
  moyen: MoyenRemboursementNoteFrais;
  reference: string;
  /** ISO strict avec fuseau (Z ou ±HH:MM). */
  dateRestitution: string;
  motif: string;
  client?: typeof db;
  clock?: NotesFraisClock;
  beforeDemandeurLock?: () => Promise<void>;
  afterDemandeurLock?: () => Promise<void>;
  beforeNoteLock?: () => Promise<void>;
  afterNoteLock?: () => Promise<void>;
  afterRestitutionInsert?: () => Promise<void>;
  afterNotifyOutbox?: () => Promise<void>;
};

export type RestitutionExecutionDto = {
  restitutionId: string;
  noteId: string;
  reglementId: string;
  montant: string;
  moyen: MoyenRemboursementNoteFrais;
  dateRestitution: string;
  version: number;
  alreadyRestituted: boolean;
};

function money(v: Prisma.Decimal | number | string): Prisma.Decimal {
  return new Prisma.Decimal(v);
}

/**
 * Normalise le motif de restitution (1–2000).
 */
export function normalizeRestitutionMotif(raw: string): string {
  if (typeof raw !== "string") {
    throw new Error("Motif de restitution requis");
  }
  const motif = raw.trim();
  if (motif.length < 1 || motif.length > 2000) {
    throw new Error("Motif invalide (1 à 2000 caractères)");
  }
  return motif;
}

function disabledResult(): NotesFraisRestitutionActionResult<never> {
  return {
    success: false,
    error: "Le module frais avancés n'est pas activé.",
    code: "NOTES_FRAIS_DISABLED",
  };
}

function mapError(error: unknown): NotesFraisRestitutionActionResult<never> {
  if (error instanceof NotesFraisDisabledError) return disabledResult();
  if (error instanceof Error) {
    let code: string | undefined;
    if (error.message === NOTES_FRAIS_RESTIT_VERSION_CONFLICT) {
      code = "VERSION_CONFLICT";
    } else if (error.message === NOTES_FRAIS_RESTIT_IDEMPOTENCY_CONFLICT) {
      code = "IDEMPOTENCY_CONFLICT";
    } else if (error.message === NOTES_FRAIS_RESTIT_EXCEEDS_REMAINING) {
      code = "RESTITUTION_EXCEEDS_REMAINING";
    } else if (error.message === NOTES_FRAIS_RESTIT_PLAFOND_INCOHERENT) {
      code = "PLAFOND_DEPASSE";
    } else if (error.message.includes("Non autorisé")) {
      code = "FORBIDDEN";
    } else if (error.message.includes("Auto-restitution")) {
      code = "AUTO_RESTITUTION_FORBIDDEN";
    } else if (
      error.message.includes("référence") ||
      error.message.includes("Référence")
    ) {
      code = "REFERENCE_INVALIDE";
    } else if (
      error.message.includes("date") ||
      error.message.includes("Date")
    ) {
      code = "DATE_INVALIDE";
    } else if (
      error.message.includes("moyen") ||
      error.message.includes("Moyen")
    ) {
      code = "MOYEN_INVALIDE";
    } else if (
      error.message.includes("motif") ||
      error.message.includes("Motif")
    ) {
      code = "MOTIF_INVALIDE";
    } else if (
      error.message.includes("REFRESH") ||
      error.message.includes("concurrent")
    ) {
      code = "REFRESH_REQUIRED";
    }
    return { success: false, error: error.message, code };
  }
  return { success: false, error: "Erreur inattendue" };
}

/**
 * Calcule le reste restituable d'un remboursement (Decimal).
 *
 * @param montantTotal - Brut du règlement
 * @param correctionsNegatives - Montants MONTANT_NEGATIF (≤ 0)
 * @param restitutions - Montants restitution (> 0)
 */
export function computeResteRestituable(
  montantTotal: Prisma.Decimal | number | string,
  correctionsNegatives: Array<Prisma.Decimal | number | string | null>,
  restitutions: Array<Prisma.Decimal | number | string>
): {
  remboursementCorrige: Prisma.Decimal;
  restitueCumule: Prisma.Decimal;
  resteRestituable: Prisma.Decimal;
} {
  const remboursementCorrige = computeReglementNetMontant(
    montantTotal,
    correctionsNegatives
  );
  let restitueCumule = money(0);
  for (const r of restitutions) {
    const m = money(r);
    if (!m.gt(0)) {
      throw new Error("Restitution attendue strictement positive");
    }
    restitueCumule = restitueCumule.plus(m);
  }
  if (restitueCumule.gt(remboursementCorrige)) {
    throw new Error(
      "Cumul des restitutions supérieur au remboursement corrigé"
    );
  }
  return {
    remboursementCorrige,
    restitueCumule,
    resteRestituable: remboursementCorrige.minus(restitueCumule),
  };
}

type CanonicalRestitutionContent = {
  reglementId: string;
  montant: string;
  moyen: MoyenRemboursementNoteFrais;
  referenceNormalisee: string;
  dateRestitutionIso: string;
  motif: string;
};

function sameRestitutionContent(
  a: CanonicalRestitutionContent,
  row: {
    reglementId: string;
    montant: Prisma.Decimal;
    moyen: string;
    referenceNormalisee: string;
    dateRestitution: Date;
    motif: string;
  }
): boolean {
  return (
    row.reglementId === a.reglementId &&
    money(row.montant).eq(money(a.montant)) &&
    row.moyen === a.moyen &&
    row.referenceNormalisee === a.referenceNormalisee &&
    row.dateRestitution.toISOString() === a.dateRestitutionIso &&
    row.motif === a.motif
  );
}

async function assertRestitutorAuthorized(
  actorUserId: string,
  demandeurUserId: string,
  client: typeof db
): Promise<void> {
  if (demandeurUserId === actorUserId) {
    throw new Error(
      "Auto-restitution interdite : l'acteur ne peut pas être le demandeur"
    );
  }
  const ok = await canUserRecordNoteFraisRestitution(actorUserId, client);
  if (!ok) {
    throw new Error("Non autorisé à enregistrer une restitution");
  }
}

async function resolveIdempotentRestitution(opts: {
  client: typeof db;
  actorUserId: string;
  noteId: string;
  content: CanonicalRestitutionContent;
  byKey: {
    id: string;
    reglementId: string;
    montant: Prisma.Decimal;
    moyen: string;
    referenceNormalisee: string;
    dateRestitution: Date;
    motif: string;
  };
}): Promise<NotesFraisRestitutionActionResult<RestitutionExecutionDto>> {
  const { client, actorUserId, noteId, content, byKey } = opts;
  const note = await client.noteFrais.findUnique({
    where: { id: noteId },
    select: { version: true, demandeurUserId: true },
  });
  if (!note) throw new Error("Note introuvable");
  await assertRestitutorAuthorized(actorUserId, note.demandeurUserId, client);

  if (sameRestitutionContent(content, byKey)) {
    return {
      success: true,
      data: {
        restitutionId: byKey.id,
        noteId,
        reglementId: byKey.reglementId,
        montant: money(byKey.montant).toFixed(2),
        moyen: byKey.moyen as MoyenRemboursementNoteFrais,
        dateRestitution: byKey.dateRestitution.toISOString(),
        version: note.version,
        alreadyRestituted: true,
      },
      message: "Déjà enregistrée",
    };
  }
  throw new Error(NOTES_FRAIS_RESTIT_IDEMPOTENCY_CONFLICT);
}

/**
 * Enregistre une restitution réelle sur un règlement REMBOURSEMENT.
 *
 * @param input - Acteur, note, règlement, OCC, clé, montant, moyen, référence, date, motif
 */
export async function recordNoteFraisRestitution(
  input: RecordRestitutionInput
): Promise<NotesFraisRestitutionActionResult<RestitutionExecutionDto>> {
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
    const reglementId = String(input.reglementId || "").trim();
    if (!reglementId) throw new Error("Identifiant de règlement requis");

    const motif = normalizeRestitutionMotif(input.motif);
    const mNorm = normalizeNotesFraisMontant(input.montant);
    if (!mNorm || !money(mNorm).gt(0)) {
      throw new Error(
        "Le montant de restitution doit être une chaîne décimale strictement positive"
      );
    }
    const montant = money(mNorm);

    if (input.moyen !== "VIREMENT" && input.moyen !== "ESPECES") {
      throw new Error("Moyen invalide (VIREMENT|ESPECES)");
    }
    const { brute: reference, normalisee: referenceNormalisee } =
      normalizeRemboursementReference(input.reference);

    const { date: dateRestitution, canonicalIso: dateRestitutionIso } =
      parseAndCanonicalizeExecuteAt(input.dateRestitution);

    const nowMs = clock.now().getTime();
    const maxFutureMs = nowMs + 5 * 60 * 1000;
    if (dateRestitution.getTime() > maxFutureMs) {
      throw new Error("Date de restitution trop future");
    }

    const content: CanonicalRestitutionContent = {
      reglementId,
      montant: montant.toFixed(2),
      moyen: input.moyen,
      referenceNormalisee,
      dateRestitutionIso,
      motif,
    };

    // Authz avant replay (hors TX pour fail-fast ; re-vérifié dans TX)
    const notePreview = await client.noteFrais.findUnique({
      where: { id: input.noteId },
      select: {
        id: true,
        statut: true,
        demandeurUserId: true,
        decideeAt: true,
      },
    });
    if (!notePreview) throw new Error("Note introuvable");
    if (notePreview.statut !== "VALIDEE") {
      throw new Error("Seule une note VALIDEE peut recevoir une restitution");
    }
    await assertRestitutorAuthorized(
      input.actorUserId,
      notePreview.demandeurUserId,
      client
    );

    if (
      notePreview.decideeAt &&
      dateRestitution.getTime() < notePreview.decideeAt.getTime()
    ) {
      throw new Error(
        "Date de restitution antérieure à la décision de la note"
      );
    }

    const existingKey = await client.noteFraisRestitution.findUnique({
      where: { idempotencyKey: key },
    });
    if (existingKey) {
      return await resolveIdempotentRestitution({
        client,
        actorUserId: input.actorUserId,
        noteId: input.noteId,
        content,
        byKey: existingKey,
      });
    }

    let kickOutbox = false;
    let result: RestitutionExecutionDto | undefined;

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

        const note = await tx.noteFrais.findUniqueOrThrow({
          where: { id: input.noteId },
          select: {
            id: true,
            version: true,
            statut: true,
            demandeurUserId: true,
            decideeAt: true,
          },
        });
        if (note.statut !== "VALIDEE") {
          throw new Error(
            "Seule une note VALIDEE peut recevoir une restitution"
          );
        }
        await assertRestitutorAuthorized(
          input.actorUserId,
          note.demandeurUserId,
          tx as unknown as typeof db
        );

        await tx.$executeRaw`
          SELECT id FROM notes_frais_reglements WHERE id = ${reglementId} FOR UPDATE
        `;

        // Refus explicite si l'id est une opération MIXTE parente (pas un règlement).
        const asOperation = await tx.noteFraisReglementOperation.findUnique({
          where: { id: reglementId },
          select: { id: true },
        });
        if (asOperation) {
          throw new Error(
            "Restitution refusée sur l'opération MIXTE parente — cibler l'enfant REMBOURSEMENT"
          );
        }

        const reglement = await tx.noteFraisReglement.findUnique({
          where: { id: reglementId },
          include: {
            Corrections: {
              where: { type: "MONTANT_NEGATIF" },
              select: { montant: true },
            },
            Restitutions: { select: { montant: true } },
          },
        });
        if (!reglement || reglement.noteFraisId !== input.noteId) {
          throw new Error("Règlement introuvable pour cette note");
        }
        if (reglement.statut !== "EXECUTE") {
          throw new Error(
            "Seuls les règlements EXECUTE peuvent être restitués"
          );
        }
        if (reglement.type !== "REMBOURSEMENT") {
          throw new Error(
            "Restitution réservée aux règlements REMBOURSEMENT (compensation refusée)"
          );
        }
        // Parent MIXTE = NoteFraisReglementOperation.id — jamais un id d'opération.
        // Ici reglementId pointe toujours vers un NoteFraisReglement (enfant ou simple).

        const choix = await tx.noteFraisChoixReglement.findUniqueOrThrow({
          where: { id: reglement.choixId },
        });
        if (choix.statut !== "ACTIF") {
          throw new Error("Choix de règlement non ACTIF");
        }

        const byKeyTx = await tx.noteFraisRestitution.findUnique({
          where: { idempotencyKey: key },
        });
        if (byKeyTx) {
          return (
            await resolveIdempotentRestitution({
              client: tx as unknown as typeof db,
              actorUserId: input.actorUserId,
              noteId: input.noteId,
              content,
              byKey: byKeyTx,
            })
          ).data!;
        }

        if (
          note.decideeAt &&
          dateRestitution.getTime() < note.decideeAt.getTime()
        ) {
          throw new Error(
            "Date de restitution antérieure à la décision de la note"
          );
        }
        if (dateRestitution.getTime() > maxFutureMs) {
          throw new Error("Date de restitution trop future");
        }

        const { resteRestituable } = computeResteRestituable(
          reglement.montantTotal,
          reglement.Corrections.map((c) => c.montant),
          reglement.Restitutions.map((r) => r.montant)
        );
        if (montant.gt(resteRestituable)) {
          throw new Error(NOTES_FRAIS_RESTIT_EXCEEDS_REMAINING);
        }

        if (note.version !== input.expectedNoteVersion) {
          throw new Error(NOTES_FRAIS_RESTIT_VERSION_CONFLICT);
        }

        const restitution = await tx.noteFraisRestitution.create({
          data: {
            reglementId,
            montant,
            moyen: input.moyen,
            reference,
            referenceNormalisee,
            dateRestitution,
            motif,
            idempotencyKey: key,
            actorUserId: input.actorUserId,
          },
        });

        if (input.afterRestitutionInsert) await input.afterRestitutionInsert();

        const compteur = await tx.noteFraisChoixReglement.updateMany({
          where: {
            id: choix.id,
            montantRembourseUtilise: { gte: montant },
          },
          data: {
            montantRembourseUtilise: { decrement: montant },
          },
        });
        if (compteur.count !== 1) {
          throw new Error(NOTES_FRAIS_RESTIT_PLAFOND_INCOHERENT);
        }

        const updated = await tx.noteFrais.updateMany({
          where: { id: note.id, version: input.expectedNoteVersion },
          data: { version: { increment: 1 } },
        });
        if (updated.count !== 1) {
          throw new Error(NOTES_FRAIS_RESTIT_VERSION_CONFLICT);
        }

        await createNoteFraisReglementNotificationInTx(tx, {
          noteId: note.id,
          demandeurUserId: note.demandeurUserId,
          kind: "RESTITUTION_ENREGISTREE",
          anchorId: restitution.id,
        });
        if (input.afterNotifyOutbox) await input.afterNotifyOutbox();

        kickOutbox = true;
        return {
          restitutionId: restitution.id,
          noteId: note.id,
          reglementId,
          montant: montant.toFixed(2),
          moyen: input.moyen,
          dateRestitution: dateRestitutionIso,
          version: note.version + 1,
          alreadyRestituted: false,
        };
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const targets = Array.isArray(error.meta?.target)
          ? (error.meta?.target as string[])
          : String(error.meta?.target ?? "");
        const onIdempotency =
          (typeof targets === "string" &&
            targets.includes("idempotencyKey")) ||
          (Array.isArray(targets) &&
            targets.some((t) => String(t).includes("idempotencyKey")));
        if (onIdempotency) {
          const byKey = await client.noteFraisRestitution.findUnique({
            where: { idempotencyKey: key },
          });
          if (byKey) {
            return await resolveIdempotentRestitution({
              client,
              actorUserId: input.actorUserId,
              noteId: input.noteId,
              content,
              byKey,
            });
          }
        }
      }
      throw error;
    }

    if (!result) throw new Error("Restitution échouée");

    if (kickOutbox && !result.alreadyRestituted && !input.client) {
      void import("@/lib/services/frais-avances/note-frais-service")
        .then(({ processNoteFraisOutboxOnce }) => processNoteFraisOutboxOnce())
        .catch((e) => {
          console.error(
            "[notes-frais] kick outbox restitution",
            hashIdForLog(input.noteId),
            e
          );
        });
    }

    return {
      success: true,
      data: result,
      message: result.alreadyRestituted
        ? "Déjà enregistrée"
        : "Restitution enregistrée",
    };
  } catch (error) {
    return mapError(error);
  }
}

/**
 * Agrège la somme des restitutions (chaîne décimale canonique).
 */
export async function aggregateRestitutionsMontant(
  client: typeof db = db
): Promise<string> {
  const agg = await client.noteFraisRestitution.aggregate({
    _sum: { montant: true },
  });
  return money(agg._sum.montant ?? 0).toFixed(2);
}

/**
 * Calcule restantDuNotesFrais global (notes VALIDEE, choix ACTIF uniquement).
 * Fail closed si un restant devient négatif.
 */
export async function computeRestantDuNotesFraisGlobal(
  client: typeof db = db
): Promise<string> {
  const notes = await client.noteFrais.findMany({
    where: { statut: "VALIDEE" },
    select: {
      montantAccepte: true,
      ChoixReglements: {
        where: { statut: "ACTIF" },
        take: 1,
        select: {
          montantRembourseUtilise: true,
          montantCompensationUtilise: true,
        },
      },
    },
  });
  let total = money(0);
  for (const n of notes) {
    if (n.montantAccepte == null) {
      throw new Error(
        "NOTES_FRAIS_FINANCIAL_STATE_INCONSISTENT: montantAccepte null sur note VALIDEE"
      );
    }
    const accepte = money(n.montantAccepte);
    const choix = n.ChoixReglements[0];
    const remb = choix ? money(choix.montantRembourseUtilise) : money(0);
    const comp = choix ? money(choix.montantCompensationUtilise) : money(0);
    const restant = accepte.minus(remb).minus(comp);
    if (restant.lt(0)) {
      throw new Error(
        "NOTES_FRAIS_FINANCIAL_STATE_INCONSISTENT: restantDuNotesFrais négatif"
      );
    }
    total = total.plus(restant);
  }
  return total.toFixed(2);
}
