/**
 * Lot R1.1 — Calcul d’éligibilité aux rappels cotisations/dettes.
 * Lecture seule : aucun envoi, aucune mutation.
 */

export {
  computeDetteRappelable,
} from "@/lib/services/cotisations/rappel-dette/compute-dette-rappelable";

export {
  previewRappelsDetteAdmin,
  PREVIEW_RAPPELS_BANNER,
  PREVIEW_INCOMPLETE_ALERT,
  type PreviewRappelsDetteResult,
  type PreviewRappelAdherentRow,
  type PreviewRappelsDetteAdminOptions,
  type PreviewComputationKind,
} from "@/lib/services/cotisations/rappel-dette/preview-rappels-admin";

export {
  canAccessPreviewRappelsDette,
  PREVIEW_RAPPELS_ACCESS_DENIED_MESSAGE,
} from "@/lib/services/cotisations/rappel-dette/preview-access";

export {
  labelGlobalReason,
  labelLineIgnoreReason,
  isTechnicalComputationFailure,
  type LabeledReason,
} from "@/lib/services/cotisations/rappel-dette/reason-labels";

export {
  formatPreviewEuroAmount,
  formatPreviewAmountDisplay,
  formatPreviewDueDisplay,
  formatPreviewComputedAt,
  buildHomonymFicheReferences,
  HOMONYM_DISPLAY_NOTICE,
  PREVIEW_REFRESH_SUCCESS_TOAST,
  PREVIEW_REFRESH_INCOMPLETE_TOAST,
  type PreviewDisplayComputationKind,
} from "@/lib/services/cotisations/rappel-dette/preview-display";

export {
  getParisYmd,
  civilDaysBetweenParis,
  addCivilDaysParis,
  parisCivilDate,
  parisYmdToUtcNoon,
} from "@/lib/services/cotisations/rappel-dette/paris-calendar";

export {
  resolveCotisationMensuelleDueDate,
  resolveDetteInitialeDueDate,
  resolveAssistanceDueDate,
} from "@/lib/services/cotisations/rappel-dette/resolve-due-date";

export {
  RAPPEL_DETTE_TIMEZONE,
  RAPPEL_J_PLUS_DAYS,
  RAPPEL_COOLDOWN_DAYS,
  RAPPEL_SENT_STATUSES,
  PENDING_PAYMENT_STATUSES,
  frozenLineKey,
  type RappelDebtSource,
  type RappelLineIgnoreReason,
  type RappelGlobalReason,
  type RappelRetainedLine,
  type RappelIgnoredLine,
  type ComputeDetteRappelableResult,
  type ComputeDetteRappelableOptions,
  type ComputeDetteRappelablePrisma,
} from "@/lib/services/cotisations/rappel-dette/types";

export {
  RAPPEL_DETTE_TEMPLATE_DETAIL_LINK_CONTRACT,
  RAPPEL_DETTE_TEMPLATE_DETAIL_LINK_CONTRACT_V2,
  RAPPEL_DETTE_TEMPLATE_REGISTRY,
  RAPPEL_DETTE_FINGERPRINT_SCHEMA_VERSION,
  buildRappelDetteFingerprintPayload,
  hashRappelDetteFingerprint,
  computeRappelDetteFingerprint,
  normalizeRecipientEmail,
  resolveTemplateDetailLinkContract,
  type RappelDetteFingerprintPayload,
  type RappelDetteFingerprintLine,
} from "@/lib/services/cotisations/rappel-dette/payload-fingerprint";

export {
  RAPPEL_DETTE_RESERVED_TTL_MS,
  RAPPEL_DETTE_RESERVATION_ACCESS_DENIED_MESSAGE,
  RAPPEL_DETTE_RESERVED_ON_PRECALLING_REFUSAL,
  reserveRappelDetteEnvoi,
  authorizeRappelDetteCalling,
  type ReserveRappelDetteInput,
  type ReserveRappelDetteResult,
  type AuthorizeCallingInput,
  type AuthorizeCallingResult,
} from "@/lib/services/cotisations/rappel-dette/rappel-dette-reservation";

/**
 * Persistance résultat email : **ne pas** réexporter ici.
 * Import serveur uniquement :
 * `@/lib/services/cotisations/rappel-dette/rappel-dette-email-outcome`
 * (évite un export client accidentel via ce barrel mixte).
 * `caller.kind="server_adapter"` = convention interne de forme, pas une auth.
 * Aucune action HTTP / paramètre client ne doit appeler ce service avec un outcome fabriqué.
 *
 * Notification interne post-Accepted : **ne pas** réexporter ici.
 * Import serveur uniquement :
 * `@/lib/services/cotisations/rappel-dette/rappel-dette-notification`
 * (création via `tx.notification.create` — jamais `createNotification` / push).
 *
 * Adaptateur email SMTP/Resend (classification Accepted/DNA/Unknown) :
 * **ne pas** réexporter ici — non branché actions/UI/cron.
 * Import : `@/lib/services/cotisations/rappel-dette/rappel-dette-email-provider-adapter`
 *
 * Contenu / URL canonique template v2 : **ne pas** réexporter ici.
 * `canonical-app-url` / `rappel-dette-email-content-v2` — construction serveur only.
 *
 * Orchestrateur d’envoi Lot 3 : **ne pas** réexporter ici — non branché actions/UI/cron.
 * Import : `@/lib/services/cotisations/rappel-dette/rappel-dette-orchestrate-send`
 *
 * Activation / garde legacy / resolve provider : **ne pas** réexporter ici.
 * `rappel-dette-activation` / `rappel-dette-legacy-guard` / `rappel-dette-provider-resolve`
 */
