/**
 * Résolution et validation de configuration fournisseur Lot 3.
 * **Aucun** appel réseau — lecture env / options injectées uniquement.
 */

export type RappelDetteProviderKind = "smtp" | "resend";

export type ResolveProviderEnv = {
  EMAIL_PROVIDER?: string | null;
  RESEND_API_KEY?: string | null;
  SMTP_HOST?: string | null;
  SMTP_PORT?: string | null;
  SMTP_FROM?: string | null;
  SMTP_USER?: string | null;
  SMTP_PASS?: string | null;
  EMAIL_FROM?: string | null;
};

export type ValidatedRappelDetteProvider = {
  kind: RappelDetteProviderKind;
  /** Adresse from validée (jamais un secret). */
  from: string;
};

export type ValidateProviderFailure = {
  ok: false;
  code: "PROVIDER_CONFIG_INVALID";
  message: string;
};

export type ValidateProviderSuccess = {
  ok: true;
  provider: ValidatedRappelDetteProvider;
};

export type ValidateProviderResult =
  | ValidateProviderSuccess
  | ValidateProviderFailure;

/**
 * Résout le kind fournisseur (défaut resend, aligné usine mail).
 *
 * @param env - Environnement injectable
 */
export function resolveRappelDetteProviderKind(
  env: ResolveProviderEnv = process.env as ResolveProviderEnv
): RappelDetteProviderKind | null {
  const raw = String(env.EMAIL_PROVIDER ?? "resend")
    .trim()
    .toLowerCase();
  if (raw === "smtp" || raw === "resend") return raw;
  return null;
}

/**
 * Valide la configuration du fournisseur **sans** ouvrir de socket / HTTP.
 *
 * @param env - Environnement injectable
 * @param forcedKind - Kind déjà figé (tests) ; sinon résolu depuis env
 */
export function validateRappelDetteProviderConfig(
  env: ResolveProviderEnv = process.env as ResolveProviderEnv,
  forcedKind?: RappelDetteProviderKind | null
): ValidateProviderResult {
  const kind = forcedKind ?? resolveRappelDetteProviderKind(env);
  if (!kind) {
    return {
      ok: false,
      code: "PROVIDER_CONFIG_INVALID",
      message: "Fournisseur email non supporté ou non configuré",
    };
  }

  if (kind === "resend") {
    const apiKey = String(env.RESEND_API_KEY ?? "").trim();
    if (!apiKey) {
      return {
        ok: false,
        code: "PROVIDER_CONFIG_INVALID",
        message: "Configuration Resend incomplète",
      };
    }
    const from = String(env.EMAIL_FROM ?? env.SMTP_FROM ?? "")
      .trim() || "noreply@amaki.fr";
    return { ok: true, provider: { kind: "resend", from } };
  }

  // smtp
  const host = String(env.SMTP_HOST ?? "").trim();
  const portRaw = String(env.SMTP_PORT ?? "").trim();
  const from = String(env.SMTP_FROM ?? "").trim();
  const port = Number(portRaw);
  if (!host || !from || !Number.isFinite(port) || port <= 0) {
    return {
      ok: false,
      code: "PROVIDER_CONFIG_INVALID",
      message: "Configuration SMTP incomplète",
    };
  }
  const user = String(env.SMTP_USER ?? "").trim();
  const pass = String(env.SMTP_PASS ?? "").trim();
  if ((user && !pass) || (!user && pass)) {
    return {
      ok: false,
      code: "PROVIDER_CONFIG_INVALID",
      message: "Configuration SMTP auth incohérente",
    };
  }
  return { ok: true, provider: { kind: "smtp", from } };
}
