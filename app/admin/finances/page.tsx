"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Euro, TrendingUp, TrendingDown, AlertCircle, DollarSign, Receipt, HandHeart, FileText, RefreshCw } from "lucide-react";
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
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Euro className="h-8 w-8 text-blue-600" />
            Gestion Financière
          </h1>
          <div className="flex items-center justify-between">
            <p className="text-gray-600 dark:text-gray-300 mt-2">
              Gérez les cotisations, paiements, dettes et assistances
            </p>
            <Button
              variant="outline"
              onClick={loadStats}
              disabled={loading}
              className="mt-2"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Actualiser
            </Button>
          </div>
        </div>

        {/* Statistiques */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="shadow-lg border-red-200 dark:border-red-700/50 bg-white dark:bg-gray-900 !py-0">
            <CardHeader className="bg-gradient-to-r from-red-500 to-red-600 dark:from-red-600 dark:to-red-700 text-white rounded-t-lg pb-4 pt-4 px-6 gap-0">
              <CardTitle className="flex items-center gap-2 text-lg">
                <TrendingDown className="h-5 w-5" />
                Dettes totales
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 pb-6 px-6">
              {loading ? (
                <div className="animate-pulse">
                  <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
                </div>
              ) : (
                <div>
                  <p className="text-3xl font-bold text-red-600 dark:text-red-300">
                    {stats.totalDettesInitiales.toFixed(2)} €
                  </p>
                  <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                    {stats.nombreDettesInitiales} dette(s) • {stats.nombreAdherentsAvecDette} adhérent(s)
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-lg border-green-200 dark:border-green-700/50 bg-white dark:bg-gray-900 !py-0">
            <CardHeader className="bg-gradient-to-r from-green-500 to-green-600 dark:from-green-600 dark:to-green-700 text-white rounded-t-lg pb-4 pt-4 px-6 gap-0">
              <CardTitle className="flex items-center gap-2 text-lg">
                <TrendingUp className="h-5 w-5" />
                Paiements totaux
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 pb-6 px-6">
              {loading ? (
                <div className="animate-pulse">
                  <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
                </div>
              ) : (
                <div>
                  <p className="text-3xl font-bold text-green-600 dark:text-green-300">
                    {stats.totalPaiements.toFixed(2)} €
                  </p>
                  <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                    {stats.nombrePaiements} paiement(s) enregistré(s)
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-lg border-purple-200 dark:border-purple-700/50 bg-white dark:bg-gray-900 !py-0">
            <CardHeader className="bg-gradient-to-r from-purple-500 to-purple-600 dark:from-purple-600 dark:to-purple-700 text-white rounded-t-lg pb-4 pt-4 px-6 gap-0">
              <CardTitle className="flex items-center gap-2 text-lg">
                <HandHeart className="h-5 w-5" />
                Assistances en attente
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 pb-6 px-6">
              {loading ? (
                <div className="animate-pulse">
                  <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
                </div>
              ) : (
                <div>
                  <p className="text-3xl font-bold text-purple-600 dark:text-purple-300">
                    {stats.totalAssistancesEnAttente.toFixed(2)} €
                  </p>
                  <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                    {stats.nombreAssistances} assistance(s) en attente
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-lg border-blue-200 dark:border-blue-700/50 bg-white dark:bg-gray-900 !py-0">
            <CardHeader className="bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 text-white rounded-t-lg pb-4 pt-4 px-6 gap-0">
              <CardTitle className="flex items-center gap-2 text-lg">
                <AlertCircle className="h-5 w-5" />
                Solde net
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 pb-6 px-6">
              {loading ? (
                <div className="animate-pulse">
                  <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
                </div>
              ) : (
                <div>
                  <p className={`text-3xl font-bold ${
                    (stats.totalDettesInitiales + stats.totalAssistancesEnAttente - stats.totalPaiements) >= 0
                      ? "text-red-600 dark:text-red-300"
                      : "text-green-600 dark:text-green-300"
                  }`}>
                    {(stats.totalDettesInitiales + stats.totalAssistancesEnAttente - stats.totalPaiements).toFixed(2)} €
                  </p>
                  <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                    Dettes - Paiements
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Cards de navigation */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Link href="/admin/finances/dettes">
            <Card className="shadow-lg border-blue-200 dark:border-blue-700/50 bg-white dark:bg-gray-900 hover:shadow-xl transition-all duration-300 cursor-pointer h-full !py-0">
              <CardHeader className="bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 text-white rounded-t-lg pb-4 pt-4 px-6 gap-0">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-6 w-6" />
                  Dettes Initiales
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 pb-6 px-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-700 dark:text-gray-300">Gérer les dettes</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">2024, 2025, etc.</p>
                  </div>
                  <TrendingDown className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/admin/finances/paiements">
            <Card className="shadow-lg border-green-200 dark:border-green-700/50 bg-white dark:bg-gray-900 hover:shadow-xl transition-all duration-300 cursor-pointer h-full !py-0">
              <CardHeader className="bg-gradient-to-r from-green-500 to-green-600 dark:from-green-600 dark:to-green-700 text-white rounded-t-lg pb-4 pt-4 px-6 gap-0">
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="h-6 w-6" />
                  Paiements
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 pb-6 px-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-700 dark:text-gray-300">Enregistrer les paiements</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Partiels ou complets</p>
                  </div>
                  <DollarSign className="h-8 w-8 text-green-600 dark:text-green-400" />
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/admin/finances/assistances">
            <Card className="shadow-lg border-purple-200 dark:border-purple-700/50 bg-white dark:bg-gray-900 hover:shadow-xl transition-all duration-300 cursor-pointer h-full !py-0">
              <CardHeader className="bg-gradient-to-r from-purple-500 to-purple-600 dark:from-purple-600 dark:to-purple-700 text-white rounded-t-lg pb-4 pt-4 px-6 gap-0">
                <CardTitle className="flex items-center gap-2">
                  <HandHeart className="h-6 w-6" />
                  Assistances
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 pb-6 px-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-700 dark:text-gray-300">Gérer les assistances</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">50€ par événement</p>
                  </div>
                  <HandHeart className="h-8 w-8 text-purple-600 dark:text-purple-400" />
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/admin/finances/relances">
            <Card className="shadow-lg border-orange-200 dark:border-orange-700/50 bg-white dark:bg-gray-900 hover:shadow-xl transition-all duration-300 cursor-pointer h-full !py-0">
              <CardHeader className="bg-gradient-to-r from-orange-500 to-orange-600 dark:from-orange-600 dark:to-orange-700 text-white rounded-t-lg pb-4 pt-4 px-6 gap-0">
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-6 w-6" />
                  Relances
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 pb-6 px-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-700 dark:text-gray-300">Gérer les relances</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Automatiques</p>
                  </div>
                  <AlertCircle className="h-8 w-8 text-orange-600 dark:text-orange-400" />
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Informations */}
        <Card className="shadow-lg border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 !py-0">
          <CardHeader className="bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-800 dark:to-gray-800 border-b pb-4 pt-4 px-6 gap-0">
            <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
              <Euro className="h-5 w-5 text-blue-600 dark:text-blue-400" />
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

