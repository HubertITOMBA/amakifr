/**
 * Provider SendGrid pour l'envoi d'emails
 */

import sgMail from "@sendgrid/mail";
import type { EmailProviderInterface, EmailOptions, SendGridConfig } from "./types";

export class SendGridProvider implements EmailProviderInterface {
  private defaultFrom: string;

  constructor(config: SendGridConfig) {
    if (!config.apiKey) {
      throw new Error("SENDGRID_API_KEY est requis pour utiliser le provider SendGrid");
    }
    sgMail.setApiKey(config.apiKey);
    this.defaultFrom = config.from;
  }

  async send(options: EmailOptions): Promise<{ success: boolean; error?: any }> {
    try {
      const recipients = Array.isArray(options.to) ? options.to : [options.to];
      
      const messages = recipients.map(recipient => ({
        to: recipient,
        from: options.from || this.defaultFrom,
        subject: options.subject,
        html: options.html,
        attachments: options.attachments?.map(att => ({
          filename: att.filename,
          content: att.content,
          type: 'application/pdf',
          disposition: 'attachment',
        })),
      }));

      await sgMail.send(messages);

      return { success: true };
    } catch (error: any) {
      console.error("SENDGRID_ERROR", error);
      return { success: false, error: error.response?.body || error.message };
    }
  }
}

