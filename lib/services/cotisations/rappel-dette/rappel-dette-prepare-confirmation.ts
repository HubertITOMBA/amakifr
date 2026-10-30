/**
 * Préparation d’une confirmation d’envoi Lot 3 — **sans mutation métier**.
 *
 * Recalcul + destinataire + empreinte + jeton HMAC. Aucun reserve / transport /
 * notification / envoi.
 *
 * Gels : `frozenAdherent` / `frozenLineKeys` restent des options injectables
 * **sans source persistée** Prisma. Cette préparation **n’injecte pas** de gels
 * (comportement aligné preview). Tant qu’aucune source serveur réelle n’existe,
 * l’activation produit (`RAPPEL_DETTE_ENVOI_ENABLED=true`) reste **bloquée**
 * si le métier exige le gel/contestation.
 *
 * Module serveur — **ne pas** réexporter via le barrel public.
 */

import { randomUUID } from "node:crypto";
import type { AuthContext } from "@/lib/auth-context";
import { db } from "@/lib/db";
import { computeDetteRappelable } from "@/lib/services/cotisations/rappel-dette/compute-dette-rappelable";
import { getParisYmd } from "@/lib/services/cotisations/rappel-dette/paris-calendar";
import {
  canAccessPreviewRappelsDette,
} from "@/lib/services/cotisations/rappel-dette/preview-access";
import {
  computeRappelDetteFingerprint,
  normalizeRecipientEmail,
  resolveTemplateDetailLinkContract,
} from "@/lib/services/cotisations/rappel-dette/payload-fingerprint";
import {
  isRappelDetteEnvoiEnabled,
  RAPPEL_DETTE_ENVOI_DISABLED_MESSAGE,
} from "@/lib/services/cotisations/rappel-dette/rappel-dette-activation";
import {
  RAPPEL_DETTE_CONFIRMATION_TEMPLATE_V2,
  signRappelDetteConfirmationToken,
  type RappelDetteConfirmationTokenClaims,
} from "@/lib/services/cotisations/rappel-dette/rappel-dette-confirmation-token";
import { RAPPEL_DETTE_RESERVATION_ACCESS_DENIED_MESSAGE } from "@/lib/services/cotisations/rappel-dette/rappel-dette-reservation";
import { RAPPEL_DETTE_ORCHESTRATE_TEMPLATE_V2 } from "@/lib/services/cotisations/rappel-dette/rappel-dette-orchestrate-send";

export type PrepareRappelDetteActor = Pick<AuthContext, "userId" | "role">;

export type PrepareRappelDetteConfirmationInput = {
  actor: PrepareRappelDetteActor | null | undefined;
  adherentId: string;
  getNow?: () => Date;
  /**
   * Injection **tests uniquement** (flag / secret / compute / destinataire).
   * Jamais depuis FormData / body client.
   */
  deps?: PrepareRappelDetteConfirmationDeps;
};

export type PrepareRappelDetteConfirmationDeps = {
  isEnvoiEnabled?: () => boolean;
  hmacSecret?: string | null;
  compute?: typeof computeDetteRappelable;
  loadRecipient?: (
    adherentId: string
  ) => Promise<
    | { ok: true; recipientUserId: string; recipientEmail: string }
    | { ok: false; code: string; message: string }
  >;
  randomConfirmationId?: () => string;
};

export type PrepareRappelDetteConfirmationSuccess = {
  ok: true;
  adherentId: string;
  clientConfirmationId: string;
  expectedFingerprint: string;
  templateVersion: typeof RAPPEL_DETTE_ORCHESTRATE_TEMPLATE_V2;
  detteNette: string;
  referenceAt: string;
  referenceLabel: string;
  recipientMasked: string;
  prepareExpiresAt: string;
  confirmationToken: string;
  /** Claims signés (sans email) — utile tests ; actions peuvent omettre. */
  claims: RappelDetteConfirmationTokenClaims;
};

export type PrepareRappelDetteConfirmationFailure = {
  ok: false;
  code: string;
  message: string;
  nextHint?: "reconfirm" | "wait_or_ops" | "none";
};

export type PrepareRappelDetteConfirmationResult =
  | PrepareRappelDetteConfirmationSuccess
  | PrepareRappelDetteConfirmationFailure;

/**
 * Masque une adresse email pour l’UI (jamais le secret / jeton).
 *
 * @param email - Adresse serveur normalisée
 */
export function maskRappelDetteRecipientEmail(email: string): string {
  const normalized = normalizeRecipientEmail(email);
  const at = normalized.indexOf("@");
  if (at <= 0 || at === normalized.length - 1) {
    return "***";
  }
  const local = normalized.slice(0, at);
  const domain = normalized.slice(at + 1);
  const visible = local.charAt(0) || "*";
  return `${visible}***@${domain}`;
}

function formatParisReferenceLabel(date: Date): string {
  const ymd = getParisYmd(date);
  const dd = String(ymd.day).padStart(2, "0");
  const mm = String(ymd.month).padStart(2, "0");
  return `${dd}/${mm}/${ymd.year}`;
}

async function defaultLoadRecipient(
  adherentId: string
): Promise<
  | { ok: true; recipientUserId: string; recipientEmail: string }
  | { ok: false; code: string; message: string }
> {
  const adherent = await db.adherent.findUnique({
    where: { id: adherentId },
    select: {
      id: true,
      User: { select: { id: true, email: true } },
    },
  });
  if (!adherent?.User?.id) {
    return { ok: false, code: "NOT_FOUND", message: "Adhérent introuvable" };
  }
  const rawEmail = adherent.User.email;
  if (!rawEmail || String(rawEmail).trim() === "") {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      message: "Adresse email destinataire indisponible",
    };
  }
  return {
    ok: true,
    recipientUserId: adherent.User.id,
    recipientEmail: normalizeRecipientEmail(rawEmail),
  };
}

/**
 * Prépare une confirmation signée (lecture / recalcul uniquement).
 *
 * @param input - Acteur session + adhérent cible
 */
export async function prepareRappelDetteConfirmation(
  input: PrepareRappelDetteConfirmationInput
): Promise<PrepareRappelDetteConfirmationResult> {
  const deps = input.deps ?? {};
  const isEnabled =
    deps.isEnvoiEnabled?.() ?? isRappelDetteEnvoiEnabled();

  if (!input.actor?.userId || String(input.actor.userId).trim() === "") {
    return {
      ok: false,
      code: "UNAUTHENTICATED",
      message: "Authentification requise",
      nextHint: "none",
    };
  }
  if (!canAccessPreviewRappelsDette(input.actor.role)) {
    return {
      ok: false,
      code: "FORBIDDEN",
      message: RAPPEL_DETTE_RESERVATION_ACCESS_DENIED_MESSAGE,
      nextHint: "none",
    };
  }
  if (!isEnabled) {
    return {
      ok: false,
      code: "ENVOI_DISABLED",
      message: RAPPEL_DETTE_ENVOI_DISABLED_MESSAGE,
      nextHint: "none",
    };
  }

  if (
    RAPPEL_DETTE_CONFIRMATION_TEMPLATE_V2 !== RAPPEL_DETTE_ORCHESTRATE_TEMPLATE_V2
  ) {
    return {
      ok: false,
      code: "INTERNAL_ERROR",
      message: "Alignement template prepare/orchestrateur invalide",
      nextHint: "none",
    };
  }

  const adherentId = String(input.adherentId ?? "").trim();
  if (!adherentId) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      message: "Adhérent requis",
      nextHint: "none",
    };
  }

  const templateVersion = RAPPEL_DETTE_ORCHESTRATE_TEMPLATE_V2;
  const templateDetailLinkContract =
    resolveTemplateDetailLinkContract(templateVersion);
  if (!templateDetailLinkContract) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      message: "Version de template hors catalogue serveur",
      nextHint: "none",
    };
  }

  const now = input.getNow?.() ?? new Date();
  const loadRecipient = deps.loadRecipient ?? defaultLoadRecipient;
  const recipient = await loadRecipient(adherentId);
  if (!recipient.ok) {
    return {
      ok: false,
      code: recipient.code,
      message: recipient.message,
      nextHint: "none",
    };
  }

  // Pas de gels : aucune source persistée (voir en-tête module).
  const computeFn = deps.compute ?? computeDetteRappelable;
  const compute = await computeFn(adherentId, { now });

  if (compute.globalReasons.includes("PRISMA_ERROR")) {
    return {
      ok: false,
      code: "COMPUTE_ERROR",
      message: "Échec du recalcul d’éligibilité",
      nextHint: "wait_or_ops",
    };
  }
  if (!compute.eligible) {
    return {
      ok: false,
      code: "NOT_ELIGIBLE",
      message: "Adhérent non éligible au rappel",
      nextHint: "reconfirm",
    };
  }

  const { fingerprint } = computeRappelDetteFingerprint({
    adherentId,
    recipientUserId: recipient.recipientUserId,
    recipientEmail: recipient.recipientEmail,
    templateVersion,
    templateDetailLinkContract,
    montantBrut: compute.montantBrut,
    avoirDisponible: compute.avoirDisponible,
    detteNette: compute.detteNette,
    retainedLines: compute.retainedLines,
  });

  const clientConfirmationId =
    deps.randomConfirmationId?.() ?? randomUUID();

  const signed = signRappelDetteConfirmationToken({
    actorUserId: input.actor.userId,
    adherentId,
    fingerprint,
    clientConfirmationId,
    issuedAt: now,
    secret: deps.hmacSecret === undefined ? undefined : deps.hmacSecret ?? "",
  });

  if (!signed.ok) {
    return {
      ok: false,
      code: signed.code,
      message: signed.message,
      nextHint: "wait_or_ops",
    };
  }

  const detteNette = Number(compute.detteNette.toString());
  const detteNetteStr = Number.isFinite(detteNette)
    ? detteNette.toFixed(2)
    : "0.00";

  return {
    ok: true,
    adherentId,
    clientConfirmationId: signed.claims.clientConfirmationId,
    expectedFingerprint: fingerprint,
    templateVersion,
    detteNette: detteNetteStr,
    referenceAt: now.toISOString(),
    referenceLabel: formatParisReferenceLabel(now),
    recipientMasked: maskRappelDetteRecipientEmail(recipient.recipientEmail),
    prepareExpiresAt: new Date(signed.claims.expiresAt).toISOString(),
    confirmationToken: signed.token,
    claims: signed.claims,
  };
}
