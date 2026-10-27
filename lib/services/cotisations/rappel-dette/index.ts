/**
 * Lot R1.1 — Calcul d’éligibilité aux rappels cotisations/dettes.
 * Lecture seule : aucun envoi, aucune mutation.
 */

export {
  computeDetteRappelable,
} from "@/lib/services/cotisations/rappel-dette/compute-dette-rappelable";

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
