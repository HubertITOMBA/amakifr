"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  AlertCircle, 
  Search, 
  Send,
  Mail,
  Calendar,
  User,
  Euro,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight
} from "lucide-react";
import { toast } from "sonner";
import { checkAndSendRelances } from "@/actions/paiements";
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
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const columnHelper = createColumnHelper<any>();

export default function AdminRelancesPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statutFilter, setStatutFilter] = useState<string>("all");
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("admin-relances-column-visibility");
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
      // Pour l'instant, on simule des données
      // Plus tard, on pourra récupérer les relances depuis la base
      setData([]);
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors du chargement des données");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCheckRelances = async () => {
    try {
      setProcessing(true);
      const result = await checkAndSendRelances();
      if (result.success) {
        toast.success(result.message);
        loadData();
      } else {
        toast.error(result.error || "Erreur lors de la vérification");
      }
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de la vérification");
    } finally {
      setProcessing(false);
    }
  };

  // Filtrer les données
  const filteredData = useMemo(() => {
    return data.filter((item) => {
      // Filtre global (recherche)
      if (globalFilter.trim()) {
        const q = globalFilter.trim().toLowerCase();
        const searchText = [
          item.Adherent?.firstname || "",
          item.Adherent?.lastname || "",
          item.Adherent?.User?.email || "",
          item.contenu || "",
        ].join(" ").toLowerCase();
        if (!searchText.includes(q)) return false;
      }
      
      // Filtre par statut
      if (statutFilter !== "all" && item.statut !== statutFilter) {
        return false;
      }
      
      return true;
    });
  }, [data, globalFilter, statutFilter]);

  const columns = useMemo(() => [
    columnHelper.accessor("Adherent", {
      header: "Adhérent",
      cell: ({ row }) => {
        const adherent = row.original.Adherent;
        return (
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-gray-400" />
            <span className="text-sm text-gray-900 dark:text-gray-100">
              {adherent?.firstname} {adherent?.lastname}
            </span>
          </div>
        );
      },
      size: 200,
      minSize: 150,
      maxSize: 300,
      enableResizing: true,
    }),
    columnHelper.accessor("montantRappele", {
      header: "Montant rappelé",
      cell: ({ row }) => {
        const montant = row.getValue("montantRappele");
        return (
          <span className="text-sm font-semibold text-red-600 dark:text-red-400">
            {montant ? Number(montant).toFixed(2) : "—"} €
          </span>
        );
      },
      size: 150,
      minSize: 120,
      maxSize: 200,
      enableResizing: true,
    }),
    columnHelper.accessor("type", {
      header: "Type",
      cell: ({ row }) => {
        const type = row.getValue("type");
        return (
          <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
            {type === "Email" ? "Email" : type}
          </Badge>
        );
      },
      size: 100,
      minSize: 80,
      maxSize: 150,
      enableResizing: true,
    }),
    columnHelper.accessor("statut", {
      header: "Statut",
      cell: ({ row }) => {
        const statut = row.getValue("statut");
        return (
          <Badge className={
            statut === "Envoye" 
              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
              : statut === "Lu"
              ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
              : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
          }>
            {statut === "Envoye" ? "Envoyé" : statut === "Lu" ? "Lu" : "En attente"}
          </Badge>
        );
      },
      size: 120,
      minSize: 100,
      maxSize: 150,
      enableResizing: true,
    }),
    columnHelper.accessor("dateEnvoi", {
      header: "Date d'envoi",
      cell: ({ row }) => {
        const date = row.getValue("dateEnvoi");
        return date ? (
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-400" />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {format(new Date(date), "d MMM yyyy", { locale: fr })}
            </span>
          </div>
        ) : (
          <span className="text-sm text-gray-400">—</span>
        );
      },
      size: 150,
      minSize: 120,
      maxSize: 200,
      enableResizing: true,
    }),
  ], []);

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
      const newVisibility = typeof updater === "function" ? updater(columnVisibility) : updater;
      setColumnVisibility(newVisibility);
      try {
        localStorage.setItem("admin-relances-column-visibility", JSON.stringify(newVisibility));
      } catch (error) {
        console.error("Erreur lors de la sauvegarde des préférences:", error);
      }
    },
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
    state: { sorting, columnFilters, globalFilter, columnVisibility },
    defaultColumn: {
      minSize: 50,
      maxSize: 800,
    },
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50">
      <div className="p-4 sm:p-6">
        <Card className="mx-auto max-w-7xl shadow-lg border-2 border-amber-200 dark:border-amber-800/50 bg-white dark:bg-gray-900 !py-0">
          <CardHeader className="bg-gradient-to-r from-amber-100 to-amber-50 dark:from-amber-900/30 dark:to-amber-800/20 pb-3 sm:pb-4 pt-3 sm:pt-4 px-4 sm:px-6 gap-0">
            <div className="flex flex-col gap-3 sm:gap-0">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg sm:text-xl text-gray-700 dark:text-gray-200 font-bold">
                  <AlertCircle className="h-5 w-5 text-amber-500 dark:text-amber-400" />
                  Relances ({filteredData.length})
                </CardTitle>
                <ColumnVisibilityToggle 
                  table={table} 
                  storageKey="admin-relances-column-visibility"
                />
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  className="bg-white text-orange-600 hover:bg-orange-50 dark:bg-gray-800 dark:text-orange-400 dark:hover:bg-orange-900/20 w-full sm:w-auto"
                  onClick={handleCheckRelances}
                  disabled={processing}
                >
                  {processing ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Vérification...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Vérifier les relances
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4 sm:pt-6 pb-4 px-4 sm:px-6">
          {/* Filtres et recherche */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Rechercher..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statutFilter} onValueChange={setStatutFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filtrer par statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="EnAttente">En attente</SelectItem>
                <SelectItem value="Envoye">Envoyé</SelectItem>
                <SelectItem value="Lu">Lu</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Information */}
          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>Relances automatiques :</strong> Les relances sont créées automatiquement lorsque la dette d'un adhérent dépasse <strong>3 fois le montant de la cotisation mensuelle</strong> (45,00 €). 
              Une relance ne peut être envoyée qu'une fois tous les 30 jours maximum.
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
            </div>
          ) : (
            <>
              <div className="mb-4 text-sm text-gray-600 dark:text-gray-300">
                {filteredData.length} relance(s) trouvée(s)
              </div>
              <DataTable table={table} emptyMessage="Aucune relance trouvée" compact={true} />
              
              {/* Pagination */}
              <div className="bg-white dark:bg-gray-800 mt-5 flex items-center justify-between py-5 font-semibold rounded-xl shadow-xl border border-gray-200 dark:border-gray-700">
                <div className="ml-5 mt-2 flex-1 text-sm text-muted-foreground dark:text-gray-400">
                  {table.getFilteredRowModel().rows.length} ligne(s) au total
                </div>

                <div className="flex items-center space-x-6 lg:space-x-8">
                  <div className="flex items-center space-x-2">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Lignes par page</p>
                    <Select
                      value={`${table.getState().pagination.pageSize}`}
                      onValueChange={(value) => {
                        table.setPageSize(Number(value));
                      }}
                    >
                      <SelectTrigger className="h-8 w-[70px]">
                        <SelectValue placeholder={table.getState().pagination.pageSize} />
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

                  <div className="flex w-[100px] items-center justify-center text-sm font-medium text-gray-700 dark:text-gray-300">
                    Page {table.getState().pagination.pageIndex + 1} sur{" "}
                    {table.getPageCount()}
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

