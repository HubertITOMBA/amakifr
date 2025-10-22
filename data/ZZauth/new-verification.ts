"use server"

import * as z from 'zod'
import { db } from '@/lib/db'
import { TwoFactorSchema } from '@/schemas'
import { getUserByEmail, getVerificationTokenByToken } from '.'


export const newVerification = async (values: z.infer<typeof TwoFactorSchema>) => {

    const existingToken = await getVerificationTokenByToken(values.code)

    if( !existingToken) return { error: "Le jeton n'existe pas !"}


    const hasExpired = new Date()  > new Date(existingToken.expires)

    if (hasExpired) return { error: "Le jeton a expiré !" }

    const existingUser = await getUserByEmail(existingToken.email)

    if(!existingUser) return { error: "L'email n'existe pas !" }

        await db.user.update({
            where: {
                email: existingToken.email
            },
            data: {
                emailVerified: new Date()
            }
    })

    await db.verificationToken.delete({
        where: {
            id: existingToken.id
        }
    })

    return { success: "Email vérifié !"}
}