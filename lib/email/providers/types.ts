/**
 * Types et interfaces pour les providers d'email
 */

export type EmailProvider = "resend" | "smtp";

export interface EmailOptions {
  from: string;
  to: string | string[];
  /** Destinataires en copie cachée (non visibles pour les autres destinataires) */
  bcc?: string | string[];
  subject: string;
  html: string;
  attachments?: Array<{
    filename: string;
    content: string; // Base64
  }>;
}

export interface EmailProviderInterface {
  send(options: EmailOptions): Promise<{ success: boolean; error?: unknown }>;
}

/**
 * Configuration SMTP.
 * `auth` omis = transport sans authentification (sink local / Mailpit).
 */
export interface SMTPConfig {
  host: string;
  port: number;
  secure: boolean; // true pour 465, false pour autres ports
  /** Absent lorsque SMTP_USER et SMTP_PASS sont tous deux vides. */
  auth?: {
    user: string;
    pass: string;
  };
  from: string; // Email de l'expéditeur
}
