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

  async send(options: EmailOptions): Promise<{ success: boolean; error?: unknown }> {
    try {
      const bcc = options.bcc
        ? (Array.isArray(options.bcc) ? options.bcc : [options.bcc]).filter(Boolean)
        : undefined;

      const { error } = await this.resend.emails.send({
        from: options.from,
        to: Array.isArray(options.to) ? options.to : [options.to],
        ...(bcc?.length ? { bcc } : {}),
        subject: options.subject,
        html: options.html,
        attachments: options.attachments?.map(att => ({
          filename: att.filename,
          content: att.content,
        })),
      });

      if (error) {
        // Catégorie bornée uniquement — jamais message/objet provider brut
        console.error("RESEND_ERROR", { category: "provider_error" });
        return { success: false, error };
      }

      return { success: true };
    } catch {
      console.error("RESEND_ERROR", { category: "exception" });
      return { success: false, error: { category: "exception" } };
    }
  }
}
