"use server"

import { db } from "@/lib/db"



export const getUserByEmail = async (email: string) => {
    try {
        const user = await db.user.findUnique({
            where: {
                email
            }
        })

        return user
    } catch (error) {
        return null
    }
}

/**
 * Récupère un utilisateur par son nom
 * 
 * @param name - Le nom de l'utilisateur
 * @returns L'utilisateur trouvé ou null
 */
export const getUserByName = async (name: string | null | undefined) => {
    try {
        if (!name) {
            return null;
        }
        
        const user = await db.user.findUnique({
            where: {
                name
            }
        })

        return user
    } catch (error) {
        return null
    }
}


export const getUserById = async(id: string) => {
    try {
        const user = await db.user.findUnique({
            where: {
                id
            }
        })

        return user
    } catch (error) {
        return null
    }
}




export const getVerificationTokenByEmail = async (email: string) => {
    try {
        const verificationToken = await db.verificationToken.findFirst({
            where: {
                email
            }
        })

        return verificationToken
    } catch (error) {
        return null
    }
}

export const getVerificationTokenByToken = async (token: string) => {
    try {
        const verificationToken = await db.verificationToken.findUnique({
            where: {
                token
            }
        })

        return verificationToken
    } catch (error) {
        return null
    }
}


export const getPasswordResetTokenByEmail = async (email: string) => {

    try {
        const passwordResetToken = await db.passwordResetToken.findFirst({
            where: {
                email
            }
        })
        return passwordResetToken
    } catch (error) {
        return null
    }
}

export const getPasswordResetTokenByToken = async (token: string) => {
    try {
        const passwordResetToken = await db.passwordResetToken.findUnique({
            where: {
                token
            }
        })

        return passwordResetToken
    } catch (error) {
        return null
    }
}