/**
 * Annulation à double validation des règlements notes de frais (lot 4.8).
 * Expiration 30 jours ; CONFIRMEE seule porte un effet financier.
 * Distincte des corrections 4.6 et restitutions 4.7.
 */
import { Prisma, AdminRole, UserRole, UserStatus } from "@prisma/client";
import type { PreuveAnnulationReglement } from "@prisma/client";
import { db } from "@/lib/db";
import {
  NotesFraisDisabledError,
  assertNotesFraisEnabled,
} from "@/lib/frais-avances/feature-flag";
import {
  canUserConfirmCancelNoteFraisReglement,
  canUserRefuseCancelNoteFraisReglement,
  canUserRequestCancelNoteFraisReglement,
} from "@/lib/frais-avances/authz";
import { hashIdForLog } from "@/lib/frais-avances/storage";
import { lockUserRowForNotesFrais } from "@/lib/services/frais-avances/rgpd-account-deletion";
import { lockCompensationTargetsInTx } from "@/lib/services/frais-avances/note-frais-reglement-apply";
import {
  createNoteFraisAnnulationNotificationsInTx,
} from "@/lib/services/frais-avances/note-frais-reglement-notify";

export const NOTES_FRAIS_ANNULATION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type NotesFraisAnnulationActionResult<T = unknown> =
  | { success: true; data: T; message?: string }
  | { success: false; error: string; code?: string };

export const NOTES_FRAIS_ANNUL_VERSION_CONFLICT =
  "Conflit de version — rechargez la note et réessayez";
export const NOTES_FRAIS_ANNUL_IDEMPOTENCY_CONFLICT =
  "Clé d'idempotence déjà utilisée avec un contenu différent";
export const NOTES_FRAIS_ANNUL_HAS_CORRECTIONS = "REGLEMENT_HAS_CORRECTIONS";
export const NOTES_FRAIS_ANNUL_HAS_RESTITUTIONS = "REGLEMENT_HAS_RESTITUTIONS";
export const NOTES_FRAIS_ANNUL_MIXTE_PARENT_REQUIRED = "MIXTE_PARENT_REQUIRED";
export const NOTES_FRAIS_ANNUL_EXPIRED = "ANNULATION_EXPIRED";
export const NOTES_FRAIS_ANNUL_ALREADY_DECIDED = "ANNULATION_ALREADY_DECIDED";
/** Une DEMANDEE active existe déjà sur la cible (garde TX — index partiel futur). */
export const NOTES_FRAIS_ANNUL_ACTIVE_EXISTS = "ANNULATION_ALREADY_PENDING";
export const NOTES_FRAIS_ANNUL_PLAFOND =
  "Compteur insuffisant pour cette annulation";
export const NOTES_FRAIS_ANNUL_CIBLE_MOUVEMENTS =
  "CIBLE_MOUVEMENTS_POSTERIEURS";
export const NOTES_FRAIS_ANNUL_ATTESTATION_REQUIRED =
  "ANNULATION_ATTESTATION_REQUIRED";

/** Texte d'attestation confirmateur — remboursement. */
export const ANNULATION_ATTESTATION_REMBOURSEMENT =
  "Le remboursement n'a jamais été effectivement crédité ou a été annulé avant effet";
/** Texte d'attestation confirmateur — compensation. */
export const ANNULATION_ATTESTATION_COMPENSATION =
  "Validation de l'inversion des créances compensées";

type NotesFraisClock = { now: () => Date };
const defaultClock: NotesFraisClock = { now: () => new Date() };

function money(v: Prisma.Decimal | number | string): Prisma.Decimal {
  return new Prisma.Decimal(v);
}

function disabledResult(): NotesFraisAnnulationActionResult<never> {
  return {
    success: false,
    error: "Le module frais avancés n'est pas activé.",
    code: "NOTES_FRAIS_DISABLED",
  };
}

function mapError(error: unknown): NotesFraisAnnulationActionResult<never> {
  if (error instanceof NotesFraisDisabledError) return disabledResult();
  if (error instanceof Error) {
    let code: string | undefined;
    const m = error.message;
    if (m === NOTES_FRAIS_ANNUL_VERSION_CONFLICT) code = "VERSION_CONFLICT";
    else if (m === NOTES_FRAIS_ANNUL_IDEMPOTENCY_CONFLICT)
      code = "IDEMPOTENCY_CONFLICT";
    else if (m === NOTES_FRAIS_ANNUL_HAS_CORRECTIONS)
      code = "REGLEMENT_HAS_CORRECTIONS";
    else if (m === NOTES_FRAIS_ANNUL_HAS_RESTITUTIONS)
      code = "REGLEMENT_HAS_RESTITUTIONS";
    else if (m === NOTES_FRAIS_ANNUL_MIXTE_PARENT_REQUIRED)
      code = "MIXTE_PARENT_REQUIRED";
    else if (m === NOTES_FRAIS_ANNUL_EXPIRED) code = "ANNULATION_EXPIRED";
    else if (m === NOTES_FRAIS_ANNUL_ALREADY_DECIDED)
      code = "ANNULATION_ALREADY_DECIDED";
    else if (m === NOTES_FRAIS_ANNUL_ACTIVE_EXISTS)
      code = "ANNULATION_ALREADY_PENDING";
    else if (m === NOTES_FRAIS_ANNUL_PLAFOND) code = "PLAFOND_DEPASSE";
    else if (m === NOTES_FRAIS_ANNUL_CIBLE_MOUVEMENTS)
      code = "CIBLE_MOUVEMENTS_POSTERIEURS";
    else if (m === NOTES_FRAIS_ANNUL_ATTESTATION_REQUIRED)
      code = "ANNULATION_ATTESTATION_REQUIRED";
    else if (m.includes("Non autorisé") || m.includes("Auto-"))
      code = "FORBIDDEN";
    else if (m.includes("motif") || m.includes("Motif")) code = "MOTIF_INVALIDE";
    else if (m.includes("preuve") || m.includes("Preuve"))
      code = "PREUVE_INVALIDE";
    return { success: false, error: m, code };
  }
  return { success: false, error: "Erreur inattendue" };
}

/**
 * Normalise le motif d'annulation (1–2000).
 */
export function normalizeAnnulationMotif(raw: string): string {
  if (typeof raw !== "string") throw new Error("Motif requis");
  const motif = raw.trim();
  if (motif.length < 1 || motif.length > 2000) {
    throw new Error("Motif invalide (1 à 2000 caractères)");
  }
  return motif;
}

/**
 * Normalise une référence de preuve technique (8–64, sans PII).
 */
export function normalizeAnnulationPreuveRef(raw: string): string {
  if (typeof raw !== "string") throw new Error("Référence de preuve requise");
  const ref = raw.trim();
  if (ref.length < 8 || ref.length > 64) {
    throw new Error("Référence de preuve invalide (8 à 64 caractères)");
  }
  if (/[\x00-\x1f\x7f]/.test(ref)) {
    throw new Error("Référence de preuve : caractères de contrôle interdits");
  }
  // Heuristiques anti-PII légères
  if (/@/.test(ref) || /\bFR\d{2}/i.test(ref) || /\d+[.,]\d{2}\s*€?/.test(ref)) {
    throw new Error(
      "Référence de preuve : email, IBAN ou montant interdits"
    );
  }
  return ref;
}

const PREUVES_REMBOURSEMENT = new Set<PreuveAnnulationReglement>([
  "REJET_BANQUE",
  "ANNULATION_VIREMENT",
  "RECU_CAISSE_ANNULE",
  "TRACE_ETABLISSEMENT",
  "AUTRE_TRACE",
]);

const PREUVES_COMPENSATION = new Set<PreuveAnnulationReglement>([
  "PV_TRESORERIE",
  "JUSTIFICATIF_INTERNE",
  "AUTRE_TRACE",
]);

/**
 * Valide la preuve selon le type de cible (remb / comp / MIXTE).
 */
export function assertPreuveCompatible(
  preuveKind: PreuveAnnulationReglement,
  targetKind: "REMBOURSEMENT" | "COMPENSATION" | "MIXTE"
): void {
  if (targetKind === "REMBOURSEMENT" || targetKind === "MIXTE") {
    if (!PREUVES_REMBOURSEMENT.has(preuveKind)) {
      throw new Error(
        "Preuve incompatible avec un remboursement (banque/caisse requise)"
      );
    }
    return;
  }
  if (!PREUVES_COMPENSATION.has(preuveKind)) {
    throw new Error(
      "Preuve incompatible avec une compensation (preuve interne requise)"
    );
  }
}

function cmStatutApres(
  montantPaye: Prisma.Decimal,
  montantRestant: Prisma.Decimal
): string {
  if (montantRestant.lte(0)) return "Paye";
  if (montantPaye.gt(0)) return "PartiellementPaye";
  return "EnAttente";
}

/** Tri stable enfants MIXTE : type puis id. */
function sortMixteChildren<T extends { type: string; id: string }>(
  regs: T[]
): T[] {
  return [...regs].sort(
    (a, b) => a.type.localeCompare(b.type) || a.id.localeCompare(b.id)
  );
}

/**
 * Texte decisionMotif de confirmation selon les types de règlements ciblés.
 */
export function buildAnnulationConfirmationDecisionMotif(
  types: Array<"REMBOURSEMENT" | "COMPENSATION">
): string {
  const hasRemb = types.includes("REMBOURSEMENT");
  const hasComp = types.includes("COMPENSATION");
  if (hasRemb && hasComp) {
    return `${ANNULATION_ATTESTATION_REMBOURSEMENT} ; ${ANNULATION_ATTESTATION_COMPENSATION}`;
  }
  if (hasComp) return ANNULATION_ATTESTATION_COMPENSATION;
  return ANNULATION_ATTESTATION_REMBOURSEMENT;
}

/**
 * Résout les ADMIN/TRESOR actifs (hors exclus) pour notification de demande.
 */
export async function resolveAnnulationConfirmateurUserIds(
  excludeUserIds: string[],
  client: typeof db = db
): Promise<string[]> {
  const primary = await client.user.findMany({
    where: {
      status: UserStatus.Actif,
      role: { in: [UserRole.ADMIN, UserRole.TRESOR] },
    },
    select: { id: true },
  });
  const additional = await client.userAdminRole.findMany({
    where: {
      role: { in: [AdminRole.ADMIN, AdminRole.TRESOR] },
      user: { status: UserStatus.Actif },
    },
    select: { userId: true },
  });
  const ids = new Set<string>();
  for (const u of primary) ids.add(u.id);
  for (const r of additional) ids.add(r.userId);
  for (const ex of excludeUserIds) ids.delete(ex);
  return [...ids];
}

/**
 * Expire les demandes DEMANDEE dont expiresAt <= now (atomique).
 *
 * @param opts.now - Horloge
 * @param opts.limit - Plafond de lignes (optionnel)
 * @param opts.reglementId - Filtre cible simple
 * @param opts.operationId - Filtre cible MIXTE
 */
export async function expirePendingCancellationRequests(
  opts: {
    now?: Date;
    limit?: number;
    reglementId?: string;
    operationId?: string;
    client?: typeof db;
  } = {}
): Promise<number> {
  const client = opts.client ?? db;
  const now = opts.now ?? new Date();
  const where: Prisma.NoteFraisReglementAnnulationDemandeWhereInput = {
    statut: "DEMANDEE",
    expiresAt: { lte: now },
  };
  if (opts.reglementId) where.reglementId = opts.reglementId;
  if (opts.operationId) where.operationId = opts.operationId;

  if (opts.limit && opts.limit > 0) {
    const ids = await client.noteFraisReglementAnnulationDemande.findMany({
      where,
      select: { id: true },
      take: opts.limit,
      orderBy: { expiresAt: "asc" },
    });
    if (ids.length === 0) return 0;
    const res = await client.noteFraisReglementAnnulationDemande.updateMany({
      where: {
        id: { in: ids.map((x) => x.id) },
        statut: "DEMANDEE",
        expiresAt: { lte: now },
      },
      data: { statut: "EXPIREE", decideeAt: now },
    });
    return res.count;
  }

  const res = await client.noteFraisReglementAnnulationDemande.updateMany({
    where,
    data: { statut: "EXPIREE", decideeAt: now },
  });
  return res.count;
}

async function assertNoCorrRestit(
  tx: Prisma.TransactionClient,
  reglementIds: string[]
): Promise<void> {
  const corr = await tx.noteFraisReglementCorrection.count({
    where: { reglementId: { in: reglementIds } },
  });
  if (corr > 0) throw new Error(NOTES_FRAIS_ANNUL_HAS_CORRECTIONS);
  const restit = await tx.noteFraisRestitution.count({
    where: { reglementId: { in: reglementIds } },
  });
  if (restit > 0) throw new Error(NOTES_FRAIS_ANNUL_HAS_RESTITUTIONS);
}

type CanonicalDemandeContent = {
  noteId: string;
  reglementId: string | null;
  operationId: string | null;
  motif: string;
  preuveKind: PreuveAnnulationReglement;
  preuveRef: string;
};

function sameDemandeContent(
  a: CanonicalDemandeContent,
  row: {
    reglementId: string | null;
    operationId: string | null;
    motif: string;
    preuveKind: string;
    preuveRef: string;
    Reglement?: { noteFraisId: string } | null;
    Operation?: { noteFraisId: string } | null;
  }
): boolean {
  const noteId =
    row.Reglement?.noteFraisId ?? row.Operation?.noteFraisId ?? "";
  return (
    noteId === a.noteId &&
    row.reglementId === a.reglementId &&
    row.operationId === a.operationId &&
    row.motif === a.motif &&
    row.preuveKind === a.preuveKind &&
    row.preuveRef === a.preuveRef
  );
}

export type RequestCancelInput = {
  actorUserId: string;
  noteId: string;
  /** XOR : règlement simple. */
  reglementId?: string | null;
  /** XOR : opération MIXTE parent. */
  operationId?: string | null;
  idempotencyKey: string;
  motif: string;
  preuveKind: PreuveAnnulationReglement;
  preuveRef: string;
  client?: typeof db;
  clock?: NotesFraisClock;
  /** Hook tests concurrence — avant verrou demandeur. */
  beforeDemandeurLock?: () => Promise<void>;
  afterDemandeInsert?: () => Promise<void>;
  afterNotifyOutbox?: () => Promise<void>;
};

export type RequestCancelDto = {
  demandeId: string;
  noteId: string;
  statut: "DEMANDEE";
  expiresAt: string;
  alreadyRequested: boolean;
};

/**
 * Crée une demande d'annulation (sans effet financier).
 */
export async function requestNoteFraisReglementAnnulation(
  input: RequestCancelInput
): Promise<NotesFraisAnnulationActionResult<RequestCancelDto>> {
  const client = input.client ?? db;
  const clock = input.clock ?? defaultClock;
  try {
    assertNotesFraisEnabled();
    const key = input.idempotencyKey?.trim();
    if (!key || key.length < 8 || key.length > 64) {
      throw new Error("Clé d'idempotence requise (8–64 caractères)");
    }
    const motif = normalizeAnnulationMotif(input.motif);
    const preuveRef = normalizeAnnulationPreuveRef(input.preuveRef);
    const preuveKind = input.preuveKind;
    const reglementId = input.reglementId?.trim() || null;
    const operationId = input.operationId?.trim() || null;
    if ((reglementId == null) === (operationId == null)) {
      throw new Error(
        "Cible XOR requise : reglementId ou operationId exclusivement"
      );
    }

    const notePreview = await client.noteFrais.findUnique({
      where: { id: input.noteId },
      select: { id: true, statut: true, demandeurUserId: true },
    });
    if (!notePreview) throw new Error("Note introuvable");
    if (notePreview.statut !== "VALIDEE") {
      throw new Error("Seule une note VALIDEE peut être annulée");
    }
    if (notePreview.demandeurUserId === input.actorUserId) {
      throw new Error(
        "Auto-annulation interdite : l'acteur ne peut pas être le demandeur de la note"
      );
    }
    const ok = await canUserRequestCancelNoteFraisReglement(
      input.actorUserId,
      client
    );
    if (!ok) throw new Error("Non autorisé à demander une annulation");

    const content: CanonicalDemandeContent = {
      noteId: input.noteId,
      reglementId,
      operationId,
      motif,
      preuveKind,
      preuveRef,
    };

    const existingKey =
      await client.noteFraisReglementAnnulationDemande.findUnique({
        where: { idempotencyKey: key },
        include: {
          Reglement: { select: { noteFraisId: true } },
          Operation: { select: { noteFraisId: true } },
        },
      });
    if (existingKey) {
      if (sameDemandeContent(content, existingKey)) {
        return {
          success: true,
          data: {
            demandeId: existingKey.id,
            noteId: input.noteId,
            statut: "DEMANDEE",
            expiresAt: existingKey.expiresAt.toISOString(),
            alreadyRequested: true,
          },
          message: "Déjà demandée",
        };
      }
      throw new Error(NOTES_FRAIS_ANNUL_IDEMPOTENCY_CONFLICT);
    }

    let kick = false;
    let result: RequestCancelDto | undefined;

    try {
      result = await client.$transaction(async (tx) => {
        if (input.beforeDemandeurLock) await input.beforeDemandeurLock();
        await lockUserRowForNotesFrais(tx, notePreview.demandeurUserId);
        await tx.$executeRaw`
          SELECT id FROM notes_frais WHERE id = ${input.noteId} FOR UPDATE
        `;
        const note = await tx.noteFrais.findUniqueOrThrow({
          where: { id: input.noteId },
          select: {
            id: true,
            statut: true,
            demandeurUserId: true,
            adherentId: true,
          },
        });
        if (note.statut !== "VALIDEE") {
          throw new Error("Seule une note VALIDEE peut être annulée");
        }
        if (note.demandeurUserId === input.actorUserId) {
          throw new Error(
            "Auto-annulation interdite : l'acteur ne peut pas être le demandeur de la note"
          );
        }
        const allowed = await canUserRequestCancelNoteFraisReglement(
          input.actorUserId,
          tx as unknown as typeof db
        );
        if (!allowed) throw new Error("Non autorisé à demander une annulation");

        let targetKind: "REMBOURSEMENT" | "COMPENSATION" | "MIXTE";
        let reglementIds: string[] = [];

        if (operationId) {
          await tx.$executeRaw`
            SELECT id FROM notes_frais_reglement_operations WHERE id = ${operationId} FOR UPDATE
          `;
          const op = await tx.noteFraisReglementOperation.findUnique({
            where: { id: operationId },
            include: { Reglements: true },
          });
          if (!op || op.noteFraisId !== input.noteId) {
            throw new Error("Opération introuvable pour cette note");
          }
          if (op.statut !== "EXECUTE") {
            throw new Error("Opération non EXECUTE");
          }
          if (op.Reglements.length !== 2) {
            throw new Error("Opération MIXTE incomplète");
          }
          const children = sortMixteChildren(op.Reglements);
          for (const r of children) {
            await tx.$executeRaw`
              SELECT id FROM notes_frais_reglements WHERE id = ${r.id} FOR UPDATE
            `;
            if (r.statut !== "EXECUTE") {
              throw new Error("Enfant MIXTE non EXECUTE");
            }
          }
          reglementIds = children.map((r) => r.id);
          targetKind = "MIXTE";
          await expirePendingCancellationRequests({
            now: clock.now(),
            operationId,
            client: tx as unknown as typeof db,
          });
        } else {
          await tx.$executeRaw`
            SELECT id FROM notes_frais_reglements WHERE id = ${reglementId!} FOR UPDATE
          `;
          const reg = await tx.noteFraisReglement.findUnique({
            where: { id: reglementId! },
          });
          if (!reg || reg.noteFraisId !== input.noteId) {
            throw new Error("Règlement introuvable pour cette note");
          }
          if (reg.operationId) {
            throw new Error(NOTES_FRAIS_ANNUL_MIXTE_PARENT_REQUIRED);
          }
          if (reg.statut !== "EXECUTE") {
            throw new Error("Règlement non EXECUTE");
          }
          reglementIds = [reg.id];
          targetKind =
            reg.type === "REMBOURSEMENT" ? "REMBOURSEMENT" : "COMPENSATION";
          await expirePendingCancellationRequests({
            now: clock.now(),
            reglementId: reg.id,
            client: tx as unknown as typeof db,
          });
        }

        assertPreuveCompatible(preuveKind, targetKind);
        await assertNoCorrRestit(tx, reglementIds);

        const activeWhere = operationId
          ? { operationId, statut: "DEMANDEE" as const }
          : { reglementId: reglementId!, statut: "DEMANDEE" as const };
        const active = await tx.noteFraisReglementAnnulationDemande.count({
          where: activeWhere,
        });
        if (active > 0) throw new Error(NOTES_FRAIS_ANNUL_ACTIVE_EXISTS);

        const byKeyTx =
          await tx.noteFraisReglementAnnulationDemande.findUnique({
            where: { idempotencyKey: key },
            include: {
              Reglement: { select: { noteFraisId: true } },
              Operation: { select: { noteFraisId: true } },
            },
          });
        if (byKeyTx) {
          if (!sameDemandeContent(content, byKeyTx)) {
            throw new Error(NOTES_FRAIS_ANNUL_IDEMPOTENCY_CONFLICT);
          }
          return {
            demandeId: byKeyTx.id,
            noteId: input.noteId,
            statut: "DEMANDEE" as const,
            expiresAt: byKeyTx.expiresAt.toISOString(),
            alreadyRequested: true,
          };
        }

        const createdAt = clock.now();
        const expiresAt = new Date(
          createdAt.getTime() + NOTES_FRAIS_ANNULATION_TTL_MS
        );
        const demande = await tx.noteFraisReglementAnnulationDemande.create({
          data: {
            reglementId,
            operationId,
            statut: "DEMANDEE",
            motif,
            preuveKind,
            preuveRef,
            demandeurUserId: input.actorUserId,
            idempotencyKey: key,
            createdAt,
            expiresAt,
          },
        });
        if (input.afterDemandeInsert) await input.afterDemandeInsert();

        const recipients = await resolveAnnulationConfirmateurUserIds(
          [input.actorUserId, note.demandeurUserId],
          tx as unknown as typeof db
        );
        if (recipients.length > 0) {
          await createNoteFraisAnnulationNotificationsInTx(tx, {
            noteId: note.id,
            userIds: recipients,
            kind: "ANNULATION_DEMANDEE",
            demandeId: demande.id,
            lien: `/admin/frais-avances/${note.id}`,
          });
        }
        if (input.afterNotifyOutbox) await input.afterNotifyOutbox();
        kick = true;
        return {
          demandeId: demande.id,
          noteId: note.id,
          statut: "DEMANDEE" as const,
          expiresAt: expiresAt.toISOString(),
          alreadyRequested: false,
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
        const onIdem =
          (typeof targets === "string" &&
            targets.includes("idempotencyKey")) ||
          (Array.isArray(targets) &&
            targets.some((t) => String(t).includes("idempotencyKey")));
        if (onIdem) {
          const byKey =
            await client.noteFraisReglementAnnulationDemande.findUnique({
              where: { idempotencyKey: key },
              include: {
                Reglement: { select: { noteFraisId: true } },
                Operation: { select: { noteFraisId: true } },
              },
            });
          if (byKey && sameDemandeContent(content, byKey)) {
            return {
              success: true,
              data: {
                demandeId: byKey.id,
                noteId: input.noteId,
                statut: "DEMANDEE",
                expiresAt: byKey.expiresAt.toISOString(),
                alreadyRequested: true,
              },
              message: "Déjà demandée",
            };
          }
          throw new Error(NOTES_FRAIS_ANNUL_IDEMPOTENCY_CONFLICT);
        }
      }
      throw error;
    }

    if (!result) throw new Error("Demande d'annulation échouée");
    if (kick && !result.alreadyRequested && !input.client) {
      void import("@/lib/services/frais-avances/note-frais-service")
        .then(({ processNoteFraisOutboxOnce }) => processNoteFraisOutboxOnce())
        .catch((e) =>
          console.error(
            "[notes-frais] kick outbox annulation demande",
            hashIdForLog(input.noteId),
            e
          )
        );
    }
    return {
      success: true,
      data: result,
      message: result.alreadyRequested
        ? "Déjà demandée"
        : "Demande d'annulation enregistrée",
    };
  } catch (error) {
    return mapError(error);
  }
}

export type RefuseCancelInput = {
  actorUserId: string;
  noteId: string;
  demandeId: string;
  decisionIdempotencyKey: string;
  decisionMotif: string;
  client?: typeof db;
  clock?: NotesFraisClock;
  /** Hook tests concurrence — immédiatement avant claim REFUSEE. */
  beforeClaim?: () => Promise<void>;
  afterNotifyOutbox?: () => Promise<void>;
};

export type DecisionCancelDto = {
  demandeId: string;
  noteId: string;
  statut: "REFUSEE" | "CONFIRMEE" | "EXPIREE";
  alreadyDecided: boolean;
  version?: number;
};

/**
 * Refuse une demande DEMANDEE (sans effet financier).
 */
export async function refuseNoteFraisReglementAnnulation(
  input: RefuseCancelInput
): Promise<NotesFraisAnnulationActionResult<DecisionCancelDto>> {
  const client = input.client ?? db;
  const clock = input.clock ?? defaultClock;
  try {
    assertNotesFraisEnabled();
    const dKey = input.decisionIdempotencyKey?.trim();
    if (!dKey || dKey.length < 8 || dKey.length > 64) {
      throw new Error("Clé d'idempotence de décision requise (8–64)");
    }
    const decisionMotif = normalizeAnnulationMotif(input.decisionMotif);

    const ok = await canUserRefuseCancelNoteFraisReglement(
      input.actorUserId,
      client
    );
    if (!ok) throw new Error("Non autorisé à refuser une annulation");

    const existingDec =
      await client.noteFraisReglementAnnulationDemande.findUnique({
        where: { decisionIdempotencyKey: dKey },
      });
    if (existingDec) {
      if (
        existingDec.id === input.demandeId &&
        existingDec.statut === "REFUSEE" &&
        existingDec.decisionMotif === decisionMotif
      ) {
        return {
          success: true,
          data: {
            demandeId: existingDec.id,
            noteId: input.noteId,
            statut: "REFUSEE",
            alreadyDecided: true,
          },
          message: "Déjà refusée",
        };
      }
      throw new Error(NOTES_FRAIS_ANNUL_IDEMPOTENCY_CONFLICT);
    }

    let kick = false;
    const result = await client.$transaction(async (tx) => {
      const now = clock.now();
      await expirePendingCancellationRequests({
        now,
        client: tx as unknown as typeof db,
      });

      const demande =
        await tx.noteFraisReglementAnnulationDemande.findUniqueOrThrow({
          where: { id: input.demandeId },
          include: {
            Reglement: { select: { noteFraisId: true } },
            Operation: { select: { noteFraisId: true } },
          },
        });
      const noteId =
        demande.Reglement?.noteFraisId ??
        demande.Operation?.noteFraisId ??
        null;
      if (noteId !== input.noteId) throw new Error("Demande hors note");

      if (demande.demandeurUserId === input.actorUserId) {
        throw new Error(
          "Le confirmateur/refuseur doit être distinct de l'auteur de la demande"
        );
      }

      const note = await tx.noteFrais.findUniqueOrThrow({
        where: { id: input.noteId },
        select: { demandeurUserId: true },
      });
      if (note.demandeurUserId === input.actorUserId) {
        throw new Error(
          "Auto-annulation interdite : l'acteur ne peut pas être le demandeur de la note"
        );
      }

      if (demande.statut !== "DEMANDEE") {
        if (demande.statut === "REFUSEE" && demande.decisionMotif === decisionMotif) {
          return {
            demandeId: demande.id,
            noteId: input.noteId,
            statut: "REFUSEE" as const,
            alreadyDecided: true,
          };
        }
        if (demande.statut === "EXPIREE") {
          throw new Error(NOTES_FRAIS_ANNUL_EXPIRED);
        }
        throw new Error(NOTES_FRAIS_ANNUL_ALREADY_DECIDED);
      }
      if (demande.expiresAt.getTime() <= now.getTime()) {
        await tx.noteFraisReglementAnnulationDemande.updateMany({
          where: { id: demande.id, statut: "DEMANDEE" },
          data: { statut: "EXPIREE", decideeAt: now },
        });
        throw new Error(NOTES_FRAIS_ANNUL_EXPIRED);
      }

      if (input.beforeClaim) await input.beforeClaim();

      const claimed = await tx.noteFraisReglementAnnulationDemande.updateMany({
        where: {
          id: demande.id,
          statut: "DEMANDEE",
          expiresAt: { gt: now },
        },
        data: {
          statut: "REFUSEE",
          decisionMotif,
          decideeAt: now,
          confirmateurUserId: input.actorUserId,
          decisionIdempotencyKey: dKey,
        },
      });
      if (claimed.count !== 1) {
        const cur =
          await tx.noteFraisReglementAnnulationDemande.findUniqueOrThrow({
            where: { id: demande.id },
          });
        if (cur.statut === "EXPIREE") throw new Error(NOTES_FRAIS_ANNUL_EXPIRED);
        throw new Error(NOTES_FRAIS_ANNUL_ALREADY_DECIDED);
      }

      if (demande.demandeurUserId) {
        await createNoteFraisAnnulationNotificationsInTx(tx, {
          noteId: input.noteId,
          userIds: [demande.demandeurUserId],
          kind: "ANNULATION_REFUSEE",
          demandeId: demande.id,
          lien: `/admin/frais-avances/${input.noteId}`,
        });
        kick = true;
      }
      if (input.afterNotifyOutbox) await input.afterNotifyOutbox();
      return {
        demandeId: demande.id,
        noteId: input.noteId,
        statut: "REFUSEE" as const,
        alreadyDecided: false,
      };
    });

    if (kick && !result.alreadyDecided && !input.client) {
      void import("@/lib/services/frais-avances/note-frais-service")
        .then(({ processNoteFraisOutboxOnce }) => processNoteFraisOutboxOnce())
        .catch((e) =>
          console.error(
            "[notes-frais] kick outbox annulation refus",
            hashIdForLog(input.noteId),
            e
          )
        );
    }
    return {
      success: true,
      data: result,
      message: result.alreadyDecided ? "Déjà refusée" : "Annulation refusée",
    };
  } catch (error) {
    return mapError(error);
  }
}

export type ConfirmCancelInput = {
  actorUserId: string;
  noteId: string;
  demandeId: string;
  expectedNoteVersion: number;
  decisionIdempotencyKey: string;
  /**
   * Attestation confirmateur obligatoire (`true`).
   * `false` / absente → ANNULATION_ATTESTATION_REQUIRED (jamais une case UI seule).
   */
  attestation: boolean;
  client?: typeof db;
  clock?: NotesFraisClock;
  beforeDemandeurLock?: () => Promise<void>;
  afterClaim?: () => Promise<void>;
  beforeApplyInverse?: (index: number) => Promise<void>;
  afterAllInverses?: () => Promise<void>;
  afterNotifyOutbox?: () => Promise<void>;
};

/**
 * Confirme une demande DEMANDEE et applique les effets financiers.
 */
export async function confirmNoteFraisReglementAnnulation(
  input: ConfirmCancelInput
): Promise<NotesFraisAnnulationActionResult<DecisionCancelDto>> {
  const client = input.client ?? db;
  const clock = input.clock ?? defaultClock;
  try {
    assertNotesFraisEnabled();
    const dKey = input.decisionIdempotencyKey?.trim();
    if (!dKey || dKey.length < 8 || dKey.length > 64) {
      throw new Error("Clé d'idempotence de décision requise (8–64)");
    }
    if (
      !Number.isInteger(input.expectedNoteVersion) ||
      input.expectedNoteVersion < 1
    ) {
      throw new Error("Version de note invalide");
    }
    if (input.attestation !== true) {
      throw new Error(NOTES_FRAIS_ANNUL_ATTESTATION_REQUIRED);
    }

    const ok = await canUserConfirmCancelNoteFraisReglement(
      input.actorUserId,
      client
    );
    if (!ok) throw new Error("Non autorisé à confirmer une annulation");

    const existingDec =
      await client.noteFraisReglementAnnulationDemande.findUnique({
        where: { decisionIdempotencyKey: dKey },
      });
    if (existingDec) {
      if (
        existingDec.id === input.demandeId &&
        existingDec.statut === "CONFIRMEE" &&
        input.attestation === true
      ) {
        const note = await client.noteFrais.findUniqueOrThrow({
          where: { id: input.noteId },
          select: { version: true },
        });
        return {
          success: true,
          data: {
            demandeId: existingDec.id,
            noteId: input.noteId,
            statut: "CONFIRMEE",
            alreadyDecided: true,
            version: note.version,
          },
          message: "Déjà confirmée",
        };
      }
      throw new Error(NOTES_FRAIS_ANNUL_IDEMPOTENCY_CONFLICT);
    }

    let kick = false;
    const result = await client.$transaction(async (tx) => {
      const now = clock.now();
      const notePreview = await tx.noteFrais.findUniqueOrThrow({
        where: { id: input.noteId },
        select: { demandeurUserId: true, adherentId: true, version: true },
      });
      if (notePreview.demandeurUserId === input.actorUserId) {
        throw new Error(
          "Auto-annulation interdite : l'acteur ne peut pas être le demandeur de la note"
        );
      }

      if (input.beforeDemandeurLock) await input.beforeDemandeurLock();
      await lockUserRowForNotesFrais(tx, notePreview.demandeurUserId);
      await tx.$executeRaw`
        SELECT id FROM notes_frais WHERE id = ${input.noteId} FOR UPDATE
      `;

      const demande =
        await tx.noteFraisReglementAnnulationDemande.findUniqueOrThrow({
          where: { id: input.demandeId },
          include: {
            Reglement: { select: { noteFraisId: true } },
            Operation: { select: { noteFraisId: true } },
          },
        });
      const noteIdFromDemande =
        demande.Reglement?.noteFraisId ??
        demande.Operation?.noteFraisId ??
        null;
      if (noteIdFromDemande !== input.noteId) {
        throw new Error("Demande hors note");
      }
      if (demande.demandeurUserId === input.actorUserId) {
        throw new Error(
          "Le confirmateur doit être distinct de l'auteur de la demande"
        );
      }

      await expirePendingCancellationRequests({
        now,
        reglementId: demande.reglementId ?? undefined,
        operationId: demande.operationId ?? undefined,
        client: tx as unknown as typeof db,
      });

      const demandeFresh =
        await tx.noteFraisReglementAnnulationDemande.findUniqueOrThrow({
          where: { id: input.demandeId },
        });
      if (demandeFresh.statut !== "DEMANDEE") {
        if (demandeFresh.statut === "CONFIRMEE") {
          return {
            demandeId: demandeFresh.id,
            noteId: input.noteId,
            statut: "CONFIRMEE" as const,
            alreadyDecided: true,
            version: notePreview.version,
          };
        }
        if (demandeFresh.statut === "EXPIREE") {
          throw new Error(NOTES_FRAIS_ANNUL_EXPIRED);
        }
        throw new Error(NOTES_FRAIS_ANNUL_ALREADY_DECIDED);
      }
      if (demandeFresh.expiresAt.getTime() <= now.getTime()) {
        await tx.noteFraisReglementAnnulationDemande.updateMany({
          where: { id: demandeFresh.id, statut: "DEMANDEE" },
          data: { statut: "EXPIREE", decideeAt: now },
        });
        throw new Error(NOTES_FRAIS_ANNUL_EXPIRED);
      }

      type RegRow = {
        id: string;
        type: "REMBOURSEMENT" | "COMPENSATION";
        montantTotal: Prisma.Decimal;
        choixId: string;
        statut: string;
        Lignes: Array<{
          id: string;
          typeLigne: string;
          typeCible: string | null;
          cibleId: string | null;
          montant: Prisma.Decimal;
          montantRestantCibleApres: Prisma.Decimal | null;
        }>;
      };
      let regs: RegRow[] = [];

      // Verrous opération/règlements (enfants MIXTE triés type puis id) — avant toute revalidation financière.
      if (demande.operationId) {
        await tx.$executeRaw`
          SELECT id FROM notes_frais_reglement_operations WHERE id = ${demande.operationId} FOR UPDATE
        `;
        const op = await tx.noteFraisReglementOperation.findUniqueOrThrow({
          where: { id: demande.operationId },
          include: {
            Reglements: {
              include: { Lignes: true },
            },
          },
        });
        if (op.statut !== "EXECUTE") throw new Error("Opération non EXECUTE");
        const children = sortMixteChildren(op.Reglements);
        for (const r of children) {
          await tx.$executeRaw`
            SELECT id FROM notes_frais_reglements WHERE id = ${r.id} FOR UPDATE
          `;
        }
        regs = children as RegRow[];
      } else {
        await tx.$executeRaw`
          SELECT id FROM notes_frais_reglements WHERE id = ${demande.reglementId!} FOR UPDATE
        `;
        const r = await tx.noteFraisReglement.findUniqueOrThrow({
          where: { id: demande.reglementId! },
          include: { Lignes: true },
        });
        if (r.operationId) {
          throw new Error(NOTES_FRAIS_ANNUL_MIXTE_PARENT_REQUIRED);
        }
        regs = [r as RegRow];
      }

      for (const r of regs) {
        if (r.statut !== "EXECUTE") throw new Error("Règlement non EXECUTE");
      }
      await assertNoCorrRestit(
        tx,
        regs.map((r) => r.id)
      );

      const choixId = regs[0]!.choixId;
      await tx.$executeRaw`
        SELECT id FROM notes_frais_choix_reglement
        WHERE id = ${choixId} AND statut = 'ACTIF'
        FOR UPDATE
      `;
      await tx.$executeRaw`
        SELECT id FROM notes_frais_choix_reglement_cibles
        WHERE "choixId" = ${choixId}
        ORDER BY "typeCible" ASC, "cibleId" ASC
        FOR UPDATE
      `;

      const compLignesForLock = regs
        .filter((r) => r.type === "COMPENSATION")
        .flatMap((r) =>
          r.Lignes.filter((l) => l.typeLigne === "COMPENSATION")
        )
        .filter((l) => l.typeCible && l.cibleId)
        .map((l) => ({
          typeCible: l.typeCible as "DETTE_INITIALE" | "COTISATION_MENSUELLE",
          cibleId: l.cibleId!,
          montant: l.montant.toFixed(2),
          rang: 0,
        }))
        .sort(
          (a, b) =>
            a.typeCible.localeCompare(b.typeCible) ||
            a.cibleId.localeCompare(b.cibleId)
        );
      if (compLignesForLock.length > 0) {
        await lockCompensationTargetsInTx(tx, compLignesForLock);
      }

      const note = await tx.noteFrais.findUniqueOrThrow({
        where: { id: input.noteId },
        select: {
          id: true,
          version: true,
          adherentId: true,
          demandeurUserId: true,
        },
      });

      const choix = await tx.noteFraisChoixReglement.findUniqueOrThrow({
        where: { id: choixId },
        include: { Cibles: true },
      });
      if (choix.statut !== "ACTIF") throw new Error("Choix non ACTIF");

      // Revalidation financière APRÈS verrous (mouvements postérieurs).
      type PrepInv = {
        reglementLigneId: string;
        typeCible: "DETTE_INITIALE" | "COTISATION_MENSUELLE";
        cibleId: string;
        montantRestaure: Prisma.Decimal;
        restantAvant: Prisma.Decimal;
        restantApres: Prisma.Decimal;
        cibleChoixId: string;
      };
      const prepared: PrepInv[] = [];
      const compRegs = regs.filter((r) => r.type === "COMPENSATION");
      const lignesSorted = compRegs
        .flatMap((r) =>
          r.Lignes.filter((l) => l.typeLigne === "COMPENSATION").map((l) => ({
            ...l,
            _regId: r.id,
          }))
        )
        .sort(
          (a, b) =>
            String(a.typeCible ?? "").localeCompare(String(b.typeCible ?? "")) ||
            String(a.cibleId ?? "").localeCompare(String(b.cibleId ?? "")) ||
            a.id.localeCompare(b.id)
        );

      for (const ligne of lignesSorted) {
        if (!ligne.typeCible || !ligne.cibleId) {
          throw new Error("Ligne compensation incomplète");
        }
        const typeCible = ligne.typeCible as PrepInv["typeCible"];
        const cibleChoix = choix.Cibles.find(
          (c) => c.typeCible === typeCible && c.cibleId === ligne.cibleId
        );
        if (!cibleChoix) throw new Error("Cible absente du choix");
        const expectedRestantAvant =
          ligne.montantRestantCibleApres ?? money(0);
        if (typeCible === "DETTE_INITIALE") {
          const dette = await tx.detteInitiale.findFirst({
            where: { id: ligne.cibleId, adherentId: note.adherentId },
          });
          if (!dette) throw new Error("Cible introuvable");
          const restantLive = money(dette.montantRestant);
          const payeLive = money(dette.montantPaye);
          if (
            !restantLive.eq(expectedRestantAvant) ||
            payeLive.lt(ligne.montant)
          ) {
            throw new Error(NOTES_FRAIS_ANNUL_CIBLE_MOUVEMENTS);
          }
          prepared.push({
            reglementLigneId: ligne.id,
            typeCible,
            cibleId: ligne.cibleId,
            montantRestaure: money(ligne.montant),
            restantAvant: restantLive,
            restantApres: restantLive.plus(ligne.montant),
            cibleChoixId: cibleChoix.id,
          });
        } else {
          const cm = await tx.cotisationMensuelle.findFirst({
            where: {
              id: ligne.cibleId,
              adherentId: note.adherentId,
              adherentBeneficiaireId: null,
              TypeCotisation: { categorie: { not: "Assistance" } },
            },
          });
          if (!cm) throw new Error("Cible introuvable");
          const restantLive = money(cm.montantRestant);
          const payeLive = money(cm.montantPaye);
          if (
            !restantLive.eq(expectedRestantAvant) ||
            payeLive.lt(ligne.montant)
          ) {
            throw new Error(NOTES_FRAIS_ANNUL_CIBLE_MOUVEMENTS);
          }
          prepared.push({
            reglementLigneId: ligne.id,
            typeCible,
            cibleId: ligne.cibleId,
            montantRestaure: money(ligne.montant),
            restantAvant: restantLive,
            restantApres: restantLive.plus(ligne.montant),
            cibleChoixId: cibleChoix.id,
          });
        }
      }

      const decisionMotif = buildAnnulationConfirmationDecisionMotif(
        regs.map((r) => r.type)
      );

      const claimed = await tx.noteFraisReglementAnnulationDemande.updateMany({
        where: {
          id: demandeFresh.id,
          statut: "DEMANDEE",
          expiresAt: { gt: now },
        },
        data: {
          statut: "CONFIRMEE",
          decideeAt: now,
          confirmateurUserId: input.actorUserId,
          decisionIdempotencyKey: dKey,
          decisionMotif,
        },
      });
      if (claimed.count !== 1) {
        throw new Error(NOTES_FRAIS_ANNUL_ALREADY_DECIDED);
      }
      if (input.afterClaim) await input.afterClaim();

      if (note.version !== input.expectedNoteVersion) {
        throw new Error(NOTES_FRAIS_ANNUL_VERSION_CONFLICT);
      }

      for (let i = 0; i < prepared.length; i++) {
        const inv = prepared[i]!;
        if (input.beforeApplyInverse) await input.beforeApplyInverse(i);
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
            throw new Error(NOTES_FRAIS_ANNUL_CIBLE_MOUVEMENTS);
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
        const cibleDec = await tx.noteFraisChoixReglementCible.updateMany({
          where: {
            id: inv.cibleChoixId,
            montantUtilise: { gte: inv.montantRestaure },
          },
          data: { montantUtilise: { decrement: inv.montantRestaure } },
        });
        if (cibleDec.count !== 1) throw new Error(NOTES_FRAIS_ANNUL_PLAFOND);

        await tx.noteFraisAnnulationInverseCible.create({
          data: {
            demandeId: demandeFresh.id,
            reglementLigneId: inv.reglementLigneId,
            typeCible: inv.typeCible,
            cibleId: inv.cibleId,
            montantRestaure: inv.montantRestaure,
            restantAvant: inv.restantAvant,
            restantApres: inv.restantApres,
          },
        });
      }
      if (input.afterAllInverses) await input.afterAllInverses();

      for (const reg of regs) {
        if (reg.type === "REMBOURSEMENT") {
          const dec = await tx.noteFraisChoixReglement.updateMany({
            where: {
              id: choix.id,
              montantRembourseUtilise: { gte: reg.montantTotal },
            },
            data: {
              montantRembourseUtilise: { decrement: reg.montantTotal },
            },
          });
          if (dec.count !== 1) throw new Error(NOTES_FRAIS_ANNUL_PLAFOND);
        } else {
          const dec = await tx.noteFraisChoixReglement.updateMany({
            where: {
              id: choix.id,
              montantCompensationUtilise: { gte: reg.montantTotal },
            },
            data: {
              montantCompensationUtilise: { decrement: reg.montantTotal },
            },
          });
          if (dec.count !== 1) throw new Error(NOTES_FRAIS_ANNUL_PLAFOND);
        }
        await tx.noteFraisReglement.update({
          where: { id: reg.id },
          data: { statut: "ANNULE" },
        });
      }
      if (demande.operationId) {
        await tx.noteFraisReglementOperation.update({
          where: { id: demande.operationId },
          data: { statut: "ANNULEE" },
        });
      }

      const updated = await tx.noteFrais.updateMany({
        where: { id: note.id, version: input.expectedNoteVersion },
        data: { version: { increment: 1 } },
      });
      if (updated.count !== 1) {
        throw new Error(NOTES_FRAIS_ANNUL_VERSION_CONFLICT);
      }

      const recipients: Array<{
        userId: string;
        lien: string;
        audience: "user" | "admin";
      }> = [];
      recipients.push({
        userId: note.demandeurUserId,
        lien: `/user/frais-avances/${note.id}`,
        audience: "user",
      });
      if (
        demande.demandeurUserId &&
        demande.demandeurUserId !== note.demandeurUserId
      ) {
        recipients.push({
          userId: demande.demandeurUserId,
          lien: `/admin/frais-avances/${note.id}`,
          audience: "admin",
        });
      }
      await createNoteFraisAnnulationNotificationsInTx(tx, {
        noteId: note.id,
        kind: "ANNULATION_CONFIRMEE",
        demandeId: demandeFresh.id,
        recipients,
      });
      if (input.afterNotifyOutbox) await input.afterNotifyOutbox();
      kick = true;
      return {
        demandeId: demandeFresh.id,
        noteId: note.id,
        statut: "CONFIRMEE" as const,
        alreadyDecided: false,
        version: note.version + 1,
      };
    });

    if (kick && !result.alreadyDecided && !input.client) {
      void import("@/lib/services/frais-avances/note-frais-service")
        .then(({ processNoteFraisOutboxOnce }) => processNoteFraisOutboxOnce())
        .catch((e) =>
          console.error(
            "[notes-frais] kick outbox annulation confirm",
            hashIdForLog(input.noteId),
            e
          )
        );
    }
    return {
      success: true,
      data: result,
      message: result.alreadyDecided
        ? "Déjà confirmée"
        : "Annulation confirmée",
    };
  } catch (error) {
    return mapError(error);
  }
}

export type PendingAnnulationDemandeDto = {
  id: string;
  noteId: string;
  reglementId: string | null;
  operationId: string | null;
  statut: "DEMANDEE";
  motif: string;
  preuveKind: PreuveAnnulationReglement;
  preuveRef: string;
  demandeurUserId: string | null;
  createdAt: string;
  expiresAt: string;
  /** Libellé cible pour l’UI (simple ou MIXTE). */
  cibleLabel: string;
  /** Types pour attestation UI (MIXTE ⇒ remb+comp). */
  cibleTypes: Array<"REMBOURSEMENT" | "COMPENSATION" | "MIXTE">;
};

/**
 * Liste les demandes DEMANDEE actives d'une note (expire d'abord les périmées).
 * Utile pour capacités UI / dialogues confirmer-refuser.
 */
export async function listPendingAnnulationDemandesForNote(input: {
  noteId: string;
  client?: typeof db;
  clock?: NotesFraisClock;
}): Promise<PendingAnnulationDemandeDto[]> {
  const client = input.client ?? db;
  const clock = input.clock ?? defaultClock;
  const now = clock.now();

  await expirePendingCancellationRequests({
    now,
    client,
    limit: 100,
  });

  const rows = await client.noteFraisReglementAnnulationDemande.findMany({
    where: {
      statut: "DEMANDEE",
      OR: [
        { Reglement: { noteFraisId: input.noteId } },
        { Operation: { noteFraisId: input.noteId } },
      ],
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      reglementId: true,
      operationId: true,
      motif: true,
      preuveKind: true,
      preuveRef: true,
      demandeurUserId: true,
      createdAt: true,
      expiresAt: true,
      Reglement: {
        select: { type: true, montantTotal: true, noteFraisId: true },
      },
      Operation: {
        select: {
          noteFraisId: true,
          Reglements: { select: { type: true, montantTotal: true } },
        },
      },
    },
  });

  return rows.map((r) => {
    let cibleLabel = "Règlement";
    let cibleTypes: PendingAnnulationDemandeDto["cibleTypes"] = [];
    if (r.operationId && r.Operation) {
      cibleLabel = "Opération MIXTE";
      cibleTypes = ["MIXTE"];
    } else if (r.Reglement) {
      cibleLabel = `${r.Reglement.type} · ${r.Reglement.montantTotal.toFixed(2)} €`;
      cibleTypes = [
        r.Reglement.type as "REMBOURSEMENT" | "COMPENSATION",
      ];
    }
    return {
      id: r.id,
      noteId: input.noteId,
      reglementId: r.reglementId,
      operationId: r.operationId,
      statut: "DEMANDEE" as const,
      motif: r.motif,
      preuveKind: r.preuveKind,
      preuveRef: r.preuveRef,
      demandeurUserId: r.demandeurUserId,
      createdAt: r.createdAt.toISOString(),
      expiresAt: r.expiresAt.toISOString(),
      cibleLabel,
      cibleTypes,
    };
  });
}
