import { PrismaClient } from "@prisma/client";


declare global {
    var prisma: PrismaClient | undefined;
}

// Fonction pour créer ou récupérer le client Prisma
function getPrismaClient(): PrismaClient {
    // En développement, vérifier que le client existant a le modèle appSettings
    if (globalThis.prisma) {
        if (!('appSettings' in globalThis.prisma)) {
            console.warn('⚠️ Client Prisma obsolète détecté, recréation...');
            // Déconnecter l'ancien client
            globalThis.prisma.$disconnect().catch(() => {});
            globalThis.prisma = undefined;
        } else {
            return globalThis.prisma;
        }
    }
    
    // Créer un nouveau client
    const client = new PrismaClient();
    
    if (process.env.NODE_ENV !== "production") {
        globalThis.prisma = client;
    }
    
    return client;
}

export const db = getPrismaClient();