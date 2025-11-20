"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Organigramme } from "@/components/admin/Organigramme";
import { MetricCard } from "@/components/admin/MetricCard";
import { AlertCard } from "@/components/admin/AlertCard";
import {
  Users,
  History,
  AlertTriangle,
  RefreshCw,
  Building2,
  Calendar,
} from "lucide-react";
import { toast } from "sonner";
import {
  getBureauActuel,
  getHistoriqueMandats,
  getAlertesFinMandat,
  getBureauStats,
} from "@/actions/bureau";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export default function BureauPage() {
  const [loading, setLoading] = useState(true);
  const [bureau, setBureau] = useState<any>(null);
  const [historique, setHistorique] = useState<any[]>([]);
  const [alertes, setAlertes] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [bureauResult, historiqueResult, alertesResult, statsResult] = await Promise.all([
        getBureauActuel(),
        getHistoriqueMandats(),
        getAlertesFinMandat(),
        getBureauStats(),
      ]);

      if (bureauResult.success && bureauResult.data) {
        setBureau(bureauResult.data);
      }

      if (historiqueResult.success && historiqueResult.data) {
        setHistorique(historiqueResult.data);
      }

      if (alertesResult.success && alertesResult.data) {
        setAlertes(alertesResult.data);
      }

      if (statsResult.success && statsResult.data) {
        setStats(statsResult.data);
      }
    } catch (error) {
      console.error("Erreur lors du chargement:", error);
      toast.error("Erreur lors du chargement des données");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-300">Chargement du bureau...</p>
        </div>
      </div>
    );
  }

  // Préparer les alertes pour AlertCard
  const alertesFormatees = alertes.map((alerte) => ({
    id: alerte.id,
    type: "election" as const,
    title: `${alerte.poste} - ${alerte.adherent}`,
    description: `Mandat expire dans ${alerte.joursRestants} jour(s)`,
    date: alerte.dateFinMandat,
  }));

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-slate-900 dark:to-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Building2 className="h-8 w-8 text-blue-600" />
            Gestion du Bureau
          </h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 mt-2">
            Visualisez et gérez la structure organisationnelle de l'association
          </p>
        </div>

        {/* Métriques */}
        {stats && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-8">
            <MetricCard
              title="Membres du Bureau"
              value={stats.nombreMembres}
              icon={Users}
              color="blue"
            />
            <MetricCard
              title="Mandats Expirant"
              value={stats.mandatsExpirant}
              icon={AlertTriangle}
              color="amber"
              description="Dans les 3 prochains mois"
            />
            <MetricCard
              title="Mandats Expirés"
              value={stats.mandatsExpires}
              icon={History}
              color="red"
            />
          </div>
        )}

        {/* Organigramme */}
        <div className="mb-8">
          <Organigramme
            membres={bureau?.membres || []}
            election={bureau?.election || null}
          />
        </div>

        {/* Alertes et Historique */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <AlertCard
            alerts={alertesFormatees}
            title="Alertes de Fin de Mandat"
            icon={AlertTriangle}
            color="amber"
          />

          <Card className="!py-0 border-2 border-indigo-200 dark:border-indigo-800/50 bg-white dark:bg-gray-900">
            <CardHeader className="pt-4 px-4 sm:px-6 pb-3 bg-gradient-to-r from-indigo-100 to-indigo-50 dark:from-indigo-900/30 dark:to-indigo-800/20 rounded-t-lg">
              <CardTitle className="flex items-center space-x-2 text-base sm:text-lg text-gray-700 dark:text-gray-200">
                <History className="h-4 w-4 sm:h-5 sm:w-5 text-indigo-500 dark:text-indigo-400" />
                <span>Historique des Mandats</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
              {historique.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                  Aucun historique disponible
                </p>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {historique.map((mandat) => (
                    <div
                      key={mandat.id}
                      className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                          {mandat.poste}
                        </h4>
                        <Badge variant="outline" className="text-xs">
                          {mandat.nombreVotes} vote{mandat.nombreVotes > 1 ? "s" : ""}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                        {mandat.adherent}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                        <span>
                          <Calendar className="h-3 w-3 inline mr-1" />
                          {format(new Date(mandat.dateDebutMandat), "dd/MM/yyyy", { locale: fr })} -{" "}
                          {format(new Date(mandat.dateFinMandat), "dd/MM/yyyy", { locale: fr })}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        {mandat.election} ({format(new Date(mandat.dateElection), "yyyy", { locale: fr })})
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Informations */}
        <Card className="mt-8 !py-0 border-2 border-blue-200 dark:border-blue-800/50 bg-white dark:bg-gray-900">
          <CardHeader className="pt-4 px-4 sm:px-6 pb-3 bg-gradient-to-r from-blue-100 to-blue-50 dark:from-blue-900/30 dark:to-blue-800/20 rounded-t-lg">
            <CardTitle className="text-base sm:text-lg text-gray-700 dark:text-gray-200">
              Informations sur le Bureau
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
            <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
              <p>
                <strong>Organigramme :</strong> L'organigramme est basé sur la dernière élection clôturée.
                Les membres sont affichés selon leur hiérarchie dans le bureau.
              </p>
              <p>
                <strong>Mandats :</strong> Les dates de début et fin de mandat sont calculées automatiquement
                à partir de la date de clôture de l'élection et de la durée du mandat définie pour chaque poste.
              </p>
              <p>
                <strong>Alertes :</strong> Les alertes sont générées automatiquement pour les mandats expirant
                dans les 3 prochains mois.
              </p>
              {bureau?.election && (
                <p className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <strong>Dernière élection :</strong> {bureau.election.titre} (
                  {format(new Date(bureau.election.dateCloture), "dd MMMM yyyy", { locale: fr })})
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

