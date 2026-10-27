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
} from "@/lib/services/cotisations/rappel-dette/types";
