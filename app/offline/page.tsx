"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { WifiOff, RefreshCw, Home, Wifi } from "lucide-react";
import Link from "next/link";

export default function OfflinePage() {
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    // Vérifier l'état de la connexion au montage
    setIsOnline(navigator.onLine);

    // Écouter les changements d'état de la connexion
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const handleRefresh = () => {
    if (isOnline) {
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 flex items-center justify-center p-4">
      <Card className="max-w-md w-full border-blue-200 dark:border-blue-800 shadow-xl">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 text-center">
          <div className="flex justify-center mb-4">
            {isOnline ? (
              <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                <Wifi className="h-10 w-10 text-green-600 dark:text-green-400" />
              </div>
            ) : (
              <div className="w-20 h-20 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center">
                <WifiOff className="h-10 w-10 text-orange-600 dark:text-orange-400" />
              </div>
            )}
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900 dark:text-white">
            {isOnline ? "Connexion rétablie" : "Mode hors ligne"}
          </CardTitle>
          <CardDescription className="text-base mt-2">
            {isOnline
              ? "Votre connexion internet a été rétablie. Vous pouvez maintenant accéder à toutes les fonctionnalités."
              : "Vous êtes actuellement hors ligne. Certaines fonctionnalités peuvent être limitées."}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          {!isOnline && (
            <div className="space-y-3 text-sm text-gray-600 dark:text-gray-300">
              <p className="font-semibold text-gray-900 dark:text-white">
                Fonctionnalités disponibles hors ligne :
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Consultation des pages déjà visitées</li>
                <li>Affichage des images mises en cache</li>
                <li>Navigation dans les pages en cache</li>
                <li>Consultation des données mises en cache</li>
              </ul>
              <p className="font-semibold text-gray-900 dark:text-white mt-4">
                Fonctionnalités non disponibles :
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Envoi de messages ou formulaires</li>
                <li>Chargement de nouvelles données</li>
                <li>Upload de fichiers</li>
                <li>Actions nécessitant le serveur</li>
              </ul>
            </div>
          )}

          {isOnline && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <p className="text-sm text-green-800 dark:text-green-200">
                ✓ Votre connexion est active. Vous pouvez maintenant utiliser toutes les fonctionnalités de l'application.
              </p>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            {isOnline ? (
              <Button
                onClick={handleRefresh}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Actualiser la page
              </Button>
            ) : (
              <Button
                onClick={handleRefresh}
                variant="outline"
                className="flex-1"
                disabled
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Vérifier la connexion
              </Button>
            )}
            <Link href="/" className="flex-1">
              <Button variant="outline" className="w-full">
                <Home className="h-4 w-4 mr-2" />
                Retour à l'accueil
              </Button>
            </Link>
          </div>

          {!isOnline && (
            <div className="text-xs text-center text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-200 dark:border-gray-700">
              <p>
                L'application fonctionne en mode hors ligne grâce au cache. 
                Les données seront synchronisées dès que la connexion sera rétablie.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

