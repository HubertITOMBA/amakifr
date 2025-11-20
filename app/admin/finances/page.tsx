"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Euro, TrendingUp, TrendingDown, AlertCircle, Receipt, HandHeart, FileText, RefreshCw, BarChart3, UserCheck } from "lucide-react";
import Link from "next/link";
import { getFinancialStats } from "@/actions/paiements";
import { toast } from "sonner";

export default function AdminFinancesPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalDettesInitiales: 0,
    totalPaiements: 0,
    totalAssistancesEnAttente: 0,
    nombreAdherentsAvecDette: 0,
    nombreDettesInitiales: 0,
    nombrePaiements: 0,
    nombreAssistances: 0,
  });

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      const res = await getFinancialStats();
      if (res.success && res.data) {
        setStats(res.data);
      } else {
        toast.error(res.error || "Erreur lors du chargement des statistiques");
      }
    } catch (error) {
      console.error("Erreur lors du chargement des statistiques:", error);
      toast.error("Erreur lors du chargement des statistiques");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50">
      <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Euro className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600" />
            Gestion Financière
          </h1>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0 mt-2">
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300">
              Gérez les cotisations, paiements, dettes et assistances
            </p>
            <Button
              variant="outline"
              onClick={loadStats}
              disabled={loading}
              className="w-full sm:w-auto"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Actualiser
            </Button>
          </div>
        </div>

        {/* Statistiques */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
          <Card className="shadow-lg border-2 border-rose-200 dark:border-rose-800/50 bg-white dark:bg-gray-900 !py-0">
            <CardHeader className="bg-gradient-to-r from-rose-100 to-rose-50 dark:from-rose-900/30 dark:to-rose-800/20 rounded-t-lg pb-3 sm:pb-4 pt-3 sm:pt-4 px-4 sm:px-6 gap-0">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg text-gray-700 dark:text-gray-200">
                <TrendingDown className="h-4 w-4 sm:h-5 sm:w-5 text-rose-500 dark:text-rose-400" />
                Dettes totales
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 sm:pt-6 pb-4 sm:pb-6 px-4 sm:px-6">
              {loading ? (
                <div className="animate-pulse">
                  <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
                </div>
              ) : (
                <div>
                  <p className="text-2xl sm:text-3xl font-bold text-rose-600 dark:text-rose-400">
                    {stats.totalDettesInitiales.toFixed(2)} €
                  </p>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {stats.nombreDettesInitiales} dette(s) • {stats.nombreAdherentsAvecDette} adhérent(s)
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-lg border-2 border-emerald-200 dark:border-emerald-800/50 bg-white dark:bg-gray-900 !py-0">
            <CardHeader className="bg-gradient-to-r from-emerald-100 to-emerald-50 dark:from-emerald-900/30 dark:to-emerald-800/20 rounded-t-lg pb-3 sm:pb-4 pt-3 sm:pt-4 px-4 sm:px-6 gap-0">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg text-gray-700 dark:text-gray-200">
                <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-500 dark:text-emerald-400" />
                Paiements totaux
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 sm:pt-6 pb-4 sm:pb-6 px-4 sm:px-6">
              {loading ? (
                <div className="animate-pulse">
                  <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
                </div>
              ) : (
                <div>
                  <p className="text-2xl sm:text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                    {stats.totalPaiements.toFixed(2)} €
                  </p>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {stats.nombrePaiements} paiement(s) enregistré(s)
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-lg border-2 border-violet-200 dark:border-violet-800/50 bg-white dark:bg-gray-900 !py-0">
            <CardHeader className="bg-gradient-to-r from-violet-100 to-violet-50 dark:from-violet-900/30 dark:to-violet-800/20 rounded-t-lg pb-3 sm:pb-4 pt-3 sm:pt-4 px-4 sm:px-6 gap-0">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg text-gray-700 dark:text-gray-200">
                <HandHeart className="h-4 w-4 sm:h-5 sm:w-5 text-violet-500 dark:text-violet-400" />
                Assistances en attente
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 sm:pt-6 pb-4 sm:pb-6 px-4 sm:px-6">
              {loading ? (
                <div className="animate-pulse">
                  <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
                </div>
              ) : (
                <div>
                  <p className="text-2xl sm:text-3xl font-bold text-violet-600 dark:text-violet-400">
                    {stats.totalAssistancesEnAttente.toFixed(2)} €
                  </p>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {stats.nombreAssistances} assistance(s) en attente
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-lg border-2 border-sky-200 dark:border-sky-800/50 bg-white dark:bg-gray-900 !py-0">
            <CardHeader className="bg-gradient-to-r from-sky-100 to-sky-50 dark:from-sky-900/30 dark:to-sky-800/20 rounded-t-lg pb-3 sm:pb-4 pt-3 sm:pt-4 px-4 sm:px-6 gap-0">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg text-gray-700 dark:text-gray-200">
                <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-sky-500 dark:text-sky-400" />
                Solde net
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 sm:pt-6 pb-4 sm:pb-6 px-4 sm:px-6">
              {loading ? (
                <div className="animate-pulse">
                  <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
                </div>
              ) : (
                <div>
                  <p className={`text-2xl sm:text-3xl font-bold ${
                    (stats.totalDettesInitiales + stats.totalAssistancesEnAttente - stats.totalPaiements) >= 0
                      ? "text-rose-600 dark:text-rose-400"
                      : "text-emerald-600 dark:text-emerald-400"
                  }`}>
                    {(stats.totalDettesInitiales + stats.totalAssistancesEnAttente - stats.totalPaiements).toFixed(2)} €
                  </p>
                  <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 mt-1">
                    Dettes - Paiements
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Cards de navigation */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
          <Link href="/admin/finances/frais-adhesion">
            <Card className="shadow-lg border-2 border-indigo-200 dark:border-indigo-800/50 bg-white dark:bg-gray-900 hover:shadow-xl transition-all duration-300 cursor-pointer h-full !py-0">
              <CardHeader className="bg-gradient-to-r from-indigo-100 to-indigo-50 dark:from-indigo-900/30 dark:to-indigo-800/20 rounded-t-lg pb-3 sm:pb-4 pt-3 sm:pt-4 px-4 sm:px-6 gap-0">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg text-gray-700 dark:text-gray-200">
                  <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-indigo-500 dark:text-indigo-400" />
                  Frais d'Adhésion
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 sm:pt-6 pb-4 sm:pb-6 px-4 sm:px-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-700 dark:text-gray-300">Gérer les frais</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Anciens / Nouveaux</p>
                  </div>
                  <UserCheck className="h-8 w-8 text-indigo-500 dark:text-indigo-400" />
                </div>
              </CardContent>
            </Card>
          </Link>
          <Link href="/admin/finances/dettes">
            <Card className="shadow-lg border-2 border-blue-200 dark:border-blue-800/50 bg-white dark:bg-gray-900 hover:shadow-xl transition-all duration-300 cursor-pointer h-full !py-0">
              <CardHeader className="bg-gradient-to-r from-blue-100 to-blue-50 dark:from-blue-900/30 dark:to-blue-800/20 rounded-t-lg pb-3 sm:pb-4 pt-3 sm:pt-4 px-4 sm:px-6 gap-0">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg text-gray-700 dark:text-gray-200">
                  <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-blue-500 dark:text-blue-400" />
                  Dettes Initiales
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 sm:pt-6 pb-4 sm:pb-6 px-4 sm:px-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-700 dark:text-gray-300">Gérer les dettes</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">2024, 2025, etc.</p>
                  </div>
                  <TrendingDown className="h-8 w-8 text-blue-500 dark:text-blue-400" />
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/admin/finances/paiements">
            <Card className="shadow-lg border-2 border-emerald-200 dark:border-emerald-800/50 bg-white dark:bg-gray-900 hover:shadow-xl transition-all duration-300 cursor-pointer h-full !py-0">
              <CardHeader className="bg-gradient-to-r from-emerald-100 to-emerald-50 dark:from-emerald-900/30 dark:to-emerald-800/20 rounded-t-lg pb-3 sm:pb-4 pt-3 sm:pt-4 px-4 sm:px-6 gap-0">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg text-gray-700 dark:text-gray-200">
                  <Receipt className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-500 dark:text-emerald-400" />
                  Paiements
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 sm:pt-6 pb-4 sm:pb-6 px-4 sm:px-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-700 dark:text-gray-300">Enregistrer les paiements</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Partiels ou complets</p>
                  </div>
                  <Euro className="h-8 w-8 text-emerald-500 dark:text-emerald-400" />
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/admin/finances/assistances">
            <Card className="shadow-lg border-2 border-violet-200 dark:border-violet-800/50 bg-white dark:bg-gray-900 hover:shadow-xl transition-all duration-300 cursor-pointer h-full !py-0">
              <CardHeader className="bg-gradient-to-r from-violet-100 to-violet-50 dark:from-violet-900/30 dark:to-violet-800/20 rounded-t-lg pb-3 sm:pb-4 pt-3 sm:pt-4 px-4 sm:px-6 gap-0">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg text-gray-700 dark:text-gray-200">
                  <HandHeart className="h-5 w-5 sm:h-6 sm:w-6 text-violet-500 dark:text-violet-400" />
                  Assistances
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 sm:pt-6 pb-4 sm:pb-6 px-4 sm:px-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-700 dark:text-gray-300">Gérer les assistances</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">50€ par événement</p>
                  </div>
                  <HandHeart className="h-8 w-8 text-violet-500 dark:text-violet-400" />
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/admin/finances/relances">
            <Card className="shadow-lg border-2 border-amber-200 dark:border-amber-800/50 bg-white dark:bg-gray-900 hover:shadow-xl transition-all duration-300 cursor-pointer h-full !py-0">
              <CardHeader className="bg-gradient-to-r from-amber-100 to-amber-50 dark:from-amber-900/30 dark:to-amber-800/20 rounded-t-lg pb-3 sm:pb-4 pt-3 sm:pt-4 px-4 sm:px-6 gap-0">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg text-gray-700 dark:text-gray-200">
                  <AlertCircle className="h-5 w-5 sm:h-6 sm:w-6 text-amber-500 dark:text-amber-400" />
                  Relances
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 sm:pt-6 pb-4 sm:pb-6 px-4 sm:px-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-700 dark:text-gray-300">Gérer les relances</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Automatiques</p>
                  </div>
                  <AlertCircle className="h-8 w-8 text-amber-500 dark:text-amber-400" />
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Card Synthèse Financière */}
        <Link href="/admin/finances/synthese">
          <Card className="shadow-lg border-2 border-indigo-200 dark:border-indigo-800/50 bg-white dark:bg-gray-900 hover:shadow-xl transition-all duration-300 cursor-pointer !py-0">
            <CardHeader className="bg-gradient-to-r from-indigo-100 to-indigo-50 dark:from-indigo-900/30 dark:to-indigo-800/20 rounded-t-lg pb-3 sm:pb-4 pt-3 sm:pt-4 px-4 sm:px-6 gap-0">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg text-gray-700 dark:text-gray-200">
                <BarChart3 className="h-5 w-5 sm:h-6 sm:w-6 text-indigo-500 dark:text-indigo-400" />
                Synthèse Financière
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 sm:pt-6 pb-4 sm:pb-6 px-4 sm:px-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-700 dark:text-gray-300">Tableau de bord complet</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Export PDF • Tri • Filtres</p>
                </div>
                <BarChart3 className="h-8 w-8 text-indigo-500 dark:text-indigo-400" />
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* Informations */}
        <Card className="shadow-lg border-2 border-slate-200 dark:border-slate-800/50 bg-white dark:bg-gray-900 !py-0">
          <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900/30 dark:to-slate-800/20 border-b pb-4 pt-4 px-6 gap-0">
            <CardTitle className="flex items-center gap-2 text-gray-700 dark:text-gray-200">
              <Euro className="h-5 w-5 text-slate-500 dark:text-slate-400" />
              Informations
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 pb-6 px-6">
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">Cotisation mensuelle</h3>
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  Montant : <strong>15,00 €</strong> (peut être modifié par vote en comité)
                </p>
              </div>
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                <h3 className="font-semibold text-green-900 dark:text-green-100 mb-2">Assistance</h3>
                <p className="text-sm text-green-800 dark:text-green-200">
                  Montant : <strong>50,00 €</strong> pour naissance, décès, anniversaire en salle ou mariage
                </p>
              </div>
              <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
                <h3 className="font-semibold text-orange-900 dark:text-orange-100 mb-2">Relances automatiques</h3>
                <p className="text-sm text-orange-800 dark:text-orange-200">
                  Les relances sont envoyées automatiquement lorsque la dette d'un adhérent dépasse <strong>3 fois le montant de la cotisation mensuelle</strong> (45,00 €)
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

