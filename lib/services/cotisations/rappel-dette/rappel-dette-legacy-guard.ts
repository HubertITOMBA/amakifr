/**
 * Garde des producteurs legacy de rappels / relances cotisations.
 * Lorsque l’envoi Lot 3 est **activé**, les canaux legacy doivent être
 * refusés **avant** toute mutation ou émission (anti double canal).
 *
 * Flag off (défaut) → legacy autorisé (comportement historique).
 */

import {
  isRappelDetteEnvoiEnabled,
} from "@/lib/services/cotisations/rappel-dette/rappel-dette-activation";

export const RAPPEL_DETTE_LEGACY_CHANNEL_DISABLED_CODE =
  "LEGACY_CHANNEL_DISABLED" as const;

export const RAPPEL_DETTE_LEGACY_CHANNEL_DISABLED_MESSAGE =
  "Canal de rappel legacy désactivé : l’envoi Lot 3 est activé sur ce serveur." as const;

export type LegacyRappelGuardResult =
  | { ok: true }
  | {
      ok: false;
      code: typeof RAPPEL_DETTE_LEGACY_CHANNEL_DISABLED_CODE;
      message: string;
      context: string;
    };

/**
 * Autorise ou refuse un producteur legacy selon le flag Lot 3.
 *
 * @param context - Identifiant borné du producteur (logs / tests)
 * @param testEnvoiEnabledOverride - Injection tests uniquement
 */
export function assertLegacyRappelChannelsAllowed(
  context: string,
  testEnvoiEnabledOverride?: boolean
): LegacyRappelGuardResult {
  if (!isRappelDetteEnvoiEnabled(testEnvoiEnabledOverride)) {
    return { ok: true };
  }
  return {
    ok: false,
    code: RAPPEL_DETTE_LEGACY_CHANNEL_DISABLED_CODE,
    message: RAPPEL_DETTE_LEGACY_CHANNEL_DISABLED_MESSAGE,
    context: String(context ?? "").trim() || "unknown",
  };
}
