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
        console.warn('Impossible de récupérer le build ID');
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
    } catch (error) {
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
