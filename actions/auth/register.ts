"use server"

import { RegisterSchema } from "@/schemas"
import * as z from 'zod'
import bcrypt from "bcryptjs"
import { db } from "@/lib/db"
import { getUserByEmail } from "."
import { sendTwoFactorTokenEmail, sendNewUserNotificationEmail, sendUserRegistrationThankYouEmail } from "@/lib/mail"
import { generateVerificationToken } from "@/lib/token"


export const register = async (
    values: z.infer<typeof RegisterSchema>
) => {
    const validatedFields = RegisterSchema.safeParse(values)

    if(!validatedFields.success) {
        return { error: "Informations de connexion invalides !" }
    }

    const { email, password, name } = validatedFields.data
    const hashPassword = await bcrypt.hash(password, 10)

    const existingUser = await getUserByEmail(email)
    if (existingUser) {
        return { error : "Cet email est déjà utilisé !"}
    }

    const user = await db.user.create({
        data: {
            name,
            email,
            password: hashPassword
        }
    })

    // await db.adherent.create({
    //     data: {
    //         User: {
    //             connect: {
    //                 id: user.id
    //             }
    //         },
    //     }  
    // })

    // Envoyer les emails de notification et de remerciement
    try {
        // Email aux administrateurs
        await sendNewUserNotificationEmail(email, name);
        
        // Email de remerciement à l'utilisateur
        await sendUserRegistrationThankYouEmail(email, name);
    } catch (error) {
        console.error("Erreur lors de l'envoi des emails:", error);
        // Ne pas bloquer l'inscription si l'envoi d'email échoue
    }
   
    const verificationToken = await generateVerificationToken(email)
    await sendTwoFactorTokenEmail(
        verificationToken.email,
        verificationToken.token,
    )

    return { success: "Code OTP envoyé !", twoFactor: true }
} 