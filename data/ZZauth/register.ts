"use server"

import { RegisterSchema } from "@/schemas"
import * as z from 'zod'
import bcrypt from "bcryptjs"
import { db } from "@/lib/db"
import { getUserByEmail } from "."
import { sendTwoFactorTokenEmail } from "@/lib/mail"
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

    await db.adherent.create({
        data: {
            User: {
                connect: {
                    id: user.id
                }
            },
        }  
    })

   
    const verificationToken = await generateVerificationToken(email)
    await sendTwoFactorTokenEmail(
        verificationToken.email,
        verificationToken.token,
    )

    return { success: "Code OTP envoyé !", twoFactor: true }
} 