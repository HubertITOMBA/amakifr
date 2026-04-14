"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function detectIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  // iPadOS 13+ se présente parfois comme "MacIntel" avec touchpoints
  const isIpadOs = (navigator.platform === "MacIntel" && (navigator as any).maxTouchPoints > 1) || /iPad/.test(ua);
  return /iPhone|iPod/.test(ua) || isIpadOs;
}

function isStandaloneDisplayMode(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(display-mode: standalone)")?.matches ?? false;
}

/**
 * Hook PWA install: expose un bouton/menu "Installer" sans popups automatiques.
 *
 * - `canInstall`: true si `beforeinstallprompt` a été capturé (Chrome/Edge/Android).
 * - `isIOS`: true si iOS (installation manuelle via Safari).
 * - `isInstalled`: true si display-mode standalone.
 * - `install()`: déclenche le prompt ou affiche les instructions.
 */
export function usePwaInstallPrompt() {
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);
  const [canInstall, setCanInstall] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    setIsIOS(detectIOS());
    setIsInstalled(isStandaloneDisplayMode());

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      deferredPromptRef.current = e as BeforeInstallPromptEvent;
      setCanInstall(true);
    };

    const handleAppInstalled = () => {
      deferredPromptRef.current = null;
      setCanInstall(false);
      setIsInstalled(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (isStandaloneDisplayMode()) {
      setIsInstalled(true);
      return;
    }

    if (detectIOS()) {
      toast.info('Sur iOS : Safari → Partager (□↑) → "Sur l’écran d’accueil"', { duration: 4500 });
      return;
    }

    const deferred = deferredPromptRef.current;
    if (!deferred) {
      toast.info("Installation non disponible. Utilisez le menu du navigateur (⋮) → Installer l’application.", {
        duration: 4500,
      });
      return;
    }

    try {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      if (outcome === "accepted") {
        toast.success("Installation en cours…");
      }
    } catch (error) {
      console.error("Erreur lors du prompt d'installation:", error);
      toast.error("Erreur lors de l'installation. Utilisez le menu du navigateur.");
    } finally {
      deferredPromptRef.current = null;
      setCanInstall(false);
    }
  }, []);

  return { canInstall, isInstalled, isIOS, install };
}

