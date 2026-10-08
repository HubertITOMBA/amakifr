/**
 * Contrôleur comportemental « mot de passe oublié » — testable hors RN.
 * État mémoire uniquement ; pas d’URL / storage / console sensible.
 */

import { ApiClientError } from "@/api/types";
import {
  INITIAL_PASSWORD_VISIBLE,
  nextPasswordVisible,
} from "@/features/auth/sign-in-model";
import {
  PASSWORD_RESET_CONFIRM_GENERIC_ERROR,
  PASSWORD_RESET_REQUEST_GENERIC_MESSAGE,
  PASSWORD_RESET_RESEND_HINT,
  PASSWORD_RESET_SUCCESS_LOGIN_BANNER,
  type PasswordResetStep,
  filterPasswordResetCodeDigits,
  isPlausiblePasswordResetEmail,
  mapPasswordResetApiError,
  nextStepAfterRequestAccepted,
  normalizePasswordResetEmail,
  passwordResetCooldownEndsAt,
  passwordResetCooldownRemaining,
  setPendingLoginBanner,
  stepOnHardwareBack,
  validatePasswordResetConfirmClient,
} from "@/features/auth/password-reset-model";

export type ForgotPasswordFlowState = {
  step: PasswordResetStep;
  email: string;
  code: string;
  password: string;
  confirmPassword: string;
  passwordVisible: boolean;
  confirmVisible: boolean;
  loading: boolean;
  /** Erreurs actionnables (validation locale, réseau). */
  error: string | null;
  /** Messages neutres anti-énumération (jamais en rouge). */
  info: string | null;
  cooldownEndsAt: number | null;
};

export type ForgotPasswordFlowApi = {
  request: (email: string) => Promise<{
    accepted: true;
    message: string;
    retryAfter: number;
  }>;
  confirm: (input: {
    email: string;
    code: string;
    password: string;
    confirmPassword: string;
  }) => Promise<{ success: true; message: string }>;
};

export type ForgotPasswordFlowNav = {
  replaceSignIn: () => void;
};

export type ForgotPasswordFlowOptions = {
  api: ForgotPasswordFlowApi;
  nav: ForgotPasswordFlowNav;
  /** Injecté pour tests (défaut : setPendingLoginBanner). */
  setPendingBanner?: (message: string) => void;
  now?: () => number;
};

const initialState = (): ForgotPasswordFlowState => ({
  step: "request",
  email: "",
  code: "",
  password: "",
  confirmPassword: "",
  passwordVisible: INITIAL_PASSWORD_VISIBLE,
  confirmVisible: INITIAL_PASSWORD_VISIBLE,
  loading: false,
  error: null,
  info: null,
  cooldownEndsAt: null,
});

/**
 * Crée le contrôleur de parcours (lock synchrone anti-double-clic inclus).
 */
export function createForgotPasswordFlow(options: ForgotPasswordFlowOptions) {
  const now = options.now ?? (() => Date.now());
  const setBanner = options.setPendingBanner ?? setPendingLoginBanner;

  let state = initialState();
  /** Verrou synchrone — indépendant du prochain render React. */
  let busy = false;
  const listeners = new Set<() => void>();

  function emit(): void {
    for (const l of listeners) l();
  }

  function patch(partial: Partial<ForgotPasswordFlowState>): void {
    state = { ...state, ...partial };
    emit();
  }

  function clearSensitiveFields(): void {
    patch({
      code: "",
      password: "",
      confirmPassword: "",
      passwordVisible: INITIAL_PASSWORD_VISIBLE,
      confirmVisible: INITIAL_PASSWORD_VISIBLE,
    });
  }

  function goToLogin(): void {
    clearSensitiveFields();
    patch({
      email: "",
      error: null,
      info: null,
      cooldownEndsAt: null,
      step: "request",
      loading: false,
    });
    options.nav.replaceSignIn();
  }

  function onBack(): void {
    const next = stepOnHardwareBack(state.step);
    if (next === "exit") {
      goToLogin();
      return;
    }
    clearSensitiveFields();
    patch({ error: null, info: null, step: next });
  }

  async function withBusyLock(fn: () => Promise<void>): Promise<boolean> {
    if (busy) return false;
    busy = true;
    patch({ loading: true });
    try {
      await fn();
      return true;
    } finally {
      busy = false;
      patch({ loading: false });
    }
  }

  /**
   * Demande ou renvoi de code.
   * @returns true si l’appel a été entrepris (pas ignoré par le lock / cooldown)
   */
  async function requestCode(isResend: boolean): Promise<boolean> {
    patch({ error: null });
    if (!isResend) {
      patch({ info: null });
    }

    const normalized = normalizePasswordResetEmail(state.email);
    if (!isPlausiblePasswordResetEmail(normalized)) {
      patch({ error: "Adresse e-mail invalide" });
      return false;
    }

    const remaining = passwordResetCooldownRemaining(
      state.cooldownEndsAt,
      now()
    );
    if (isResend && remaining > 0) {
      return false;
    }

    return withBusyLock(async () => {
      try {
        const result = await options.api.request(normalized);
        patch({
          email: normalized,
          cooldownEndsAt: passwordResetCooldownEndsAt(
            result.retryAfter,
            now()
          ),
          info: isResend
            ? `${PASSWORD_RESET_REQUEST_GENERIC_MESSAGE}\n${PASSWORD_RESET_RESEND_HINT}`
            : PASSWORD_RESET_REQUEST_GENERIC_MESSAGE,
          step: nextStepAfterRequestAccepted(),
          error: null,
          ...(isResend ? { code: "" } : {}),
        });
      } catch (e) {
        const mapped = mapPasswordResetApiError(e, "request");
        const isNetwork =
          e instanceof ApiClientError && e.code === "NETWORK_ERROR";
        const isValidation =
          e instanceof ApiClientError && e.code === "VALIDATION_ERROR";
        if (isNetwork || isValidation) {
          patch({ error: mapped, info: state.info });
        } else {
          // Indéterminé / anti-énumération → neutre, jamais rouge
          patch({
            error: null,
            info: PASSWORD_RESET_REQUEST_GENERIC_MESSAGE,
            step: nextStepAfterRequestAccepted(),
            email: normalized,
          });
        }
      }
    });
  }

  /**
   * Confirmation du nouveau mot de passe.
   */
  async function confirmReset(): Promise<boolean> {
    patch({ error: null });
    const clientErr = validatePasswordResetConfirmClient({
      email: state.email,
      code: state.code,
      password: state.password,
      confirmPassword: state.confirmPassword,
    });
    if (clientErr) {
      patch({ error: clientErr });
      return false;
    }

    const filteredCode = filterPasswordResetCodeDigits(state.code);

    return withBusyLock(async () => {
      try {
        await options.api.confirm({
          email: normalizePasswordResetEmail(state.email),
          code: filteredCode,
          password: state.password,
          confirmPassword: state.confirmPassword,
        });
        clearSensitiveFields();
        patch({
          email: "",
          info: null,
          error: null,
          cooldownEndsAt: null,
          step: "request",
        });
        setBanner(PASSWORD_RESET_SUCCESS_LOGIN_BANNER);
        options.nav.replaceSignIn();
      } catch (e) {
        if (e instanceof ApiClientError) {
          patch({ error: mapPasswordResetApiError(e, "confirm") });
        } else {
          patch({ error: PASSWORD_RESET_CONFIRM_GENERIC_ERROR });
        }
      }
    });
  }

  return {
    getState: (): ForgotPasswordFlowState => state,
    /** true si un appel API est en cours (lock synchrone). */
    isBusy: (): boolean => busy,
    subscribe: (listener: () => void): (() => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setEmail: (email: string) => patch({ email }),
    /** Filtre chiffres puis tronque à 8 — jamais troncature native avant filtre. */
    setCodeFromRaw: (raw: string) =>
      patch({ code: filterPasswordResetCodeDigits(raw) }),
    setPassword: (password: string) => patch({ password }),
    setConfirmPassword: (confirmPassword: string) =>
      patch({ confirmPassword }),
    togglePasswordVisible: () =>
      patch({ passwordVisible: nextPasswordVisible(state.passwordVisible) }),
    toggleConfirmVisible: () =>
      patch({ confirmVisible: nextPasswordVisible(state.confirmVisible) }),
    requestCode,
    confirmReset,
    onBack,
    goToLogin,
    /** Force un re-render abonnés (ex. tick cooldown UI). */
    tick: () => emit(),
    /** Exposé tests : reset total. */
    __resetForTests: () => {
      busy = false;
      state = initialState();
      emit();
    },
  };
}

export type ForgotPasswordFlow = ReturnType<typeof createForgotPasswordFlow>;

/**
 * Navigation Login → forgot (testable sans rendre Expo Router).
 */
export function navigateToForgotPassword(
  push: (href: string) => void,
  route: string
): void {
  push(route);
}
