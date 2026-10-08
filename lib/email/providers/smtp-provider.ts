/**
 * Provider SMTP pour l'envoi d'emails (Gmail, Outlook, sink local Mailpit, etc.)
 */

import nodemailer from "nodemailer";
import type { EmailProviderInterface, EmailOptions, SMTPConfig } from "./types";

/**
 * Options Nodemailer dérivées de {@link SMTPConfig}.
 * Si `auth` est absent de la config, la propriété `auth` n'est pas définie
 * sur l'objet transport (Mailpit / SMTP local sans authentification).
 */
export type NodemailerSmtpTransportOptions = {
  host: string;
  port: number;
  secure: boolean;
  auth?: {
    user: string;
    pass: string;
  };
};

/**
 * Construit les options de transport Nodemailer sans jamais forcer `auth: undefined`
 * (propriété absente si pas d'auth).
 *
 * @param config - Configuration SMTP applicative
 * @returns Options passées à `nodemailer.createTransport`
 */
export function buildNodemailerTransportOptions(
  config: SMTPConfig
): NodemailerSmtpTransportOptions {
  const options: NodemailerSmtpTransportOptions = {
    host: config.host,
    port: config.port,
    secure: config.secure,
  };

  if (config.auth) {
    options.auth = {
      user: config.auth.user,
      pass: config.auth.pass,
    };
  }

  return options;
}

export class SMTPProvider implements EmailProviderInterface {
  private transporter: nodemailer.Transporter;
  private defaultFrom: string;

  /**
   * @param config - Configuration SMTP (auth optionnelle)
   */
  constructor(config: SMTPConfig) {
    this.defaultFrom = config.from;
    this.transporter = nodemailer.createTransport(
      buildNodemailerTransportOptions(config)
    );
  }

  /**
   * Envoie un email via SMTP.
   * Les erreurs sont journalisées de façon catégorielle (pas de destinataire / secret).
   *
   * @param options - Contenu et destinataires
   */
  async send(
    options: EmailOptions
  ): Promise<{ success: boolean; error?: unknown }> {
    try {
      const recipients = Array.isArray(options.to) ? options.to : [options.to];

      const bccList = options.bcc
        ? (Array.isArray(options.bcc) ? options.bcc : [options.bcc]).filter(
            Boolean
          )
        : undefined;

      for (const recipient of recipients) {
        await this.transporter.sendMail({
          from: options.from || this.defaultFrom,
          to: recipient,
          ...(bccList?.length ? { bcc: bccList } : {}),
          subject: options.subject,
          html: options.html,
          attachments: options.attachments?.map((att) => ({
            filename: att.filename,
            content: Buffer.from(att.content, "base64"),
          })),
        });
      }

      return { success: true };
    } catch {
      console.error("SMTP_ERROR", { category: "transport_error" });
      return { success: false, error: { category: "transport_error" } };
    }
  }
}
