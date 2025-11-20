/**
 * Helpers pour gérer les erreurs Prisma courantes en production
 * Ces fonctions permettent de gérer gracieusement l'absence de tables ou colonnes
 */

/**
 * Helper pour gérer l'absence de table dans Prisma (code P2021)
 * Retourne une valeur par défaut si la table n'existe pas
 */
export async function safePrismaQuery<T>(
  query: () => Promise<T>,
  defaultValue: T
): Promise<T> {
  try {
    return await query();
  } catch (error: any) {
    // Si la table n'existe pas (code P2021 pour Prisma)
    if (error?.code === 'P2021') {
      console.warn(`Table manquante (P2021), utilisation de la valeur par défaut:`, error?.meta);
      return defaultValue;
    }
    // Si la colonne n'existe pas (code P2022 pour Prisma)
    if (error?.code === 'P2022') {
      console.warn(`Colonne manquante (P2022), utilisation de la valeur par défaut:`, error?.meta);
      return defaultValue;
    }
    throw error;
  }
}

/**
 * Helper pour gérer l'absence de table dans Prisma pour count()
 * Retourne 0 si la table n'existe pas
 */
export async function safeCount(query: Promise<number>): Promise<number> {
  return safePrismaQuery(() => query, 0);
}

/**
 * Helper pour gérer l'absence de table dans Prisma pour findMany()
 * Retourne un tableau vide si la table n'existe pas
 */
export async function safeFindMany<T>(query: Promise<T[]>): Promise<T[]> {
  return safePrismaQuery(() => query, []);
}

/**
 * Helper pour gérer l'absence de table dans Prisma pour findFirst/findUnique()
 * Retourne null si la table n'existe pas
 */
export async function safeFind<T>(query: Promise<T | null>): Promise<T | null> {
  return safePrismaQuery(() => query, null);
}

/**
 * Helper pour gérer l'absence de table dans Prisma pour aggregate()
 * Retourne un objet avec _sum: { montant: 0 } si la table n'existe pas
 */
export async function safeAggregate<T extends { _sum: { montant?: any } }>(
  query: Promise<T>
): Promise<T> {
  return safePrismaQuery(() => query, { _sum: { montant: 0 } } as T);
}

