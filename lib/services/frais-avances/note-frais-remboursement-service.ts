/**
 * Exécution réelle d'un remboursement de note VALIDEE (lot 4.2).
 * Modes choix : REMBOURSEMENT | MIXTE (part remboursement uniquement).
 * Aucune compensation, PaiementCotisation, Avoir, 2ᵉ Depense, notif/outbox.
 */
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  NotesFraisDisabledError,
  assertNotesFraisEnabled,
} from "@/lib/frais-avances/feature-flag";
import { canUserExecuteNoteFraisRemboursement } from "@/lib/frais-avances/authz";
import { lockUserRowForNotesFrais } from "@/lib/services/frais-avances/rgpd-account-deletion";
import { normalizeNotesFraisMontant } from "@/lib/services/frais-avances/note-frais-decision-service";

export type NotesFraisRemboursementActionResult<T = unknown> =
  | { success: true; data: T; message?: string }
  | { success: false; error: string; code?: string };

export const NOTES_FRAIS_REMB_VERSION_CONFLICT =
  "Conflit de version — rechargez la note et réessayez";

export const NOTES_FRAIS_REMB_IDEMPOTENCY_CONFLICT =
  "Clé d'idempotence déjà utilisée avec un contenu de remboursement différent";

export const NOTES_FRAIS_REMB_PLAFOND =
  "Montant supérieur au remboursement encore disponible sur le choix";

/** Invariant compteurs / montant accepté incohérents (jamais clamp silencieux). */
export const NOTES_FRAIS_FINANCIAL_STATE_INCONSISTENT =
  "NOTES_FRAIS_FINANCIAL_STATE_INCONSISTENT";

export type MoyenRemboursementNoteFrais = "VIREMENT" | "ESPECES";

/** Horloge injectable (tests) — jamais exposée par les Server Actions. */
export type NotesFraisClock = { now: () => Date };

const defaultClock: NotesFraisClock = { now: () => new Date() };

export type ExecuteRemboursementInput = {
  actorUserId: string;
  noteId: string;
  expectedNoteVersion: number;
  idempotencyKey: string;
  /** Chaîne décimale préférée ; normalisée via Prisma.Decimal (pas de float). */
  montant: string | number;
  moyen: MoyenRemboursementNoteFrais;
  reference: string;
  /** Date/heure ISO avec fuseau explicite (Z ou ±HH:MM). */
  executeAt: string;
  client?: typeof db;
  /** Options internes/tests uniquement — jamais depuis l’action HTTP. */
  clock?: NotesFraisClock;
  beforeDemandeurLock?: () => Promise<void>;
  afterDemandeurLock?: () => Promise<void>;
  beforeNoteLock?: () => Promise<void>;
  afterNoteLock?: () => Promise<void>;
  /** Hook tests : après insert règlement, avant commit. */
  afterReglementInsert?: () => Promise<void>;
};

export type RemboursementExecutionDto = {
  reglementId: string;
  noteId: string;
  choixId: string;
  montantTotal: string;
  moyen: MoyenRemboursementNoteFrais;
  executeAt: string;
  version: number;
  alreadyExecuted: boolean;
};

export type EtatFinancierNoteFrais =
  | "NON_REGLEE"
  | "PARTIELLEMENT_REGLEE"
  | "REGLEE";

function money(v: Prisma.Decimal | number | string): Prisma.Decimal {
  return new Prisma.Decimal(v);
}

function disabledResult(): NotesFraisRemboursementActionResult<never> {
  return {
    success: false,
    error: "Le module frais avancés n'est pas activé.",
    code: "NOTES_FRAIS_DISABLED",
  };
}

function mapError(error: unknown): NotesFraisRemboursementActionResult<never> {
  if (error instanceof NotesFraisDisabledError) return disabledResult();
  if (error instanceof Error) {
    let code: string | undefined;
    if (error.message === NOTES_FRAIS_REMB_VERSION_CONFLICT) {
      code = "VERSION_CONFLICT";
    }
    if (error.message === NOTES_FRAIS_REMB_IDEMPOTENCY_CONFLICT) {
      code = "IDEMPOTENCY_CONFLICT";
    }
    if (error.message === NOTES_FRAIS_REMB_PLAFOND) {
      code = "PLAFOND_DEPASSE";
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
    if (error.message === NOTES_FRAIS_FINANCIAL_STATE_INCONSISTENT) {
      code = NOTES_FRAIS_FINANCIAL_STATE_INCONSISTENT;
    }
    return { success: false, error: error.message, code };
  }
  return { success: false, error: "Erreur inattendue" };
}

/**
 * Normalise une référence de traçabilité (NFKC, uppercase, espaces réduits).
 * Ne journalise jamais la valeur.
 *
 * @param raw - Référence brute saisie
 * @returns { brute, normalisee }
 */
export function normalizeRemboursementReference(raw: string): {
  brute: string;
  normalisee: string;
} {
  if (typeof raw !== "string") {
    throw new Error("Référence de remboursement requise");
  }
  const brute = raw.trim();
  if (brute.length < 1 || brute.length > 64) {
    throw new Error("Référence invalide (1 à 64 caractères après trim)");
  }
  for (let i = 0; i < brute.length; i++) {
    const code = brute.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f) {
      throw new Error("Référence : caractères de contrôle interdits");
    }
  }
  const normalisee = brute
    .normalize("NFKC")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
  if (normalisee.length < 1 || normalisee.length > 64) {
    throw new Error("Référence normalisée invalide");
  }
  return { brute, normalisee };
}

const ISO_Z_RE =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?Z$/;
const ISO_OFFSET_RE =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?([+-])(\d{2}):(\d{2})$/;

function parseFractionMs(frac: string | undefined): number {
  if (!frac) return 0;
  const padded = (frac + "000").slice(0, 3);
  return Number(padded);
}

/**
 * Parse et canonise executeAt : ISO strict avec fuseau (Z ou ±HH:MM).
 * Refuse les dates calendaires invalides (ex. 31/02) et les instants ambigus.
 *
 * @param iso - Chaîne ISO client avec timezone
 * @returns ISO canonique UTC (`toISOString`)
 */
export function parseAndCanonicalizeExecuteAt(iso: string): {
  date: Date;
  canonicalIso: string;
} {
  if (typeof iso !== "string" || !iso.trim()) {
    throw new Error("Date d'exécution requise (ISO)");
  }
  const trimmed = iso.trim();
  const z = ISO_Z_RE.exec(trimmed);
  const o = z ? null : ISO_OFFSET_RE.exec(trimmed);
  if (!z && !o) {
    throw new Error(
      "Date d'exécution invalide : ISO avec fuseau (Z ou ±HH:MM) requis"
    );
  }
  const parts = (z ?? o)!;
  const y = Number(parts[1]);
  const mo = Number(parts[2]);
  const d = Number(parts[3]);
  const h = Number(parts[4]);
  const mi = Number(parts[5]);
  const s = Number(parts[6]);
  const ms = parseFractionMs(parts[7]);
  if (
    mo < 1 ||
    mo > 12 ||
    d < 1 ||
    d > 31 ||
    h > 23 ||
    mi > 59 ||
    s > 59
  ) {
    throw new Error("Date d'exécution invalide");
  }
  let offsetMin = 0;
  if (o) {
    const sign = o[8] === "-" ? -1 : 1;
    const oh = Number(o[9]);
    const om = Number(o[10]);
    if (oh > 23 || om > 59) {
      throw new Error("Date d'exécution invalide");
    }
    offsetMin = sign * (oh * 60 + om);
  }
  const asUtcWall = Date.UTC(y, mo - 1, d, h, mi, s, ms);
  const check = new Date(asUtcWall);
  if (
    check.getUTCFullYear() !== y ||
    check.getUTCMonth() !== mo - 1 ||
    check.getUTCDate() !== d ||
    check.getUTCHours() !== h ||
    check.getUTCMinutes() !== mi ||
    check.getUTCSeconds() !== s
  ) {
    throw new Error("Date d'exécution calendaire invalide");
  }
  const utcMs = asUtcWall - offsetMin * 60_000;
  const date = new Date(utcMs);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Date d'exécution invalide");
  }
  const canonicalIso = date.toISOString();
  if (new Date(canonicalIso).getTime() !== date.getTime()) {
    throw new Error("Date d'exécution invalide");
  }
  return { date, canonicalIso };
}

/**
 * Calcule l'état financier d'une note (non stocké).
 * Refuse explicitement une incohérence compteurs > montant accepté.
 *
 * @throws {Error} `NOTES_FRAIS_FINANCIAL_STATE_INCONSISTENT`
 */
export function computeEtatFinancierNoteFrais(input: {
  montantAccepte: Prisma.Decimal | number | string;
  montantRembourseUtilise: Prisma.Decimal | number | string;
  montantCompensationUtilise: Prisma.Decimal | number | string;
}): {
  consomme: string;
  restantDu: string;
  etatFinancier: EtatFinancierNoteFrais;
} {
  const accepte = money(input.montantAccepte);
  const remb = money(input.montantRembourseUtilise);
  const comp = money(input.montantCompensationUtilise);
  if (remb.lt(0) || comp.lt(0) || accepte.lt(0)) {
    throw new Error(NOTES_FRAIS_FINANCIAL_STATE_INCONSISTENT);
  }
  const consomme = remb.plus(comp);
  if (consomme.lt(0) || consomme.gt(accepte)) {
    throw new Error(NOTES_FRAIS_FINANCIAL_STATE_INCONSISTENT);
  }
  const restant = accepte.minus(consomme);
  let etat: EtatFinancierNoteFrais;
  if (consomme.lte(0)) etat = "NON_REGLEE";
  else if (restant.lte(0)) etat = "REGLEE";
  else etat = "PARTIELLEMENT_REGLEE";
  return {
    consomme: consomme.toFixed(2),
    restantDu: restant.toFixed(2),
    etatFinancier: etat,
  };
}

type IdempotentContent = {
  noteId: string;
  montant: string;
  moyen: MoyenRemboursementNoteFrais;
  referenceNormalisee: string;
  executeAtIso: string;
};

function sameRemboursementContent(
  a: IdempotentContent,
  reglement: {
    noteFraisId: string;
    type: string;
    montantTotal: Prisma.Decimal;
    moyen: string | null;
    referenceNormalisee: string | null;
    executeAt: Date;
  }
): boolean {
  if (reglement.type !== "REMBOURSEMENT") return false;
  if (reglement.noteFraisId !== a.noteId) return false;
  if ((normalizeNotesFraisMontant(reglement.montantTotal) ?? "") !== a.montant) {
    return false;
  }
  if (reglement.moyen !== a.moyen) return false;
  if ((reglement.referenceNormalisee ?? "") !== a.referenceNormalisee) {
    return false;
  }
  if (reglement.executeAt.toISOString() !== a.executeAtIso) return false;
  return true;
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
  const allowed = await canUserExecuteNoteFraisRemboursement(
    actorUserId,
    client
  );
  if (!allowed) {
    throw new Error(
      "Non autorisé à exécuter un remboursement de note de frais"
    );
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
  return false;
}

type ReglementRembRow = {
  id: string;
  noteFraisId: string;
  choixId: string;
  type: string;
  montantTotal: Prisma.Decimal;
  moyen: string | null;
  referenceNormalisee: string | null;
  executeAt: Date;
};

async function resolveIdempotentReglement(params: {
  client: typeof db;
  actorUserId: string;
  content: IdempotentContent;
  byKey: ReglementRembRow;
}): Promise<NotesFraisRemboursementActionResult<RemboursementExecutionDto>> {
  const { client, actorUserId, content, byKey } = params;
  const note = await client.noteFrais.findUnique({
    where: { id: content.noteId },
    select: { version: true, demandeurUserId: true },
  });
  if (!note) throw new Error("Note introuvable");
  await assertExecutorAuthorized(actorUserId, note.demandeurUserId, client);

  if (byKey.noteFraisId !== content.noteId) {
    throw new Error(NOTES_FRAIS_REMB_IDEMPOTENCY_CONFLICT);
  }
  if (sameRemboursementContent(content, byKey)) {
    return {
      success: true,
      data: {
        reglementId: byKey.id,
        noteId: content.noteId,
        choixId: byKey.choixId,
        montantTotal: byKey.montantTotal.toFixed(2),
        moyen: byKey.moyen as MoyenRemboursementNoteFrais,
        executeAt: byKey.executeAt.toISOString(),
        version: note.version,
        alreadyExecuted: true,
      },
      message: "Déjà exécuté",
    };
  }
  throw new Error(NOTES_FRAIS_REMB_IDEMPOTENCY_CONFLICT);
}

/**
 * Exécute un remboursement (partiel ou total) sur le choix ACTIF.
 *
 * @param input - Acteur, note, OCC, clé, montant, moyen, référence, date
 */
export async function executeNoteFraisRemboursement(
  input: ExecuteRemboursementInput
): Promise<NotesFraisRemboursementActionResult<RemboursementExecutionDto>> {
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
    const montantNorm = normalizeNotesFraisMontant(input.montant);
    if (!montantNorm || !money(montantNorm).gt(0)) {
      throw new Error("Le montant de remboursement doit être strictement positif");
    }
    const { brute, normalisee } = normalizeRemboursementReference(
      input.reference
    );
    const { date: executeAtDate, canonicalIso } = parseAndCanonicalizeExecuteAt(
      input.executeAt
    );
    /** Instant unique pour preview + TX (évite divergence). */
    const nowMs = clock.now().getTime();
    const maxFutureMs = nowMs + 5 * 60 * 1000;

    const content: IdempotentContent = {
      noteId: input.noteId,
      montant: montantNorm,
      moyen: input.moyen,
      referenceNormalisee: normalisee,
      executeAtIso: canonicalIso,
    };

    const byKey = await client.noteFraisReglement.findUnique({
      where: { idempotencyKey: key },
    });
    if (byKey) {
      return await resolveIdempotentReglement({
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
      },
    });
    if (!notePreview) throw new Error("Note introuvable");
    await assertExecutorAuthorized(
      input.actorUserId,
      notePreview.demandeurUserId,
      client
    );
    if (notePreview.statut !== "VALIDEE") {
      throw new Error("Seules les notes validées peuvent être remboursées");
    }
    if (!notePreview.decideeAt) {
      throw new Error("Date de décision manquante sur la note");
    }
    if (executeAtDate.getTime() < notePreview.decideeAt.getTime()) {
      throw new Error(
        "Date d'exécution antérieure à la décision de la note"
      );
    }
    if (executeAtDate.getTime() > maxFutureMs) {
      throw new Error(
        "Date d'exécution trop dans le futur (tolérance 5 minutes)"
      );
    }

    let result: {
      kind: "already" | "fresh";
      reglementId: string;
      choixId: string;
      montantTotal: string;
      moyen: MoyenRemboursementNoteFrais;
      executeAt: string;
      version: number;
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
          throw new Error("Seules les notes validées peuvent être remboursées");
        }
        if (note.version !== input.expectedNoteVersion) {
          throw new Error(NOTES_FRAIS_REMB_VERSION_CONFLICT);
        }
        if (note.montantAccepte == null) {
          throw new Error("Montant accepté manquant");
        }

        const existingKey = await tx.noteFraisReglement.findUnique({
          where: { idempotencyKey: key },
        });
        if (existingKey) {
          if (sameRemboursementContent(content, existingKey)) {
            return {
              kind: "already" as const,
              reglementId: existingKey.id,
              choixId: existingKey.choixId,
              montantTotal: existingKey.montantTotal.toFixed(2),
              moyen: existingKey.moyen as MoyenRemboursementNoteFrais,
              executeAt: existingKey.executeAt.toISOString(),
              version: note.version,
            };
          }
          throw new Error(NOTES_FRAIS_REMB_IDEMPOTENCY_CONFLICT);
        }

        await tx.$executeRaw`
          SELECT id FROM notes_frais_choix_reglement
          WHERE "noteFraisId" = ${input.noteId} AND statut = 'ACTIF'
          FOR UPDATE
        `;

        const choix = await tx.noteFraisChoixReglement.findFirst({
          where: { noteFraisId: input.noteId, statut: "ACTIF" },
        });
        if (!choix) {
          throw new Error("Aucun choix de règlement ACTIF pour cette note");
        }
        if (choix.mode !== "REMBOURSEMENT" && choix.mode !== "MIXTE") {
          throw new Error(
            "Remboursement réservé aux choix REMBOURSEMENT ou MIXTE"
          );
        }

        const plafond = money(choix.montantRemboursement).minus(
          money(choix.montantRembourseUtilise)
        );
        const montant = money(montantNorm);
        if (montant.gt(plafond)) {
          throw new Error(NOTES_FRAIS_REMB_PLAFOND);
        }

        const consommeApres = money(choix.montantRembourseUtilise)
          .plus(money(choix.montantCompensationUtilise))
          .plus(montant);
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

        const claimed = await tx.noteFrais.updateMany({
          where: {
            id: input.noteId,
            statut: "VALIDEE",
            version: input.expectedNoteVersion,
          },
          data: { version: { increment: 1 } },
        });
        if (claimed.count !== 1) {
          throw new Error(NOTES_FRAIS_REMB_VERSION_CONFLICT);
        }

        const reglement = await tx.noteFraisReglement.create({
          data: {
            noteFraisId: input.noteId,
            choixId: choix.id,
            type: "REMBOURSEMENT",
            statut: "EXECUTE",
            montantTotal: montant,
            moyen: input.moyen,
            reference: brute,
            referenceNormalisee: normalisee,
            idempotencyKey: key,
            executeurUserId: input.actorUserId,
            executeAt: executeAtDate,
          },
        });

        await tx.noteFraisReglementLigne.create({
          data: {
            reglementId: reglement.id,
            typeLigne: "REMBOURSEMENT",
            typeCible: null,
            cibleId: null,
            rang: 1,
            montant,
            montantRestantCibleAvant: null,
            montantRestantCibleApres: null,
            montantAutoriseRestantAvant: null,
          },
        });

        if (input.afterReglementInsert) {
          await input.afterReglementInsert();
        }

        await tx.noteFraisChoixReglement.update({
          where: { id: choix.id },
          data: {
            montantRembourseUtilise: { increment: montant },
          },
        });

        return {
          kind: "fresh" as const,
          reglementId: reglement.id,
          choixId: choix.id,
          montantTotal: montantNorm,
          moyen: input.moyen,
          executeAt: canonicalIso,
          version: input.expectedNoteVersion + 1,
        };
      });
    } catch (txError) {
      if (!isIdempotencyKeyUniqueViolation(txError)) throw txError;
      const existing = await client.noteFraisReglement.findUnique({
        where: { idempotencyKey: key },
      });
      if (!existing) throw txError;
      return await resolveIdempotentReglement({
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
          reglementId: result.reglementId,
          noteId: input.noteId,
          choixId: result.choixId,
          montantTotal: result.montantTotal,
          moyen: result.moyen,
          executeAt: result.executeAt,
          version: result.version,
          alreadyExecuted: true,
        },
        message: "Déjà exécuté",
      };
    }

    return {
      success: true,
      data: {
        reglementId: result.reglementId,
        noteId: input.noteId,
        choixId: result.choixId,
        montantTotal: result.montantTotal,
        moyen: result.moyen,
        executeAt: result.executeAt,
        version: result.version,
        alreadyExecuted: false,
      },
      message: "Remboursement exécuté",
    };
  } catch (error) {
    return mapError(error);
  }
}
