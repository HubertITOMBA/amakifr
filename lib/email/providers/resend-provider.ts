/**
 * Provider Resend pour l'envoi d'emails
 */

import { Resend } from "resend";
import type { EmailProviderInterface, EmailOptions } from "./types";

export class ResendProvider implements EmailProviderInterface {
  private resend: Resend;

  constructor(apiKey?: string) {
    if (!apiKey) {
      throw new Error("RESEND_API_KEY est requis pour utiliser le provider Resend");
    }
    this.resend = new Resend(apiKey);
  }

  async send(options: EmailOptions): Promise<{ success: boolean; error?: any }> {
    try {
      const { error } = await this.resend.emails.send({
        from: options.from,
        to: Array.isArray(options.to) ? options.to : [options.to],
        subject: options.subject,
        html: options.html,
        attachments: options.attachments?.map(att => ({
          filename: att.filename,
          content: att.content,
        })),
      });

      if (error) {
        console.error("RESEND_ERROR", error);
        return { success: false, error };
      }

      return { success: true };
    } catch (error) {
      console.error("RESEND_ERROR", error);
      return { success: false, error };
    }
  }
}

