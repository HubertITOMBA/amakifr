"use client";

import { useState, useEffect, useRef, useCallback } from 'react';

interface BuildInfo {
  buildId: string;
  timestamp: string;
  version: string;
}

/**
 * Hook pour vérifier périodiquement le build ID et détecter les nouveaux déploiements
 * 
 * @param checkInterval - Intervalle de vérification en millisecondes (défaut: 30 secondes)
 * @returns L'objet buildInfo actuel et une fonction pour forcer une vérification
 */
export function useBuildId(checkInterval: number = 30000) {
  const [buildInfo, setBuildInfo] = useState<BuildInfo | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const initialBuildIdRef = useRef<string | null>(null);

  const checkBuildId = useCallback(async () => {
    try {
      setIsChecking(true);
      const response = await fetch('/api/build-id', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
        },
      });
      
      if (!response.ok) {
        // Si c'est un 502, le serveur n'est peut-être pas encore prêt après un redémarrage
        if (response.status === 502) {
          console.warn('⚠️ Serveur non disponible (502), le serveur est peut-être en cours de redémarrage...');
          // Ne pas recharger immédiatement, attendre la prochaine vérification
          return false;
        }
        console.warn('Impossible de récupérer le build ID:', response.status);
        return false;
      }

      // Vérifier que la réponse est bien du JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        // Si c'est du HTML, c'est probablement une page d'erreur 502
        if (contentType?.includes('text/html')) {
          console.warn('⚠️ Le serveur retourne du HTML au lieu de JSON (502 Bad Gateway), le serveur est peut-être en cours de redémarrage...');
          return false;
        }
        console.warn('La réponse du build ID n\'est pas du JSON:', contentType);
        return false;
      }

      const data: BuildInfo = await response.json();
      setBuildInfo(data);

      // Si c'est la première vérification, sauvegarder le build ID initial
      if (initialBuildIdRef.current === null) {
        initialBuildIdRef.current = data.buildId;
        return false;
      } else if (initialBuildIdRef.current !== data.buildId) {
        // Le build ID a changé, un nouveau déploiement a eu lieu
        console.log('🔄 Nouveau build détecté:', {
          ancien: initialBuildIdRef.current,
          nouveau: data.buildId,
        });
        
        // Retourner true pour indiquer qu'un refresh est nécessaire
        return true;
      }
      
      return false;
    } catch (error: any) {
      // Gérer les erreurs réseau (502, etc.) gracieusement
      if (error?.message?.includes('502') || error?.message?.includes('Bad Gateway')) {
        console.warn('⚠️ Erreur réseau lors de la vérification du build ID (502), le serveur est peut-être en cours de redémarrage...');
        return false;
      }
      console.error('Erreur lors de la vérification du build ID:', error);
      return false;
    } finally {
      setIsChecking(false);
    }
  }, []);

  useEffect(() => {
    // Vérification initiale
    checkBuildId().then((needsRefresh) => {
      if (needsRefresh) {
        // Le build ID a changé dès le chargement initial, forcer un refresh
        window.location.reload();
      }
    });

    // Vérification périodique
    intervalRef.current = setInterval(async () => {
      const needsRefresh = await checkBuildId();
      if (needsRefresh) {
        // Le build ID a changé, forcer un refresh de la page
        window.location.reload();
      }
    }, checkInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [checkInterval, checkBuildId]);

  return {
    buildInfo,
    isChecking,
    checkBuildId: () => checkBuildId(),
  };
}
