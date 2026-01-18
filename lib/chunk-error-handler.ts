/**
 * Gestionnaire d'erreurs pour les ChunkLoadError de Next.js
 * Résout les problèmes de chargement de chunks après un redémarrage du serveur
 */

/**
 * Vérifie si une erreur est une ChunkLoadError
 */
export function isChunkLoadError(error: any): boolean {
  if (!error) return false;
  
  const errorMessage = error?.message || String(error);
  const errorName = error?.name || '';
  
  return (
    errorName === 'ChunkLoadError' ||
    errorMessage.includes('ChunkLoadError') ||
    errorMessage.includes('Loading chunk') ||
    errorMessage.includes('failed to load')
  );
}

/**
 * Vérifie si une erreur est liée à un 502 Bad Gateway
 */
export function isBadGatewayError(error: any): boolean {
  if (!error) return false;
  
  const errorMessage = error?.message || String(error);
  const status = error?.status || error?.response?.status;
  
  return (
    status === 502 ||
    errorMessage.includes('502') ||
    errorMessage.includes('Bad Gateway')
  );
}

/**
 * Gère une ChunkLoadError en proposant un rechargement de la page
 * 
 * @param error - L'erreur à gérer
 * @param retryCount - Nombre de tentatives déjà effectuées
 * @param maxRetries - Nombre maximum de tentatives (défaut: 3)
 * @returns true si un rechargement a été déclenché, false sinon
 */
export function handleChunkLoadError(
  error: any,
  retryCount: number = 0,
  maxRetries: number = 3
): boolean {
  if (!isChunkLoadError(error) && !isBadGatewayError(error)) {
    return false;
  }

  // Si on a dépassé le nombre maximum de tentatives, forcer un rechargement complet
  if (retryCount >= maxRetries) {
    console.warn('⚠️ Trop de tentatives de chargement de chunks échouées, rechargement complet de la page...');
    if (typeof window !== 'undefined') {
      // Vider le cache et recharger
      window.location.href = window.location.href;
    }
    return true;
  }

  // Attendre un peu avant de réessayer (backoff exponentiel)
  const delay = Math.min(1000 * Math.pow(2, retryCount), 5000);
  
  console.warn(`⚠️ Erreur de chargement de chunk détectée (tentative ${retryCount + 1}/${maxRetries}), rechargement dans ${delay}ms...`);
  
  setTimeout(() => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  }, delay);

  return true;
}

/**
 * Wrapper pour les imports dynamiques avec gestion d'erreur de chunks
 * 
 * @param importFn - Fonction d'import dynamique
 * @param retryCount - Nombre de tentatives (interne)
 * @returns Le module importé ou null en cas d'échec
 */
export async function safeDynamicImport<T>(
  importFn: () => Promise<T>,
  retryCount: number = 0
): Promise<T | null> {
  try {
    return await importFn();
  } catch (error: any) {
    if (isChunkLoadError(error) || isBadGatewayError(error)) {
      const handled = handleChunkLoadError(error, retryCount);
      if (handled) {
        // Le rechargement va se faire, retourner null pour l'instant
        return null;
      }
    }
    // Autre type d'erreur, la propager
    throw error;
  }
}
