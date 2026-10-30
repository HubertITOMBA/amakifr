/**
 * Orchestrateur interne Lot 3 — enchaînement manuel d’envoi.
 *
 * Module **serveur dédié**, **non réexporté** par le barrel `rappel-dette/index.ts`,
 * **non branché** actions / UI / cron dans cette passe.
 *
 * Ordre figé :
 * 1. Auth ADMIN|PRESID + garde d’activation serveur
 * 2. Réservation + vérification fingerprint
 * 3. Résolution fournisseur, validation config, URL + contenu + **transport**
 *    (méthode d’envoi callable) **avant** Calling (sans réseau)
 * 4. Autorisation Calling sous verrou
 * 5. Appel fournisseur **uniquement** si `providerCallAuthorized === true`
 *    via la référence transport/méthode capturée (hors TX, 0 retry/failover)
 * 6. Persistance puis notification **uniquement** après preuve Accepted persistée
 *
 * Contenu / destinataire : snapshot serveur confirmé uniquement — jamais montants
 * ni adresse fournis par le client.
 *
 * Reprise après `PROVIDER_TRANSPORT_INVALID` (Reserved conservé) :
 * corriger le câblage serveur (injection `smtpTransport` / `resendTransport`),
 * puis rappeler l’orchestrateur avec le **même** `clientConfirmationId` et la
 * **même** `expectedFingerprint` tant que le TTL Reserved n’est pas écoulé.
 * `reserve` reste idempotent ; `authorizeCalling` recalcule sous verrou.
 * **Aucun** contournement de TTL, fingerprint ou verrou adhérent.
 */

import type { AuthContext } from "@/lib/auth-context";
import { db } from "@/lib/db";
import {
  isRappelDetteEnvoiEnabled,
  RAPPEL_DETTE_ENVOI_DISABLED_MESSAGE,
} from "@/lib/services/cotisations/rappel-dette/rappel-dette-activation";
import { buildRappelDetteDetailAbsoluteUrlV2 } from "@/lib/services/cotisations/rappel-dette/canonical-app-url";
import { getParisYmd } from "@/lib/services/cotisations/rappel-dette/paris-calendar";
import { canAccessPreviewRappelsDette } from "@/lib/services/cotisations/rappel-dette/preview-access";
import { buildRappelDetteEmailContentV2 } from "@/lib/services/cotisations/rappel-dette/rappel-dette-email-content-v2";
import {
  persistRappelDetteEmailOutcome,
  type PersistRappelDetteEmailOutcomeResult,
  type RappelDetteEmailOutcome,
} from "@/lib/services/cotisations/rappel-dette/rappel-dette-email-outcome";
import {
  sendRappelDetteEmailResend,
  sendRappelDetteEmailSmtp,
  type ResendTransport,
  type SmtpTransport,
} from "@/lib/services/cotisations/rappel-dette/rappel-dette-email-provider-adapter";
import {
  ensureRappelDetteInternalNotification,
  type EnsureRappelDetteNotificationResult,
} from "@/lib/services/cotisations/rappel-dette/rappel-dette-notification";
import {
  validateRappelDetteProviderConfig,
  type ResolveProviderEnv,
  type ValidateProviderResult,
  type ValidatedRappelDetteProvider,
} from "@/lib/services/cotisations/rappel-dette/rappel-dette-provider-resolve";
import {
  RAPPEL_DETTE_RESERVED_ON_PRECALLING_REFUSAL,
  authorizeRappelDetteCalling,
  reserveRappelDetteEnvoi,
  type AuthorizeCallingResult,
  type ReserveRappelDetteResult,
} from "@/lib/services/cotisations/rappel-dette/rappel-dette-reservation";
import { RAPPEL_DETTE_RESERVATION_ACCESS_DENIED_MESSAGE } from "@/lib/services/cotisations/rappel-dette/rappel-dette-reservation";

export const RAPPEL_DETTE_ORCHESTRATE_TEMPLATE_V2 =
  "email-rappel-dette-v2" as const;

/**
 * Transport du fournisseur sélectionné absent ou méthode d’envoi non callable.
 * Refus **pré-Calling** : Reserved intact — voir reprise documentée en tête de module.
 */
export const RAPPEL_DETTE_PROVIDER_TRANSPORT_INVALID_CODE =
  "PROVIDER_TRANSPORT_INVALID" as const;

export const RAPPEL_DETTE_PROVIDER_TRANSPORT_INVALID_MESSAGE =
  "Transport fournisseur indisponible ou invalide — corriger le câblage serveur puis reprendre la même réservation." as const;

export type OrchestrateRappelDetteActor = Pick<
  AuthContext,
  "userId" | "role"
>;

/**
 * Référence stable figée **avant** Calling : fournisseur + transport + méthode.
 * Aucun bascule / failover après capture.
 */
type PinnedProviderCall =
  | {
      kind: "smtp";
      provider: ValidatedRappelDetteProvider & { kind: "smtp" };
      transport: SmtpTransport;
      /** `sendMail` lié au transport (contexte `this` préservé). */
      sendMail: SmtpTransport["sendMail"];
    }
  | {
      kind: "resend";
      provider: ValidatedRappelDetteProvider & { kind: "resend" };
      transport: ResendTransport;
      /** `emails.send` lié à `emails` (contexte `this` préservé). */
      send: ResendTransport["emails"]["send"];
    };

/**
 * Vérifie et capture le transport du fournisseur **sélectionné** uniquement.
 *
 * @param provider - Kind + from déjà validés (env)
 * @param input - Transports injectés (jamais depuis le client HTTP)
 */
function capturePinnedProviderTransport(
  provider: ValidatedRappelDetteProvider,
  input: Pick<
    OrchestrateRappelDetteSendInput,
    "smtpTransport" | "resendTransport"
  >
):
  | { ok: true; pinned: PinnedProviderCall }
  | {
      ok: false;
      code: typeof RAPPEL_DETTE_PROVIDER_TRANSPORT_INVALID_CODE;
      message: string;
    } {
  if (provider.kind === "smtp") {
    const transport = input.smtpTransport;
    if (!transport || typeof transport.sendMail !== "function") {
      return {
        ok: false,
        code: RAPPEL_DETTE_PROVIDER_TRANSPORT_INVALID_CODE,
        message: RAPPEL_DETTE_PROVIDER_TRANSPORT_INVALID_MESSAGE,
      };
    }
    const smtpProvider: ValidatedRappelDetteProvider & { kind: "smtp" } = {
      kind: "smtp",
      from: provider.from,
    };
    return {
      ok: true,
      pinned: {
        kind: "smtp",
        provider: smtpProvider,
        transport,
        sendMail: transport.sendMail.bind(transport),
      },
    };
  }

  const transport = input.resendTransport;
  if (
    !transport ||
    !transport.emails ||
    typeof transport.emails.send !== "function"
  ) {
    return {
      ok: false,
      code: RAPPEL_DETTE_PROVIDER_TRANSPORT_INVALID_CODE,
      message: RAPPEL_DETTE_PROVIDER_TRANSPORT_INVALID_MESSAGE,
    };
  }
  const resendProvider: ValidatedRappelDetteProvider & { kind: "resend" } = {
    kind: "resend",
    from: provider.from,
  };
  return {
    ok: true,
    pinned: {
      kind: "resend",
      provider: resendProvider,
      transport,
      send: transport.emails.send.bind(transport.emails),
    },
  };
}

/** Snapshot serveur pour construire le contenu (jamais hydraté depuis le client). */
export type RappelDetteEnvoiContentSnapshot = {
  id: string;
  adherentId: string;
  recipientEmail: string;
  recipientUserId: string;
  detteNette: { toString(): string } | string | number;
  reservationStatus: string;
  emailStatus: string;
  notifStatus: string;
  emailAcceptedAt: Date | null;
  payloadFingerprint: string;
  templateVersion: string;
  reservedAt: Date;
  technicalResultCode?: string | null;
};

export type OrchestrateRappelDetteSendDeps = {
  /**
   * Injection **tests uniquement** pour forcer le flag d’activation.
   * Aucun champ FormData / query / body client ne doit l’alimenter.
   */
  isEnvoiEnabled?: () => boolean;
  reserve?: (
    input: Parameters<typeof reserveRappelDetteEnvoi>[0]
  ) => Promise<ReserveRappelDetteResult>;
  authorizeCalling?: (
    input: Parameters<typeof authorizeRappelDetteCalling>[0]
  ) => Promise<AuthorizeCallingResult>;
  validateProvider?: (env?: ResolveProviderEnv) => ValidateProviderResult;
  loadEnvoiSnapshot?: (
    envoiId: string
  ) => Promise<RappelDetteEnvoiContentSnapshot | null>;
  loadRecipientSalutation?: (
    recipientUserId: string
  ) => Promise<string | null>;
  buildDetailUrl?: () => string | null;
  buildEmailContent?: typeof buildRappelDetteEmailContentV2;
  sendSmtp?: typeof sendRappelDetteEmailSmtp;
  sendResend?: typeof sendRappelDetteEmailResend;
  persistOutcome?: (
    input: Parameters<typeof persistRappelDetteEmailOutcome>[0]
  ) => Promise<PersistRappelDetteEmailOutcomeResult>;
  ensureNotification?: (
    input: Parameters<typeof ensureRappelDetteInternalNotification>[0]
  ) => Promise<EnsureRappelDetteNotificationResult>;
  /** Env injectable (provider) — jamais secrets renvoyés au client. */
  env?: ResolveProviderEnv;
  /** Trace ordonnée des étapes (tests). */
  onStep?: (step: string) => void;
};

export type OrchestrateRappelDetteSendInput = {
  actor: OrchestrateRappelDetteActor | null | undefined;
  adherentId: string;
  clientConfirmationId: string;
  expectedFingerprint: string;
  /** Révision gels du jeton v2 (chaîne décimale) — comparée sous verrou. */
  expectedGelsRevision: string;
  /** Catalogue serveur — seule v2 autorisée pour l’envoi réel. */
  templateVersion: typeof RAPPEL_DETTE_ORCHESTRATE_TEMPLATE_V2;
  getNow?: () => Date;
  reservedTtlMs?: number;
  smtpTransport?: SmtpTransport;
  resendTransport?: ResendTransport;
  /** Corrélation logs bornée (pas de PII). */
  correlationId?: string;
  deps?: OrchestrateRappelDetteSendDeps;
};

export type RappelDetteOrchestrationUiSuccess = {
  ok: true;
  phase:
    | "email_accepted"
    | "email_rejected"
    | "email_unknown"
    | "notif_created"
    | "notif_idempotent"
    | "notif_failed"
    | "terminal_replay";
  envoiId: string;
  reservationStatus: string;
  emailStatus?: string;
  notifStatus?: string;
  technicalCode?: string;
  message: string;
  providerCallPerformed: boolean;
};

export type RappelDetteOrchestrationUiFailure = {
  ok: false;
  code: string;
  message: string;
  nextHint?: "reconfirm" | "wait_or_ops" | "resume_notif" | "none";
  envoiId?: string;
  reservationStatus?: string;
  /**
   * Présent sur échec pré-Calling : Reserved intact ;
   * reprise possible sans contourner le verrou (nouvelle confirmation).
   */
  reservedFate?: typeof RAPPEL_DETTE_RESERVED_ON_PRECALLING_REFUSAL;
  providerCallPerformed: false;
};

export type OrchestrateRappelDetteSendResult =
  | RappelDetteOrchestrationUiSuccess
  | RappelDetteOrchestrationUiFailure;

export type ResumeRappelDetteNotifInput = {
  actor: OrchestrateRappelDetteActor | null | undefined;
  envoiId: string;
  adherentId: string;
  getNow?: () => Date;
  correlationId?: string;
  deps?: Pick<
    OrchestrateRappelDetteSendDeps,
    "isEnvoiEnabled" | "ensureNotification" | "onStep"
  >;
};

function fail(
  code: string,
  message: string,
  extra?: Partial<RappelDetteOrchestrationUiFailure>
): RappelDetteOrchestrationUiFailure {
  return {
    ok: false,
    code,
    message,
    providerCallPerformed: false,
    ...extra,
  };
}

function step(deps: OrchestrateRappelDetteSendDeps | undefined, name: string) {
  deps?.onStep?.(name);
}

function formatDetteNetteEuro(
  value: { toString(): string } | string | number
): string {
  const n = Number(typeof value === "object" ? value.toString() : value);
  if (!Number.isFinite(n)) return "";
  return n.toFixed(2).replace(".", ",");
}

function formatParisReferenceLabel(date: Date): string {
  const ymd = getParisYmd(date);
  const dd = String(ymd.day).padStart(2, "0");
  const mm = String(ymd.month).padStart(2, "0");
  return `${dd}/${mm}/${ymd.year}`;
}

async function defaultLoadEnvoiSnapshot(
  envoiId: string
): Promise<RappelDetteEnvoiContentSnapshot | null> {
  const row = await db.rappelDetteEnvoi.findUnique({ where: { id: envoiId } });
  if (!row) return null;
  return {
    id: row.id,
    adherentId: row.adherentId,
    recipientEmail: row.recipientEmail,
    recipientUserId: row.recipientUserId,
    detteNette: row.detteNette,
    reservationStatus: row.reservationStatus,
    emailStatus: row.emailStatus,
    notifStatus: row.notifStatus,
    emailAcceptedAt: row.emailAcceptedAt,
    payloadFingerprint: row.payloadFingerprint,
    templateVersion: row.templateVersion,
    reservedAt: row.reservedAt,
    technicalResultCode: row.technicalResultCode,
  };
}

async function defaultLoadRecipientSalutation(
  recipientUserId: string
): Promise<string | null> {
  const adherent = await db.adherent.findFirst({
    where: { userId: recipientUserId },
    select: { civility: true, firstname: true, lastname: true },
  });
  if (!adherent) return null;
  const parts = [adherent.civility, adherent.firstname, adherent.lastname]
    .map((p) => String(p ?? "").trim())
    .filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : null;
}

function mapReserveFailure(
  r: Extract<ReserveRappelDetteResult, { ok: false }>
): RappelDetteOrchestrationUiFailure {
  const nextHint =
    r.code === "REQUIRES_RECONFIRM" || r.code === "NOT_ELIGIBLE"
      ? "reconfirm"
      : r.code === "BLOCKED_ATTEMPT" ||
          r.code === "CONFLICT" ||
          r.code === "GEL_SOURCE_UNAVAILABLE" ||
          r.code === "COMPUTE_ERROR"
        ? "wait_or_ops"
        : "none";
  return fail(r.code, r.message, { nextHint });
}

function mapCallingFailure(
  r: Extract<AuthorizeCallingResult, { ok: false }>,
  envoiId: string
): RappelDetteOrchestrationUiFailure {
  const nextHint =
    r.code === "REQUIRES_RECONFIRM" || r.code === "NOT_ELIGIBLE"
      ? "reconfirm"
      : r.code === "EXPIRED"
        ? "reconfirm"
        : "wait_or_ops";
  return fail(r.code, r.message, {
    nextHint,
    envoiId,
    reservationStatus: "Reserved",
    reservedFate: r.reservedFate,
  });
}

function mapTerminalReplay(
  snap: RappelDetteEnvoiContentSnapshot
): OrchestrateRappelDetteSendResult {
  const technical =
    typeof snap.technicalResultCode === "string" &&
    snap.technicalResultCode.trim()
      ? snap.technicalResultCode.trim()
      : undefined;

  if (snap.reservationStatus === "Completed" && snap.emailStatus === "Accepted") {
    if (snap.notifStatus === "Created") {
      return {
        ok: true,
        phase: "terminal_replay",
        envoiId: snap.id,
        reservationStatus: snap.reservationStatus,
        emailStatus: snap.emailStatus,
        notifStatus: snap.notifStatus,
        message: "Envoi déjà accepté et notification créée — aucun nouvel email.",
        providerCallPerformed: false,
      };
    }
    return {
      ok: true,
      phase: "terminal_replay",
      envoiId: snap.id,
      reservationStatus: snap.reservationStatus,
      emailStatus: snap.emailStatus,
      notifStatus: snap.notifStatus,
      message:
        "Envoi déjà accepté — reprise notification possible, aucun nouvel email.",
      providerCallPerformed: false,
    };
  }

  if (
    snap.reservationStatus === "Failed" ||
    snap.emailStatus === "DefinitelyNotAccepted"
  ) {
    return {
      ok: true,
      phase: "terminal_replay",
      envoiId: snap.id,
      reservationStatus: snap.reservationStatus,
      emailStatus: snap.emailStatus,
      notifStatus: snap.notifStatus,
      technicalCode: technical,
      message: "Tentative déjà clôturée (refus définitif) — aucun nouvel email.",
      providerCallPerformed: false,
    };
  }

  if (
    snap.reservationStatus === "Unknown" ||
    snap.emailStatus === "Unknown"
  ) {
    return {
      ok: true,
      phase: "terminal_replay",
      envoiId: snap.id,
      reservationStatus: snap.reservationStatus,
      emailStatus: snap.emailStatus,
      notifStatus: snap.notifStatus,
      technicalCode: technical,
      message:
        "Tentative en incertitude — aucun nouvel email ; réconciliation ops requise.",
      providerCallPerformed: false,
    };
  }

  return fail("ENVOI_IN_PROGRESS_OR_BLOCKED", "Tentative déjà en cours ou bloquée", {
    nextHint: "wait_or_ops",
    envoiId: snap.id,
    reservationStatus: snap.reservationStatus,
  });
}

/**
 * Orchestre un envoi manuel Lot 3 (interne).
 *
 * @param input - Acteur, confirmation, empreinte attendue, transports injectés
 * @returns Résultat UI-safe (sans secrets / corps fournisseur)
 */
export async function orchestrateRappelDetteSend(
  input: OrchestrateRappelDetteSendInput
): Promise<OrchestrateRappelDetteSendResult> {
  const deps = input.deps ?? {};
  const isEnabled =
    deps.isEnvoiEnabled?.() ?? isRappelDetteEnvoiEnabled();

  step(deps, "auth_flag");
  if (!input.actor?.userId) {
    return fail("UNAUTHENTICATED", "Authentification requise", {
      nextHint: "none",
    });
  }
  if (!canAccessPreviewRappelsDette(input.actor.role)) {
    return fail("FORBIDDEN", RAPPEL_DETTE_RESERVATION_ACCESS_DENIED_MESSAGE, {
      nextHint: "none",
    });
  }
  if (!isEnabled) {
    return fail("ENVOI_DISABLED", RAPPEL_DETTE_ENVOI_DISABLED_MESSAGE, {
      nextHint: "none",
    });
  }

  if (input.templateVersion !== RAPPEL_DETTE_ORCHESTRATE_TEMPLATE_V2) {
    return fail(
      "VALIDATION_ERROR",
      "Version de template non autorisée pour l’envoi",
      { nextHint: "none" }
    );
  }

  const reserveFn = deps.reserve ?? reserveRappelDetteEnvoi;
  step(deps, "reserve");
  const reserved = await reserveFn({
    actor: input.actor,
    adherentId: input.adherentId,
    clientConfirmationId: input.clientConfirmationId,
    expectedFingerprint: input.expectedFingerprint,
    expectedGelsRevision: input.expectedGelsRevision,
    templateVersion: input.templateVersion,
    getNow: input.getNow,
    reservedTtlMs: input.reservedTtlMs,
  });

  if (!reserved.ok) {
    return mapReserveFailure(reserved);
  }

  const loadSnap = deps.loadEnvoiSnapshot ?? defaultLoadEnvoiSnapshot;
  const snapAfterReserve = await loadSnap(reserved.envoiId);
  if (!snapAfterReserve) {
    return fail("INTERNAL_ERROR", "Snapshot d’envoi introuvable après réservation", {
      nextHint: "wait_or_ops",
      envoiId: reserved.envoiId,
    });
  }

  // Rejeu terminal : restituer l’état sans nouvel email
  if (
    reserved.reservationStatus === "Completed" ||
    reserved.reservationStatus === "Failed" ||
    reserved.reservationStatus === "Unknown"
  ) {
    step(deps, "terminal_replay");
    return mapTerminalReplay(snapAfterReserve);
  }

  if (reserved.reservationStatus === "Calling") {
    step(deps, "calling_blocked");
    return fail(
      "ENVOI_IN_PROGRESS_OR_BLOCKED",
      "Tentative déjà en Calling — aucun nouvel email automatique",
      {
        nextHint: "wait_or_ops",
        envoiId: reserved.envoiId,
        reservationStatus: "Calling",
      }
    );
  }

  if (reserved.reservationStatus !== "Reserved") {
    return fail("INVALID_STATE", "État de réservation non supporté", {
      nextHint: "wait_or_ops",
      envoiId: reserved.envoiId,
      reservationStatus: reserved.reservationStatus,
    });
  }

  // ——— Pré-Calling : config fournisseur + URL + contenu (sans réseau) ———
  step(deps, "validate_provider");
  const validateFn = deps.validateProvider ?? validateRappelDetteProviderConfig;
  const providerResult = validateFn(deps.env);
  if (!providerResult.ok) {
    return fail(providerResult.code, providerResult.message, {
      nextHint: "wait_or_ops",
      envoiId: reserved.envoiId,
      reservationStatus: "Reserved",
      reservedFate: RAPPEL_DETTE_RESERVED_ON_PRECALLING_REFUSAL,
    });
  }
  const pinnedProvider: ValidatedRappelDetteProvider = providerResult.provider;

  step(deps, "prepare_content");
  const detailUrl = deps.buildDetailUrl
    ? deps.buildDetailUrl()
    : buildRappelDetteDetailAbsoluteUrlV2();
  if (!detailUrl) {
    return fail(
      "CONTENT_INVALID",
      "URL détail serveur indisponible — aucun appel fournisseur",
      {
        nextHint: "wait_or_ops",
        envoiId: reserved.envoiId,
        reservationStatus: "Reserved",
        reservedFate: RAPPEL_DETTE_RESERVED_ON_PRECALLING_REFUSAL,
      }
    );
  }

  const detteFmt = formatDetteNetteEuro(snapAfterReserve.detteNette);
  if (!detteFmt) {
    return fail(
      "CONTENT_INVALID",
      "Montant serveur invalide — aucun appel fournisseur",
      {
        nextHint: "reconfirm",
        envoiId: reserved.envoiId,
        reservationStatus: "Reserved",
        reservedFate: RAPPEL_DETTE_RESERVED_ON_PRECALLING_REFUSAL,
      }
    );
  }

  const loadSalutation =
    deps.loadRecipientSalutation ?? defaultLoadRecipientSalutation;
  const salutationName = await loadSalutation(snapAfterReserve.recipientUserId);
  const now = input.getNow?.() ?? new Date();
  const buildContent = deps.buildEmailContent ?? buildRappelDetteEmailContentV2;
  const preparedContent = buildContent({
    detteNetteFormatted: detteFmt,
    referenceDateLabel: formatParisReferenceLabel(
      snapAfterReserve.reservedAt ?? now
    ),
    salutationName,
  });
  if (!preparedContent) {
    return fail(
      "CONTENT_INVALID",
      "Contenu email indisponible — aucun appel fournisseur",
      {
        nextHint: "wait_or_ops",
        envoiId: reserved.envoiId,
        reservationStatus: "Reserved",
        reservedFate: RAPPEL_DETTE_RESERVED_ON_PRECALLING_REFUSAL,
      }
    );
  }

  // Destinataire figé depuis le snapshot serveur (jamais client)
  const recipientTo = String(snapAfterReserve.recipientEmail ?? "").trim();
  if (!recipientTo) {
    return fail(
      "CONTENT_INVALID",
      "Destinataire serveur manquant — aucun appel fournisseur",
      {
        nextHint: "reconfirm",
        envoiId: reserved.envoiId,
        reservationStatus: "Reserved",
        reservedFate: RAPPEL_DETTE_RESERVED_ON_PRECALLING_REFUSAL,
      }
    );
  }

  // ——— Transport du fournisseur sélectionné (callable) avant Calling ———
  step(deps, "validate_transport");
  const transportCapture = capturePinnedProviderTransport(
    pinnedProvider,
    input
  );
  if (!transportCapture.ok) {
    return fail(transportCapture.code, transportCapture.message, {
      nextHint: "wait_or_ops",
      envoiId: reserved.envoiId,
      reservationStatus: "Reserved",
      reservedFate: RAPPEL_DETTE_RESERVED_ON_PRECALLING_REFUSAL,
    });
  }
  /** Figé pour l’appel post-Calling — aucun failover / changement de kind. */
  const pinnedCall = transportCapture.pinned;

  // ——— Calling sous verrou ———
  step(deps, "authorize_calling");
  const authorizeFn = deps.authorizeCalling ?? authorizeRappelDetteCalling;
  const calling = await authorizeFn({
    actor: input.actor,
    envoiId: reserved.envoiId,
    adherentId: input.adherentId,
    getNow: input.getNow,
  });

  if (!calling.ok) {
    // Contenu préparé abandonné — pas de remplacement silencieux
    return mapCallingFailure(calling, reserved.envoiId);
  }

  if (!calling.providerCallAuthorized) {
    step(deps, "provider_skipped_already_started");
    return fail(
      "ENVOI_IN_PROGRESS_OR_BLOCKED",
      "Appel fournisseur déjà démarré ou non autorisé — aucun nouvel email",
      {
        nextHint: "wait_or_ops",
        envoiId: calling.envoiId,
        reservationStatus: "Calling",
      }
    );
  }

  // ——— Appel fournisseur hors TX (réfs capturées pré-Calling uniquement) ———
  step(deps, "provider_call");
  let emailOutcome: RappelDetteEmailOutcome;
  try {
    if (pinnedCall.kind === "smtp") {
      const sendSmtp = deps.sendSmtp ?? sendRappelDetteEmailSmtp;
      emailOutcome = await sendSmtp(
        { sendMail: pinnedCall.sendMail },
        {
          from: pinnedCall.provider.from,
          to: recipientTo,
          subject: preparedContent.subject,
          html: preparedContent.html,
          correlationId: input.correlationId,
        }
      );
    } else {
      const sendResend = deps.sendResend ?? sendRappelDetteEmailResend;
      emailOutcome = await sendResend(
        { emails: { send: pinnedCall.send } },
        {
          from: pinnedCall.provider.from,
          to: recipientTo,
          subject: preparedContent.subject,
          html: preparedContent.html,
          correlationId: input.correlationId,
        }
      );
    }
  } catch {
    // Exception fournisseur ambiguë après Calling → Unknown (jamais DNA, 0 retry)
    emailOutcome = {
      kind: "Unknown",
      technicalCode: "PROVIDER_EXCEPTION",
    };
  }

  // ——— Persistance (échec = bloquant explicite, aucun renvoi) ———
  step(deps, "persist_outcome");
  const persistFn = deps.persistOutcome ?? persistRappelDetteEmailOutcome;
  let persistResult: PersistRappelDetteEmailOutcomeResult;
  try {
    persistResult = await persistFn({
      caller: {
        kind: "server_adapter",
        correlationId: input.correlationId,
      },
      envoiId: calling.envoiId,
      adherentId: input.adherentId,
      outcome: emailOutcome,
      getNow: input.getNow,
      actor: input.actor,
    });
  } catch {
    if (emailOutcome.kind === "Accepted") {
      return fail(
        "PROVIDER_ACCEPTED_PERSIST_FAILED",
        "Acceptation fournisseur observée mais non enregistrée — intervention requise",
        {
          nextHint: "wait_or_ops",
          envoiId: calling.envoiId,
          reservationStatus: "Calling",
        }
      );
    }
    return fail(
      "PERSIST_FAILED_BLOCKING",
      "Échec de persistance du résultat email — aucun renvoi automatique",
      {
        nextHint: "wait_or_ops",
        envoiId: calling.envoiId,
        reservationStatus: "Calling",
      }
    );
  }

  if (!persistResult.ok) {
    if (emailOutcome.kind === "Accepted") {
      return fail(
        "PROVIDER_ACCEPTED_PERSIST_FAILED",
        "Acceptation fournisseur observée mais non enregistrée — intervention requise",
        {
          nextHint: "wait_or_ops",
          envoiId: calling.envoiId,
          reservationStatus: "Calling",
        }
      );
    }
    return fail(
      "PERSIST_FAILED_BLOCKING",
      persistResult.message ||
        "Échec de persistance du résultat email — aucun renvoi automatique",
      {
        nextHint: "wait_or_ops",
        envoiId: calling.envoiId,
        reservationStatus: "Calling",
      }
    );
  }

  if (persistResult.emailStatus === "DefinitelyNotAccepted") {
    return {
      ok: true,
      phase: "email_rejected",
      envoiId: persistResult.envoiId,
      reservationStatus: persistResult.reservationStatus,
      emailStatus: persistResult.emailStatus,
      notifStatus: persistResult.notifStatus,
      technicalCode:
        emailOutcome.kind === "DefinitelyNotAccepted"
          ? emailOutcome.technicalCode
          : undefined,
      message: "Email refusé définitivement par le fournisseur.",
      providerCallPerformed: true,
    };
  }

  if (persistResult.emailStatus === "Unknown") {
    return {
      ok: true,
      phase: "email_unknown",
      envoiId: persistResult.envoiId,
      reservationStatus: persistResult.reservationStatus,
      emailStatus: persistResult.emailStatus,
      notifStatus: persistResult.notifStatus,
      technicalCode:
        emailOutcome.kind === "Unknown" ? emailOutcome.technicalCode : undefined,
      message:
        "Résultat email ambigu — aucun nouvel envoi ; réconciliation ops requise.",
      providerCallPerformed: true,
    };
  }

  // Accepted persisté → notification (échec ≠ renvoi email)
  if (
    persistResult.emailStatus !== "Accepted" ||
    persistResult.emailAcceptedAt == null
  ) {
    return fail(
      "INTERNAL_ERROR",
      "État persisté incohérent après acceptation",
      {
        nextHint: "wait_or_ops",
        envoiId: persistResult.envoiId,
      }
    );
  }

  step(deps, "ensure_notification");
  const ensureFn =
    deps.ensureNotification ?? ensureRappelDetteInternalNotification;
  let notifResult: EnsureRappelDetteNotificationResult;
  try {
    notifResult = await ensureFn({
      caller: {
        kind: "server_adapter",
        correlationId: input.correlationId,
      },
      envoiId: persistResult.envoiId,
      adherentId: input.adherentId,
      getNow: input.getNow,
    });
  } catch {
    return {
      ok: true,
      phase: "notif_failed",
      envoiId: persistResult.envoiId,
      reservationStatus: persistResult.reservationStatus,
      emailStatus: "Accepted",
      notifStatus: "Failed",
      message:
        "Email accepté ; échec notification — reprise notification seule possible.",
      providerCallPerformed: true,
    };
  }

  if (!notifResult.ok) {
    return {
      ok: true,
      phase: "notif_failed",
      envoiId: persistResult.envoiId,
      reservationStatus: persistResult.reservationStatus,
      emailStatus: "Accepted",
      notifStatus: "Failed",
      message:
        "Email accepté ; échec notification — reprise notification seule possible.",
      providerCallPerformed: true,
    };
  }

  return {
    ok: true,
    phase:
      notifResult.outcome === "idempotent"
        ? "notif_idempotent"
        : "notif_created",
    envoiId: notifResult.envoiId,
    reservationStatus: "Completed",
    emailStatus: "Accepted",
    notifStatus: notifResult.notifStatus,
    message:
      notifResult.outcome === "idempotent"
        ? "Email accepté ; notification déjà créée."
        : "Email accepté et notification créée.",
    providerCallPerformed: true,
  };
}

/**
 * Reprise **notification seule** après Accepted persisté (aucun email).
 *
 * @param input - Acteur ADMIN|PRESID, cible envoi
 */
export async function resumeRappelDetteNotification(
  input: ResumeRappelDetteNotifInput
): Promise<OrchestrateRappelDetteSendResult> {
  const deps = input.deps ?? {};
  const isEnabled =
    deps.isEnvoiEnabled?.() ?? isRappelDetteEnvoiEnabled();

  step(deps, "resume_auth_flag");
  if (!input.actor?.userId) {
    return fail("UNAUTHENTICATED", "Authentification requise", {
      nextHint: "none",
    });
  }
  if (!canAccessPreviewRappelsDette(input.actor.role)) {
    return fail("FORBIDDEN", RAPPEL_DETTE_RESERVATION_ACCESS_DENIED_MESSAGE, {
      nextHint: "none",
    });
  }
  if (!isEnabled) {
    return fail("ENVOI_DISABLED", RAPPEL_DETTE_ENVOI_DISABLED_MESSAGE, {
      nextHint: "none",
    });
  }

  step(deps, "resume_notification");
  const ensureFn =
    deps.ensureNotification ?? ensureRappelDetteInternalNotification;
  let notifResult: EnsureRappelDetteNotificationResult;
  try {
    notifResult = await ensureFn({
      caller: {
        kind: "server_adapter",
        correlationId: input.correlationId,
      },
      envoiId: input.envoiId,
      adherentId: input.adherentId,
      getNow: input.getNow,
    });
  } catch {
    return fail(
      "NOTIF_RESUME_FAILED",
      "Échec de reprise de la notification",
      {
        nextHint: "resume_notif",
        envoiId: input.envoiId,
      }
    );
  }

  if (!notifResult.ok) {
    const nextHint =
      notifResult.code === "INVALID_STATE" ? "none" : "resume_notif";
    return fail(notifResult.code, notifResult.message, {
      nextHint,
      envoiId: input.envoiId,
    });
  }

  return {
    ok: true,
    phase:
      notifResult.outcome === "idempotent"
        ? "notif_idempotent"
        : "notif_created",
    envoiId: notifResult.envoiId,
    reservationStatus: "Completed",
    emailStatus: "Accepted",
    notifStatus: notifResult.notifStatus,
    message:
      notifResult.outcome === "idempotent"
        ? "Notification déjà créée — aucun email."
        : "Notification créée — aucun email.",
    providerCallPerformed: false,
  };
}
