/**
 * Commandes serveur pose / levée des gels rappel dette.
 *
 * - Acteur + garde mutation : **toujours** vérifiés ici (défense en profondeur).
 * - Flag mutation **indépendant** du flag envoi.
 * - Verrou adhérent (`acquireAdherentRowLock`) avant toute lecture/mutation métier.
 * - TX exclusivement ; révision gels **jamais** écrite par ce module (triggers only).
 * - Pose répétée sur cible ACTIF → `already_active` sans écraser le motif.
 * - Levée répétée → `already_lifted` sans second bump.
 * - Violation unique : **pas** de relecture dans la TX avortée ; nouvelle TX + verrou,
 *   tentatives bornées ; autres contraintes non masquées.
 *
 * Module serveur — **ne pas** réexporter via le barrel public.
 */

import { Prisma } from "@prisma/client";
import type { AuthContext } from "@/lib/auth-context";
import { db } from "@/lib/db";
import { acquireAdherentRowLock } from "@/lib/services/cotisations/rappel-dette/adherent-lock";
import { canAccessPreviewRappelsDette } from "@/lib/services/cotisations/rappel-dette/preview-access";
import {
  formatGelsRevisionDecimal,
} from "@/lib/services/cotisations/rappel-dette/rappel-dette-gel-resolve";
import {
  isRappelDetteGelMutationEnabled,
  RAPPEL_DETTE_GEL_MUTATION_DISABLED_MESSAGE,
} from "@/lib/services/cotisations/rappel-dette/rappel-dette-gel-mutation-activation";

/** Reprises max après P2002 unique ACTIF (nouvelle TX à chaque fois). */
export const RAPPEL_DETTE_GEL_UNIQUE_MAX_ATTEMPTS = 3 as const;

export const RAPPEL_DETTE_GEL_MUTATE_ACCESS_DENIED_MESSAGE =
  "Pose et levée de gels réservées aux administrateurs et au président." as const;

export type GelMutateActor = Pick<AuthContext, "userId" | "role">;

export type PoseRappelDetteGelTarget =
  | { scope: "ADHERENT"; adherentId: string }
  | {
      scope: "LIGNE";
      adherentId: string;
      lineSource: "cotisation_mensuelle" | "dette_initiale";
      cotisationMensuelleId?: string;
      detteInitialeId?: string;
    };

export type PoseRappelDetteGelInput = {
  actor: GelMutateActor | null | undefined;
  target: PoseRappelDetteGelTarget;
  motifCode: "CONTESTATION" | "VERIFICATION_ADMINISTRATIVE" | "AUTRE";
  motifTexte: string;
  referenceDossier?: string | null;
};

export type LeveRappelDetteGelInput = {
  actor: GelMutateActor | null | undefined;
  adherentId: string;
  gelId: string;
};

/**
 * Injection **tests uniquement** — jamais depuis HTTP / FormData / body.
 * `isMutationEnabled` ne doit pas être alimenté par une entrée client.
 */
export type GelMutateDeps = {
  isMutationEnabled?: boolean;
  maxUniqueAttempts?: number;
  getNow?: () => Date;
};

export type GelMutationSuccess = {
  ok: true;
  outcome: "posed" | "already_active" | "lifted" | "already_lifted";
  gelId: string;
  adherentId: string;
  scope: "ADHERENT" | "LIGNE";
  statut: "ACTIF" | "LEVE";
  /** Révision courante (lecture seule) — décimal. */
  gelsRevision: string;
};

export type GelMutationFailure = {
  ok: false;
  code:
    | "UNAUTHENTICATED"
    | "FORBIDDEN"
    | "GEL_MUTATION_DISABLED"
    | "VALIDATION_ERROR"
    | "NOT_FOUND"
    | "TARGET_MISMATCH"
    | "CONFLICT"
    | "INTERNAL_ERROR";
  message: string;
};

export type GelMutationResult = GelMutationSuccess | GelMutationFailure;

type ActiveGelRow = {
  id: string;
  scope: "ADHERENT" | "LIGNE";
  statut: "ACTIF" | "LEVE";
  adherentId: string;
};

function fail(
  code: GelMutationFailure["code"],
  message: string
): GelMutationFailure {
  return { ok: false, code, message };
}

/**
 * Garde acteur ADMIN|PRESID avant métier.
 *
 * @param actor - Contexte acteur (session)
 */
function assertGelMutateActor(
  actor: GelMutateActor | null | undefined
): GelMutationFailure | null {
  if (!actor?.userId || String(actor.userId).trim() === "") {
    return fail("UNAUTHENTICATED", "Non authentifié");
  }
  if (!canAccessPreviewRappelsDette(actor.role)) {
    return fail("FORBIDDEN", RAPPEL_DETTE_GEL_MUTATE_ACCESS_DENIED_MESSAGE);
  }
  return null;
}

/**
 * Garde flag mutation (indépendant de l’envoi).
 *
 * @param deps - Override tests uniquement
 */
function assertMutationEnabled(
  deps?: GelMutateDeps
): GelMutationFailure | null {
  if (!isRappelDetteGelMutationEnabled(deps?.isMutationEnabled)) {
    return fail(
      "GEL_MUTATION_DISABLED",
      RAPPEL_DETTE_GEL_MUTATION_DISABLED_MESSAGE
    );
  }
  return null;
}

function normalizeMotifTexte(raw: string): string | null {
  const t = String(raw ?? "").trim();
  if (t.length < 1 || t.length > 500) return null;
  return t;
}

function normalizeReferenceDossier(
  raw: string | null | undefined
): { ok: true; value: string | null } | { ok: false } {
  if (raw === undefined || raw === null) {
    return { ok: true, value: null };
  }
  const t = String(raw).trim();
  if (t.length === 0) {
    return { ok: true, value: null };
  }
  if (t.length > 120) return { ok: false };
  return { ok: true, value: t };
}

const MOTIF_CODES = new Set([
  "CONTESTATION",
  "VERIFICATION_ADMINISTRATIVE",
  "AUTRE",
]);

/**
 * Valide et normalise la cible de pose (forme exclusive).
 *
 * @param target - Cible brute
 */
function normalizePoseTarget(
  target: PoseRappelDetteGelTarget
):
  | {
      ok: true;
      adherentId: string;
      scope: "ADHERENT" | "LIGNE";
      lineSource: "cotisation_mensuelle" | "dette_initiale" | null;
      cotisationMensuelleId: string | null;
      detteInitialeId: string | null;
    }
  | { ok: false; message: string } {
  const adherentId = String(target?.adherentId ?? "").trim();
  if (!adherentId || adherentId.length > 64) {
    return { ok: false, message: "Adhérent requis" };
  }

  if (target.scope === "ADHERENT") {
    return {
      ok: true,
      adherentId,
      scope: "ADHERENT",
      lineSource: null,
      cotisationMensuelleId: null,
      detteInitialeId: null,
    };
  }

  if (target.scope !== "LIGNE") {
    return { ok: false, message: "Portée de gel invalide" };
  }

  const lineSource = target.lineSource;
  if (
    lineSource !== "cotisation_mensuelle" &&
    lineSource !== "dette_initiale"
  ) {
    return { ok: false, message: "Source de ligne invalide" };
  }

  const cm = String(target.cotisationMensuelleId ?? "").trim();
  const di = String(target.detteInitialeId ?? "").trim();

  if (lineSource === "cotisation_mensuelle") {
    if (!cm || cm.length > 64 || di) {
      return {
        ok: false,
        message: "Ligne cotisation mensuelle exclusive requise",
      };
    }
    return {
      ok: true,
      adherentId,
      scope: "LIGNE",
      lineSource,
      cotisationMensuelleId: cm,
      detteInitialeId: null,
    };
  }

  if (!di || di.length > 64 || cm) {
    return {
      ok: false,
      message: "Ligne dette initiale exclusive requise",
    };
  }
  return {
    ok: true,
    adherentId,
    scope: "LIGNE",
    lineSource,
    cotisationMensuelleId: null,
    detteInitialeId: di,
  };
}

/**
 * Identifie une violation d’unicité ACTIF gels (pas les autres contraintes).
 *
 * @param error - Erreur Prisma / inconnue
 */
export function isActiveGelUniqueViolation(error: unknown): boolean {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== "P2002"
  ) {
    return false;
  }
  const raw = error.meta?.target;
  const parts = (Array.isArray(raw) ? raw : [raw]).map((x) =>
    String(x ?? "").toLowerCase()
  );
  const blob = parts.join("|");
  if (
    blob.includes("one_active_adherent") ||
    blob.includes("one_active_cm") ||
    blob.includes("one_active_di") ||
    blob.includes("rappel_dette_gels_one_active")
  ) {
    return true;
  }
  const cols = new Set(parts);
  return (
    cols.has("adherentid") ||
    cols.has("cotisationmensuelleid") ||
    cols.has("detteinitialeid")
  );
}

async function readGelsRevisionDecimal(
  tx: Prisma.TransactionClient,
  adherentId: string
): Promise<string> {
  const row = await tx.rappelDetteGelRevision.findUnique({
    where: { adherentId },
    select: { revision: true },
  });
  return formatGelsRevisionDecimal(row?.revision ?? BigInt(0));
}

async function findActiveGelForTarget(
  tx: Prisma.TransactionClient,
  target: {
    adherentId: string;
    scope: "ADHERENT" | "LIGNE";
    cotisationMensuelleId: string | null;
    detteInitialeId: string | null;
  }
): Promise<ActiveGelRow | null> {
  if (target.scope === "ADHERENT") {
    return tx.rappelDetteGel.findFirst({
      where: {
        adherentId: target.adherentId,
        scope: "ADHERENT",
        statut: "ACTIF",
      },
      select: {
        id: true,
        scope: true,
        statut: true,
        adherentId: true,
      },
    });
  }
  if (target.cotisationMensuelleId) {
    return tx.rappelDetteGel.findFirst({
      where: {
        adherentId: target.adherentId,
        scope: "LIGNE",
        statut: "ACTIF",
        cotisationMensuelleId: target.cotisationMensuelleId,
      },
      select: {
        id: true,
        scope: true,
        statut: true,
        adherentId: true,
      },
    });
  }
  return tx.rappelDetteGel.findFirst({
    where: {
      adherentId: target.adherentId,
      scope: "LIGNE",
      statut: "ACTIF",
      detteInitialeId: target.detteInitialeId!,
    },
    select: {
      id: true,
      scope: true,
      statut: true,
      adherentId: true,
    },
  });
}

function successFromActive(
  gel: ActiveGelRow,
  gelsRevision: string,
  outcome: "posed" | "already_active" | "lifted" | "already_lifted"
): GelMutationSuccess {
  return {
    ok: true,
    outcome,
    gelId: gel.id,
    adherentId: gel.adherentId,
    scope: gel.scope,
    statut: gel.statut,
    gelsRevision,
  };
}

/**
 * Pose un gel ACTIF (adhérent ou ligne) sous verrou.
 *
 * Adhérent existant accepté même **inactif** (protection en cas de réactivation).
 * Motif obligatoire ; en `already_active` le motif existant n’est **pas** écrasé.
 *
 * @param input - Acteur session + cible + motif
 * @param deps - Overrides **tests** uniquement
 */
export async function poseRappelDetteGel(
  input: PoseRappelDetteGelInput,
  deps?: GelMutateDeps
): Promise<GelMutationResult> {
  const denied = assertGelMutateActor(input.actor);
  if (denied) return denied;

  const disabled = assertMutationEnabled(deps);
  if (disabled) return disabled;

  const actorUserId = String(input.actor!.userId).trim();

  if (!MOTIF_CODES.has(input.motifCode)) {
    return fail("VALIDATION_ERROR", "Code motif invalide");
  }
  const motifTexte = normalizeMotifTexte(input.motifTexte);
  if (!motifTexte) {
    return fail(
      "VALIDATION_ERROR",
      "Commentaire motif obligatoire (1–500 caractères)"
    );
  }
  const refNorm = normalizeReferenceDossier(input.referenceDossier);
  if (!refNorm.ok) {
    return fail(
      "VALIDATION_ERROR",
      "Référence dossier invalide (max 120 caractères)"
    );
  }

  const targetNorm = normalizePoseTarget(input.target);
  if (!targetNorm.ok) {
    return fail("VALIDATION_ERROR", targetNorm.message);
  }

  const maxAttempts = Math.max(
    1,
    Math.min(
      10,
      deps?.maxUniqueAttempts ?? RAPPEL_DETTE_GEL_UNIQUE_MAX_ATTEMPTS
    )
  );

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await db.$transaction(async (tx) => {
        const locked = await acquireAdherentRowLock(
          tx,
          targetNorm.adherentId
        );
        if (!locked) {
          return fail("NOT_FOUND", "Adhérent introuvable");
        }

        // Existence seule — statut Actif/Inactif : gel autorisé (réactivation).
        const adherent = await tx.adherent.findUnique({
          where: { id: targetNorm.adherentId },
          select: { id: true },
        });
        if (!adherent) {
          return fail("NOT_FOUND", "Adhérent introuvable");
        }

        if (targetNorm.scope === "LIGNE") {
          if (targetNorm.lineSource === "cotisation_mensuelle") {
            const cm = await tx.cotisationMensuelle.findFirst({
              where: {
                id: targetNorm.cotisationMensuelleId!,
                adherentId: targetNorm.adherentId,
              },
              select: { id: true },
            });
            if (!cm) {
              return fail(
                "TARGET_MISMATCH",
                "Ligne cotisation non liée à cet adhérent"
              );
            }
          } else {
            const di = await tx.detteInitiale.findFirst({
              where: {
                id: targetNorm.detteInitialeId!,
                adherentId: targetNorm.adherentId,
              },
              select: { id: true },
            });
            if (!di) {
              return fail(
                "TARGET_MISMATCH",
                "Ligne dette initiale non liée à cet adhérent"
              );
            }
          }
        }

        const existing = await findActiveGelForTarget(tx, targetNorm);
        if (existing) {
          // already_active : ne pas UPDATE motif même si le nouveau diffère.
          const gelsRevision = await readGelsRevisionDecimal(
            tx,
            targetNorm.adherentId
          );
          return successFromActive(existing, gelsRevision, "already_active");
        }

        const created = await tx.rappelDetteGel.create({
          data: {
            scope: targetNorm.scope,
            statut: "ACTIF",
            adherentId: targetNorm.adherentId,
            lineSource: targetNorm.lineSource,
            cotisationMensuelleId: targetNorm.cotisationMensuelleId,
            detteInitialeId: targetNorm.detteInitialeId,
            motifCode: input.motifCode,
            motifTexte,
            referenceDossier: refNorm.value,
            poseParUserId: actorUserId,
          },
          select: {
            id: true,
            scope: true,
            statut: true,
            adherentId: true,
          },
        });

        // Lecture seule — bump via trigger SQL, jamais d’écriture app.
        const gelsRevision = await readGelsRevisionDecimal(
          tx,
          targetNorm.adherentId
        );

        return successFromActive(
          {
            id: created.id,
            scope: created.scope,
            statut: created.statut,
            adherentId: created.adherentId,
          },
          gelsRevision,
          "posed"
        );
      });
    } catch (error) {
      if (isActiveGelUniqueViolation(error) && attempt < maxAttempts) {
        // TX avortée : relecture **uniquement** dans une nouvelle TX + verrou.
        try {
          const recovered = await db.$transaction(async (tx) => {
            const locked = await acquireAdherentRowLock(
              tx,
              targetNorm.adherentId
            );
            if (!locked) return null;
            const existing = await findActiveGelForTarget(tx, targetNorm);
            if (!existing) return null;
            const gelsRevision = await readGelsRevisionDecimal(
              tx,
              targetNorm.adherentId
            );
            return successFromActive(
              existing,
              gelsRevision,
              "already_active"
            );
          });
          if (recovered) return recovered;
          // Concurrent delete/lift improbable : retenter la pose.
          continue;
        } catch (recoveryError) {
          console.error("[poseRappelDetteGel]", {
            category: "unique_recovery_error",
            adherentIdLength: targetNorm.adherentId.length,
            name:
              recoveryError instanceof Error
                ? recoveryError.name
                : "unknown",
          });
          return fail("INTERNAL_ERROR", "Échec de la pose du gel");
        }
      }

      if (isActiveGelUniqueViolation(error)) {
        console.error("[poseRappelDetteGel]", {
          category: "unique_exhausted",
          adherentIdLength: targetNorm.adherentId.length,
          attempts: attempt,
        });
        return fail(
          "CONFLICT",
          "Conflit de concurrence sur le gel actif"
        );
      }

      console.error("[poseRappelDetteGel]", {
        category: "transaction_error",
        adherentIdLength: targetNorm.adherentId.length,
        name: error instanceof Error ? error.name : "unknown",
        prismaCode:
          error instanceof Prisma.PrismaClientKnownRequestError
            ? error.code
            : undefined,
      });
      return fail("INTERNAL_ERROR", "Échec de la pose du gel");
    }
  }

  return fail("CONFLICT", "Conflit de concurrence sur le gel actif");
}

/**
 * Lève un gel ACTIF → LEVE (audit acteur/date uniquement).
 * Ne modifie pas motif / référence / champs de pose.
 *
 * @param input - Acteur session + gelId + adherentId
 * @param deps - Overrides **tests** uniquement
 */
export async function leveRappelDetteGel(
  input: LeveRappelDetteGelInput,
  deps?: GelMutateDeps
): Promise<GelMutationResult> {
  const denied = assertGelMutateActor(input.actor);
  if (denied) return denied;

  const disabled = assertMutationEnabled(deps);
  if (disabled) return disabled;

  const actorUserId = String(input.actor!.userId).trim();
  const adherentId = String(input.adherentId ?? "").trim();
  const gelId = String(input.gelId ?? "").trim();

  if (!adherentId || adherentId.length > 64) {
    return fail("VALIDATION_ERROR", "Adhérent requis");
  }
  if (!gelId || gelId.length > 64) {
    return fail("VALIDATION_ERROR", "Identifiant de gel requis");
  }

  const now = deps?.getNow?.() ?? new Date();

  try {
    return await db.$transaction(async (tx) => {
      const locked = await acquireAdherentRowLock(tx, adherentId);
      if (!locked) {
        return fail("NOT_FOUND", "Adhérent introuvable");
      }

      const gel = await tx.rappelDetteGel.findUnique({
        where: { id: gelId },
        select: {
          id: true,
          scope: true,
          statut: true,
          adherentId: true,
        },
      });

      if (!gel || gel.adherentId !== adherentId) {
        return fail("NOT_FOUND", "Gel introuvable");
      }

      if (gel.statut === "LEVE") {
        const gelsRevision = await readGelsRevisionDecimal(tx, adherentId);
        return successFromActive(gel, gelsRevision, "already_lifted");
      }

      if (gel.statut !== "ACTIF") {
        return fail("CONFLICT", "État de gel non levable");
      }

      const updated = await tx.rappelDetteGel.update({
        where: { id: gelId },
        data: {
          statut: "LEVE",
          leveParUserId: actorUserId,
          leveAt: now,
        },
        select: {
          id: true,
          scope: true,
          statut: true,
          adherentId: true,
        },
      });

      const gelsRevision = await readGelsRevisionDecimal(tx, adherentId);
      return successFromActive(updated, gelsRevision, "lifted");
    });
  } catch (error) {
    console.error("[leveRappelDetteGel]", {
      category: "transaction_error",
      adherentIdLength: adherentId.length,
      gelIdLength: gelId.length,
      name: error instanceof Error ? error.name : "unknown",
      prismaCode:
        error instanceof Prisma.PrismaClientKnownRequestError
          ? error.code
          : undefined,
    });
    return fail("INTERNAL_ERROR", "Échec de la levée du gel");
  }
}
