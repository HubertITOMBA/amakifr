"use server";

import { ResetSchema } from "@/schemas";
import * as z from "zod";
import { error } from "console";
import { getUserByEmail, getUserById } from ".";
import { generatePasswordResetToken } from "@/lib/token";
import { sendPasswordResetToken } from "@/lib/mail";
import { headers } from "next/headers";
import { normalizeEmail } from "@/lib/utils";


export const reset = async(
    values: z.infer<typeof ResetSchema>,
) => {

    const validatedFields = ResetSchema.safeParse(values);

    if(!validatedFields.success) {
        return { error: "Champs invalides !" }
    }

    const { email } = validatedFields.data;

    // Normaliser l'email pour la recherche case-insensitive
    const normalizedEmail = normalizeEmail(email);

    const existingUser = await getUserByEmail(normalizedEmail)

    if(!existingUser){
        return { error: "Email non trouvé !"}
    }

    const passwordResetToken = await generatePasswordResetToken(normalizedEmail)

    try {
      // Prioriser NEXT_PUBLIC_APP_URL pour les liens dans les emails (plus fiable en production)
      // Utiliser les headers seulement en fallback pour le développement
      let baseUrl: string | undefined = process.env.NEXT_PUBLIC_APP_URL;
      
      // Si NEXT_PUBLIC_APP_URL n'est pas défini, construire depuis les headers
      if (!baseUrl) {
        const headersList = await headers();
        const host = headersList.get('host');
        const protocol = headersList.get('x-forwarded-proto') || 
                        (headersList.get('x-forwarded-ssl') === 'on' ? 'https' : 'http');
        
        if (host) {
          // Retirer le port si c'est un port standard (80 pour HTTP, 443 pour HTTPS)
          const hostWithoutPort = host.split(':')[0];
          const port = host.includes(':') ? host.split(':')[1] : null;
          
          // Ne pas inclure le port si c'est un port standard
          if (port && port !== '80' && port !== '443') {
            baseUrl = `${protocol}://${host}`;
          } else {
            // Pour HTTPS, ne pas inclure le port 443 (standard)
            // Pour HTTP, ne pas inclure le port 80 (standard)
            baseUrl = protocol === 'https' ? `https://${hostWithoutPort}` : `http://${hostWithoutPort}`;
          }
        }
      }
      
      // Nettoyer l'URL : retirer le port 9050 si présent (non standard pour HTTPS)
      if (baseUrl && baseUrl.includes(':9050')) {
        baseUrl = baseUrl.replace(':9050', '');
        // S'assurer que c'est HTTPS en production
        if (baseUrl.startsWith('http://') && process.env.NODE_ENV === 'production') {
          baseUrl = baseUrl.replace('http://', 'https://');
        }
      }

      await sendPasswordResetToken(
        passwordResetToken.email,
        passwordResetToken.token,
        baseUrl
      );
      return { success: "L'e-mail de Réinitialisation est envoyé !" };
    } catch (error: any) {
      console.error("Erreur lors de l'envoi de l'email de réinitialisation:", error);
      // Ne pas révéler l'erreur à l'utilisateur pour des raisons de sécurité
      // Mais logger l'erreur pour le débogage
      return { 
        error: "Une erreur est survenue lors de l'envoi de l'email. Veuillez réessayer plus tard ou contacter l'administrateur." 
      };
    }

}