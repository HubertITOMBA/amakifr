/**
 * Utilitaire pour gérer les erreurs de Server Actions en production
 * Résout les problèmes de "Failed to find Server Action" qui peuvent survenir
 * lors des déploiements ou des problèmes de cache
 */

export function handleServerActionError(error: any): {
  shouldRetry: boolean;
  errorMessage: string;
  isServerActionError: boolean;
} {
  const errorMessage = error?.message || String(error);
  const isServerActionError = 
    errorMessage.includes('Failed to find Server Action') ||
    errorMessage.includes('server-action') ||
    errorMessage.includes('4055cc5483d97e15c676d2cc85d23a3199171593ea') ||
    errorMessage.includes('00245d1fdc34d59d692f9d802514db14eb8db6c3c3');

  if (isServerActionError) {
    return {
      shouldRetry: true,
      errorMessage: 'Une erreur de synchronisation est survenue. Veuillez rafraîchir la page (Ctrl+Shift+R ou Cmd+Shift+R).',
      isServerActionError: true,
    };
  }

  return {
    shouldRetry: false,
    errorMessage: errorMessage,
    isServerActionError: false,
  };
}

/**
 * Wrapper pour les appels de Server Actions avec gestion d'erreur améliorée
 */
export async function safeServerAction<T>(
  action: () => Promise<T>,
  retries: number = 1
): Promise<{ success: boolean; data?: T; error?: string }> {
  try {
    const data = await action();
    return { success: true, data };
  } catch (error: any) {
    const errorInfo = handleServerActionError(error);
    
    if (errorInfo.isServerActionError && retries > 0) {
      // Attendre un peu avant de réessayer
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Rafraîchir la page si c'est une erreur de Server Action
      if (typeof window !== 'undefined') {
        console.warn('Erreur de Server Action détectée, rafraîchissement de la page...');
        window.location.reload();
        return { success: false, error: errorInfo.errorMessage };
      }
    }
    
    return { success: false, error: errorInfo.errorMessage };
  }
}

