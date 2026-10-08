/**
 * Factory pour créer le provider d'email approprié selon la configuration
 */

import type { EmailProvider, EmailProviderInterface, SMTPConfig } from "./types";
import { ResendProvider } from "./resend-provider";
import { SMTPProvider } from "./smtp-provider";
import { resolveSmtpAuth } from "./smtp-auth";

/**
 * Récupère le provider email depuis la base de données ou la variable d'environnement
 */
async function getProviderFromDB(): Promise<EmailProvider | null> {
  try {
    // Import dynamique pour éviter les erreurs de cycle
    const { getEmailProviderFromDB } = await import("@/actions/admin/settings");
    return await getEmailProviderFromDB();
  } catch (error) {
    console.error("Erreur lors de la récupération du provider depuis la DB:", error);
    return null;
  }
}

/**
 * Construit la configuration SMTP à partir de l'environnement.
 * HOST / PORT / FROM obligatoires ; auth optionnelle (les deux ou aucun).
 *
 * @param env - Source d'environnement (injectable pour tests)
 * @returns Configuration SMTP
 */
export function buildSmtpConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env
): SMTPConfig {
  const smtpHost = env.SMTP_HOST?.trim();
  const smtpPort = env.SMTP_PORT?.trim();
  const smtpFrom = env.SMTP_FROM?.trim();

  if (!smtpHost || !smtpPort || !smtpFrom) {
    throw new Error(
      "SMTP_HOST, SMTP_PORT et SMTP_FROM sont requis quand EMAIL_PROVIDER=smtp"
    );
  }

  const auth = resolveSmtpAuth(env.SMTP_USER, env.SMTP_PASS);
  const port = parseInt(smtpPort, 10);
  if (!Number.isFinite(port) || port <= 0) {
    throw new Error("SMTP_PORT invalide quand EMAIL_PROVIDER=smtp");
  }

  const config: SMTPConfig = {
    host: smtpHost,
    port,
    secure: smtpPort === "465",
    from: smtpFrom,
  };

  if (auth) {
    config.auth = auth;
  }

  return config;
}

/**
 * Crée le provider d'email selon la configuration de la base de données ou la variable d'environnement
 */
export async function createEmailProvider(): Promise<EmailProviderInterface> {
  // Essayer d'abord de récupérer depuis la base de données
  const dbProvider = await getProviderFromDB();
  const provider = (dbProvider || process.env.EMAIL_PROVIDER || "resend") as EmailProvider;

  switch (provider) {
    case "resend": {
      const apiKey = process.env.RESEND_API_KEY;
      if (!apiKey) {
        throw new Error("RESEND_API_KEY est requis quand EMAIL_PROVIDER=resend");
      }
      return new ResendProvider(apiKey);
    }

    case "smtp": {
      return new SMTPProvider(buildSmtpConfigFromEnv(process.env));
    }

    default:
      throw new Error(
        `Provider d'email non supporté: ${provider}. Valeurs possibles: resend, smtp`
      );
  }
}

// Instance singleton du provider
let emailProviderInstance: EmailProviderInterface | null = null;

/**
 * Obtient l'instance du provider d'email (singleton)
 * Note: Cette fonction est maintenant asynchrone car elle peut récupérer la config depuis la DB
 */
export async function getEmailProvider(): Promise<EmailProviderInterface> {
  if (!emailProviderInstance) {
    emailProviderInstance = await createEmailProvider();
  }
  return emailProviderInstance;
}

/**
 * Réinitialise le singleton (tests uniquement).
 */
export function __resetEmailProviderForTests(): void {
  emailProviderInstance = null;
}
