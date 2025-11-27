/**
 * Types et interfaces pour les providers d'email
 */

export type EmailProvider = 'resend' | 'smtp' | 'sendgrid';

export interface EmailOptions {
  from: string;
  to: string | string[];
  subject: string;
  html: string;
  attachments?: Array<{
    filename: string;
    content: string; // Base64
  }>;
}

export interface EmailProviderInterface {
  send(options: EmailOptions): Promise<{ success: boolean; error?: any }>;
}

export interface SMTPConfig {
  host: string;
  port: number;
  secure: boolean; // true pour 465, false pour autres ports
  auth: {
    user: string;
    pass: string;
  };
  from: string; // Email de l'expéditeur
}

export interface SendGridConfig {
  apiKey: string;
  from: string; // Email de l'expéditeur
}

