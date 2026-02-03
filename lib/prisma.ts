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
    // Invalider le cache si le client n'a pas les modèles attendus (après migration / prisma generate)
    const hasExpectedModels = 'appSettings' in globalThis.prismaGlobal && 'passAssistance' in globalThis.prismaGlobal;
    if (!hasExpectedModels) {
      console.warn('⚠️ Client Prisma obsolète détecté dans lib/prisma.ts, recréation...');
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