/**
 * Corrections append-only des règlements de notes de frais (lot 4.6).
 * REFERENCE | MONTANT_NEGATIF ; compensation multilignes via InverseCible.
 * Aucune mutation du règlement / ligne / Avoir / UA d'origine.
 * Notif + outbox génériques atomiques sur correction fresh uniquement.
 */
import { Prisma, type PreuveCorrectionNoteFrais } from "@prisma/client";
import { db } from "@/lib/db";
import {
  NotesFraisDisabledError,
  assertNotesFraisEnabled,
} from "@/lib/frais-avances/feature-flag";
import { canUserCorrectNoteFraisReglement } from "@/lib/frais-avances/authz";
import { hashIdForLog } from "@/lib/frais-avances/storage";
import { lockUserRowForNotesFrais } from "@/lib/services/frais-avances/rgpd-account-deletion";
import { normalizeNotesFraisMontant } from "@/lib/services/frais-avances/note-frais-decision-service";
import { normalizeRemboursementReference } from "@/lib/services/frais-avances/note-frais-remboursement-service";
import { lockCompensationTargetsInTx } from "@/lib/services/frais-avances/note-frais-reglement-apply";
import { createNoteFraisReglementNotificationInTx } from "@/lib/services/frais-avances/note-frais-reglement-notify";

export type NotesFraisCorrectionActionResult<T = unknown> =
  | { success: true; data: T; message?: string }
  | { success: false; error: string; code?: string };

export const NOTES_FRAIS_CORR_VERSION_CONFLICT =
  "Conflit de version — rechargez la note et réessayez";

export const NOTES_FRAIS_CORR_IDEMPOTENCY_CONFLICT =
  "Clé d'idempotence déjà utilisée avec un contenu de correction différent";

export const NOTES_FRAIS_CORR_NO_CHANGE =
  "Correction sans changement effectif de la référence";

export const NOTES_FRAIS_CORR_PLAFOND =
  "Montant à corriger supérieur au net restant du règlement";

export const NOTES_FRAIS_CORR_CIBLE_MOUVEMENTS_POSTERIEURS =
  "Mouvements postérieurs sur la cible — inversion exacte impossible";

const PREUVE_KINDS = new Set<string>([
  "PV_TRESORERIE",
  "JUSTIFICATIF_INTERNE",
  "EMAIL_TRACE",
  "AUTRE_TRACE",
]);

const PREUVE_REF_CHARSET = /^[A-Za-z0-9._\-:/]+$/;
const EMAIL_LIKE =
  /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const IBAN_LIKE = /\b[A-Z]{2}\d{2}[A-Z0-9]{10,30}\b/i;
const MONTANT_LIKE = /\d+[.,]\d{2}/;

export type CorrectionAllocationInput = {
  reglementLigneId: string;
  /** Chaîne décimale positive à restaurer. */
  montantARestaurer: string;
};

export type CorrectNoteFraisReglementInput = {
  actorUserId: string;
  noteId: string;
  reglementId: string;
  expectedNoteVersion: number;
  idempotencyKey: string;
  type: "REFERENCE" | "MONTANT_NEGATIF";
  motif: string;
  /** REFERENCE : nouvelle référence brute. */
  referenceApres?: string;
  /** MONTANT_NEGATIF : montant positif à corriger (stocké négatif). */
  montantACorriger?: string;
  /** MONTANT_NEGATIF compensation : répartitions positives. */
  allocations?: CorrectionAllocationInput[];
  preuveKind?: PreuveCorrectionNoteFrais | string;
  preuveRef?: string;
  client?: typeof db;
  beforeDemandeurLock?: () => Promise<void>;
  afterDemandeurLock?: () => Promise<void>;
  beforeNoteLock?: () => Promise<void>;
  afterNoteLock?: () => Promise<void>;
  afterCorrectionInsert?: () => Promise<void>;
  afterNotifyOutbox?: () => Promise<void>;
  /** Hook tests : avant application de chaque inverse (index 0-based). */
  beforeApplyInverse?: (index: number) => Promise<void>;
};

export type CorrectionExecutionDto = {
  correctionId: string;
  noteId: string;
  reglementId: string;
  type: "REFERENCE" | "MONTANT_NEGATIF";
  montant: string | null;
  version: number;
  alreadyCorrected: boolean;
};

function money(v: Prisma.Decimal | number | string): Prisma.Decimal {
  return new Prisma.Decimal(v);
}

function disabledResult(): NotesFraisCorrectionActionResult<never> {
  return {
    success: false,
    error: "Le module frais avancés n'est pas activé.",
    code: "NOTES_FRAIS_DISABLED",
  };
}

function mapError(error: unknown): NotesFraisCorrectionActionResult<never> {
  if (error instanceof NotesFraisDisabledError) return disabledResult();
  if (error instanceof Error) {
    let code: string | undefined;
    if (error.message === NOTES_FRAIS_CORR_VERSION_CONFLICT) {
      code = "VERSION_CONFLICT";
    } else if (error.message === NOTES_FRAIS_CORR_IDEMPOTENCY_CONFLICT) {
      code = "IDEMPOTENCY_CONFLICT";
    } else if (error.message === NOTES_FRAIS_CORR_NO_CHANGE) {
      code = "CORRECTION_NO_CHANGE";
    } else if (error.message === NOTES_FRAIS_CORR_PLAFOND) {
      code = "PLAFOND_DEPASSE";
    } else if (error.message === NOTES_FRAIS_CORR_CIBLE_MOUVEMENTS_POSTERIEURS) {
      code = "CIBLE_MOUVEMENTS_POSTERIEURS";
    } else if (error.message.includes("Non autorisé")) {
      code = "FORBIDDEN";
    } else if (error.message.includes("Auto-correction")) {
      code = "AUTO_CORRECTION_FORBIDDEN";
    } else if (
      error.message.includes("preuve") ||
      error.message.includes("Preuve")
    ) {
      code = "PREUVE_INVALIDE";
    } else if (
      error.message.includes("motif") ||
      error.message.includes("Motif")
    ) {
      code = "MOTIF_INVALIDE";
    } else if (
      error.message.includes("référence") ||
      error.message.includes("Référence")
    ) {
      code = "REFERENCE_INVALIDE";
    }
    return { success: false, error: error.message, code };
  }
  return { success: false, error: "Erreur inattendue" };
}

/**
 * Normalise et valide le motif (1–2000).
 */
export function normalizeCorrectionMotif(raw: string): string {
  if (typeof raw !== "string") {
    throw new Error("Motif de correction requis");
  }
  const motif = raw.trim();
  if (motif.length < 1 || motif.length > 2000) {
    throw new Error("Motif invalide (1 à 2000 caractères)");
  }
  return motif;
}

/**
 * Normalise preuveRef V1 (8–64, NFKC, charset technique).
 * Refuse email, IBAN, montant ou nom identifiable.
 */
export function normalizeCorrectionPreuveRef(raw: string): string {
  if (typeof raw !== "string") {
    throw new Error("Référence de preuve requise");
  }
  const ref = raw.normalize("NFKC").trim();
  if (ref.length < 8 || ref.length > 64) {
    throw new Error("Référence de preuve invalide (8 à 64 caractères)");
  }
  if (!PREUVE_REF_CHARSET.test(ref)) {
    throw new Error("Référence de preuve : caractères non autorisés");
  }
  if (EMAIL_LIKE.test(ref)) {
    throw new Error(
      "Référence de preuve : adresse email interdite (utiliser un id de trace)"
    );
  }
  if (IBAN_LIKE.test(ref.replace(/\s/g, ""))) {
    throw new Error("Référence de preuve : IBAN interdit");
  }
  if (MONTANT_LIKE.test(ref)) {
    throw new Error("Référence de preuve : montant interdit");
  }
  // Refuse espaces / tokens trop « nominatifs » (mots avec majuscule initiale multiples)
  if (/\s/.test(raw.trim()) || /[A-Z][a-z]{2,}\s+[A-Z][a-z]{2,}/.test(raw)) {
    throw new Error("Référence de preuve : nom identifiable interdit");
  }
  return ref;
}

/**
 * Valide preuveKind parmi les 4 valeurs V1.
 */
export function parsePreuveKind(
  raw: string | undefined | null
): PreuveCorrectionNoteFrais {
  const k = String(raw || "").trim().toUpperCase();
  if (!PREUVE_KINDS.has(k)) {
    throw new Error(
      "Preuve kind invalide (PV_TRESORERIE|JUSTIFICATIF_INTERNE|EMAIL_TRACE|AUTRE_TRACE)"
    );
  }
  return k as PreuveCorrectionNoteFrais;
}

/**
 * Net d'un règlement = brut + Σ corrections MONTANT_NEGATIF (montants ≤ 0).
 */
export function computeReglementNetMontant(
  montantTotal: Prisma.Decimal | number | string,
  correctionsMontantNegatif: Array<Prisma.Decimal | number | string | null>
): Prisma.Decimal {
  let net = money(montantTotal);
  for (const c of correctionsMontantNegatif) {
    if (c == null) continue;
    const m = money(c);
    if (!m.lt(0)) {
      throw new Error("Correction de montant attendue strictement négative");
    }
    net = net.plus(m);
  }
  if (net.lt(0)) {
    throw new Error("Net de règlement négatif — état incohérent");
  }
  return net;
}

type CanonicalAllocation = {
  reglementLigneId: string;
  montant: string;
};

type CanonicalCorrectionContent = {
  reglementId: string;
  type: "REFERENCE" | "MONTANT_NEGATIF";
  referenceApresNorm: string | null;
  montantACorriger: string | null;
  allocations: CanonicalAllocation[];
  motif: string;
  preuveKind: string | null;
  preuveRef: string | null;
};

function sameCorrectionContent(
  a: CanonicalCorrectionContent,
  row: {
    reglementId: string;
    type: string;
    referenceApresNorm: string | null;
    montant: Prisma.Decimal | null;
    motif: string;
    preuveKind: string | null;
    preuveRef: string | null;
    Inverses?: Array<{
      reglementLigneId: string;
      montantRestaure: Prisma.Decimal;
    }>;
  }
): boolean {
  if (row.reglementId !== a.reglementId) return false;
  if (row.type !== a.type) return false;
  if (row.motif !== a.motif) return false;
  if ((row.preuveKind ?? null) !== a.preuveKind) return false;
  if ((row.preuveRef ?? null) !== a.preuveRef) return false;
  if (a.type === "REFERENCE") {
    return (row.referenceApresNorm ?? null) === a.referenceApresNorm;
  }
  if (!row.montant || !a.montantACorriger) return false;
  if (!money(row.montant).eq(money(a.montantACorriger).neg())) return false;
  const inv = (row.Inverses ?? [])
    .map((i) => ({
      reglementLigneId: i.reglementLigneId,
      montant: normalizeNotesFraisMontant(i.montantRestaure) ?? "",
    }))
    .sort((x, y) => x.reglementLigneId.localeCompare(y.reglementLigneId));
  if (inv.length !== a.allocations.length) return false;
  for (let i = 0; i < inv.length; i++) {
    if (
      inv[i]!.reglementLigneId !== a.allocations[i]!.reglementLigneId ||
      inv[i]!.montant !== a.allocations[i]!.montant
    ) {
      return false;
    }
  }
  return true;
}

async function assertCorrectorAuthorized(
  actorUserId: string,
  demandeurUserId: string,
  client: typeof db
): Promise<void> {
  if (demandeurUserId === actorUserId) {
    throw new Error(
      "Auto-correction interdite : le correcteur ne peut pas être le demandeur"
    );
  }
  const allowed = await canUserCorrectNoteFraisReglement(actorUserId, client);
  if (!allowed) {
    throw new Error(
      "Non autorisé à corriger un règlement de note de frais"
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

function cmStatutApres(
  montantPaye: Prisma.Decimal,
  montantRestant: Prisma.Decimal
): string {
  if (montantRestant.lte(0)) return "Paye";
  if (montantPaye.gt(0)) return "PartiellementPaye";
  return "EnAttente";
}

/**
 * Normalise les allocations compensation (somme = montantACorriger).
 */
export function normalizeCorrectionAllocations(
  allocations: CorrectionAllocationInput[],
  montantACorriger: string
): CanonicalAllocation[] {
  if (!Array.isArray(allocations) || allocations.length === 0) {
    throw new Error("Au moins une répartition de ligne est requise");
  }
  const seen = new Set<string>();
  const out: CanonicalAllocation[] = [];
  let sum = money(0);
  for (const a of allocations) {
    const ligneId = String(a.reglementLigneId || "").trim();
    if (!ligneId) throw new Error("Identifiant de ligne requis");
    if (seen.has(ligneId)) {
      throw new Error("Ligne dupliquée dans les répartitions");
    }
    seen.add(ligneId);
    const mNorm = normalizeNotesFraisMontant(a.montantARestaurer);
    if (!mNorm || !money(mNorm).gt(0)) {
      throw new Error(
        "Chaque montant de répartition doit être strictement positif"
      );
    }
    sum = sum.plus(money(mNorm));
    out.push({ reglementLigneId: ligneId, montant: mNorm });
  }
  if (!sum.eq(money(montantACorriger))) {
    throw new Error(
      "La somme des répartitions doit égaler exactement le montant à corriger"
    );
  }
  out.sort((a, b) => a.reglementLigneId.localeCompare(b.reglementLigneId));
  return out;
}

type CorrRow = {
  id: string;
  reglementId: string;
  type: string;
  montant: Prisma.Decimal | null;
  referenceApresNorm: string | null;
  motif: string;
  preuveKind: string | null;
  preuveRef: string | null;
  Inverses?: Array<{
    reglementLigneId: string;
    montantRestaure: Prisma.Decimal;
  }>;
};

async function resolveIdempotentCorrection(params: {
  client: typeof db;
  actorUserId: string;
  noteId: string;
  content: CanonicalCorrectionContent;
  byKey: CorrRow;
}): Promise<NotesFraisCorrectionActionResult<CorrectionExecutionDto>> {
  const { client, actorUserId, noteId, content, byKey } = params;
  const note = await client.noteFrais.findUnique({
    where: { id: noteId },
    select: { version: true, demandeurUserId: true },
  });
  if (!note) throw new Error("Note introuvable");
  await assertCorrectorAuthorized(actorUserId, note.demandeurUserId, client);

  if (sameCorrectionContent(content, byKey)) {
    return {
      success: true,
      data: {
        correctionId: byKey.id,
        noteId,
        reglementId: byKey.reglementId,
        type: byKey.type as "REFERENCE" | "MONTANT_NEGATIF",
        montant: byKey.montant?.toFixed(2) ?? null,
        version: note.version,
        alreadyCorrected: true,
      },
      message: "Déjà corrigé",
    };
  }
  throw new Error(NOTES_FRAIS_CORR_IDEMPOTENCY_CONFLICT);
}

/**
 * Enregistre une correction append-only (REFERENCE ou MONTANT_NEGATIF).
 *
 * @param input - Acteur, note, règlement, OCC, clé, type, motif, payload
 */
export async function correctNoteFraisReglement(
  input: CorrectNoteFraisReglementInput
): Promise<NotesFraisCorrectionActionResult<CorrectionExecutionDto>> {
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
    if (input.type !== "REFERENCE" && input.type !== "MONTANT_NEGATIF") {
      throw new Error("Type de correction invalide");
    }
    const motif = normalizeCorrectionMotif(input.motif);
    const reglementId = String(input.reglementId || "").trim();
    if (!reglementId) throw new Error("Identifiant de règlement requis");

    let referenceApresNorm: string | null = null;
    let referenceApresBrute: string | null = null;
    let montantACorriger: string | null = null;
    let allocations: CanonicalAllocation[] = [];
    let preuveKind: PreuveCorrectionNoteFrais | null = null;
    let preuveRef: string | null = null;

    if (input.type === "REFERENCE") {
      if (input.preuveKind != null || input.preuveRef != null) {
        throw new Error("Preuve interdite pour une correction de référence");
      }
      const { brute, normalisee } = normalizeRemboursementReference(
        String(input.referenceApres ?? "")
      );
      referenceApresBrute = brute;
      referenceApresNorm = normalisee;
    } else {
      preuveKind = parsePreuveKind(input.preuveKind);
      preuveRef = normalizeCorrectionPreuveRef(String(input.preuveRef ?? ""));
      const mNorm = normalizeNotesFraisMontant(input.montantACorriger ?? "");
      if (!mNorm || !money(mNorm).gt(0)) {
        throw new Error(
          "Le montant à corriger doit être une chaîne décimale strictement positive"
        );
      }
      montantACorriger = mNorm;
      // allocations normalisées après lecture du type de règlement
    }

    const contentBase: Omit<CanonicalCorrectionContent, "allocations"> & {
      allocations: CanonicalAllocation[];
    } = {
      reglementId,
      type: input.type,
      referenceApresNorm,
      montantACorriger,
      allocations: [],
      motif,
      preuveKind,
      preuveRef,
    };

    // Authz + replay avant tout lock / mutation
    const existing = await client.noteFraisReglementCorrection.findUnique({
      where: { idempotencyKey: key },
      include: { Inverses: true },
    });
    if (existing) {
      // Pour MONTANT_NEGATIF compensation, allocations doivent matcher ;
      // si pas encore normalisées (on ne connaît pas encore le type règlement),
      // on compare sans allocations d'abord puis re-résout après.
      if (input.type === "MONTANT_NEGATIF") {
        const regPeek = await client.noteFraisReglement.findUnique({
          where: { id: reglementId },
          select: { type: true },
        });
        if (regPeek?.type === "COMPENSATION") {
          contentBase.allocations = normalizeCorrectionAllocations(
            input.allocations ?? [],
            montantACorriger!
          );
        }
      }
      return await resolveIdempotentCorrection({
        client,
        actorUserId: input.actorUserId,
        noteId: input.noteId,
        content: contentBase,
        byKey: existing,
      });
    }

    let kickOutbox = false;
    const result = await client.$transaction(async (tx) => {
      const notePreview = await tx.noteFrais.findUnique({
        where: { id: input.noteId },
        select: { demandeurUserId: true, statut: true },
      });
      if (!notePreview) throw new Error("Note introuvable");
      if (notePreview.statut !== "VALIDEE") {
        throw new Error("Seule une note VALIDEE peut être corrigée");
      }

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
          adherentId: true,
        },
      });
      if (note.statut !== "VALIDEE") {
        throw new Error("Seule une note VALIDEE peut être corrigée");
      }
      await assertCorrectorAuthorized(
        input.actorUserId,
        note.demandeurUserId,
        tx as unknown as typeof db
      );

      await tx.$executeRaw`
        SELECT id FROM notes_frais_reglements WHERE id = ${reglementId} FOR UPDATE
      `;

      const reglement = await tx.noteFraisReglement.findUnique({
        where: { id: reglementId },
        include: {
          Lignes: { orderBy: { rang: "asc" } },
          Corrections: {
            where: { type: { in: ["REFERENCE", "MONTANT_NEGATIF"] } },
            orderBy: { createdAt: "asc" },
            include: { Inverses: true },
          },
          Restitutions: { select: { montant: true } },
        },
      });
      if (!reglement || reglement.noteFraisId !== input.noteId) {
        throw new Error("Règlement introuvable pour cette note");
      }
      if (reglement.statut !== "EXECUTE") {
        throw new Error("Seuls les règlements EXECUTE peuvent être corrigés");
      }

      const choix = await tx.noteFraisChoixReglement.findUniqueOrThrow({
        where: { id: reglement.choixId },
        include: { Cibles: true },
      });

      // Idempotence dans la TX (course)
      const byKeyTx = await tx.noteFraisReglementCorrection.findUnique({
        where: { idempotencyKey: key },
        include: { Inverses: true },
      });

      if (input.type === "REFERENCE") {
        if (reglement.type !== "REMBOURSEMENT") {
          throw new Error(
            "Correction de référence réservée aux règlements REMBOURSEMENT"
          );
        }
        const lastRef = [...reglement.Corrections]
          .filter((c) => c.type === "REFERENCE")
          .sort(
            (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
          )[0];
        const effectiveBrute =
          lastRef?.referenceApres ?? reglement.reference ?? "";
        const effectiveNorm =
          lastRef?.referenceApresNorm ??
          reglement.referenceNormalisee ??
          "";
        if (!effectiveNorm) {
          throw new Error("Référence effective introuvable sur le règlement");
        }
        if (referenceApresNorm === effectiveNorm) {
          throw new Error(NOTES_FRAIS_CORR_NO_CHANGE);
        }

        const content: CanonicalCorrectionContent = {
          ...contentBase,
          allocations: [],
        };
        if (byKeyTx) {
          return (
            await resolveIdempotentCorrection({
              client: tx as unknown as typeof db,
              actorUserId: input.actorUserId,
              noteId: input.noteId,
              content,
              byKey: byKeyTx,
            })
          ).data!;
        }

        if (note.version !== input.expectedNoteVersion) {
          throw new Error(NOTES_FRAIS_CORR_VERSION_CONFLICT);
        }

        const correction = await tx.noteFraisReglementCorrection.create({
          data: {
            reglementId,
            type: "REFERENCE",
            montant: null,
            referenceAvant: effectiveBrute,
            referenceAvantNorm: effectiveNorm,
            referenceApres: referenceApresBrute!,
            referenceApresNorm: referenceApresNorm!,
            motif,
            preuveKind: null,
            preuveRef: null,
            idempotencyKey: key,
            actorUserId: input.actorUserId,
          },
        });

        if (input.afterCorrectionInsert) await input.afterCorrectionInsert();

        const updated = await tx.noteFrais.updateMany({
          where: { id: note.id, version: input.expectedNoteVersion },
          data: { version: { increment: 1 } },
        });
        if (updated.count !== 1) {
          throw new Error(NOTES_FRAIS_CORR_VERSION_CONFLICT);
        }

        await createNoteFraisReglementNotificationInTx(tx, {
          noteId: note.id,
          demandeurUserId: note.demandeurUserId,
          kind: "CORRECTION_REFERENCE",
          anchorId: correction.id,
        });
        if (input.afterNotifyOutbox) await input.afterNotifyOutbox();

        kickOutbox = true;
        return {
          correctionId: correction.id,
          noteId: note.id,
          reglementId,
          type: "REFERENCE" as const,
          montant: null,
          version: note.version + 1,
          alreadyCorrected: false,
        };
      }

      // ——— MONTANT_NEGATIF ———
      if (
        reglement.type !== "REMBOURSEMENT" &&
        reglement.type !== "COMPENSATION"
      ) {
        throw new Error("Type de règlement non corrigeable");
      }

      if (reglement.type === "COMPENSATION") {
        allocations = normalizeCorrectionAllocations(
          input.allocations ?? [],
          montantACorriger!
        );
      } else if ((input.allocations?.length ?? 0) > 0) {
        throw new Error(
          "Répartitions interdites pour un remboursement"
        );
      }

      const content: CanonicalCorrectionContent = {
        ...contentBase,
        allocations,
      };
      if (byKeyTx) {
        return (
          await resolveIdempotentCorrection({
            client: tx as unknown as typeof db,
            actorUserId: input.actorUserId,
            noteId: input.noteId,
            content,
            byKey: byKeyTx,
          })
        ).data!;
      }

      const priorNeg = reglement.Corrections.filter(
        (c) => c.type === "MONTANT_NEGATIF" && c.montant != null
      ).map((c) => c.montant!);
      const net = computeReglementNetMontant(reglement.montantTotal, priorNeg);
      const restitueCumule = (reglement.Restitutions ?? []).reduce(
        (acc, r) => acc.plus(money(r.montant)),
        money(0)
      );
      // Lot 4.7 : une correction ne peut pas rendre net < cumuls restitués.
      const montantEncoreCorrigeable = net.minus(restitueCumule);
      if (montantEncoreCorrigeable.lt(0)) {
        throw new Error(NOTES_FRAIS_CORR_PLAFOND);
      }
      const aCorriger = money(montantACorriger!);
      if (aCorriger.gt(montantEncoreCorrigeable)) {
        throw new Error(NOTES_FRAIS_CORR_PLAFOND);
      }
      const montantStocke = aCorriger.neg();
      if (!montantStocke.lt(0)) {
        throw new Error("Montant de correction doit être strictement négatif");
      }

      if (note.version !== input.expectedNoteVersion) {
        throw new Error(NOTES_FRAIS_CORR_VERSION_CONFLICT);
      }

      if (reglement.type === "REMBOURSEMENT") {
        const correction = await tx.noteFraisReglementCorrection.create({
          data: {
            reglementId,
            type: "MONTANT_NEGATIF",
            montant: montantStocke,
            referenceAvant: null,
            referenceAvantNorm: null,
            referenceApres: null,
            referenceApresNorm: null,
            motif,
            preuveKind: preuveKind!,
            preuveRef: preuveRef!,
            idempotencyKey: key,
            actorUserId: input.actorUserId,
          },
        });

        // Décrément atomique gardé (aligné restitution 4.7).
        const compteur = await tx.noteFraisChoixReglement.updateMany({
          where: {
            id: choix.id,
            montantRembourseUtilise: { gte: aCorriger },
          },
          data: {
            montantRembourseUtilise: { decrement: aCorriger },
          },
        });
        if (compteur.count !== 1) {
          throw new Error(NOTES_FRAIS_CORR_PLAFOND);
        }

        if (input.afterCorrectionInsert) await input.afterCorrectionInsert();

        const updated = await tx.noteFrais.updateMany({
          where: { id: note.id, version: input.expectedNoteVersion },
          data: { version: { increment: 1 } },
        });
        if (updated.count !== 1) {
          throw new Error(NOTES_FRAIS_CORR_VERSION_CONFLICT);
        }

        await createNoteFraisReglementNotificationInTx(tx, {
          noteId: note.id,
          demandeurUserId: note.demandeurUserId,
          kind: "CORRECTION_MONTANT_NEGATIF",
          anchorId: correction.id,
        });
        if (input.afterNotifyOutbox) await input.afterNotifyOutbox();

        kickOutbox = true;
        return {
          correctionId: correction.id,
          noteId: note.id,
          reglementId,
          type: "MONTANT_NEGATIF" as const,
          montant: montantStocke.toFixed(2),
          version: note.version + 1,
          alreadyCorrected: false,
        };
      }

      // COMPENSATION multilignes
      const ligneById = new Map(reglement.Lignes.map((l) => [l.id, l]));
      const lockSpecs = allocations.map((a) => {
        const ligne = ligneById.get(a.reglementLigneId);
        if (!ligne || ligne.reglementId !== reglementId) {
          throw new Error("Ligne hors règlement corrigé");
        }
        if (!ligne.typeCible || !ligne.cibleId) {
          throw new Error("Ligne de compensation sans cible");
        }
        if (ligne.typeLigne !== "COMPENSATION") {
          throw new Error("Ligne non compensable");
        }
        return {
          typeCible: ligne.typeCible as
            | "COTISATION_MENSUELLE"
            | "DETTE_INITIALE",
          cibleId: ligne.cibleId,
          montant: a.montant,
          rang: ligne.rang,
          reglementLigneId: ligne.id,
          montantLigne: money(ligne.montant),
          restantApresOrigine: money(ligne.montantRestantCibleApres ?? 0),
        };
      });

      await lockCompensationTargetsInTx(
        tx,
        lockSpecs.map((s) => ({
          typeCible: s.typeCible,
          cibleId: s.cibleId,
          montant: s.montant,
          rang: s.rang,
        }))
      );

      // Inverses antérieurs par ligne
      const priorInverses = await tx.noteFraisCorrectionInverseCible.findMany({
        where: {
          reglementLigneId: { in: lockSpecs.map((s) => s.reglementLigneId) },
        },
        select: {
          reglementLigneId: true,
          montantRestaure: true,
          createdAt: true,
        },
      });
      const sumPriorByLigne = new Map<string, Prisma.Decimal>();
      for (const inv of priorInverses) {
        const cur = sumPriorByLigne.get(inv.reglementLigneId) ?? money(0);
        sumPriorByLigne.set(
          inv.reglementLigneId,
          cur.plus(money(inv.montantRestaure))
        );
      }

      type InversePrepared = {
        reglementLigneId: string;
        typeCible: "COTISATION_MENSUELLE" | "DETTE_INITIALE";
        cibleId: string;
        montantRestaure: Prisma.Decimal;
        restantAvant: Prisma.Decimal;
        restantApres: Prisma.Decimal;
        cibleChoixId: string;
      };
      const preparedInverses: InversePrepared[] = [];

      for (const spec of lockSpecs) {
        const priorSum = sumPriorByLigne.get(spec.reglementLigneId) ?? money(0);
        const restaurableMax = spec.montantLigne.minus(priorSum);
        const montantRestaure = money(spec.montant);
        if (montantRestaure.gt(restaurableMax)) {
          throw new Error(NOTES_FRAIS_CORR_PLAFOND);
        }

        const expectedRestantAvant = spec.restantApresOrigine.plus(priorSum);
        const cibleChoix = choix.Cibles.find(
          (c) =>
            c.typeCible === spec.typeCible && c.cibleId === spec.cibleId
        );
        if (!cibleChoix) {
          throw new Error("Cible absente du choix");
        }

        if (spec.typeCible === "DETTE_INITIALE") {
          const dette = await tx.detteInitiale.findFirst({
            where: { id: spec.cibleId, adherentId: note.adherentId },
          });
          if (!dette) throw new Error("Cible introuvable");
          const restantLive = money(dette.montantRestant);
          const payeLive = money(dette.montantPaye);
          const payeAttribuable = restaurableMax;
          if (
            !restantLive.eq(expectedRestantAvant) ||
            payeLive.lt(payeAttribuable)
          ) {
            throw new Error(NOTES_FRAIS_CORR_CIBLE_MOUVEMENTS_POSTERIEURS);
          }
          const newPaye = payeLive.minus(montantRestaure);
          if (newPaye.lt(0)) {
            throw new Error(NOTES_FRAIS_CORR_CIBLE_MOUVEMENTS_POSTERIEURS);
          }
          preparedInverses.push({
            reglementLigneId: spec.reglementLigneId,
            typeCible: spec.typeCible,
            cibleId: spec.cibleId,
            montantRestaure,
            restantAvant: restantLive,
            restantApres: restantLive.plus(montantRestaure),
            cibleChoixId: cibleChoix.id,
          });
        } else {
          const cm = await tx.cotisationMensuelle.findFirst({
            where: {
              id: spec.cibleId,
              adherentId: note.adherentId,
              adherentBeneficiaireId: null,
              TypeCotisation: { categorie: { not: "Assistance" } },
            },
          });
          if (!cm) throw new Error("Cible introuvable");
          const restantLive = money(cm.montantRestant);
          const payeLive = money(cm.montantPaye);
          const payeAttribuable = restaurableMax;
          if (
            !restantLive.eq(expectedRestantAvant) ||
            payeLive.lt(payeAttribuable)
          ) {
            throw new Error(NOTES_FRAIS_CORR_CIBLE_MOUVEMENTS_POSTERIEURS);
          }
          preparedInverses.push({
            reglementLigneId: spec.reglementLigneId,
            typeCible: spec.typeCible,
            cibleId: spec.cibleId,
            montantRestaure,
            restantAvant: restantLive,
            restantApres: restantLive.plus(montantRestaure),
            cibleChoixId: cibleChoix.id,
          });
        }
      }

      const newCompUtilise = money(choix.montantCompensationUtilise).minus(
        aCorriger
      );
      if (newCompUtilise.lt(0)) {
        throw new Error(NOTES_FRAIS_CORR_PLAFOND);
      }

      const correction = await tx.noteFraisReglementCorrection.create({
        data: {
          reglementId,
          type: "MONTANT_NEGATIF",
          montant: montantStocke,
          motif,
          preuveKind: preuveKind!,
          preuveRef: preuveRef!,
          idempotencyKey: key,
          actorUserId: input.actorUserId,
        },
      });

      for (let invIndex = 0; invIndex < preparedInverses.length; invIndex++) {
        const inv = preparedInverses[invIndex]!;
        if (input.beforeApplyInverse) {
          await input.beforeApplyInverse(invIndex);
        }
        if (inv.typeCible === "DETTE_INITIALE") {
          const dette = await tx.detteInitiale.findUniqueOrThrow({
            where: { id: inv.cibleId },
          });
          await tx.detteInitiale.update({
            where: { id: inv.cibleId },
            data: {
              montantPaye: money(dette.montantPaye).minus(inv.montantRestaure),
            },
          });
          const after = await tx.detteInitiale.findUniqueOrThrow({
            where: { id: inv.cibleId },
            select: { montantRestant: true },
          });
          if (!money(after.montantRestant).eq(inv.restantApres)) {
            throw new Error(NOTES_FRAIS_CORR_CIBLE_MOUVEMENTS_POSTERIEURS);
          }
        } else {
          const cm = await tx.cotisationMensuelle.findUniqueOrThrow({
            where: { id: inv.cibleId },
          });
          const newPaye = money(cm.montantPaye).minus(inv.montantRestaure);
          const newRestant = money(cm.montantRestant).plus(inv.montantRestaure);
          await tx.cotisationMensuelle.update({
            where: { id: inv.cibleId },
            data: {
              montantPaye: newPaye,
              montantRestant: newRestant,
              statut: cmStatutApres(newPaye, newRestant),
            },
          });
        }

        // Décrément atomique gardé : refuse si montantUtilise < montantRestaure.
        const cibleDec = await tx.noteFraisChoixReglementCible.updateMany({
          where: {
            id: inv.cibleChoixId,
            montantUtilise: { gte: inv.montantRestaure },
          },
          data: {
            montantUtilise: { decrement: inv.montantRestaure },
          },
        });
        if (cibleDec.count !== 1) {
          throw new Error(NOTES_FRAIS_CORR_PLAFOND);
        }

        await tx.noteFraisCorrectionInverseCible.create({
          data: {
            correctionId: correction.id,
            reglementLigneId: inv.reglementLigneId,
            typeCible: inv.typeCible,
            cibleId: inv.cibleId,
            montantRestaure: inv.montantRestaure,
            restantAvant: inv.restantAvant,
            restantApres: inv.restantApres,
          },
        });
      }

      await tx.noteFraisChoixReglement.update({
        where: { id: choix.id },
        data: { montantCompensationUtilise: newCompUtilise },
      });

      if (input.afterCorrectionInsert) await input.afterCorrectionInsert();

      const updated = await tx.noteFrais.updateMany({
        where: { id: note.id, version: input.expectedNoteVersion },
        data: { version: { increment: 1 } },
      });
      if (updated.count !== 1) {
        throw new Error(NOTES_FRAIS_CORR_VERSION_CONFLICT);
      }

      await createNoteFraisReglementNotificationInTx(tx, {
        noteId: note.id,
        demandeurUserId: note.demandeurUserId,
        kind: "CORRECTION_MONTANT_NEGATIF",
        anchorId: correction.id,
      });
      if (input.afterNotifyOutbox) await input.afterNotifyOutbox();

      kickOutbox = true;
      return {
        correctionId: correction.id,
        noteId: note.id,
        reglementId,
        type: "MONTANT_NEGATIF" as const,
        montant: montantStocke.toFixed(2),
        version: note.version + 1,
        alreadyCorrected: false,
      };
    });

    // P2002 hors TX / filet
    if (!result) {
      throw new Error("Correction échouée");
    }

    if (kickOutbox && !result.alreadyCorrected && !input.client) {
      void import("@/lib/services/frais-avances/note-frais-service")
        .then(({ processNoteFraisOutboxOnce }) => processNoteFraisOutboxOnce())
        .catch((err) => {
          console.error("[notes-frais] outbox kick failed after correction", {
            note: hashIdForLog(input.noteId),
            err: err instanceof Error ? err.message.slice(0, 120) : "unknown",
          });
        });
    }

    return {
      success: true,
      data: result,
      message: result.alreadyCorrected
        ? "Déjà corrigé"
        : "Correction enregistrée",
    };
  } catch (error) {
    if (isIdempotencyKeyUniqueViolation(error)) {
      try {
        const byKey = await client.noteFraisReglementCorrection.findUnique({
          where: { idempotencyKey: input.idempotencyKey.trim() },
          include: { Inverses: true },
        });
        if (byKey) {
          let allocations: CanonicalAllocation[] = [];
          let montantACorriger: string | null = null;
          let referenceApresNorm: string | null = null;
          let preuveKind: string | null = null;
          let preuveRef: string | null = null;
          const motif = normalizeCorrectionMotif(input.motif);
          if (input.type === "REFERENCE") {
            referenceApresNorm = normalizeRemboursementReference(
              String(input.referenceApres ?? "")
            ).normalisee;
          } else {
            preuveKind = parsePreuveKind(input.preuveKind);
            preuveRef = normalizeCorrectionPreuveRef(
              String(input.preuveRef ?? "")
            );
            montantACorriger = normalizeNotesFraisMontant(
              input.montantACorriger ?? ""
            );
            const reg = await client.noteFraisReglement.findUnique({
              where: { id: input.reglementId },
              select: { type: true },
            });
            if (reg?.type === "COMPENSATION" && montantACorriger) {
              allocations = normalizeCorrectionAllocations(
                input.allocations ?? [],
                montantACorriger
              );
            }
          }
          return await resolveIdempotentCorrection({
            client,
            actorUserId: input.actorUserId,
            noteId: input.noteId,
            content: {
              reglementId: input.reglementId,
              type: input.type,
              referenceApresNorm,
              montantACorriger,
              allocations,
              motif,
              preuveKind,
              preuveRef,
            },
            byKey,
          });
        }
      } catch (e) {
        return mapError(e);
      }
    }
    return mapError(error);
  }
}

/**
 * Agrège les corrections MONTANT_NEGATIF par type de règlement cible.
 * Retourne des chaînes décimales canoniques (pas de flottant intermédiaire).
 */
export async function aggregateCorrectionsMontantByReglementType(
  client: typeof db = db
): Promise<{ remboursements: string; compensations: string }> {
  const rows = await client.noteFraisReglementCorrection.findMany({
    where: { type: "MONTANT_NEGATIF", montant: { not: null } },
    select: {
      montant: true,
      Reglement: { select: { type: true } },
    },
  });
  let remboursements = money(0);
  let compensations = money(0);
  for (const r of rows) {
    const m = money(r.montant!);
    if (r.Reglement.type === "REMBOURSEMENT") {
      remboursements = remboursements.plus(m);
    } else if (r.Reglement.type === "COMPENSATION") {
      compensations = compensations.plus(m);
    }
  }
  return {
    remboursements: remboursements.toFixed(2),
    compensations: compensations.toFixed(2),
  };
}
