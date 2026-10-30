/**
 * Construction serveur du transport Lot 3 sélectionné.
 *
 * - Valide la config (env) sans réseau.
 * - Construit **uniquement** le transport du kind sélectionné.
 * - Aucun `verify()`, connexion, ni appel HTTP/SMTP à la construction.
 *
 * Module serveur — **ne pas** réexporter via le barrel public.
 */

import nodemailer from "nodemailer";
import { Resend } from "resend";
import { buildNodemailerTransportOptions } from "@/lib/email/providers/smtp-provider";
import type {
  ResendTransport,
  SmtpTransport,
} from "@/lib/services/cotisations/rappel-dette/rappel-dette-email-provider-adapter";
import {
  validateRappelDetteProviderConfig,
  type ResolveProviderEnv,
  type ValidatedRappelDetteProvider,
} from "@/lib/services/cotisations/rappel-dette/rappel-dette-provider-resolve";

export type BuildSelectedServerTransportSuccess = {
  ok: true;
  provider: ValidatedRappelDetteProvider;
  smtpTransport?: SmtpTransport;
  resendTransport?: ResendTransport;
};

export type BuildSelectedServerTransportFailure = {
  ok: false;
  code: "PROVIDER_CONFIG_INVALID" | "TRANSPORT_BUILD_FAILED";
  message: string;
};

export type BuildSelectedServerTransportResult =
  | BuildSelectedServerTransportSuccess
  | BuildSelectedServerTransportFailure;

export type BuildSelectedServerTransportDeps = {
  /**
   * Factories **tests** — ne doivent pas ouvrir de socket.
   * Production : nodemailer.createTransport / new Resend.
   */
  createSmtpTransport?: (options: {
    host: string;
    port: number;
    secure: boolean;
    auth?: { user: string; pass: string };
  }) => SmtpTransport;
  createResendTransport?: (apiKey: string) => ResendTransport;
};

/**
 * Construit le transport du fournisseur sélectionné (sans réseau).
 *
 * @param env - Environnement injectable (défaut `process.env`)
 * @param deps - Factories optionnelles (tests)
 */
export function buildSelectedRappelDetteServerTransport(
  env: ResolveProviderEnv = process.env as ResolveProviderEnv,
  deps: BuildSelectedServerTransportDeps = {}
): BuildSelectedServerTransportResult {
  const validated = validateRappelDetteProviderConfig(env);
  if (!validated.ok) {
    return {
      ok: false,
      code: validated.code,
      message: validated.message,
    };
  }

  const provider = validated.provider;

  try {
    if (provider.kind === "smtp") {
      const host = String(env.SMTP_HOST ?? "").trim();
      const port = Number(String(env.SMTP_PORT ?? "").trim());
      const user = String(env.SMTP_USER ?? "").trim();
      const pass = String(env.SMTP_PASS ?? "").trim();
      const secure = port === 465;

      const options = buildNodemailerTransportOptions({
        host,
        port,
        secure,
        from: provider.from,
        ...(user && pass ? { auth: { user, pass } } : {}),
      });

      const create =
        deps.createSmtpTransport ??
        ((opts) =>
          nodemailer.createTransport(opts) as unknown as SmtpTransport);

      const smtpTransport = create(options);

      // Garde : pas de verify/connexion ici (contrat).
      if (
        smtpTransport &&
        typeof (smtpTransport as { verify?: unknown }).verify === "function"
      ) {
        // Ne pas appeler verify — présence OK.
      }

      if (!smtpTransport || typeof smtpTransport.sendMail !== "function") {
        return {
          ok: false,
          code: "TRANSPORT_BUILD_FAILED",
          message: "Transport SMTP serveur non constructible",
        };
      }

      return { ok: true, provider, smtpTransport };
    }

    const apiKey = String(env.RESEND_API_KEY ?? "").trim();
    if (!apiKey) {
      return {
        ok: false,
        code: "PROVIDER_CONFIG_INVALID",
        message: "Configuration Resend incomplète",
      };
    }

    const createResend =
      deps.createResendTransport ??
      ((key: string) => {
        const client = new Resend(key);
        return {
          emails: {
            send: client.emails.send.bind(client.emails),
          },
        } satisfies ResendTransport;
      });

    const resendTransport = createResend(apiKey);
    if (
      !resendTransport?.emails ||
      typeof resendTransport.emails.send !== "function"
    ) {
      return {
        ok: false,
        code: "TRANSPORT_BUILD_FAILED",
        message: "Transport Resend serveur non constructible",
      };
    }

    return { ok: true, provider, resendTransport };
  } catch {
    return {
      ok: false,
      code: "TRANSPORT_BUILD_FAILED",
      message: "Échec de construction du transport serveur",
    };
  }
}
