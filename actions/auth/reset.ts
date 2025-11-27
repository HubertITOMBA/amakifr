"use server";

import { ResetSchema } from "@/schemas";
import * as z from "zod";
import { error } from "console";
import { getUserByEmail, getUserById } from ".";
import { generatePasswordResetToken } from "@/lib/token";
import { sendPasswordResetToken } from "@/lib/mail";
import { headers } from "next/headers";


export const reset = async(
    values: z.infer<typeof ResetSchema>,
) => {

    const validatedFields = ResetSchema.safeParse(values);

    if(!validatedFields.success) {
        return { error: "Champs invalides !" }
    }

    const { email } = validatedFields.data;

    const existingUser = await getUserByEmail(email)

    if(!existingUser){
        return { error: "Email non trouvé !"}
    }

    const passwordResetToken = await generatePasswordResetToken(email)

    try {
      // Obtenir l'URL de base depuis les headers de la requête
      const headersList = await headers();
      const host = headersList.get('host');
      const protocol = headersList.get('x-forwarded-proto') || 
                      (headersList.get('x-forwarded-ssl') === 'on' ? 'https' : 'http');
      
      // Construire l'URL de base
      let baseUrl: string | undefined;
      if (host) {
        baseUrl = `${protocol}://${host}`;
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