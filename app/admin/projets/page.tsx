"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, FolderKanban, Plus, Search, Eye, Edit, Trash2, ChevronsLeft, ChevronsRight, ChevronLeft, ChevronRight, Users, Calendar, FileText } from "lucide-react";
import { toast } from "react-toastify";
import { getAllProjets, deleteProjet } from "@/actions/projets";
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
import { CreateProjetDialog } from "@/components/admin/projets/CreateProjetDialog";
import { EditProjetDialog } from "@/components/admin/projets/EditProjetDialog";
import { ViewProjetDialog } from "@/components/admin/projets/ViewProjetDialog";
import { useActivityLogger } from "@/hooks/use-activity-logger";
import { ensureProjetsMenu } from "@/actions/menus/ensure-projets-menu";
import Link from "next/link";

type ProjetData = {
  id: string;
  titre: string;
  description: string;
  statut: "Planifie" | "EnCours" | "EnPause" | "Termine" | "Annule";
  dateDebut: Date | null;
  dateFin: Date | null;
  dateFinReelle: Date | null;
  createdAt: Date;
  updatedAt: Date;
  CreatedBy: {
    id: string;
    name: string | null;
    email: string | null;
  };
  _count: {
    SousProjets: number;
  };
};

const columnHelper = createColumnHelper<ProjetData>();

// Fonction pour obtenir la couleur du badge selon le statut
const getStatutBadgeColor = (statut: string) => {
  switch (statut) {
    case "Planifie":
      return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-700";
    case "EnCours":
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800";
    case "EnPause":
      return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800";
    case "Termine":
      return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800";
    case "Annule":
      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800";
    default:
      return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-700";
  }
};

export default function AdminProjetsPage() {
  const [data, setData] = useState<ProjetData[]>([]);
  const [loading, setLoading] = useState(true);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statutFilter, setStatutFilter] = useState<string>("all");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState<ProjetData | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState<ProjetData | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<{ id: string; titre: string } | null>(null);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("admin-projets-column-visibility");
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
      const result = await getAllProjets();
      if (result.success && result.data) {
        setData(result.data);
      } else {
        toast.error(result.error || "Erreur lors du chargement des projets");
      }
    } catch (error) {
      console.error("Erreur lors du chargement:", error);
      toast.error("Erreur lors du chargement des données");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    // S'assurer que le menu existe dans la sidebar
    ensureProjetsMenu().catch((error) => {
      console.error("Erreur lors de la vérification du menu:", error);
    });
  }, [loadData]);

  // Logger la consultation de la page
  useActivityLogger("Gestion des projets", "Projet");

  // Filtrer les données
  const filteredData = useMemo(() => {
    return data.filter((item) => {
      // Filtre global (recherche)
      if (globalFilter.trim()) {
        const q = globalFilter.trim().toLowerCase();
        const searchText = [
          item.titre || "",
          item.description || "",
          item.CreatedBy?.name || "",
          item.CreatedBy?.email || "",
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

  const handleDelete = async (projetId: string) => {
    try {
      const result = await deleteProjet(projetId);
      if (result.success) {
        toast.success(result.message);
        loadData();
        setDeleteDialogOpen(null);
      } else {
        toast.error(result.error || "Erreur lors de la suppression");
      }
    } catch (error) {
      console.error("Erreur lors de la suppression:", error);
      toast.error("Erreur lors de la suppression du projet");
    }
  };

  const columns = useMemo(() => [
    columnHelper.accessor("titre", {
      header: "Titre",
      cell: ({ row }) => (
        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
          {row.getValue("titre")}
        </span>
      ),
      size: 250,
      minSize: 200,
      maxSize: 400,
      enableResizing: true,
    }),
    columnHelper.accessor("description", {
      header: "Description",
      cell: ({ row }) => (
        <span className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
          {row.getValue("description")}
        </span>
      ),
      size: 300,
      minSize: 200,
      maxSize: 500,
      enableResizing: true,
    }),
    columnHelper.accessor("statut", {
      header: "Statut",
      cell: ({ row }) => {
        const statut = row.getValue("statut");
        return (
          <Badge className={`${getStatutBadgeColor(statut)} text-xs border`}>
            {statut}
          </Badge>
        );
      },
      size: 120,
      minSize: 100,
      maxSize: 150,
      enableResizing: true,
    }),
    columnHelper.accessor("dateDebut", {
      header: "Date début",
      cell: ({ row }) => {
        const date = row.getValue("dateDebut");
        return (
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {date ? format(new Date(date), "dd/MM/yyyy", { locale: fr }) : "N/A"}
          </span>
        );
      },
      size: 120,
      minSize: 100,
      maxSize: 150,
      enableResizing: true,
    }),
    columnHelper.accessor("dateFin", {
      header: "Date fin",
      cell: ({ row }) => {
        const date = row.getValue("dateFin");
        return (
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {date ? format(new Date(date), "dd/MM/yyyy", { locale: fr }) : "N/A"}
          </span>
        );
      },
      size: 120,
      minSize: 100,
      maxSize: 150,
      enableResizing: true,
    }),
    columnHelper.display({
      id: "taches",
      header: "Tâches",
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <FileText className="h-4 w-4 text-blue-600" />
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {row.original._count?.SousProjets || 0}
          </span>
        </div>
      ),
      size: 100,
      minSize: 80,
      maxSize: 120,
      enableResizing: true,
    }),
    columnHelper.accessor("CreatedBy", {
      header: "Créé par",
      cell: ({ row }) => {
        const createdBy = row.getValue("CreatedBy");
        return (
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {createdBy?.name || createdBy?.email || "Inconnu"}
          </span>
        );
      },
      size: 150,
      minSize: 120,
      maxSize: 200,
      enableResizing: true,
    }),
    columnHelper.display({
      id: "actions",
      header: "Actions",
      meta: { forceVisible: true },
      enableResizing: false,
      cell: ({ row }) => {
        const projet = row.original;
        return (
          <div className="flex items-center gap-1 sm:gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-7 w-7 sm:h-8 sm:w-8 p-0 border-blue-300 hover:bg-blue-50"
              onClick={() => setViewDialogOpen(projet)}
              title="Voir les détails"
            >
              <Eye className="h-3 w-3 sm:h-4 sm:w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 w-7 sm:h-8 sm:w-8 p-0 border-blue-300 hover:bg-blue-50"
              onClick={() => setEditDialogOpen(projet)}
              title="Modifier"
            >
              <Edit className="h-3 w-3 sm:h-4 sm:w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 w-7 sm:h-8 sm:w-8 p-0 border-red-300 hover:bg-red-50"
              onClick={() => setDeleteDialogOpen({ id: projet.id, titre: projet.titre })}
              title="Supprimer"
            >
              <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
            </Button>
          </div>
        );
      },
      size: 150,
      minSize: 120,
      maxSize: 180,
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
        localStorage.setItem("admin-projets-column-visibility", JSON.stringify(newVisibility));
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

  const stats = useMemo(() => {
    const total = data.length;
    const enCours = data.filter(p => p.statut === "EnCours").length;
    const termines = data.filter(p => p.statut === "Termine").length;
    const totalTaches = data.reduce((sum, p) => sum + p._count.SousProjets, 0);
    return { total, enCours, termines, totalTaches };
  }, [data]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-slate-900 dark:to-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card className="mx-auto max-w-7xl shadow-lg border-blue-200 dark:border-gray-700 !pt-0">
          <CardHeader className="bg-gradient-to-r from-blue-500/90 via-blue-400/80 to-blue-500/90 dark:from-blue-700/50 dark:via-blue-600/40 dark:to-blue-700/50 text-white !pt-0 rounded-t-lg">
            <div className="flex items-center justify-between pt-4 sm:pt-6 pb-4 sm:pb-6">
              <CardTitle className="flex items-center gap-2">
                <FolderKanban className="h-5 w-5" />
                Gestion des projets ({stats.total})
              </CardTitle>
              <Button
                onClick={() => setCreateDialogOpen(true)}
                className="bg-white/10 hover:bg-white/20 border-white/30 text-white hover:text-white"
              >
                <Plus className="h-4 w-4 mr-2" />
                Nouveau projet
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            {/* Statistiques */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <Card className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20">
                <CardContent className="p-3">
                  <div className="text-xs text-blue-600 dark:text-blue-400 font-semibold">Total</div>
                  <div className="text-lg font-bold text-blue-900 dark:text-blue-100">{stats.total}</div>
                </CardContent>
              </Card>
              <Card className="border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20">
                <CardContent className="p-3">
                  <div className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">En cours</div>
                  <div className="text-lg font-bold text-emerald-900 dark:text-emerald-100">{stats.enCours}</div>
                </CardContent>
              </Card>
              <Card className="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20">
                <CardContent className="p-3">
                  <div className="text-xs text-green-600 dark:text-green-400 font-semibold">Terminés</div>
                  <div className="text-lg font-bold text-green-900 dark:text-green-100">{stats.termines}</div>
                </CardContent>
              </Card>
              <Card className="border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/20">
                <CardContent className="p-3">
                  <div className="text-xs text-purple-600 dark:text-purple-400 font-semibold">Total tâches</div>
                  <div className="text-lg font-bold text-purple-900 dark:text-purple-100">{stats.totalTaches}</div>
                </CardContent>
              </Card>
            </div>

            {/* Filtres et recherche */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Rechercher par titre, description, créateur..."
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
                  <SelectItem value="Planifie">Planifié</SelectItem>
                  <SelectItem value="EnCours">En cours</SelectItem>
                  <SelectItem value="EnPause">En pause</SelectItem>
                  <SelectItem value="Termine">Terminé</SelectItem>
                  <SelectItem value="Annule">Annulé</SelectItem>
                </SelectContent>
              </Select>
              <ColumnVisibilityToggle
                table={table}
                storageKey="admin-projets-column-visibility"
              />
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              </div>
            ) : (
              <>
                <div className="mb-4 text-sm text-gray-600 dark:text-gray-300">
                  {filteredData.length} projet(s) trouvé(s)
                </div>
                <DataTable table={table} emptyMessage="Aucun projet trouvé" />
                
                {/* Pagination - Masquée sur mobile */}
                <div className="hidden md:flex bg-white dark:bg-gray-800 mt-5 flex-col sm:flex-row items-center justify-between py-5 font-semibold rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 gap-4">
                  <div className="ml-5 flex-1 text-sm text-muted-foreground dark:text-gray-400">
                    {table.getFilteredRowModel().rows.length} projet(s) au total
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

        {/* Dialogs */}
        {createDialogOpen && (
          <CreateProjetDialog
            open={createDialogOpen}
            onOpenChange={setCreateDialogOpen}
            onSuccess={loadData}
          />
        )}

        {editDialogOpen && (
          <EditProjetDialog
            projet={editDialogOpen}
            open={!!editDialogOpen}
            onOpenChange={(open) => {
              if (!open) setEditDialogOpen(null);
            }}
            onSuccess={loadData}
          />
        )}

        {viewDialogOpen && (
          <ViewProjetDialog
            projetId={viewDialogOpen.id}
            open={!!viewDialogOpen}
            onOpenChange={(open) => {
              if (!open) setViewDialogOpen(null);
            }}
          />
        )}

        {deleteDialogOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className="max-w-md w-full mx-4">
              <CardHeader>
                <CardTitle>Supprimer le projet</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-4">
                  Êtes-vous sûr de vouloir supprimer le projet <strong>{deleteDialogOpen.titre}</strong> ?
                  Cette action est irréversible et supprimera également tous les sous-projets et affectations associés.
                </p>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setDeleteDialogOpen(null)}
                  >
                    Annuler
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => handleDelete(deleteDialogOpen.id)}
                  >
                    Supprimer
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
