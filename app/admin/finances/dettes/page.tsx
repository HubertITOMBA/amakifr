"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AdherentSearchDialog } from "@/components/admin/AdherentSearchDialog";
import { Badge } from "@/components/ui/badge";
import { 
  FileText, 
  Search, 
  Plus, 
  Euro,
  Calendar,
  User,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight
} from "lucide-react";
import { toast } from "sonner";
import { 
  getAllDettesInitiales, 
  createDetteInitiale 
} from "@/actions/paiements";
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

const columnHelper = createColumnHelper<any>();

export default function AdminDettesPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [anneeFilter, setAnneeFilter] = useState<string>("all");
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("admin-dettes-column-visibility");
        if (saved) return JSON.parse(saved);
      } catch (error) {
        console.error("Erreur lors du chargement des préférences:", error);
      }
    }
    return {};
  });
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [adherentSearchOpen, setAdherentSearchOpen] = useState(false);
  const [selectedAdherent, setSelectedAdherent] = useState<{
    id: string;
    firstname: string;
    lastname: string;
    email: string;
  } | null>(null);
  const [formData, setFormData] = useState({
    adherentId: "",
    annee: new Date().getFullYear(),
    montant: "",
    description: "",
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
      const res = await getAllDettesInitiales();
      if (res.success && res.data) {
        setData(res.data);
      } else {
        toast.error(res.error || "Erreur lors du chargement des dettes");
      }
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
          item.annee?.toString() || "",
          item.description || "",
        ].join(" ").toLowerCase();
        if (!searchText.includes(q)) return false;
      }
      
      // Filtre par année
      if (anneeFilter !== "all" && item.annee?.toString() !== anneeFilter) {
        return false;
      }
      
      return true;
    });
  }, [data, globalFilter, anneeFilter]);

  const handleCreate = async () => {
    if (!formData.adherentId || !formData.montant) {
      toast.error("Veuillez remplir tous les champs obligatoires");
      return;
    }

    try {
      const result = await createDetteInitiale({
        adherentId: formData.adherentId,
        annee: formData.annee,
        montant: parseFloat(formData.montant),
        description: formData.description || undefined,
      });

      if (result.success) {
        toast.success(result.message);
        setCreateDialogOpen(false);
        setFormData({
          adherentId: "",
          annee: new Date().getFullYear(),
          montant: "",
          description: "",
        });
        setSelectedAdherent(null);
        loadData();
      } else {
        toast.error(result.error || "Erreur lors de la création");
      }
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de la création");
    }
  };

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
    columnHelper.accessor("annee", {
      header: "Année",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-900 dark:text-gray-100 font-medium">
            {row.getValue("annee")}
          </span>
        </div>
      ),
      size: 100,
      minSize: 80,
      maxSize: 150,
      enableResizing: true,
    }),
    columnHelper.accessor("montant", {
      header: "Montant total",
      cell: ({ row }) => (
        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {row.getValue("montant").toFixed(2)} €
        </span>
      ),
      size: 120,
      minSize: 100,
      maxSize: 150,
      enableResizing: true,
    }),
    columnHelper.accessor("montantPaye", {
      header: "Payé",
      cell: ({ row }) => (
        <span className="text-sm text-green-600 dark:text-green-400 font-medium">
          {row.getValue("montantPaye").toFixed(2)} €
        </span>
      ),
      size: 120,
      minSize: 100,
      maxSize: 150,
      enableResizing: true,
    }),
    columnHelper.accessor("montantRestant", {
      header: "Restant",
      cell: ({ row }) => {
        const restant = row.getValue("montantRestant");
        return (
          <span className={`text-sm font-semibold ${
            restant > 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"
          }`}>
            {restant.toFixed(2)} €
          </span>
        );
      },
      size: 120,
      minSize: 100,
      maxSize: 150,
      enableResizing: true,
    }),
    columnHelper.accessor("description", {
      header: "Description",
      cell: ({ row }) => (
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {row.getValue("description") || "—"}
        </span>
      ),
      size: 200,
      minSize: 150,
      maxSize: 400,
      enableResizing: true,
    }),
    columnHelper.accessor("createdAt", {
      header: "Date de création",
      cell: ({ row }) => (
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {format(new Date(row.getValue("createdAt")), "d MMM yyyy", { locale: fr })}
        </span>
      ),
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
        localStorage.setItem("admin-dettes-column-visibility", JSON.stringify(newVisibility));
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

  // Récupérer les années uniques
  const annees = useMemo(() => {
    const years = new Set<number>();
    data.forEach((item) => {
      if (item.annee) years.add(item.annee);
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [data]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50">
      <div className="p-4 sm:p-6">
        <Card className="mx-auto max-w-7xl shadow-lg border-2 border-blue-200 dark:border-blue-800/50 bg-white dark:bg-gray-900 !py-0">
          <CardHeader className="bg-gradient-to-r from-blue-100 to-blue-50 dark:from-blue-900/30 dark:to-blue-800/20 pb-3 sm:pb-4 pt-3 sm:pt-4 px-4 sm:px-6 gap-0">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl text-gray-700 dark:text-gray-200">
                <FileText className="h-5 w-5 text-blue-500 dark:text-blue-400" />
                Dettes Initiales ({filteredData.length})
              </CardTitle>
              <div className="flex items-center gap-2 w-full sm:w-auto">
              <ColumnVisibilityToggle 
                table={table} 
                storageKey="admin-dettes-column-visibility"
              />
              <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-white text-blue-600 hover:bg-blue-50">
                    <Plus className="h-4 w-4 mr-2" />
                    Nouvelle dette
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Créer une dette initiale</DialogTitle>
                    <DialogDescription>
                      Enregistrez une dette initiale pour un adhérent (ex: 2024, 2025)
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="adherent">Adhérent *</Label>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setAdherentSearchOpen(true)}
                          className="flex-1 justify-start"
                        >
                          <User className="h-4 w-4 mr-2" />
                          {selectedAdherent
                            ? `${selectedAdherent.firstname} ${selectedAdherent.lastname}`
                            : "Rechercher un adhérent"}
                        </Button>
                        {selectedAdherent && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedAdherent(null);
                              setFormData({ ...formData, adherentId: "" });
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      {selectedAdherent && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {selectedAdherent.email}
                        </p>
                      )}
                      <AdherentSearchDialog
                        open={adherentSearchOpen}
                        onOpenChange={setAdherentSearchOpen}
                        onSelect={(adherent) => {
                          setSelectedAdherent(adherent);
                          setFormData({ ...formData, adherentId: adherent.id });
                        }}
                      />
                    </div>
                    <div>
                      <Label htmlFor="annee">Année *</Label>
                      <Input
                        id="annee"
                        type="number"
                        min="2020"
                        max="2100"
                        value={formData.annee}
                        onChange={(e) => setFormData({ ...formData, annee: parseInt(e.target.value) || new Date().getFullYear() })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="montant">Montant (€) *</Label>
                      <Input
                        id="montant"
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.montant}
                        onChange={(e) => setFormData({ ...formData, montant: e.target.value })}
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Description optionnelle"
                        rows={3}
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                        Annuler
                      </Button>
                      <Button onClick={handleCreate}>
                        Créer
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4 sm:pt-6 pb-4 px-4 sm:px-6">
          {/* Filtres et recherche */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-4 sm:mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Rechercher..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={anneeFilter} onValueChange={setAnneeFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filtrer par année" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les années</SelectItem>
                {annees.map((annee) => (
                  <SelectItem key={annee} value={annee.toString()}>
                    {annee}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <>
              <div className="mb-4 text-sm text-gray-600 dark:text-gray-300">
                {filteredData.length} dette(s) trouvée(s)
              </div>
              <DataTable table={table} emptyMessage="Aucune dette initiale trouvée" compact={true} />
              
              {/* Pagination */}
              <div className="bg-white dark:bg-gray-800 mt-4 sm:mt-5 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-0 py-4 sm:py-5 font-semibold rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 px-4 sm:px-6">
                <div className="flex-1 text-xs sm:text-sm text-muted-foreground dark:text-gray-400 text-center sm:text-left">
                  {table.getFilteredRowModel().rows.length} ligne(s) au total
                </div>

                <div className="flex items-center space-x-4 sm:space-x-6 lg:space-x-8 w-full sm:w-auto justify-center sm:justify-end">
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

