import { PrismaClient } from "@prisma/client";


declare global {
    var prisma: PrismaClient | undefined;
}

// Fonction pour créer ou récupérer le client Prisma
function getPrismaClient(): PrismaClient {
    // Vérifier si un client existe déjà
    if (globalThis.prisma) {
        // En développement, vérifier que le client existant a le modèle appSettings
        if (process.env.NODE_ENV !== "production" && !('appSettings' in globalThis.prisma)) {
            console.warn('⚠️ Client Prisma obsolète détecté, recréation...');
            // Déconnecter l'ancien client
            globalThis.prisma.$disconnect().catch(() => {});
            globalThis.prisma = undefined;
        } else {
            return globalThis.prisma;
        }
    }
    
    // Créer un nouveau client
    console.log(`🔌 Création d'un nouveau client Prisma (${process.env.NODE_ENV})`);
    const client = new PrismaClient({
        log: process.env.NODE_ENV === "production" ? ['error'] : ['query', 'error', 'warn'],
    });
    
    // Mettre en cache le client (en dev ET en production)
    globalThis.prisma = client;
    
    return client;
}

export const db = getPrismaClient();