"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Download, X, Smartphone } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showManualButton, setShowManualButton] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Détecter iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(iOS);

    // Vérifier si l'app est déjà installée
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
      return;
    }

    // Écouter l'événement beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      console.log("✅ beforeinstallprompt event déclenché");
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Afficher le prompt après un délai
      setTimeout(() => {
        setShowInstallPrompt(true);
      }, 3000);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // Vérifier si l'app a été installée
    window.addEventListener("appinstalled", () => {
      console.log("✅ Application installée");
      setIsInstalled(true);
      setShowInstallPrompt(false);
      setDeferredPrompt(null);
    });

    // Si après 5 secondes, le prompt n'est pas déclenché, afficher le bouton manuel
    const timer = setTimeout(() => {
      if (!deferredPrompt && !isInstalled && !iOS) {
        console.log("⚠️ beforeinstallprompt non déclenché, affichage du bouton manuel");
        setShowManualButton(true);
      }
    }, 5000);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      clearTimeout(timer);
    };
  }, [deferredPrompt, isInstalled]);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      try {
        // Afficher le prompt d'installation
        await deferredPrompt.prompt();

        // Attendre la réponse de l'utilisateur
        const { outcome } = await deferredPrompt.userChoice;

        if (outcome === "accepted") {
          setIsInstalled(true);
          toast.success("Installation en cours...");
        }

        setDeferredPrompt(null);
        setShowInstallPrompt(false);
        setShowManualButton(false);
      } catch (error) {
        console.error("Erreur lors de l'installation:", error);
        toast.error("Erreur lors de l'installation. Utilisez le menu de votre navigateur.");
      }
    } else {
      // Si deferredPrompt n'est pas disponible, essayer de déclencher l'installation
      // Sur certains navigateurs, on peut forcer l'affichage du menu d'installation
      console.log("⚠️ Prompt d'installation non disponible, tentative alternative");
      
      // Essayer de déclencher l'événement beforeinstallprompt manuellement
      // ou guider l'utilisateur vers le menu du navigateur
      if (isIOS) {
        // Sur iOS, on ne peut pas forcer l'installation, mais on peut guider
        toast.info("Sur iOS, utilisez le menu Safari (□↑) → Sur l'écran d'accueil", {
          duration: 4000,
        });
      } else {
        // Sur Android, essayer de déclencher le menu d'installation
        // Certains navigateurs permettent cela via un événement personnalisé
        toast.info("Utilisez le menu de votre navigateur (⋮) → Installer l'application", {
          duration: 4000,
        });
        
        // Essayer de déclencher un événement qui pourrait ouvrir le menu
        try {
          // Certains navigateurs répondent à un clic sur un lien avec href="#"
          // ou à un événement personnalisé
          const event = new Event('beforeinstallprompt', { bubbles: true, cancelable: true });
          window.dispatchEvent(event);
        } catch (e) {
          console.log("Impossible de déclencher l'installation automatique");
        }
      }
    }
  };

  const handleDismiss = () => {
    setShowInstallPrompt(false);
    // Ne plus afficher pendant cette session
    if (typeof window !== "undefined") {
      sessionStorage.setItem("pwa-install-dismissed", "true");
    }
  };

  // Ne pas afficher si déjà installée
  if (isInstalled) {
    return null;
  }

  // Vérifier sessionStorage uniquement côté client
  const isDismissed = typeof window !== "undefined" 
    ? sessionStorage.getItem("pwa-install-dismissed") === "true"
    : false;

  // Pour iOS, afficher les instructions d'installation
  if (isIOS) {
    if (isDismissed) {
      return null;
    }
    return (
      <div className="fixed bottom-4 right-4 z-50 max-w-sm">
        <Card className="border-blue-200 dark:border-blue-800 shadow-xl">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                <Smartphone className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <CardTitle className="text-lg font-bold">Installer l'application</CardTitle>
            </div>
            <CardDescription className="text-sm">
              Sur iOS, utilisez le menu Safari pour installer
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600 dark:text-gray-300">
              <li>Cliquez sur le bouton de partage (□↑)</li>
              <li>Sélectionnez "Sur l'écran d'accueil"</li>
              <li>Confirmez l'installation</li>
            </ol>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (typeof window !== "undefined") {
                  sessionStorage.setItem("pwa-install-dismissed", "true");
                }
                setShowManualButton(false);
              }}
              className="w-full"
            >
              <X className="h-4 w-4 mr-2" />
              Fermer
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Afficher le bouton manuel si le prompt automatique n'est pas disponible
  if (showManualButton && !deferredPrompt) {
    if (isDismissed) {
      return null;
    }
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Card className="border-blue-200 dark:border-blue-800 shadow-xl max-w-sm">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smartphone className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <CardTitle className="text-base font-bold">Installer l'application</CardTitle>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (typeof window !== "undefined") {
                    sessionStorage.setItem("pwa-install-dismissed", "true");
                  }
                  setShowManualButton(false);
                }}
                className="h-6 w-6 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
              Installez AMAKI France pour un accès rapide et une meilleure expérience.
            </p>
            <Button
              onClick={handleInstallClick}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Download className="h-4 w-4 mr-2" />
              Installer l'application
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Ne pas afficher le dialog si l'utilisateur a déjà refusé
  if (isDismissed) {
    return null;
  }

  // Ne pas afficher si le prompt n'est pas prêt
  if (!showInstallPrompt || !deferredPrompt) {
    return null;
  }

  return (
    <Dialog open={showInstallPrompt} onOpenChange={setShowInstallPrompt}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
              <Smartphone className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <DialogTitle className="text-xl font-bold">
              Installer l'application
            </DialogTitle>
          </div>
          <DialogDescription className="text-base pt-2">
            Installez AMAKI France sur votre appareil pour un accès rapide et une meilleure expérience, même hors ligne.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-xs font-bold text-blue-600 dark:text-blue-400">1</span>
            </div>
            <div>
              <p className="font-semibold text-sm text-gray-900 dark:text-white">
                Accès rapide
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Lancez l'application directement depuis votre écran d'accueil
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-xs font-bold text-blue-600 dark:text-blue-400">2</span>
            </div>
            <div>
              <p className="font-semibold text-sm text-gray-900 dark:text-white">
                Mode hors ligne
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Consultez les pages déjà visitées même sans connexion internet
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-xs font-bold text-blue-600 dark:text-blue-400">3</span>
            </div>
            <div>
              <p className="font-semibold text-sm text-gray-900 dark:text-white">
                Expérience optimisée
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Interface native et performances améliorées
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={handleDismiss}
            className="w-full sm:w-auto"
          >
            <X className="h-4 w-4 mr-2" />
            Plus tard
          </Button>
          <Button
            onClick={handleInstallClick}
            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Download className="h-4 w-4 mr-2" />
            Installer l'application
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

