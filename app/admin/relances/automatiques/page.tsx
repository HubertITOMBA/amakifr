"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RelanceAutomatiqueConfig } from "@/components/admin/RelanceAutomatiqueConfig";
import { RelanceTemplateEditor } from "@/components/admin/RelanceTemplateEditor";
import { MetricCard } from "@/components/admin/MetricCard";
import {
  Mail,
  Settings,
  Play,
  RefreshCw,
  FileText,
  TrendingUp,
  AlertTriangle,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import {
  executeRelancesAutomatiques,
  getRelancesStats,
  getRelancesHistory,
} from "@/actions/relances/automatiques";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export default function RelancesAutomatiquesPage() {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [config, setConfig] = useState({
    actif: true,
    premiereRelanceJours: 15,
    deuxiemeRelanceJours: 30,
    relanceUrgenteJours: 60,
    exclusionAdherentsAJour: true,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [statsResult, historyResult] = await Promise.all([
        getRelancesStats(),
        getRelancesHistory(20),
      ]);

      if (statsResult.success && statsResult.data) {
        setStats(statsResult.data);
      }

      if (historyResult.success && historyResult.data) {
        setHistory(historyResult.data);
      }
    } catch (error) {
      console.error("Erreur lors du chargement:", error);
      toast.error("Erreur lors du chargement des données");
    } finally {
      setLoading(false);
    }
  };

  const handleExecute = async () => {
    try {
      setLoading(true);
      const result = await executeRelancesAutomatiques();
      if (result.success) {
        toast.success(result.message || "Relances exécutées avec succès");
        loadData();
      } else {
        toast.error(result.error || "Erreur lors de l'exécution");
      }
    } catch (error) {
      console.error("Erreur lors de l'exécution:", error);
      toast.error("Erreur lors de l'exécution des relances");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = async (newConfig: typeof config) => {
    // Pour l'instant, on sauvegarde juste en mémoire
    // Plus tard, on pourra sauvegarder en base de données
    setConfig(newConfig);
    toast.success("Configuration sauvegardée (en mémoire)");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-slate-900 dark:to-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Mail className="h-8 w-8 text-blue-600" />
            Relances Automatiques
          </h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 mt-2">
            Configurez et gérez les relances automatiques de paiement
          </p>
        </div>

        {/* Métriques */}
        {stats && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
            <MetricCard
              title="Total Relances"
              value={stats.total}
              icon={Mail}
              color="blue"
            />
            <MetricCard
              title="Relances Envoyées"
              value={stats.envoyees}
              icon={TrendingUp}
              color="green"
              description={`${stats.tauxEnvoi}% de taux d'envoi`}
            />
            <MetricCard
              title="En Attente"
              value={stats.enAttente}
              icon={AlertTriangle}
              color="amber"
            />
            <MetricCard
              title="Adhérents Récalcitrants"
              value={stats.adherentsRecalcitrants}
              icon={Users}
              color="red"
              description="3 derniers mois"
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
                    Exécuter les Relances Automatiques
                  </>
                )}
              </Button>
              <Button onClick={loadData} variant="outline" disabled={loading}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Actualiser
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Configuration et Template */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <RelanceAutomatiqueConfig config={config} onSave={handleSaveConfig} />
          <RelanceTemplateEditor />
        </div>

        {/* Historique */}
        <Card className="!py-0 border-2 border-indigo-200 dark:border-indigo-800/50 bg-white dark:bg-gray-900">
          <CardHeader className="pt-4 px-4 sm:px-6 pb-3 bg-gradient-to-r from-indigo-100 to-indigo-50 dark:from-indigo-900/30 dark:to-indigo-800/20 rounded-t-lg">
            <CardTitle className="flex items-center space-x-2 text-base sm:text-lg text-gray-700 dark:text-gray-200">
              <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-indigo-500 dark:text-indigo-400" />
              <span>Historique des Relances</span>
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm mt-1">
              Dernières relances envoyées
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
            {history.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                Aucune relance dans l'historique
              </p>
            ) : (
              <div className="space-y-3">
                {history.map((relance) => (
                  <div
                    key={relance.id}
                    className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                        {relance.adherent}
                      </h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {relance.email} • {relance.typeCotisation}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {relance.dateEnvoi
                          ? format(new Date(relance.dateEnvoi), "dd MMMM yyyy à HH:mm", { locale: fr })
                          : format(new Date(relance.dateCreation), "dd MMMM yyyy à HH:mm", { locale: fr })}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                      <div className="text-right">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">
                          {relance.montant.toFixed(2).replace(".", ",")} €
                        </p>
                        <p
                          className={`text-xs ${
                            relance.statut === "Envoyee"
                              ? "text-green-600 dark:text-green-400"
                              : relance.statut === "EnAttente"
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-gray-600 dark:text-gray-400"
                          }`}
                        >
                          {relance.statut}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

