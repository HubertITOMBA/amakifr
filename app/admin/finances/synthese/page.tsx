"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Euro,
  TrendingUp,
  TrendingDown,
  FileText,
  Download,
  RefreshCw,
  Search,
  BarChart3,
  Users,
  Receipt,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CreditCard,
  Wallet
} from "lucide-react";
import { getFinancialSynthese } from "@/actions/financial/synthese";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  createColumnHelper,
  getCoreRowModel,
  useReactTable,
  getSortedRowModel,
  SortingState,
  getFilteredRowModel,
  getPaginationRowModel,
  ColumnFiltersState,
  VisibilityState,
} from "@tanstack/react-table";
import { DataTable } from "@/components/admin/DataTable";
import { ColumnVisibilityToggle } from "@/components/admin/ColumnVisibilityToggle";

const columnHelper = createColumnHelper<any>();

interface SyntheseAdherent {
  id: string;
  nom: string;
  email: string;
  statut: string;
  dettesInitiales: number;
  cotisationMoisCourant: number;
  assistanceMoisCourant: number;
  totalCotisationsMensuelles: number;
  totalAssistances: number;
  totalAvoirs: number;
  totalPaye: number;
  detteTotale: number;
  detteNette: number;
  solde: number;
}

export default function SyntheseFinancierePage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [syntheseAdherents, setSyntheseAdherents] = useState<SyntheseAdherent[]>([]);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statutFilter, setStatutFilter] = useState<string>("all");
  const [detteFilter, setDetteFilter] = useState<string>("all");
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("admin-synthese-column-visibility");
        if (saved) return JSON.parse(saved);
      } catch (error) {
        console.error("Erreur lors du chargement des préférences:", error);
      }
    }
    return {};
  });

  // Debounce pour la recherche
  useEffect(() => {
    const timer = setTimeout(() => {
      setGlobalFilter(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const result = await getFinancialSynthese();
      if (result.success && result.data) {
        setData(result.data);
        setSyntheseAdherents(result.data.syntheseParAdherent || []);
      } else {
        toast.error(result.error || "Erreur lors du chargement de la synthèse");
      }
    } catch (error) {
      console.error("Erreur lors du chargement:", error);
      toast.error("Erreur lors du chargement de la synthèse");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filtrer les données
  const filteredData = useMemo(() => {
    return syntheseAdherents.filter((item) => {
      // Filtre global (recherche)
      if (globalFilter.trim()) {
        const q = globalFilter.trim().toLowerCase();
        const searchText = [
          item.nom || "",
          item.email || "",
        ].join(" ").toLowerCase();
        if (!searchText.includes(q)) return false;
      }

      // Filtre par statut
      if (statutFilter !== "all" && item.statut !== statutFilter) {
        return false;
      }

      // Filtre par dette
      if (detteFilter === "avec-dette" && item.detteNette <= 0) {
        return false;
      }
      if (detteFilter === "sans-dette" && item.detteNette > 0) {
        return false;
      }
      if (detteFilter === "avec-avoir" && item.totalAvoirs <= 0) {
        return false;
      }

      return true;
    });
  }, [syntheseAdherents, globalFilter, statutFilter, detteFilter]);

  const columns = useMemo(
    () => [
      columnHelper.accessor("nom", {
        header: "Adhérent",
        cell: ({ row }) => (
          <div className="min-w-[150px]">
            <div className="font-medium text-gray-900 dark:text-gray-100">
              {row.getValue("nom")}
            </div>
          </div>
        ),
        size: 200,
        minSize: 150,
        maxSize: 300,
        enableResizing: true,
      }),
      columnHelper.accessor("statut", {
        header: "Statut",
        cell: ({ row }) => {
          const statut = row.getValue("statut") as string;
          return (
            <Badge
              variant="outline"
              className={
                statut === "Actif"
                  ? "border-green-300 text-green-700 dark:border-green-700 dark:text-green-300"
                  : "border-gray-300 text-gray-700 dark:border-gray-700 dark:text-gray-300"
              }
            >
              {statut}
            </Badge>
          );
        },
        size: 100,
        minSize: 80,
        maxSize: 120,
        enableResizing: true,
      }),
      columnHelper.accessor("dettesInitiales", {
        header: "Dettes Initiales",
        cell: ({ row }) => {
          const value = row.getValue("dettesInitiales") as number;
          return (
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {value > 0 ? `${value.toFixed(2)} €` : "—"}
            </span>
          );
        },
        size: 130,
        minSize: 100,
        maxSize: 150,
        enableResizing: true,
      }),
      columnHelper.accessor("totalCotisationsMensuelles", {
        header: "Total Cotisations",
        cell: ({ row }) => {
          const value = row.getValue("totalCotisationsMensuelles") as number;
          return (
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {value > 0 ? `${value.toFixed(2)} €` : "—"}
            </span>
          );
        },
        size: 140,
        minSize: 120,
        maxSize: 160,
        enableResizing: true,
      }),
      columnHelper.accessor("totalAssistances", {
        header: "Total Assistances",
        cell: ({ row }) => {
          const value = row.getValue("totalAssistances") as number;
          return (
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {value > 0 ? `${value.toFixed(2)} €` : "—"}
            </span>
          );
        },
        size: 140,
        minSize: 120,
        maxSize: 160,
        enableResizing: true,
      }),
      columnHelper.accessor("totalAvoirs", {
        header: "Avoirs",
        cell: ({ row }) => {
          const value = row.getValue("totalAvoirs") as number;
          return (
            <span
              className={`text-sm font-medium ${
                value > 0
                  ? "text-green-600 dark:text-green-400"
                  : "text-gray-500 dark:text-gray-400"
              }`}
            >
              {value > 0 ? `${value.toFixed(2)} €` : "—"}
            </span>
          );
        },
        size: 100,
        minSize: 80,
        maxSize: 120,
        enableResizing: true,
      }),
      columnHelper.accessor("totalPaye", {
        header: "Total Payé",
        cell: ({ row }) => {
          const value = row.getValue("totalPaye") as number;
          return (
            <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
              {value > 0 ? `${value.toFixed(2)} €` : "—"}
            </span>
          );
        },
        size: 120,
        minSize: 100,
        maxSize: 140,
        enableResizing: true,
      }),
      columnHelper.accessor("detteTotale", {
        header: "Dette Totale",
        cell: ({ row }) => {
          const value = row.getValue("detteTotale") as number;
          return (
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {value > 0 ? `${value.toFixed(2)} €` : "—"}
            </span>
          );
        },
        size: 120,
        minSize: 100,
        maxSize: 140,
        enableResizing: true,
      }),
      columnHelper.accessor("detteNette", {
        header: "Dette Nette",
        cell: ({ row }) => {
          const value = row.getValue("detteNette") as number;
          return (
            <span
              className={`text-sm font-bold ${
                value > 0
                  ? "text-rose-600 dark:text-rose-400"
                  : "text-gray-500 dark:text-gray-400"
              }`}
            >
              {value > 0 ? `${value.toFixed(2)} €` : "—"}
            </span>
          );
        },
        size: 120,
        minSize: 100,
        maxSize: 140,
        enableResizing: true,
      }),
      columnHelper.accessor("solde", {
        header: "Solde",
        cell: ({ row }) => {
          const value = row.getValue("solde") as number;
          return (
            <span
              className={`text-sm font-bold ${
                value > 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : value < 0
                  ? "text-rose-600 dark:text-rose-400"
                  : "text-gray-500 dark:text-gray-400"
              }`}
            >
              {value !== 0 ? `${value > 0 ? "+" : ""}${value.toFixed(2)} €` : "—"}
            </span>
          );
        },
        size: 100,
        minSize: 80,
        maxSize: 120,
        enableResizing: true,
      }),
    ],
    []
  );

  const table = useReactTable({
    data: filteredData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: (updater) => {
      const newVisibility =
        typeof updater === "function" ? updater(columnVisibility) : updater;
      setColumnVisibility(newVisibility);
      try {
        localStorage.setItem(
          "admin-synthese-column-visibility",
          JSON.stringify(newVisibility)
        );
      } catch (error) {
        console.error("Erreur lors de la sauvegarde des préférences:", error);
      }
    },
    initialState: {
      pagination: {
        pageSize: 20,
      },
    },
    state: { sorting, columnFilters, globalFilter, columnVisibility },
    defaultColumn: {
      minSize: 50,
      maxSize: 800,
    },
  });

  const handleExportPDF = async () => {
    if (!data) {
      toast.error("Aucune donnée à exporter");
      return;
    }

    try {
      toast.loading("Génération du PDF en cours...");
      const { default: jsPDF } = await import("jspdf");
      const { addPDFHeader, addPDFFooter } = await import("@/lib/pdf-helpers-client");

      const doc = new jsPDF("l", "mm", "a4"); // Landscape pour plus d'espace
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      
      // En-tête avec logo et couleurs de l'association (uniquement sur la première page)
      await addPDFHeader(doc, "Synthèse Financière - AMAKI France");
      let yPos = 50; // Commencer après l'en-tête (hauteur réduite + marge réduite)

      // Date de génération
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.setFont('helvetica', 'normal');
      doc.text(
        `Généré le ${format(new Date(data.dateGeneration), "dd MMMM yyyy à HH:mm", {
          locale: fr,
        })}`,
        pageWidth - 20,
        yPos,
        { align: "right" }
      );
      yPos += 10;

      // Statistiques globales
      doc.setFontSize(14);
      doc.setTextColor(37, 99, 235); // blue-600
      doc.setFont('helvetica', 'bold');
      doc.text("Vue d'ensemble financière", 20, yPos);
      yPos += 8;

      doc.setFontSize(10);
      doc.setFont(undefined, "normal");
      const stats = data.stats;
      const statsData = [
        ["Recettes totales", `${stats.totalRecettes.toFixed(2)} €`],
        ["Dépenses totales", `${stats.totalDepenses.toFixed(2)} €`],
        ["Solde bancaire estimé", `${stats.soldeBancaireEstime.toFixed(2)} €`],
        ["Créances à recevoir", `${stats.totalCreances.toFixed(2)} €`],
        ["Dettes initiales", `${stats.totalDettesInitiales.toFixed(2)} €`],
        ["Cotisations mensuelles", `${stats.totalCotisationsMensuelles.toFixed(2)} €`],
        ["Assistances", `${stats.totalAssistances.toFixed(2)} €`],
        ["Avoirs disponibles", `${stats.totalAvoirs.toFixed(2)} €`],
        ["Nombre d'adhérents", `${stats.nombreAdherents}`],
        ["Adhérents avec dette", `${stats.nombreAdherentsAvecDette}`],
        ["Adhérents avec avoir", `${stats.nombreAdherentsAvecAvoir}`],
      ];

      let xPos = 20;
      statsData.forEach(([label, value], index) => {
        if (index % 2 === 0 && index > 0) {
          xPos = 20;
          yPos += 8;
        } else if (index > 0) {
          xPos = 110;
        }

        doc.text(label + " :", xPos, yPos);
        doc.setFont(undefined, "bold");
        doc.text(value, xPos + 60, yPos);
        doc.setFont(undefined, "normal");
      });

      yPos += 15;

      // Tableau des adhérents
      if (yPos > pageHeight - 60) {
        doc.addPage();
        // Pas d'en-tête sur les pages suivantes
        yPos = 20; // Commencer en haut de la page
      }

      doc.setFontSize(14);
      doc.setTextColor(37, 99, 235); // blue-600
      doc.setFont('helvetica', 'bold');
      doc.text("Détail par adhérent", 20, yPos);
      yPos += 8;

      // En-têtes du tableau avec fond bleu clair (comme les autres PDFs)
      doc.setFillColor(219, 234, 254); // blue-100
      doc.rect(10, yPos - 5, pageWidth - 20, 8, 'F');
      
      doc.setFontSize(8);
      doc.setTextColor(30, 64, 175); // blue-800
      doc.setFont('helvetica', 'bold');
      const headers = [
        "Adhérent",
        "Dettes Init.",
        "Total Cot.",
        "Total Assist.",
        "Avoirs",
        "Total Payé",
        "Dette Totale",
        "Dette Nette",
        "Solde",
      ];
      const colWidths = [45, 22, 22, 22, 18, 22, 22, 22, 18];
      let xStart = 10;

      headers.forEach((header, i) => {
        doc.text(header, xStart + 2, yPos - 1, { maxWidth: colWidths[i] - 4 });
        xStart += colWidths[i];
      });
      
      // Ligne de séparation bleue
      doc.setDrawColor(59, 130, 246); // blue-500
      doc.setLineWidth(0.5);
      doc.line(10, yPos + 3, pageWidth - 10, yPos + 3);
      
      yPos += 8;

      // Lignes du tableau
      doc.setFontSize(8);
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'normal');
      for (const adherent of filteredData) {
        if (yPos > pageHeight - 40) {
          doc.addPage();
          // Pas d'en-tête sur les pages suivantes
          yPos = 20; // Commencer en haut de la page
          
          // Réafficher les en-têtes du tableau sur la nouvelle page
          doc.setFillColor(219, 234, 254); // blue-100
          doc.rect(10, yPos - 5, pageWidth - 20, 8, 'F');
          doc.setTextColor(30, 64, 175); // blue-800
          doc.setFont('helvetica', 'bold');
          xStart = 10;
          headers.forEach((header, i) => {
            doc.text(header, xStart + 2, yPos - 1, { maxWidth: colWidths[i] - 4 });
            xStart += colWidths[i];
          });
          doc.setDrawColor(59, 130, 246); // blue-500
          doc.setLineWidth(0.5);
          doc.line(10, yPos + 3, pageWidth - 10, yPos + 3);
          yPos += 8;
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(0, 0, 0);
        }

        xStart = 10;
        const rowData = [
          adherent.nom.substring(0, 20),
          adherent.dettesInitiales > 0 ? `${adherent.dettesInitiales.toFixed(2)}` : "—",
          adherent.totalCotisationsMensuelles > 0 ? `${adherent.totalCotisationsMensuelles.toFixed(2)}` : "—",
          adherent.totalAssistances > 0 ? `${adherent.totalAssistances.toFixed(2)}` : "—",
          adherent.totalAvoirs > 0 ? `${adherent.totalAvoirs.toFixed(2)}` : "—",
          adherent.totalPaye > 0 ? `${adherent.totalPaye.toFixed(2)}` : "—",
          adherent.detteTotale > 0 ? `${adherent.detteTotale.toFixed(2)}` : "—",
          adherent.detteNette > 0 ? `${adherent.detteNette.toFixed(2)}` : "—",
          adherent.solde !== 0 ? `${adherent.solde > 0 ? "+" : ""}${adherent.solde.toFixed(2)}` : "—",
        ];

        rowData.forEach((cell, i) => {
          doc.text(cell, xStart + 1, yPos, { maxWidth: colWidths[i] - 2 });
          xStart += colWidths[i];
        });
        
        // Ligne de séparation entre les lignes
        doc.setDrawColor(200, 200, 200); // Gris clair
        doc.setLineWidth(0.1);
        doc.line(10, yPos + 3, pageWidth - 10, yPos + 3);
        
        yPos += 6;
      }

      // Ajouter le pied de page sur toutes les pages
      addPDFFooter(doc);
      
      // Sauvegarder le PDF
      const fileName = `synthese-financiere-${format(new Date(), "yyyy-MM-dd")}.pdf`;
      doc.save(fileName);
      toast.success("PDF généré avec succès");
    } catch (error) {
      console.error("Erreur lors de la génération du PDF:", error);
      toast.error("Erreur lors de la génération du PDF");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <p className="text-gray-700 dark:text-gray-300">
              Erreur lors du chargement des données
            </p>
            <Button onClick={loadData} className="mt-4">
              Réessayer
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const stats = data.stats;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50">
      <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <BarChart3 className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600" />
              Synthèse Financière
            </h1>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 mt-1">
              Vue d'ensemble complète de la situation financière de l'association
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              onClick={loadData}
              disabled={loading}
              className="w-full sm:w-auto"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Actualiser
            </Button>
            <Button
              onClick={handleExportPDF}
              className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white"
            >
              <Download className="h-4 w-4 mr-2" />
              Exporter PDF
            </Button>
          </div>
        </div>

        {/* Statistiques globales */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Card className="!py-0 shadow-lg border-2 border-emerald-200 dark:border-emerald-800/50">
            <CardHeader className="bg-gradient-to-r from-emerald-100 to-emerald-50 dark:from-emerald-900/30 dark:to-emerald-800/20 rounded-t-lg pb-3 pt-3 px-4 gap-0">
              <CardTitle className="flex items-center gap-2 text-base text-gray-700 dark:text-gray-200">
                <TrendingUp className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
                Recettes
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 pb-4 px-4">
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {stats.totalRecettes.toFixed(2)} €
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                {stats.nombrePaiements} paiement(s)
              </p>
            </CardContent>
          </Card>

          <Card className="!py-0 shadow-lg border-2 border-rose-200 dark:border-rose-800/50">
            <CardHeader className="bg-gradient-to-r from-rose-100 to-rose-50 dark:from-rose-900/30 dark:to-rose-800/20 rounded-t-lg pb-3 pt-3 px-4 gap-0">
              <CardTitle className="flex items-center gap-2 text-base text-gray-700 dark:text-gray-200">
                <TrendingDown className="h-4 w-4 text-rose-500 dark:text-rose-400" />
                Dépenses
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 pb-4 px-4">
              <p className="text-2xl font-bold text-rose-600 dark:text-rose-400">
                {stats.totalDepenses.toFixed(2)} €
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                {stats.nombreDepenses} dépense(s)
              </p>
            </CardContent>
          </Card>

          <Card className="!py-0 shadow-lg border-2 border-blue-200 dark:border-blue-800/50">
            <CardHeader className="bg-gradient-to-r from-blue-100 to-blue-50 dark:from-blue-900/30 dark:to-blue-800/20 rounded-t-lg pb-3 pt-3 px-4 gap-0">
              <CardTitle className="flex items-center gap-2 text-base text-gray-700 dark:text-gray-200">
                <Wallet className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                Solde Bancaire
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 pb-4 px-4">
              <p
                className={`text-2xl font-bold ${
                  stats.soldeBancaireEstime >= 0
                    ? "text-blue-600 dark:text-blue-400"
                    : "text-rose-600 dark:text-rose-400"
                }`}
              >
                {stats.soldeBancaireEstime.toFixed(2)} €
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                Recettes - Dépenses
              </p>
            </CardContent>
          </Card>

          <Card className="!py-0 shadow-lg border-2 border-amber-200 dark:border-amber-800/50">
            <CardHeader className="bg-gradient-to-r from-amber-100 to-amber-50 dark:from-amber-900/30 dark:to-amber-800/20 rounded-t-lg pb-3 pt-3 px-4 gap-0">
              <CardTitle className="flex items-center gap-2 text-base text-gray-700 dark:text-gray-200">
                <CreditCard className="h-4 w-4 text-amber-500 dark:text-amber-400" />
                Créances
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 pb-4 px-4">
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                {stats.totalCreances.toFixed(2)} €
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                À recevoir des adhérents
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tableau détaillé */}
        <Card className="!py-0 shadow-xl border-blue-200 dark:border-blue-800">
          <CardHeader className="bg-gradient-to-r from-blue-500/90 to-blue-600/90 dark:from-blue-600/90 dark:to-blue-700/90 text-white rounded-t-lg pb-3 sm:pb-4 pt-3 sm:pt-4 px-4 sm:px-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl font-bold">
                <Users className="h-5 w-5" />
                Détail par Adhérent ({filteredData.length})
              </CardTitle>
              <div className="flex items-center gap-2">
                <ColumnVisibilityToggle
                  table={table}
                  storageKey="admin-synthese-column-visibility"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            {/* Filtres */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Rechercher un adhérent..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-28"
                />
              </div>
              <Select value={statutFilter} onValueChange={setStatutFilter}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Filtrer par statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="Actif">Actifs</SelectItem>
                  <SelectItem value="Inactif">Inactifs</SelectItem>
                </SelectContent>
              </Select>
              <Select value={detteFilter} onValueChange={setDetteFilter}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Filtrer par dette" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="avec-dette">Avec dette</SelectItem>
                  <SelectItem value="sans-dette">Sans dette</SelectItem>
                  <SelectItem value="avec-avoir">Avec avoir</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {filteredData.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                Aucun adhérent trouvé
              </div>
            ) : (
              <>
                <div className="mb-4 text-sm text-gray-600 dark:text-gray-300">
                  {filteredData.length} adhérent(s) trouvé(s)
                </div>
                <DataTable table={table} emptyMessage="Aucun adhérent trouvé" compact={true} />

                {/* Pagination - Masquée sur mobile */}
                <div className="hidden md:flex bg-white dark:bg-gray-800 mt-5 items-center justify-between py-5 font-semibold rounded-xl shadow-xl border border-gray-200 dark:border-gray-700">
                  <div className="ml-5 mt-2 flex-1 text-sm text-muted-foreground dark:text-gray-400">
                    {table.getFilteredRowModel().rows.length} ligne(s) au total
                  </div>

                  <div className="flex items-center space-x-6 lg:space-x-8">
                    <div className="flex items-center space-x-2">
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Lignes par page
                      </p>
                      <Select
                        value={`${table.getState().pagination.pageSize}`}
                        onValueChange={(value) => {
                          table.setPageSize(Number(value));
                        }}
                      >
                        <SelectTrigger className="h-8 w-[70px]">
                          <SelectValue
                            placeholder={table.getState().pagination.pageSize}
                          />
                        </SelectTrigger>
                        <SelectContent side="top">
                          {[10, 20, 30, 40, 50].map((pageSize) => (
                            <SelectItem key={pageSize} value={`${pageSize}`}>
                              {pageSize}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center justify-center text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                      Page {table.getState().pagination.pageIndex + 1} sur {table.getPageCount()}
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        className="hidden h-8 w-8 p-0 lg:flex"
                        onClick={() => table.setPageIndex(0)}
                        disabled={!table.getCanPreviousPage()}
                      >
                        <span className="sr-only">Aller à la première page</span>
                        <ChevronsLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        className="h-8 w-8 p-0"
                        onClick={() => table.previousPage()}
                        disabled={!table.getCanPreviousPage()}
                      >
                        <span className="sr-only">Page précédente</span>
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        className="h-8 w-8 p-0"
                        onClick={() => table.nextPage()}
                        disabled={!table.getCanNextPage()}
                      >
                        <span className="sr-only">Page suivante</span>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        className="hidden h-8 w-8 p-0 lg:flex"
                        onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                        disabled={!table.getCanNextPage()}
                      >
                        <span className="sr-only">Aller à la dernière page</span>
                        <ChevronsRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

