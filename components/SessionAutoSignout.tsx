"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { toast } from "sonner";

/**
 * Composant de déconnexion automatique pour inactivité
 * 
 * Fonctionnalités :
 * - Déconnexion automatique après une période d'inactivité (15 minutes par défaut)
 * - Avertissement 1 minute avant la déconnexion
 * - Détection d'activité : clics, touches, mouvements de souris, scroll, focus
 * - Configuration via variables d'environnement :
 *   - NEXT_PUBLIC_SESSION_INACTIVITY_MS : Temps d'inactivité en millisecondes (défaut: 900000 = 15 min)
 *   - NEXT_PUBLIC_SESSION_SIGNOUT_DELAY_MS : Délai avant déconnexion lors de fermeture d'onglet (défaut: 1000 = 1 sec)
 */
export default function SessionAutoSignout() {
  const router = useRouter();
  const [warningShown, setWarningShown] = useState(false);
  const warningShownRef = useRef(false);

  useEffect(() => {
    const SIGNOUT_URL = "/api/auth/signout-quick";

    // Configuration par défaut
    const DEFAULT_DELAY_MS = 1000; // Délai avant déconnexion lors de fermeture d'onglet (1 seconde)
    const DEFAULT_INACTIVITY_MS = 15 * 60 * 1000; // Temps d'inactivité avant déconnexion (15 minutes)
    const WARNING_TIME_MS = 1 * 60 * 1000; // Avertissement 1 minute avant la déconnexion
    const ACTIVITY_DEBOUNCE_MS = 500; // Debounce de 500ms pour éviter trop de réinitialisations tout en restant réactif

    // Récupérer les valeurs depuis les variables d'environnement (si définies)
    const envDelay = Number(process.env.NEXT_PUBLIC_SESSION_SIGNOUT_DELAY_MS);
    const envInactivity = Number(process.env.NEXT_PUBLIC_SESSION_INACTIVITY_MS);

    const DELAY_MS = Number.isFinite(envDelay) && envDelay > 0 ? envDelay : DEFAULT_DELAY_MS;
    const INACTIVITY_MS = Number.isFinite(envInactivity) && envInactivity > 0 ? envInactivity : DEFAULT_INACTIVITY_MS;

    let closingTimer: number | undefined;
    let idleTimer: number | undefined;
    let warningTimer: number | undefined;
    let activityDebounceTimer: number | undefined;
    let lastActivityTime = Date.now();

    const sendSignout = async (isInactivity: boolean = false) => {
      try {
        // Si c'est une déconnexion pour inactivité, utiliser signOut avec redirection
        if (isInactivity) {
          try {
            await signOut({
              redirect: true,
              callbackUrl: "/?inactivity=true"
            });
          } catch (signOutError: any) {
            // Ignorer les erreurs CSRF qui peuvent survenir en développement
            // Ces erreurs sont généralement non bloquantes
            if (signOutError?.message?.includes('CSRF') || 
                signOutError?.message?.includes('MissingCSRF') ||
                signOutError?.type === 'MissingCSRF') {
              // En cas d'erreur CSRF, utiliser la redirection manuelle
              window.location.href = "/?inactivity=true";
            } else {
              throw signOutError;
            }
          }
        } else {
          // Pour les autres cas (fermeture de page), utiliser l'API rapide
          // qui ne nécessite pas de token CSRF
          if (navigator.sendBeacon) {
            const blob = new Blob([""], { type: "text/plain" });
            navigator.sendBeacon(SIGNOUT_URL, blob);
          } else {
            fetch(SIGNOUT_URL, { method: "POST", keepalive: true, headers: { "Content-Type": "text/plain" }, body: "" }).catch(() => {});
          }
        }
      } catch (error: any) {
        // Ignorer les erreurs CSRF qui sont généralement non bloquantes
        if (error?.message?.includes('CSRF') || 
            error?.message?.includes('MissingCSRF') ||
            error?.type === 'MissingCSRF') {
          // En cas d'erreur CSRF, utiliser la redirection manuelle
          if (isInactivity) {
            window.location.href = "/?inactivity=true";
          }
          return;
        }
        console.error("Erreur lors de la déconnexion:", error);
        // En cas d'erreur, rediriger quand même vers l'accueil
        if (isInactivity) {
          window.location.href = "/?inactivity=true";
        }
      }
    };

    const resetIdleTimer = (force: boolean = false) => {
      const now = Date.now();
      
      // Toujours réinitialiser le timer si c'est forcé ou si une activité récente a été détectée
      // Le debounce est géré dans onActivity, donc ici on réinitialise toujours
      if (process.env.NODE_ENV === 'development') {
        console.log('[SessionAutoSignout] Réinitialisation du timer', { 
          force, 
          now,
          lastActivity: new Date(lastActivityTime).toISOString(),
          elapsed: now - lastActivityTime
        });
      }
      
      // Réinitialiser le timer d'avertissement
      if (warningTimer) {
        clearTimeout(warningTimer);
        warningTimer = undefined;
      }
      
      // Réinitialiser le timer de déconnexion
      if (idleTimer) {
        clearTimeout(idleTimer);
        idleTimer = undefined;
      }
      
      // Réinitialiser le debounce d'activité
      if (activityDebounceTimer) {
        clearTimeout(activityDebounceTimer);
        activityDebounceTimer = undefined;
      }
      
      setWarningShown(false);
      warningShownRef.current = false;
      
      // Programmer l'avertissement 1 minute avant la déconnexion
      // @ts-ignore
      warningTimer = setTimeout(() => {
        showWarning();
      }, INACTIVITY_MS - WARNING_TIME_MS);
      
      // Programmer la déconnexion
      // @ts-ignore
      idleTimer = setTimeout(() => {
        // Vérifier une dernière fois qu'aucune activité n'a été détectée récemment
        // avant de déconnecter (protection contre les faux positifs)
        const timeSinceLastActivity = Date.now() - lastActivityTime;
        if (timeSinceLastActivity >= INACTIVITY_MS) {
          if (process.env.NODE_ENV === 'development') {
            console.log('[SessionAutoSignout] Déconnexion pour inactivité confirmée', {
              timeSinceLastActivity,
              lastActivity: new Date(lastActivityTime).toISOString()
            });
          }
          sendSignout(true);
        } else {
          if (process.env.NODE_ENV === 'development') {
            console.log('[SessionAutoSignout] Déconnexion annulée - activité détectée récemment', {
              timeSinceLastActivity,
              required: INACTIVITY_MS,
              lastActivity: new Date(lastActivityTime).toISOString()
            });
          }
          // Réinitialiser le timer car une activité a été détectée
          resetIdleTimer(false);
        }
        idleTimer = undefined;
      }, INACTIVITY_MS);
    };

    const showWarning = () => {
      // Utiliser la ref pour éviter les problèmes de closure avec le state
      if (!warningShownRef.current) {
        warningShownRef.current = true;
        setWarningShown(true);
        toast.warning("Session sur le point d'expirer", {
          description: "Vous avez été inactif pendant 14 minutes. Vous serez déconnecté dans 1 minute pour des raisons de sécurité. Veuillez interagir avec la page pour maintenir votre session.",
          duration: 60000, // Afficher pendant 1 minute
          action: {
            label: "OK",
            onClick: () => {
              warningShownRef.current = false;
              setWarningShown(false);
              resetIdleTimer(true); // Forcer la réinitialisation
            }
          }
        });
      }
    };

    const scheduleCloseSignout = () => {
      if (closingTimer) return;
      // @ts-ignore
      closingTimer = setTimeout(() => {
        sendSignout(false);
        closingTimer = undefined;
      }, DELAY_MS);
    };

    const cancelCloseSignout = () => {
      if (closingTimer) {
        clearTimeout(closingTimer);
        closingTimer = undefined;
      }
    };

    const activityEvents = [
      "mousemove",
      "mousedown",
      "mouseup",
      "keydown",
      "keyup",
      "scroll",
      "touchstart",
      "touchend",
      "click",
      "focus",
      "blur",
    ] as const;

    const onActivity = (event?: Event) => {
      // En développement, logger l'activité pour le débogage
      if (process.env.NODE_ENV === 'development') {
        console.log('[SessionAutoSignout] Activité détectée:', event?.type || 'unknown');
      }
      
      // Mettre à jour le temps de dernière activité immédiatement
      lastActivityTime = Date.now();
      
      // Utiliser un debounce pour éviter de réinitialiser le timer trop souvent
      // Mais toujours mettre à jour lastActivityTime pour que resetIdleTimer puisse vérifier
      if (activityDebounceTimer) {
        clearTimeout(activityDebounceTimer);
      }
      
      // @ts-ignore
      activityDebounceTimer = setTimeout(() => {
        if (process.env.NODE_ENV === 'development') {
          console.log('[SessionAutoSignout] Réinitialisation du timer d\'inactivité');
        }
        // Toujours réinitialiser si une activité a été détectée
        resetIdleTimer(false);
      }, ACTIVITY_DEBOUNCE_MS);
    };

    const onBeforeUnload = () => {
      scheduleCloseSignout();
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        scheduleCloseSignout();
      } else {
        cancelCloseSignout();
        // Quand l'onglet redevient visible, réinitialiser le timer pour éviter une déconnexion immédiate
        resetIdleTimer(true);
      }
    };

    const onPageHide = () => {
      scheduleCloseSignout();
    };

    // Init - forcer la réinitialisation au démarrage
    resetIdleTimer(true);

    // Listeners
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onPageHide);
    
    // Ajouter les listeners d'activité sur window, document ET body pour capturer tous les événements
    // Utiliser capture: true pour intercepter les événements même s'ils sont stoppés
    activityEvents.forEach((evt) => {
      window.addEventListener(evt, onActivity, { passive: true, capture: true });
      document.addEventListener(evt, onActivity, { passive: true, capture: true });
      if (document.body) {
        document.body.addEventListener(evt, onActivity, { passive: true, capture: true });
      }
    });

    // Écouter aussi les changements de focus (onglet actif/inactif)
    window.addEventListener("focus", onActivity, { passive: true });
    window.addEventListener("blur", onActivity, { passive: true });
    
    // Écouter aussi les événements de formulaire (submit, input, change)
    const formEvents = ["submit", "input", "change"] as const;
    formEvents.forEach((evt) => {
      document.addEventListener(evt, onActivity, { passive: true, capture: true });
      if (document.body) {
        document.body.addEventListener(evt, onActivity, { passive: true, capture: true });
      }
    });

    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("focus", onActivity);
      window.removeEventListener("blur", onActivity);
      activityEvents.forEach((evt) => {
        window.removeEventListener(evt, onActivity, { capture: true } as any);
        document.removeEventListener(evt, onActivity, { capture: true } as any);
        if (document.body) {
          document.body.removeEventListener(evt, onActivity, { capture: true } as any);
        }
      });
      
      // Nettoyer les événements de formulaire
      const formEvents = ["submit", "input", "change"] as const;
      formEvents.forEach((evt) => {
        document.removeEventListener(evt, onActivity, { capture: true } as any);
        if (document.body) {
          document.body.removeEventListener(evt, onActivity, { capture: true } as any);
        }
      });
      cancelCloseSignout();
      if (idleTimer) clearTimeout(idleTimer);
      if (warningTimer) clearTimeout(warningTimer);
      if (activityDebounceTimer) clearTimeout(activityDebounceTimer);
    };
  }, [router]);

  return null;
}
