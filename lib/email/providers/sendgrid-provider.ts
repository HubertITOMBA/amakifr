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
      
      // Extraire les détails de l'erreur SendGrid
      const errorDetails = {
        message: error.message,
        code: error.code,
        response: error.response ? {
          statusCode: error.response.statusCode,
          body: error.response.body,
          headers: error.response.headers
        } : undefined
      };
      
      // Logger les détails complets pour le débogage
      console.error("SENDGRID_ERROR_DETAILS", JSON.stringify(errorDetails, null, 2));
      
      // Si c'est une erreur 401 (Unauthorized), fournir un message plus explicite
      if (error.code === 401 || (error.response?.statusCode === 401)) {
        console.error("SENDGRID_AUTH_ERROR: La clé API SendGrid est invalide ou manquante. Vérifiez SENDGRID_API_KEY dans les variables d'environnement.");
      }
      
      return { 
        success: false, 
        error: errorDetails
      };
    }
  }
}

