/**
 * Modèle « mot de passe oublié » mobile — testable hors RN.
 * Aucun secret persisté ; email/code/MDP restent en mémoire d’écran uniquement.
 */

/** Étapes du parcours (une seule route Expo). */
export type PasswordResetStep = "request" | "confirm";

/** Longueur exacte du code challenge. */
export const PASSWORD_RESET_CODE_DIGITS = 8;

/** Aligné sur le serveur (trop faible — dette séparée). */
export const PASSWORD_RESET_PASSWORD_MIN_LENGTH = 6;

/** Message public anti-énumération (identique serveur). */
export const PASSWORD_RESET_REQUEST_GENERIC_MESSAGE =
  "Si un compte correspond à cette adresse, un code de réinitialisation sera envoyé.";

/** Helper champ code. */
export const PASSWORD_RESET_CODE_HELPER =
  "Saisissez les 8 chiffres reçus par e-mail.";

/** Après renvoi accepté — sans révéler l’existence du compte. */
export const PASSWORD_RESET_RESEND_HINT =
  "Si un nouveau code est envoyé, l’ancien peut ne plus être valable.";

/** Erreur générique confirmation (code invalide/expiré/verrouillé). */
export const PASSWORD_RESET_CONFIRM_GENERIC_ERROR =
  "Réinitialisation impossible. Vérifiez les informations ou demandez un nouveau code.";

/** Bannière LoginPage après succès (mémoire volatile, pas d’URL). */
export const PASSWORD_RESET_SUCCESS_LOGIN_BANNER =
  "Mot de passe réinitialisé. Vous pouvez vous connecter.";

/** Titre écran. */
export const PASSWORD_RESET_SCREEN_TITLE = "Mot de passe oublié";

/** Aide étape demande. */
export const PASSWORD_RESET_REQUEST_HELP =
  "Saisissez l’adresse e-mail utilisée pour votre compte.";

/** Libellé action retour édition adresse (étape confirm). */
export const PASSWORD_RESET_EDIT_ADDRESS_LABEL = "Modifier l’adresse";

/**
 * Normalise un e-mail côté client (trim + minuscules) — cohérent serveur.
 */
export function normalizePasswordResetEmail(
  email: string | null | undefined
): string {
  if (!email) return "";
  return email.trim().toLowerCase();
}

/**
 * Filtre une saisie/collage en chiffres uniquement, tronque à 8.
 * Ex. `12 a34-5678` → `12345678` ; lettres seules → `` ; trop long → 8 premiers.
 */
export function filterPasswordResetCodeDigits(raw: string): string {
  const digits = String(raw ?? "").replace(/\D/g, "");
  return digits.slice(0, PASSWORD_RESET_CODE_DIGITS);
}

/**
 * E-mail plausible pour validation client (serveur = autorité).
 */
export function isPlausiblePasswordResetEmail(email: string): boolean {
  const n = normalizePasswordResetEmail(email);
  return n.length > 3 && n.includes("@") && !n.includes(" ");
}

/**
 * Preview de l’adresse réellement utilisée (contrôleur uniquement).
 * Null si l’email local n’est pas syntaxiquement plausible.
 */
export function passwordResetEmailPreview(
  email: string | null | undefined
): string | null {
  const n = normalizePasswordResetEmail(email);
  return isPlausiblePasswordResetEmail(n) ? n : null;
}

/**
 * Ligne accessible affichant l’adresse qui sera / a été envoyée.
 */
export function passwordResetUsedAddressLine(normalizedEmail: string): string {
  return `Adresse utilisée : ${normalizedEmail}`;
}

/**
 * Validation client du formulaire de confirmation.
 * @returns message d’erreur FR ou null si OK
 */
export function validatePasswordResetConfirmClient(input: {
  email: string;
  code: string;
  password: string;
  confirmPassword: string;
}): string | null {
  if (!isPlausiblePasswordResetEmail(input.email)) {
    return "Adresse e-mail invalide";
  }
  const code = filterPasswordResetCodeDigits(input.code);
  if (code.length !== PASSWORD_RESET_CODE_DIGITS) {
    return "Le code doit contenir exactement 8 chiffres";
  }
  if (input.password.length < PASSWORD_RESET_PASSWORD_MIN_LENGTH) {
    return `Le mot de passe doit contenir au moins ${PASSWORD_RESET_PASSWORD_MIN_LENGTH} caractères`;
  }
  if (input.password !== input.confirmPassword) {
    return "Les mots de passe ne correspondent pas";
  }
  return null;
}

/**
 * Cooldown renvoi : secondes restantes à l’instant `nowMs`.
 */
export function passwordResetCooldownRemaining(
  cooldownEndsAtMs: number | null,
  nowMs: number
): number {
  if (cooldownEndsAtMs == null) return 0;
  return Math.max(0, Math.ceil((cooldownEndsAtMs - nowMs) / 1000));
}

/**
 * Calcule la fin de cooldown à partir de `retryAfter` (secondes serveur).
 */
export function passwordResetCooldownEndsAt(
  retryAfterSeconds: number,
  nowMs: number
): number {
  const sec = Math.max(0, Math.ceil(Number(retryAfterSeconds) || 0));
  return nowMs + sec * 1000;
}

/**
 * Libellé bouton renvoi (désactivé pendant cooldown).
 */
export function passwordResetResendLabel(remainingSeconds: number): string {
  if (remainingSeconds > 0) {
    return `Renvoyer le code (${remainingSeconds}s)`;
  }
  return "Renvoyer le code";
}

/**
 * Transition après demande acceptée.
 */
export function nextStepAfterRequestAccepted(): PasswordResetStep {
  return "confirm";
}

/**
 * Retour matériel Android depuis confirm → demande (pas de persistance).
 */
export function stepOnHardwareBack(step: PasswordResetStep): PasswordResetStep | "exit" {
  if (step === "confirm") return "request";
  return "exit";
}

/**
 * Mappe une erreur API/réseau vers un message UI sûr (pas de PII).
 */
export function mapPasswordResetApiError(
  error: unknown,
  context: "request" | "confirm"
): string {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    "message" in error
  ) {
    const code = String((error as { code: unknown }).code);
    const message = String((error as { message: unknown }).message ?? "");
    if (code === "NETWORK_ERROR") {
      return "Serveur injoignable. Vérifiez votre connexion.";
    }
    if (code === "VALIDATION_ERROR" && message.trim()) {
      // Messages Zod FR déjà sûrs (pas d’email/code)
      return message;
    }
    if (context === "confirm") {
      return PASSWORD_RESET_CONFIRM_GENERIC_ERROR;
    }
    // Request : rester générique (anti-énumération) même sur erreur métier
    return PASSWORD_RESET_REQUEST_GENERIC_MESSAGE;
  }
  if (context === "confirm") {
    return PASSWORD_RESET_CONFIRM_GENERIC_ERROR;
  }
  return "Une erreur s’est produite. Réessayez.";
}

/** Pont mémoire volatile LoginPage — jamais persisté. */
let pendingLoginBanner: string | null = null;

/**
 * Enregistre une bannière à consommer sur LoginPage (succès reset).
 */
export function setPendingLoginBanner(message: string): void {
  pendingLoginBanner = message;
}

/**
 * Lit et efface la bannière LoginPage (une seule fois).
 */
export function consumePendingLoginBanner(): string | null {
  const m = pendingLoginBanner;
  pendingLoginBanner = null;
  return m;
}

/** Reset tests uniquement. */
export function __resetPendingLoginBannerForTests(): void {
  pendingLoginBanner = null;
}
