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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ViewDialog } from "./ViewDialog";
import { EditDialog } from "./EditDialog";
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
  ChevronsRight,
  MoreHorizontal,
  Eye,
  Edit,
  ArrowLeft
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
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
  getPaginationRowModel,
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
  const [globalFilter, setGlobalFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [anneeFilter, setAnneeFilter] = useState<string>("all");
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("admin-dettes-column-visibility");
        if (saved) {
          const parsed = JSON.parse(saved);
          // Vérifier si c'est la première fois ou si les préférences existent déjà
          // Si les préférences existent, les utiliser
          if (Object.keys(parsed).length > 0) {
            return parsed;
          }
        }
        // Par défaut sur mobile, masquer les colonnes non essentielles
        const isMobile = window.innerWidth < 768; // md breakpoint
        if (isMobile) {
          return {
            annee: false,
            montantPaye: false,
            montantRestant: false,
            description: false,
            createdAt: false,
            // Garder visible : Adherent, montant, actions (forceVisible)
          };
        }
      } catch (error) {
        console.error("Erreur lors du chargement des préférences:", error);
      }
    }
    return {};
  });

  // Détecter les changements de taille d'écran pour ajuster la visibilité des colonnes
  useEffect(() => {
    const handleResize = () => {
      const isMobile = window.innerWidth < 768;
      const saved = localStorage.getItem("admin-dettes-column-visibility");
      
      // Si on passe en mode mobile et qu'il n'y a pas de préférences sauvegardées
      if (isMobile && (!saved || Object.keys(JSON.parse(saved || "{}")).length === 0)) {
        setColumnVisibility({
          annee: false,
          montantPaye: false,
          montantRestant: false,
          description: false,
          createdAt: false,
        });
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [adherentSearchOpen, setAdherentSearchOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedDetteId, setSelectedDetteId] = useState<string | null>(null);
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
          item.montant?.toString() || "",
          item.montantPaye?.toString() || "",
          item.montantRestant?.toString() || "",
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
        const annee = row.original.annee;
        return (
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-gray-400 dark:text-gray-500 shrink-0" />
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                {adherent?.firstname} {adherent?.lastname}
              </span>
            </div>
            {/* Afficher l'année en petit sur mobile */}
            <span className="text-xs text-gray-500 dark:text-gray-400 md:hidden ml-6 font-normal">
              {annee}
            </span>
          </div>
        );
      },
      sortingFn: (rowA, rowB) => {
        const adherentA = rowA.original.Adherent;
        const adherentB = rowB.original.Adherent;
        const nameA = `${adherentA?.firstname || ""} ${adherentA?.lastname || ""}`.trim().toLowerCase();
        const nameB = `${adherentB?.firstname || ""} ${adherentB?.lastname || ""}`.trim().toLowerCase();
        return nameA.localeCompare(nameB, "fr", { sensitivity: "base" });
      },
      size: 200,
      minSize: 120,
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
      header: "Montant",
      cell: ({ row }) => {
        const montant = row.getValue("montant") as number;
        const restant = row.original.montantRestant as number;
        return (
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {montant.toFixed(2)} €
            </span>
            {/* Afficher le montant restant en petit sur mobile */}
            <span className={`text-xs md:hidden font-medium ${
              restant > 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"
            }`}>
              Restant: {restant.toFixed(2)} €
            </span>
          </div>
        );
      },
      size: 120,
      minSize: 90,
      maxSize: 150,
      enableResizing: true,
    }),
    columnHelper.accessor("montantPaye", {
      header: "Payé",
      cell: ({ row }) => {
        const montantPaye = row.getValue("montantPaye") as number;
        return (
          <span className="text-sm text-green-600 dark:text-green-400 font-medium">
            {montantPaye.toFixed(2)} €
          </span>
        );
      },
      size: 120,
      minSize: 100,
      maxSize: 150,
      enableResizing: true,
    }),
    columnHelper.accessor("montantRestant", {
      header: "Restant",
      cell: ({ row }) => {
        const restant = row.getValue("montantRestant") as number;
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
      sortingFn: (rowA, rowB) => {
        const descA = (rowA.original.description || "").trim().toLowerCase();
        const descB = (rowB.original.description || "").trim().toLowerCase();
        return descA.localeCompare(descB, "fr", { sensitivity: "base" });
      },
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
    columnHelper.display({
      id: "actions",
      header: () => <div className="text-center w-full">Actions</div>,
      meta: { forceVisible: true },
      enableResizing: false,
      cell: ({ row }) => {
        const dette = row.original;
        return (
          <div className="flex items-center justify-center">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 hover:bg-slate-100 dark:hover:bg-slate-800"
                  title="Actions"
                >
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">Ouvrir le menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => {
                    setSelectedDetteId(dette.id);
                    setViewDialogOpen(true);
                  }}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <Eye className="h-4 w-4" />
                  <span>Voir</span>
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => {
                    setSelectedDetteId(dette.id);
                    setEditDialogOpen(true);
                  }}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <Edit className="h-4 w-4" />
                  <span>Modifier</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
      size: 80,
      minSize: 70,
      maxSize: 100,
    }),
  ], []);

  const table = useReactTable({
    data: filteredData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
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
    state: { sorting, columnVisibility },
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
        <div className="mb-4">
          <Link href="/admin/finances">
            <Button variant="ghost" size="sm" className="text-gray-600 dark:text-gray-300">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour
            </Button>
          </Link>
        </div>
        <Card className="mx-auto max-w-7xl shadow-lg border-2 border-blue-200 dark:border-blue-800/50 bg-white dark:bg-gray-900 !py-0">
          <CardHeader className="bg-gradient-to-r from-blue-500/90 via-blue-400/80 to-blue-500/90 dark:from-blue-700/50 dark:via-blue-600/40 dark:to-blue-700/50 text-white pb-3 sm:pb-4 pt-3 sm:pt-4 px-4 sm:px-6 gap-0 shadow-md">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl font-bold text-white">
                <FileText className="h-5 w-5 text-white" />
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
                className="pl-11"
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
              <DataTable table={table} emptyMessage="Aucune dette initiale trouvée" headerColor="blue" />
              
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

      {/* Dialogs pour voir et modifier */}
      {selectedDetteId && (
        <>
          <ViewDialog 
            detteId={selectedDetteId} 
            open={viewDialogOpen}
            onOpenChange={(open) => {
              setViewDialogOpen(open);
              if (!open) setSelectedDetteId(null);
            }}
          />
          <EditDialog 
            detteId={selectedDetteId} 
            open={editDialogOpen}
            onOpenChange={(open) => {
              setEditDialogOpen(open);
              if (!open) setSelectedDetteId(null);
            }}
            onSuccess={() => {
              loadData();
              setEditDialogOpen(false);
              setSelectedDetteId(null);
            }}
          />
        </>
      )}
    </div>
  );
}

