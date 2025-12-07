/**
 * Factory pour créer le provider d'email approprié selon la configuration
 */

import type { EmailProvider, EmailProviderInterface, SMTPConfig } from "./types";
import { ResendProvider } from "./resend-provider";
import { SMTPProvider } from "./smtp-provider";

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
 * Crée le provider d'email selon la configuration de la base de données ou la variable d'environnement
 */
export async function createEmailProvider(): Promise<EmailProviderInterface> {
  // Essayer d'abord de récupérer depuis la base de données
  const dbProvider = await getProviderFromDB();
  const provider = (dbProvider || process.env.EMAIL_PROVIDER || 'resend') as EmailProvider;

  switch (provider) {
    case 'resend': {
      const apiKey = process.env.RESEND_API_KEY;
      if (!apiKey) {
        throw new Error("RESEND_API_KEY est requis quand EMAIL_PROVIDER=resend");
      }
      return new ResendProvider(apiKey);
    }

    case 'smtp': {
      const smtpHost = process.env.SMTP_HOST;
      const smtpPort = process.env.SMTP_PORT;
      const smtpUser = process.env.SMTP_USER;
      const smtpPassword = process.env.SMTP_PASS;
      const smtpFrom = process.env.SMTP_FROM;

      if (!smtpHost || !smtpPort || !smtpUser || !smtpPassword || !smtpFrom) {
        throw new Error("SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS et SMTP_FROM sont requis quand EMAIL_PROVIDER=smtp");
      }

      const config: SMTPConfig = {
        host: smtpHost,
        port: parseInt(smtpPort, 10),
        secure: smtpPort === '465', // Port 465 = SSL, autres = STARTTLS
        auth: {
          user: smtpUser,
          pass: smtpPassword,
        },
        from: smtpFrom,
      };

      return new SMTPProvider(config);
    }

    default:
      throw new Error(`Provider d'email non supporté: ${provider}. Valeurs possibles: resend, smtp`);
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

