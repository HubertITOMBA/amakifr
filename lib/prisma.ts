import { PrismaClient } from '@prisma/client'

const prismaClientSingleton = () => {
  return new PrismaClient()
}

declare const globalThis: {
  prismaGlobal: ReturnType<typeof prismaClientSingleton>;
} & typeof global;

// Fonction pour créer ou récupérer le client Prisma
function getPrismaClient(): PrismaClient {
  // En développement, vérifier que le client existant a le modèle appSettings
  if (globalThis.prismaGlobal) {
    if (!('appSettings' in globalThis.prismaGlobal)) {
      console.warn('⚠️ Client Prisma obsolète détecté dans lib/prisma.ts, recréation...');
      // Déconnecter l'ancien client
      globalThis.prismaGlobal.$disconnect().catch(() => {});
      globalThis.prismaGlobal = undefined as any;
    } else {
      return globalThis.prismaGlobal;
    }
  }
  
  // Créer un nouveau client
  const client = prismaClientSingleton();
  
  if (process.env.NODE_ENV !== 'production') {
    globalThis.prismaGlobal = client;
  }
  
  return client;
}

const prisma = getPrismaClient()

export default prisma