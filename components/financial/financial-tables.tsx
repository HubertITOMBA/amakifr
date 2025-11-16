"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
  SortingState,
  ColumnFiltersState,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Search,
  Filter,
  Download,
  Eye,
  Calendar,
  Euro,
  CreditCard,
  Receipt,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
} from "lucide-react";
import { filterCotisations, filterObligations, exportCotisationsPDF, exportObligationsPDF } from "@/actions/financial";
import { toast } from "sonner";

interface Cotisation {
  id: string;
  type: string;
  montant: number;
  dateCotisation: string;
  moyenPaiement: string;
  description?: string;
  reference?: string;
  statut: string;
}

interface Obligation {
  id: string;
  type: string;
  montantAttendu: number;
  montantPaye: number;
  montantRestant: number;
  dateEcheance: string;
  periode: string;
  statut: string;
  description?: string;
}

interface FinancialTablesProps {
  cotisations: Cotisation[];
  obligations: Obligation[];
  loading?: boolean;
}

// Fonctions utilitaires pour les couleurs
const getCotisationStatusColor = (status: string) => {
  switch (status) {
    case 'Valide':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-green-200 dark:border-green-800';
    case 'EnAttente':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 border-yellow-200 dark:border-yellow-800';
    case 'Annule':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border-red-200 dark:border-red-800';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200 border-gray-200 dark:border-gray-800';
  }
};

const getObligationStatusColor = (status: string) => {
  switch (status) {
    case 'Paye':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-green-200 dark:border-green-800';
    case 'PartiellementPaye':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border-blue-200 dark:border-blue-800';
    case 'EnAttente':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 border-yellow-200 dark:border-yellow-800';
    case 'EnRetard':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border-red-200 dark:border-red-800';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200 border-gray-200 dark:border-gray-800';
  }
};

const getTypeCotisationLabel = (type: string) => {
  switch (type) {
    case 'Forfait': return 'Forfait';
    case 'Assistance': return 'Assistance';
    case 'Anniversaire': return 'Anniversaire';
    case 'Adhesion': return 'Adhésion';
    default: return type;
  }
};

const getMoyenPaiementLabel = (moyen: string) => {
  switch (moyen) {
    case 'Especes': return 'Espèces';
    case 'Cheque': return 'Chèque';
    case 'Virement': return 'Virement';
    case 'CarteBancaire': return 'Carte bancaire';
    default: return moyen;
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'Valide':
    case 'Paye':
      return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    case 'EnAttente':
      return <Clock className="h-4 w-4 text-yellow-600" />;
    case 'PartiellementPaye':
      return <AlertCircle className="h-4 w-4 text-blue-600" />;
    case 'Annule':
    case 'EnRetard':
      return <XCircle className="h-4 w-4 text-red-600" />;
    default:
      return <Clock className="h-4 w-4 text-gray-600" />;
  }
};

export function FinancialTables({ cotisations, obligations, loading = false }: FinancialTablesProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [filteredCotisations, setFilteredCotisations] = useState(cotisations);
  const [filteredObligations, setFilteredObligations] = useState(obligations);
  const [isFiltering, setIsFiltering] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [searchCotisations, setSearchCotisations] = useState("");
  const [searchObligations, setSearchObligations] = useState("");
  const [activeTab, setActiveTab] = useState<string>("cotisations");

  // Debounce recherches
  const [searchCotisationsDebounced, setSearchCotisationsDebounced] = useState("");
  const [searchObligationsDebounced, setSearchObligationsDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setSearchCotisationsDebounced(searchCotisations), 300);
    return () => clearTimeout(t);
  }, [searchCotisations]);
  useEffect(() => {
    const t = setTimeout(() => setSearchObligationsDebounced(searchObligations), 300);
    return () => clearTimeout(t);
  }, [searchObligations]);

  // Mettre à jour les données filtrées quand les données originales changent
  React.useEffect(() => {
    setFilteredCotisations(cotisations);
  }, [cotisations]);

  React.useEffect(() => {
    setFilteredObligations(obligations);
  }, [obligations]);

  // Recherche côté client (debounced)
  useEffect(() => {
    const term = searchCotisationsDebounced.trim();
    if (term === "") {
      setFilteredCotisations(cotisations);
    } else {
      const filtered = cotisations.filter(cotisation => 
        cotisation.type.toLowerCase().includes(term.toLowerCase()) ||
        cotisation.statut.toLowerCase().includes(term.toLowerCase()) ||
        cotisation.reference?.toLowerCase().includes(term.toLowerCase()) ||
        cotisation.moyenPaiement.toLowerCase().includes(term.toLowerCase()) ||
        cotisation.montant.toString().includes(term)
      );
      setFilteredCotisations(filtered);
    }
  }, [searchCotisationsDebounced, cotisations]);

  useEffect(() => {
    const term = searchObligationsDebounced.trim();
    if (term === "") {
      setFilteredObligations(obligations);
    } else {
      const filtered = obligations.filter(obligation => 
        obligation.type.toLowerCase().includes(term.toLowerCase()) ||
        obligation.statut.toLowerCase().includes(term.toLowerCase()) ||
        obligation.periode.toLowerCase().includes(term.toLowerCase()) ||
        obligation.montantAttendu.toString().includes(term) ||
        obligation.montantPaye.toString().includes(term) ||
        obligation.montantRestant.toString().includes(term)
      );
      setFilteredObligations(filtered);
    }
  }, [searchObligationsDebounced, obligations]);

  // Fonction pour appliquer les filtres aux cotisations
  const handleFilterCotisations = async () => {
    setIsFiltering(true);
    try {
      const result = await filterCotisations({});
      if (result.success) {
        setFilteredCotisations(result.data || []);
        toast.success("Filtres appliqués avec succès");
      } else {
        toast.error(result.error || "Erreur lors du filtrage");
      }
    } catch (error) {
      toast.error("Erreur lors du filtrage des cotisations");
    } finally {
      setIsFiltering(false);
    }
  };

  // Fonction pour appliquer les filtres aux obligations
  const handleFilterObligations = async () => {
    setIsFiltering(true);
    try {
      const result = await filterObligations({});
      if (result.success) {
        setFilteredObligations(result.data || []);
        toast.success("Filtres appliqués avec succès");
      } else {
        toast.error(result.error || "Erreur lors du filtrage");
      }
    } catch (error) {
      toast.error("Erreur lors du filtrage des obligations");
    } finally {
      setIsFiltering(false);
    }
  };

  // Fonction pour exporter les cotisations en PDF
  const handleExportCotisations = async () => {
    setIsExporting(true);
    try {
      const result = await exportCotisationsPDF();
      if (result.success && result.pdfData && result.fileName) {
        // Créer un lien de téléchargement
        const link = document.createElement('a');
        link.href = result.pdfData;
        link.download = result.fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("Export PDF des cotisations réussi");
      } else {
        toast.error(result.error || "Erreur lors de l'export");
      }
    } catch (error) {
      toast.error("Erreur lors de l'export des cotisations");
    } finally {
      setIsExporting(false);
    }
  };

  // Fonction pour exporter les obligations en PDF
  const handleExportObligations = async () => {
    setIsExporting(true);
    try {
      const result = await exportObligationsPDF();
      if (result.success && result.pdfData && result.fileName) {
        // Créer un lien de téléchargement
        const link = document.createElement('a');
        link.href = result.pdfData;
        link.download = result.fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("Export PDF des obligations réussi");
      } else {
        toast.error(result.error || "Erreur lors de l'export");
      }
    } catch (error) {
      toast.error("Erreur lors de l'export des obligations");
    } finally {
      setIsExporting(false);
    }
  };

  // Colonnes pour les cotisations
  const cotisationsColumns: ColumnDef<Cotisation>[] = useMemo(
    () => [
      {
        accessorKey: "type",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-8 px-2 lg:px-3 font-semibold text-blue-700 dark:text-blue-300"
          >
            Type
            {column.getIsSorted() === "asc" ? (
              <ChevronUp className="ml-2 h-4 w-4" />
            ) : column.getIsSorted() === "desc" ? (
              <ChevronDown className="ml-2 h-4 w-4" />
            ) : null}
          </Button>
        ),
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-blue-600" />
            <span className="font-medium">{getTypeCotisationLabel(row.getValue("type"))}</span>
          </div>
        ),
      },
      {
        accessorKey: "montant",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-8 px-2 lg:px-3 font-semibold text-green-700 dark:text-green-300"
          >
            Montant
            {column.getIsSorted() === "asc" ? (
              <ChevronUp className="ml-2 h-4 w-4" />
            ) : column.getIsSorted() === "desc" ? (
              <ChevronDown className="ml-2 h-4 w-4" />
            ) : null}
          </Button>
        ),
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <span className="font-bold text-green-700 dark:text-green-300">
              {parseFloat(row.getValue("montant")).toFixed(2).replace('.', ',')} €
            </span>
          </div>
        ),
      },
      {
        accessorKey: "statut",
        header: "Statut",
        cell: ({ row }) => (
          <Badge className={`${getCotisationStatusColor(row.getValue("statut"))} flex items-center gap-1`}>
            {getStatusIcon(row.getValue("statut"))}
            {row.getValue("statut") === 'Valide' ? 'Validée' : 
             row.getValue("statut") === 'EnAttente' ? 'En attente' : 'Annulée'}
          </Badge>
        ),
      },
      {
        accessorKey: "moyenPaiement",
        header: "Moyen de paiement",
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-gray-600" />
            <span>{getMoyenPaiementLabel(row.getValue("moyenPaiement"))}</span>
          </div>
        ),
      },
      {
        accessorKey: "dateCotisation",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-8 px-2 lg:px-3 font-semibold text-purple-700 dark:text-purple-300"
          >
            Date
            {column.getIsSorted() === "asc" ? (
              <ChevronUp className="ml-2 h-4 w-4" />
            ) : column.getIsSorted() === "desc" ? (
              <ChevronDown className="ml-2 h-4 w-4" />
            ) : null}
          </Button>
        ),
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-purple-600" />
            <span>{new Date(row.getValue("dateCotisation")).toLocaleDateString('fr-FR')}</span>
          </div>
        ),
      },
      {
        accessorKey: "reference",
        header: "Référence",
        cell: ({ row }) => (
          <span className="font-mono text-sm text-gray-600 dark:text-gray-400">
            {row.getValue("reference") || "N/A"}
          </span>
        ),
      },
      {
        id: "actions",
        header: "Paiement",
        cell: ({ row }) => {
          const statut = row.getValue("statut");
          if (statut === 'Valide') {
            return (
              <div className="flex justify-end">
                <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-green-200 dark:border-green-800">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Payée
                </Badge>
              </div>
            );
          }
          return (
            <div className="flex justify-end">
              <a href={`/paiement?type=cotisation&id=${row.original.id}`}>
                <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
                  <CreditCard className="h-4 w-4 mr-2" />
                  Payer
                </Button>
              </a>
            </div>
          );
        },
      },
    ],
    []
  );

  // Colonnes pour les obligations
  const obligationsColumns: ColumnDef<Obligation>[] = useMemo(
    () => [
      {
        accessorKey: "type",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-8 px-2 lg:px-3 font-semibold text-blue-700 dark:text-blue-300"
          >
            Type
            {column.getIsSorted() === "asc" ? (
              <ChevronUp className="ml-2 h-4 w-4" />
            ) : column.getIsSorted() === "desc" ? (
              <ChevronDown className="ml-2 h-4 w-4" />
            ) : null}
          </Button>
        ),
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-orange-600" />
            <span className="font-medium">{getTypeCotisationLabel(row.getValue("type"))}</span>
          </div>
        ),
      },
      {
        accessorKey: "montantAttendu",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-8 px-2 lg:px-3 font-semibold text-gray-700 dark:text-gray-300"
          >
            Attendu
            {column.getIsSorted() === "asc" ? (
              <ChevronUp className="ml-2 h-4 w-4" />
            ) : column.getIsSorted() === "desc" ? (
              <ChevronDown className="ml-2 h-4 w-4" />
            ) : null}
          </Button>
        ),
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <span className="font-medium">{parseFloat(row.getValue("montantAttendu")).toFixed(2).replace('.', ',')} €</span>
          </div>
        ),
      },
      {
        accessorKey: "montantPaye",
        header: "Payé",
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <span className="font-medium text-green-700 dark:text-green-300">
              {parseFloat(row.getValue("montantPaye")).toFixed(2).replace('.', ',')} €
            </span>
          </div>
        ),
      },
      {
        accessorKey: "montantRestant",
        header: "Restant",
        cell: ({ row }) => {
          const montant = parseFloat(row.getValue("montantRestant"));
          return (
            <div className="flex items-center gap-2">
              <span className={`font-bold ${montant > 0 ? 'text-red-700 dark:text-red-300' : 'text-green-700 dark:text-green-300'}`}>
                {montant.toFixed(2).replace('.', ',')} €
              </span>
            </div>
          );
        },
      },
      {
        accessorKey: "statut",
        header: "Statut",
        cell: ({ row }) => (
          <Badge className={`${getObligationStatusColor(row.getValue("statut"))} flex items-center gap-1`}>
            {getStatusIcon(row.getValue("statut"))}
            {row.getValue("statut") === 'Paye' ? 'Payée' :
             row.getValue("statut") === 'PartiellementPaye' ? 'Partiellement payée' :
             row.getValue("statut") === 'EnAttente' ? 'En attente' : 'En retard'}
          </Badge>
        ),
      },
      {
        accessorKey: "dateEcheance",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-8 px-2 lg:px-3 font-semibold text-purple-700 dark:text-purple-300"
          >
            Échéance
            {column.getIsSorted() === "asc" ? (
              <ChevronUp className="ml-2 h-4 w-4" />
            ) : column.getIsSorted() === "desc" ? (
              <ChevronDown className="ml-2 h-4 w-4" />
            ) : null}
          </Button>
        ),
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-purple-600" />
            <span>{new Date(row.getValue("dateEcheance")).toLocaleDateString('fr-FR')}</span>
          </div>
        ),
      },
      {
        accessorKey: "periode",
        header: "Période",
        cell: ({ row }) => (
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {row.getValue("periode")}
          </span>
        ),
      },
      {
        id: "actions",
        header: "Paiement",
        cell: ({ row }) => {
          const statut = row.getValue("statut");
          if (statut === 'Paye') {
            return (
              <div className="flex justify-end">
                <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-green-200 dark:border-green-800">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Payée
                </Badge>
              </div>
            );
          }
          return (
            <div className="flex justify-end">
              <a href={`/paiement?type=obligation&id=${row.original.id}`}>
                <Button size="sm" variant="outline" className="border-orange-600 text-orange-700 hover:bg-orange-50 dark:hover:bg-orange-900/20">
                  <CreditCard className="h-4 w-4 mr-2" />
                  Régler
                </Button>
              </a>
            </div>
          );
        },
      },
    ],
    []
  );

  // Configuration des tables
  const cotisationsTable = useReactTable({
    data: filteredCotisations,
    columns: cotisationsColumns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    state: {
      sorting,
      columnFilters,
    },
    initialState: {
      pagination: {
        pageSize: 5,
      },
    },
  });

  const obligationsTable = useReactTable({
    data: filteredObligations,
    columns: obligationsColumns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    state: {
      sorting,
      columnFilters,
    },
    initialState: {
      pagination: {
        pageSize: 5,
      },
    },
  });

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <Tabs defaultValue="cotisations" className="w-full" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
          <TabsTrigger 
            value="cotisations" 
            className="flex items-center gap-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white"
          >
            <Receipt className="h-4 w-4" />
            Cotisations ({filteredCotisations.length})
          </TabsTrigger>
          <TabsTrigger 
            value="obligations"
            className="flex items-center gap-2 data-[state=active]:bg-orange-600 data-[state=active]:text-white"
          >
            <AlertCircle className="h-4 w-4" />
            Obligations ({filteredObligations.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="cotisations" className="space-y-2">
          {/* même contenu mais on rend seulement si onglet actif */}
          {activeTab === "cotisations" && (
            <Card className="border-blue-200 dark:border-blue-800">
              <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 pb-3 pt-3 px-6 gap-0">
                <CardTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-300 text-base">
                  <Receipt className="h-4 w-4" />
                  Cotisations Payées
                </CardTitle>
                <CardDescription className="text-xs mt-1">
                  Historique de vos cotisations avec détails de paiement
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {/* Barre de recherche */}
                <div className="p-3 border-b">
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          placeholder="Rechercher par type, montant, statut..."
                          value={searchCotisations}
                          onChange={(event) => setSearchCotisations(event.target.value)}
                          className="pl-10"
                        />
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={handleFilterCotisations}
                        disabled={isFiltering}
                      >
                        <Filter className="h-4 w-4 mr-2" />
                        {isFiltering ? "Filtrage..." : "Filtres"}
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={handleExportCotisations}
                        disabled={isExporting}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        {isExporting ? "Export..." : "Export"}
                      </Button>
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      {cotisationsTable.getHeaderGroups().map((headerGroup) => (
                        <TableRow key={headerGroup.id} className="bg-gray-50 dark:bg-gray-800">
                          {headerGroup.headers.map((header) => (
                            <TableHead key={header.id} className="font-semibold">
                              {header.isPlaceholder
                                ? null
                                : flexRender(header.column.columnDef.header, header.getContext())}
                            </TableHead>
                          ))}
                        </TableRow>
                      ))}
                    </TableHeader>
                    <TableBody>
                      {cotisationsTable.getRowModel().rows?.length ? (
                        cotisationsTable.getRowModel().rows.map((row) => (
                          <TableRow
                            key={row.id}
                            className="hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                          >
                            {row.getVisibleCells().map((cell) => (
                              <TableCell key={cell.id}>
                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={cotisationsColumns.length} className="h-24 text-center">
                            <div className="flex flex-col items-center gap-2">
                              <Receipt className="h-8 w-8 text-gray-400" />
                              <p className="text-gray-500">Aucune cotisation trouvée.</p>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>

              {/* Totaux */}
              <div className="p-3 border-t bg-blue-50 dark:bg-blue-900/10">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="text-center">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Total des cotisations</p>
                    <p className="text-lg font-bold text-blue-700 dark:text-blue-300">
                      {filteredCotisations.reduce((sum, cotisation) => sum + cotisation.montant, 0).toFixed(2).replace('.', ',')} €
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Cotisations validées</p>
                    <p className="text-lg font-bold text-green-700 dark:text-green-300">
                      {filteredCotisations
                        .filter(c => c.statut === 'Valide')
                        .reduce((sum, cotisation) => sum + cotisation.montant, 0).toFixed(2).replace('.', ',')} €
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-600 dark:text-gray-400">En attente</p>
                    <p className="text-lg font-bold text-yellow-700 dark:text-yellow-300">
                      {filteredCotisations
                        .filter(c => c.statut === 'EnAttente')
                        .reduce((sum, cotisation) => sum + cotisation.montant, 0).toFixed(2).replace('.', ',')} €
                    </p>
                  </div>
                </div>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between p-3 border-t">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Page {cotisationsTable.getState().pagination.pageIndex + 1} sur{" "}
                  {cotisationsTable.getPageCount()}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => cotisationsTable.previousPage()}
                    disabled={!cotisationsTable.getCanPreviousPage()}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Précédent
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => cotisationsTable.nextPage()}
                    disabled={!cotisationsTable.getCanNextPage()}
                  >
                    Suivant
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        </TabsContent>

        <TabsContent value="obligations" className="space-y-2">
          {activeTab === "obligations" && (
            <Card className="border-orange-200 dark:border-orange-800">
              <CardHeader className="bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 pb-3 pt-3 px-6 gap-0">
                <CardTitle className="flex items-center gap-2 text-orange-700 dark:text-orange-300 text-base">
                  <AlertCircle className="h-4 w-4" />
                  Obligations de Cotisation
                </CardTitle>
                <CardDescription className="text-xs mt-1">
                  Suivi de vos obligations avec montants attendus et restants
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {/* Barre de recherche */}
                <div className="p-3 border-b">
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          placeholder="Rechercher par type, statut, période..."
                          value={searchObligations}
                          onChange={(event) => setSearchObligations(event.target.value)}
                          className="pl-10"
                        />
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={handleFilterObligations}
                        disabled={isFiltering}
                      >
                        <Filter className="h-4 w-4 mr-2" />
                        {isFiltering ? "Filtrage..." : "Filtres"}
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={handleExportObligations}
                        disabled={isExporting}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        {isExporting ? "Export..." : "Export"}
                      </Button>
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      {obligationsTable.getHeaderGroups().map((headerGroup) => (
                        <TableRow key={headerGroup.id} className="bg-gray-50 dark:bg-gray-800">
                          {headerGroup.headers.map((header) => (
                            <TableHead key={header.id} className="font-semibold">
                              {header.isPlaceholder
                                ? null
                                : flexRender(header.column.columnDef.header, header.getContext())}
                            </TableHead>
                          ))}
                        </TableRow>
                      ))}
                    </TableHeader>
                    <TableBody>
                      {obligationsTable.getRowModel().rows?.length ? (
                        obligationsTable.getRowModel().rows.map((row) => (
                          <TableRow
                            key={row.id}
                            className="hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors"
                          >
                            {row.getVisibleCells().map((cell) => (
                              <TableCell key={cell.id}>
                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={obligationsColumns.length} className="h-24 text-center">
                            <div className="flex flex-col items-center gap-2">
                              <AlertCircle className="h-8 w-8 text-gray-400" />
                              <p className="text-gray-500">Aucune obligation trouvée.</p>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>

              {/* Totaux */}
              <div className="p-3 border-t bg-orange-50 dark:bg-orange-900/10">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="text-center">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Total attendu</p>
                    <p className="text-lg font-bold text-gray-700 dark:text-gray-300">
                      {filteredObligations.reduce((sum, obligation) => sum + obligation.montantAttendu, 0).toFixed(2).replace('.', ',')} €
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Total payé</p>
                    <p className="text-lg font-bold text-green-700 dark:text-green-300">
                      {filteredObligations.reduce((sum, obligation) => sum + obligation.montantPaye, 0).toFixed(2).replace('.', ',')} €
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Total restant</p>
                    <p className="text-lg font-bold text-red-700 dark:text-red-300">
                      {filteredObligations.reduce((sum, obligation) => sum + obligation.montantRestant, 0).toFixed(2).replace('.', ',')} €
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-600 dark:text-gray-400">En retard</p>
                    <p className="text-lg font-bold text-red-700 dark:text-red-300">
                      {filteredObligations
                        .filter(o => o.statut === 'EnRetard')
                        .reduce((sum, obligation) => sum + obligation.montantRestant, 0).toFixed(2).replace('.', ',')} €
                    </p>
                  </div>
                </div>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between p-3 border-t">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Page {obligationsTable.getState().pagination.pageIndex + 1} sur{" "}
                  {obligationsTable.getPageCount()}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => obligationsTable.previousPage()}
                    disabled={!obligationsTable.getCanPreviousPage()}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Précédent
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => obligationsTable.nextPage()}
                    disabled={!obligationsTable.getCanNextPage()}
                  >
                    Suivant
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
