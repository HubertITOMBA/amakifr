"use server"

import { db } from "@/lib/db"
import { normalizeEmail } from "@/lib/utils"

/**
 * Récupère un utilisateur par son email (recherche case-insensitive)
 * 
 * @param email - L'email de l'utilisateur (sera normalisé en minuscules)
 * @returns L'utilisateur trouvé ou null
 */
export const getUserByEmail = async (email: string) => {
    try {
        // Normaliser l'email en minuscules pour la recherche case-insensitive
        const normalizedEmail = normalizeEmail(email);
        
        // D'abord, essayer de trouver avec l'email normalisé (si la base est déjà normalisée)
        let user = await db.user.findUnique({
            where: {
                email: normalizedEmail
            }
        });

        // Si pas trouvé, essayer avec mode insensitive (pour les emails non normalisés en base)
        if (!user) {
            user = await db.user.findFirst({
                where: {
                    email: {
                        equals: normalizedEmail,
                        mode: 'insensitive'
                    }
                }
            });
        }

        // Dernier recours: chercher tous les utilisateurs et filtrer en mémoire
        // (pour gérer les cas où la base n'est pas encore normalisée)
        if (!user) {
            const allUsers = await db.user.findMany({
                where: {
                    email: {
                        not: null
                    }
                }
            });
            
            user = allUsers.find(u => u.email && normalizeEmail(u.email) === normalizedEmail) || null;
        }

        return user;
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