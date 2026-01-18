"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExportDialog } from "@/components/admin/ExportDialog";
import {
  Users,
  Euro,
  Calendar,
  FileText,
  Vote,
  Mail,
  Download,
  RefreshCw,
  Database,
} from "lucide-react";
import { toast } from "sonner";
import {
  getAdherentsForExport,
  getCotisationsForExport,
  getPaiementsForExport,
  getEvenementsForExport,
  getInscriptionsEvenementsForExport,
  getElectionsResultsForExport,
  getDocumentsForExport,
  getRelancesForExport,
} from "@/actions/exports";

const exportTypes = [
  {
    id: "adherents",
    title: "Liste des Adhérents",
    description: "Export complet de tous les adhérents avec leurs informations",
    icon: Users,
    color: "blue",
    action: getAdherentsForExport,
  },
  {
    id: "cotisations",
    title: "Historique des Cotisations",
    description: "Toutes les cotisations enregistrées",
    icon: Euro,
    color: "green",
    action: getCotisationsForExport,
  },
  {
    id: "paiements",
    title: "Historique des Paiements",
    description: "Tous les paiements effectués",
    icon: Euro,
    color: "green",
    action: getPaiementsForExport,
  },
  {
    id: "evenements",
    title: "Liste des Événements",
    description: "Tous les événements créés",
    icon: Calendar,
    color: "purple",
    action: getEvenementsForExport,
  },
  {
    id: "inscriptions",
    title: "Inscriptions aux Événements",
    description: "Toutes les inscriptions aux événements",
    icon: Calendar,
    color: "purple",
    action: getInscriptionsEvenementsForExport,
  },
  {
    id: "elections",
    title: "Résultats des Élections",
    description: "Résultats et candidatures des élections",
    icon: Vote,
    color: "indigo",
    action: getElectionsResultsForExport,
  },
  {
    id: "documents",
    title: "Documents par Adhérent",
    description: "Liste de tous les documents uploadés",
    icon: FileText,
    color: "amber",
    action: getDocumentsForExport,
  },
  {
    id: "relances",
    title: "Relances Envoyées",
    description: "Historique des relances de paiement",
    icon: Mail,
    color: "red",
    action: getRelancesForExport,
  },
];

const colorClasses = {
  blue: {
    border: "border-blue-200 dark:border-blue-800/50",
    header: "bg-gradient-to-r from-blue-100 to-blue-50 dark:from-blue-900/30 dark:to-blue-800/20",
    icon: "text-blue-500 dark:text-blue-400",
  },
  green: {
    border: "border-green-200 dark:border-green-800/50",
    header: "bg-gradient-to-r from-green-100 to-green-50 dark:from-green-900/30 dark:to-green-800/20",
    icon: "text-green-500 dark:text-green-400",
  },
  purple: {
    border: "border-purple-200 dark:border-purple-800/50",
    header: "bg-gradient-to-r from-purple-100 to-purple-50 dark:from-purple-900/30 dark:to-purple-800/20",
    icon: "text-purple-500 dark:text-purple-400",
  },
  indigo: {
    border: "border-indigo-200 dark:border-indigo-800/50",
    header: "bg-gradient-to-r from-indigo-100 to-indigo-50 dark:from-indigo-900/30 dark:to-indigo-800/20",
    icon: "text-indigo-500 dark:text-indigo-400",
  },
  amber: {
    border: "border-amber-200 dark:border-amber-800/50",
    header: "bg-gradient-to-r from-amber-100 to-amber-50 dark:from-amber-900/30 dark:to-amber-800/20",
    icon: "text-amber-500 dark:text-amber-400",
  },
  red: {
    border: "border-red-200 dark:border-red-800/50",
    header: "bg-gradient-to-r from-red-100 to-red-50 dark:from-red-900/30 dark:to-red-800/20",
    icon: "text-red-500 dark:text-red-400",
  },
};

export default function ExportsPage() {
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [data, setData] = useState<Record<string, any[]>>({});

  const loadData = async (typeId: string, action: () => Promise<any>) => {
    try {
      setLoading((prev) => ({ ...prev, [typeId]: true }));
      const result = await action();
      if (result.success && result.data) {
        setData((prev) => ({ ...prev, [typeId]: result.data }));
        toast.success(`${result.data.length} élément(s) chargé(s)`);
      } else {
        toast.error(result.error || "Erreur lors du chargement");
      }
    } catch (error) {
      console.error("Erreur lors du chargement:", error);
      toast.error("Erreur lors du chargement des données");
    } finally {
      setLoading((prev) => ({ ...prev, [typeId]: false }));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-slate-900 dark:to-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Database className="h-8 w-8 text-blue-600" />
            Exports de Données
          </h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 mt-2">
            Exportez toutes les données de l'association au format Excel, CSV ou PDF
          </p>
        </div>

        {/* Grid des types d'export */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {exportTypes.map((exportType) => {
            const Icon = exportType.icon;
            const colors = colorClasses[exportType.color as keyof typeof colorClasses];
            const isLoading = loading[exportType.id];
            const exportData = data[exportType.id] || [];

            return (
              <Card
                key={exportType.id}
                className={`!py-0 border-2 bg-white dark:bg-gray-900 hover:shadow-lg transition-shadow ${colors.border}`}
              >
                <CardHeader className={`pt-4 px-4 sm:px-6 pb-3 rounded-t-lg ${colors.header}`}>
                  <CardTitle className="flex items-center space-x-2 text-base sm:text-lg text-gray-700 dark:text-gray-200">
                    <Icon className={`h-5 w-5 sm:h-6 sm:w-6 ${colors.icon}`} />
                    <span>{exportType.title}</span>
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm mt-1">
                    {exportType.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
                  <div className="space-y-3">
                    {exportData.length > 0 && (
                      <div className="text-sm text-gray-600 dark:text-gray-300">
                        <strong>{exportData.length}</strong> élément(s) chargé(s)
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => loadData(exportType.id, exportType.action)}
                        disabled={isLoading}
                        className="flex-1"
                      >
                        {isLoading ? (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            Chargement...
                          </>
                        ) : (
                          <>
                            <Download className="h-4 w-4 mr-2" />
                            Charger
                          </>
                        )}
                      </Button>
                      {exportData.length > 0 && (
                        <ExportDialog
                          data={exportData}
                          filename={exportType.id}
                          sheetName={exportType.title}
                          trigger={
                            <Button size="sm" className="flex-1">
                              <Download className="h-4 w-4 mr-2" />
                              Exporter
                            </Button>
                          }
                        />
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Informations */}
        <Card className="mt-8 !py-0 border-2 border-blue-200 dark:border-blue-800/50 bg-white dark:bg-gray-900">
          <CardHeader className="pt-4 px-4 sm:px-6 pb-3 bg-gradient-to-r from-blue-100 to-blue-50 dark:from-blue-900/30 dark:to-blue-800/20 rounded-t-lg">
            <CardTitle className="text-base sm:text-lg text-gray-700 dark:text-gray-200">
              Informations sur les Exports
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
            <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
              <p>
                <strong>Format Excel (.xlsx)</strong> : Format recommandé pour Excel, avec formatage et plusieurs
                feuilles possibles. Compatible avec Microsoft Excel, LibreOffice Calc, Google Sheets.
              </p>
              <p>
                <strong>Format CSV (.csv)</strong> : Format texte simple, compatible avec tous les tableurs. Les
                valeurs sont séparées par des points-virgules (;).
              </p>
              <p>
                <strong>Format PDF (.pdf)</strong> : Format document imprimable avec mise en page professionnelle,
                en-têtes et pieds de page. Idéal pour l'archivage et l'impression.
              </p>
              <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
                <strong>Note</strong> : Les exports incluent toutes les données disponibles. Pour filtrer les données,
                utilisez les pages de gestion correspondantes avant d'exporter.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

