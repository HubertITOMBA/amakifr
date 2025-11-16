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
  HandHeart, 
  Search, 
  Plus, 
  Euro,
  Calendar,
  User,
  X,
  Baby,
  Heart,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight
} from "lucide-react";
import { toast } from "sonner";
import { 
  getAllAssistances, 
  createAssistance 
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

const getTypeAssistanceLabel = (type: string) => {
  switch (type) {
    case "Naissance":
      return "Naissance";
    case "MariageEnfant":
      return "Mariage d'un enfant";
    case "DecesFamille":
      return "Décès dans la famille";
    case "AnniversaireSalle":
      return "Anniversaire en salle";
    case "Autre":
      return "Autre";
    default:
      return type;
  }
};

const getTypeAssistanceIcon = (type: string) => {
  switch (type) {
    case "Naissance":
      return <Baby className="h-4 w-4" />;
    case "MariageEnfant":
      return <Heart className="h-4 w-4" />;
    case "DecesFamille":
      return <AlertCircle className="h-4 w-4" />;
    case "AnniversaireSalle":
      return <Calendar className="h-4 w-4" />;
    default:
      return <HandHeart className="h-4 w-4" />;
  }
};

const getTypeAssistanceColor = (type: string) => {
  switch (type) {
    case "Naissance":
      return "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200";
    case "MariageEnfant":
      return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
    case "DecesFamille":
      return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    case "AnniversaireSalle":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
    default:
      return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
  }
};

export default function AdminAssistancesPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statutFilter, setStatutFilter] = useState<string>("all");
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("admin-assistances-column-visibility");
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
    type: "Naissance" as "Naissance" | "MariageEnfant" | "DecesFamille" | "AnniversaireSalle" | "Autre",
    dateEvenement: new Date().toISOString().split('T')[0],
    montant: "50",
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
      const res = await getAllAssistances();
      if (res.success && res.data) {
        setData(res.data);
      } else {
        toast.error(res.error || "Erreur lors du chargement des assistances");
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
          getTypeAssistanceLabel(item.type) || "",
          item.description || "",
        ].join(" ").toLowerCase();
        if (!searchText.includes(q)) return false;
      }
      
      // Filtre par type
      if (typeFilter !== "all" && item.type !== typeFilter) {
        return false;
      }
      
      // Filtre par statut
      if (statutFilter !== "all" && item.statut !== statutFilter) {
        return false;
      }
      
      return true;
    });
  }, [data, globalFilter, typeFilter, statutFilter]);

  const handleCreate = async () => {
    if (!formData.adherentId || !formData.dateEvenement) {
      toast.error("Veuillez remplir tous les champs obligatoires");
      return;
    }

    try {
      const result = await createAssistance({
        adherentId: formData.adherentId,
        type: formData.type,
        dateEvenement: formData.dateEvenement,
        montant: parseFloat(formData.montant) || 50,
        description: formData.description || undefined,
      });

      if (result.success) {
        toast.success(result.message);
        setCreateDialogOpen(false);
        setFormData({
          adherentId: "",
          type: "Naissance",
          dateEvenement: new Date().toISOString().split('T')[0],
          montant: "50",
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
    columnHelper.accessor("type", {
      header: "Type",
      cell: ({ row }) => {
        const type = row.getValue("type");
        return (
          <Badge className={getTypeAssistanceColor(type)}>
            <div className="flex items-center gap-1">
              {getTypeAssistanceIcon(type)}
              {getTypeAssistanceLabel(type)}
            </div>
          </Badge>
        );
      },
      size: 180,
      minSize: 150,
      maxSize: 250,
      enableResizing: true,
    }),
    columnHelper.accessor("dateEvenement", {
      header: "Date de l'événement",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {format(new Date(row.getValue("dateEvenement")), "d MMM yyyy", { locale: fr })}
          </span>
        </div>
      ),
      size: 150,
      minSize: 120,
      maxSize: 200,
      enableResizing: true,
    }),
    columnHelper.accessor("montant", {
      header: "Montant",
      cell: ({ row }) => (
        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {row.getValue("montant").toFixed(2)} €
        </span>
      ),
      size: 100,
      minSize: 80,
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
      size: 100,
      minSize: 80,
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
            statut === "Paye" 
              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
              : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
          }>
            {statut === "Paye" ? "Payé" : "En attente"}
          </Badge>
        );
      },
      size: 120,
      minSize: 100,
      maxSize: 150,
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
        localStorage.setItem("admin-assistances-column-visibility", JSON.stringify(newVisibility));
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
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-purple-50">
      <Card className="mx-auto max-w-7xl shadow-lg border-purple-200 dark:border-purple-700/50 bg-white dark:bg-gray-900 !py-0">
        <CardHeader className="bg-gradient-to-r from-purple-500 to-purple-600 dark:from-purple-600 dark:to-purple-700 text-white pb-4 pt-4 px-6 gap-0">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <HandHeart className="h-5 w-5" />
              Assistances ({filteredData.length})
            </CardTitle>
            <div className="flex items-center gap-2">
              <ColumnVisibilityToggle 
                table={table} 
                storageKey="admin-assistances-column-visibility"
              />
              <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-white text-purple-600 hover:bg-purple-50">
                    <Plus className="h-4 w-4 mr-2" />
                    Nouvelle assistance
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Créer une assistance</DialogTitle>
                    <DialogDescription>
                      Enregistrez une assistance de 50€ pour un événement familial
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
                      <Label htmlFor="type">Type d'événement *</Label>
                      <Select value={formData.type} onValueChange={(value: any) => setFormData({ ...formData, type: value })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Naissance">Naissance</SelectItem>
                          <SelectItem value="MariageEnfant">Mariage d'un enfant</SelectItem>
                          <SelectItem value="DecesFamille">Décès dans la famille</SelectItem>
                          <SelectItem value="AnniversaireSalle">Anniversaire en salle</SelectItem>
                          <SelectItem value="Autre">Autre</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="dateEvenement">Date de l'événement *</Label>
                        <Input
                          id="dateEvenement"
                          type="date"
                          value={formData.dateEvenement}
                          onChange={(e) => setFormData({ ...formData, dateEvenement: e.target.value })}
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
                          placeholder="50.00"
                        />
                      </div>
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
        <CardContent className="pt-0 px-6 pb-6">
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
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filtrer par type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les types</SelectItem>
                <SelectItem value="Naissance">Naissance</SelectItem>
                <SelectItem value="MariageEnfant">Mariage d'un enfant</SelectItem>
                <SelectItem value="DecesFamille">Décès dans la famille</SelectItem>
                <SelectItem value="AnniversaireSalle">Anniversaire en salle</SelectItem>
                <SelectItem value="Autre">Autre</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statutFilter} onValueChange={setStatutFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filtrer par statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="EnAttente">En attente</SelectItem>
                <SelectItem value="Paye">Payé</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            </div>
          ) : (
            <>
              <div className="mb-4 text-sm text-gray-600 dark:text-gray-300">
                {filteredData.length} assistance(s) trouvée(s)
              </div>
              <DataTable table={table} emptyMessage="Aucune assistance trouvée" compact={true} />
              
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
  );
}

