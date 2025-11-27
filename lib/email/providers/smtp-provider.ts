/**
 * Provider SMTP pour l'envoi d'emails (Gmail, Outlook, etc.)
 */

import nodemailer from "nodemailer";
import type { EmailProviderInterface, EmailOptions, SMTPConfig } from "./types";

export class SMTPProvider implements EmailProviderInterface {
  private transporter: nodemailer.Transporter;
  private defaultFrom: string;

  constructor(config: SMTPConfig) {
    this.defaultFrom = config.from;
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure, // true pour 465, false pour autres ports
      auth: {
        user: config.auth.user,
        pass: config.auth.pass,
      },
    });
  }

  async send(options: EmailOptions): Promise<{ success: boolean; error?: any }> {
    try {
      const recipients = Array.isArray(options.to) ? options.to : [options.to];
      
      for (const recipient of recipients) {
        await this.transporter.sendMail({
          from: options.from || this.defaultFrom,
          to: recipient,
          subject: options.subject,
          html: options.html,
          attachments: options.attachments?.map(att => ({
            filename: att.filename,
            content: Buffer.from(att.content, 'base64'),
          })),
        });
      }

      return { success: true };
    } catch (error) {
      console.error("SMTP_ERROR", error);
      return { success: false, error };
    }
  }
}

