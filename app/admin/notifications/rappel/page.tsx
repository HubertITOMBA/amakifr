"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MetricCard } from "@/components/admin/MetricCard";
import {
  Bell,
  Calendar,
  Vote,
  Euro,
  Play,
  RefreshCw,
  Settings,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import {
  executeRappelsAutomatiques,
  getRappelsStats,
} from "@/actions/notifications/rappel";

export default function RappelsNotificationsPage() {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      const result = await getRappelsStats();
      if (result.success && result.data) {
        setStats(result.data);
      } else {
        toast.error(result.error || "Erreur lors du chargement");
      }
    } catch (error) {
      console.error("Erreur lors du chargement:", error);
      toast.error("Erreur lors du chargement des statistiques");
    } finally {
      setLoading(false);
    }
  };

  const handleExecute = async () => {
    try {
      setLoading(true);
      const result = await executeRappelsAutomatiques();
      if (result.success) {
        toast.success(result.message || "Rappels exécutés avec succès");
        loadStats();
      } else {
        toast.error(result.error || "Erreur lors de l'exécution");
      }
    } catch (error) {
      console.error("Erreur lors de l'exécution:", error);
      toast.error("Erreur lors de l'exécution des rappels");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-slate-900 dark:to-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Bell className="h-8 w-8 text-blue-600" />
            Rappels et Notifications Intelligentes
          </h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 mt-2">
            Gérez les rappels automatiques pour améliorer l'engagement des membres
          </p>
        </div>

        {/* Métriques */}
        {stats && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
            <MetricCard
              title="Événements Prochains"
              value={stats.evenementsProchains}
              icon={Calendar}
              color="purple"
              description="Dans les 3 prochains jours"
            />
            <MetricCard
              title="Élections - Limite Candidature"
              value={stats.electionsLimite}
              icon={Vote}
              color="blue"
              description="Dans les 7 prochains jours"
            />
            <MetricCard
              title="Événements - Limite Inscription"
              value={stats.evenementsLimiteInscription}
              icon={Calendar}
              color="amber"
              description="Dans les 3 prochains jours"
            />
            <MetricCard
              title="Cotisations - Échéance"
              value={stats.cotisationsEcheance}
              icon={Euro}
              color="green"
              description="Dans les 7 prochains jours"
            />
          </div>
        )}

        {/* Actions rapides */}
        <Card className="mb-8 !py-0 border-2 border-green-200 dark:border-green-800/50 bg-white dark:bg-gray-900">
          <CardHeader className="pt-4 px-4 sm:px-6 pb-3 bg-gradient-to-r from-green-100 to-green-50 dark:from-green-900/30 dark:to-green-800/20 rounded-t-lg">
            <CardTitle className="text-base sm:text-lg text-gray-700 dark:text-gray-200">
              Actions Rapides
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <Button onClick={handleExecute} disabled={loading} className="flex-1">
                {loading ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Exécution...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Exécuter les Rappels Automatiques
                  </>
                )}
              </Button>
              <Button onClick={loadStats} variant="outline" disabled={loading}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Actualiser
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Types de rappels */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card className="!py-0 border-2 border-purple-200 dark:border-purple-800/50 bg-white dark:bg-gray-900">
            <CardHeader className="pt-4 px-4 sm:px-6 pb-3 bg-gradient-to-r from-purple-100 to-purple-50 dark:from-purple-900/30 dark:to-purple-800/20 rounded-t-lg">
              <CardTitle className="flex items-center space-x-2 text-base sm:text-lg text-gray-700 dark:text-gray-200">
                <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-purple-500 dark:text-purple-400" />
                <span>Rappels d'Événements</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
              <div className="space-y-3 text-sm text-gray-600 dark:text-gray-300">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-purple-500" />
                  <span>3 jours avant l'événement</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-purple-500" />
                  <span>1 jour avant l'événement</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-purple-500" />
                  <span>Jour J de l'événement</span>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Les rappels sont envoyés uniquement aux adhérents inscrits à l'événement
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="!py-0 border-2 border-blue-200 dark:border-blue-800/50 bg-white dark:bg-gray-900">
            <CardHeader className="pt-4 px-4 sm:px-6 pb-3 bg-gradient-to-r from-blue-100 to-blue-50 dark:from-blue-900/30 dark:to-blue-800/20 rounded-t-lg">
              <CardTitle className="flex items-center space-x-2 text-base sm:text-lg text-gray-700 dark:text-gray-200">
                <Vote className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500 dark:text-blue-400" />
                <span>Rappels d'Élections</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
              <div className="space-y-3 text-sm text-gray-600 dark:text-gray-300">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-blue-500" />
                  <span>Date limite de candidature (7 jours avant)</span>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Les rappels sont envoyés aux adhérents actifs qui n'ont pas encore candidaté
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="!py-0 border-2 border-amber-200 dark:border-amber-800/50 bg-white dark:bg-gray-900">
            <CardHeader className="pt-4 px-4 sm:px-6 pb-3 bg-gradient-to-r from-amber-100 to-amber-50 dark:from-amber-900/30 dark:to-amber-800/20 rounded-t-lg">
              <CardTitle className="flex items-center space-x-2 text-base sm:text-lg text-gray-700 dark:text-gray-200">
                <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-amber-500 dark:text-amber-400" />
                <span>Rappels d'Inscriptions</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
              <div className="space-y-3 text-sm text-gray-600 dark:text-gray-300">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-amber-500" />
                  <span>Date limite d'inscription (3 jours avant)</span>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Les rappels sont envoyés aux adhérents actifs non inscrits
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="!py-0 border-2 border-green-200 dark:border-green-800/50 bg-white dark:bg-gray-900">
            <CardHeader className="pt-4 px-4 sm:px-6 pb-3 bg-gradient-to-r from-green-100 to-green-50 dark:from-green-900/30 dark:to-green-800/20 rounded-t-lg">
              <CardTitle className="flex items-center space-x-2 text-base sm:text-lg text-gray-700 dark:text-gray-200">
                <Euro className="h-4 w-4 sm:h-5 sm:w-5 text-green-500 dark:text-green-400" />
                <span>Rappels de Cotisations</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
              <div className="space-y-3 text-sm text-gray-600 dark:text-gray-300">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-green-500" />
                  <span>7 jours avant l'échéance</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-green-500" />
                  <span>Jour J de l'échéance</span>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Les rappels sont envoyés aux adhérents avec des obligations en attente
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Informations */}
        <Card className="!py-0 border-2 border-indigo-200 dark:border-indigo-800/50 bg-white dark:bg-gray-900">
          <CardHeader className="pt-4 px-4 sm:px-6 pb-3 bg-gradient-to-r from-indigo-100 to-indigo-50 dark:from-indigo-900/30 dark:to-indigo-800/20 rounded-t-lg">
            <CardTitle className="flex items-center space-x-2 text-base sm:text-lg text-gray-700 dark:text-gray-200">
              <Settings className="h-4 w-4 sm:h-5 sm:w-5 text-indigo-500 dark:text-indigo-400" />
              <span>Fonctionnement des Rappels</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
            <div className="space-y-3 text-sm text-gray-600 dark:text-gray-300">
              <p>
                <strong>Rappels automatiques :</strong> Les rappels sont envoyés automatiquement selon les délais
                configurés. Vous pouvez également les exécuter manuellement.
              </p>
              <p>
                <strong>Notifications :</strong> Tous les rappels créent également une notification in-app pour
                l'utilisateur concerné.
              </p>
              <p>
                <strong>Emails :</strong> Les rappels sont envoyés par email aux adhérents actifs ayant une adresse
                email valide.
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">
                <strong>Note :</strong> Pour automatiser complètement les rappels, configurez un cron job qui
                appelle cette fonction régulièrement (ex: tous les jours à 9h).
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

