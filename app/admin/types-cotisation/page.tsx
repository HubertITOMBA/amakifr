"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { 
  Settings, 
  Euro, 
  Plus, 
  Edit, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  AlertTriangle,
  Users,
  Calendar,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Columns,
  Eye,
  X,
  Info,
  FileText,
  MoreHorizontal
} from "lucide-react";
import { toast } from "react-toastify";
import { 
  getAllTypesCotisationMensuelle, 
  createTypeCotisationMensuelle, 
  updateTypeCotisationMensuelle,
  deleteTypeCotisationMensuelle,
  getCotisationsMensuellesStats
} from "@/actions/cotisations-mensuelles";
import {
  createColumnHelper,
  getCoreRowModel,
  useReactTable,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  SortingState,
  ColumnFiltersState,
  VisibilityState,
} from "@tanstack/react-table";
import { DataTable } from "@/components/admin/DataTable";
import { ColumnVisibilityToggle } from "@/components/admin/ColumnVisibilityToggle";
import { ViewDialog } from "./ViewDialog";

// Composant pour la cellule d'actions avec état local
function TypeActionsCell({ 
  type, 
  onEdit, 
  onDelete 
}: { 
  type: TypeCotisationMensuelle; 
  onEdit: (type: TypeCotisationMensuelle) => void; 
  onDelete: (id: string) => void;
}) {
  const [viewOpen, setViewOpen] = useState(false);

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
            onClick={() => setViewOpen(true)}
            className="flex items-center gap-2 cursor-pointer"
          >
            <Eye className="h-4 w-4" />
            <span>Voir les détails</span>
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={() => onEdit(type)}
            className="flex items-center gap-2 cursor-pointer"
          >
            <Edit className="h-4 w-4" />
            <span>Éditer</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem 
            onClick={() => onDelete(type.id)}
            className="flex items-center gap-2 cursor-pointer text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400"
          >
            <Trash2 className="h-4 w-4" />
            <span>Supprimer</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ViewDialog type={type} open={viewOpen} onOpenChange={setViewOpen} />
    </div>
  );
}

export type CategorieTypeCotisation = "ForfaitMensuel" | "Assistance" | "Divers";

interface TypeCotisationMensuelle {
  id: string;
  nom: string;
  description?: string;
  montant: number;
  obligatoire?: boolean;
  actif: boolean;
  ordre?: number;
  categorie?: CategorieTypeCotisation;
  aBeneficiaire?: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  CreatedBy: {
    id: string;
    email: string;
  };
  _count: {
    CotisationsMensuelles: number;
  };
}

interface Stats {
  totalTypesCotisation: number;
  typesActifs: number;
  totalCotisationsMois: number;
  totalDettes: number;
  adherentsEnRetard: number;
}

const columnHelper = createColumnHelper<TypeCotisationMensuelle>();

export default function AdminTypesCotisationMensuelle() {
  const [typesCotisation, setTypesCotisation] = useState<TypeCotisationMensuelle[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingType, setEditingType] = useState<TypeCotisationMensuelle | null>(null);
  const [formData, setFormData] = useState<{
    nom: string;
    description: string;
    montant: number;
    actif: boolean;
    categorie: CategorieTypeCotisation;
  }>({
    nom: "",
    description: "",
    montant: 0,
    actif: true,
    categorie: "Divers",
  });

  // États pour TanStack Table
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("admin-types-cotisation-column-visibility");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Object.keys(parsed).length > 0) {
            return parsed;
          }
        }
        // Par défaut sur mobile, masquer les colonnes non essentielles
        const isMobile = window.innerWidth < 768;
        if (isMobile) {
          return {
            description: false,
            actif: false,
            createdAt: false,
            // Garder visible : nom, montant, actions (si présente)
          };
        }
      } catch (error) {
        console.error("Erreur lors du chargement des préférences:", error);
      }
    }
    return {};
  });

  // Détecter les changements de taille d'écran
  useEffect(() => {
    const handleResize = () => {
      const isMobile = window.innerWidth < 768;
      const saved = localStorage.getItem("admin-types-cotisation-column-visibility");
      
      if (isMobile && (!saved || Object.keys(JSON.parse(saved || "{}")).length === 0)) {
        setColumnVisibility({
          description: false,
          actif: false,
          createdAt: false,
        });
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Debounce pour la recherche
  useEffect(() => {
    const timer = setTimeout(() => {
      setGlobalFilter(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [typesResult, statsResult] = await Promise.all([
        getAllTypesCotisationMensuelle(),
        getCotisationsMensuellesStats()
      ]);

      if (typesResult.success && typesResult.data) {
        setTypesCotisation(typesResult.data);
      } else {
        toast.error(typesResult.error || "Erreur lors du chargement des types");
      }

      if (statsResult.success && statsResult.data) {
        setStats(statsResult.data);
      }
    } catch (error) {
      toast.error("Erreur lors du chargement des données");
    } finally {
      setLoading(false);
    }
  }, []);

  // Filtrer les données
  const filteredData = useMemo(() => {
    return typesCotisation.filter(item => {
      // Filtre global (recherche)
      if (globalFilter.trim()) {
        const q = globalFilter.trim().toLowerCase();
        const searchText = [
          item.nom || "",
          item.description || "",
          item.montant.toString(),
          item.CreatedBy?.email || "",
        ].join(" ").toLowerCase();
        if (!searchText.includes(q)) return false;
      }
      
      // Filtre par statut (actif/inactif)
      if (statusFilter !== "all") {
        if (statusFilter === "actif" && !item.actif) return false;
        if (statusFilter === "inactif" && item.actif) return false;
      }
      
      return true;
    });
  }, [typesCotisation, globalFilter, statusFilter]);

  const columns = useMemo(() => [
    columnHelper.accessor("nom", {
      header: "Nom",
      cell: ({ row }) => (
        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
          {row.getValue("nom")}
        </span>
      ),
      size: 200,
      minSize: 150,
      maxSize: 300,
      enableResizing: true,
    }),
    columnHelper.accessor("description", {
      header: "Description",
      cell: ({ row }) => (
        <span className="text-sm text-gray-600 dark:text-gray-300 max-w-xs truncate block">
          {row.getValue("description") || "-"}
        </span>
      ),
      size: 200,
      minSize: 150,
      maxSize: 300,
      enableResizing: true,
    }),
    columnHelper.accessor("montant", {
      header: "Montant",
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Euro className="h-4 w-4 text-gray-500" />
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {row.getValue("montant").toFixed(2).replace(".", ",")} €
          </span>
        </div>
      ),
      size: 120,
      minSize: 100,
      maxSize: 150,
      enableResizing: true,
    }),
    columnHelper.accessor("categorie", {
      header: "Catégorie",
      cell: ({ row }) => {
        const cat = (row.getValue("categorie") as CategorieTypeCotisation) || "Divers";
        const labels: Record<CategorieTypeCotisation, string> = {
          ForfaitMensuel: "Forfait mensuel",
          Assistance: "Assistance",
          Divers: "Divers",
        };
        const colors: Record<CategorieTypeCotisation, string> = {
          ForfaitMensuel: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
          Assistance: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
          Divers: "bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-200",
        };
        return (
          <Badge className={colors[cat]}>
            {labels[cat]}
          </Badge>
        );
      },
      size: 140,
      minSize: 120,
      maxSize: 180,
      enableResizing: true,
    }),
    columnHelper.accessor("actif", {
      header: "Statut",
      cell: ({ row }) => (
        <Badge
          className={
            row.getValue("actif")
              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs"
              : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 text-xs"
          }
        >
          {row.getValue("actif") ? "Actif" : "Inactif"}
        </Badge>
      ),
      size: 100,
      minSize: 80,
      maxSize: 120,
      enableResizing: true,
    }),
    columnHelper.display({
      id: "utilisations",
      header: "Utilisations",
      cell: ({ row }) => (
        <span className="text-sm text-gray-600 dark:text-gray-300">
          {row.original._count?.CotisationsMensuelles || 0} cotisation(s)
        </span>
      ),
      size: 120,
      minSize: 100,
      maxSize: 150,
      enableResizing: true,
    }),
    columnHelper.accessor("CreatedBy.email", {
      header: "Créé par",
      cell: ({ row }) => (
        <span className="text-sm text-gray-600 dark:text-gray-300">
          {row.original.CreatedBy?.email || "-"}
        </span>
      ),
      size: 150,
      minSize: 120,
      maxSize: 200,
      enableResizing: true,
    }),
    columnHelper.accessor("createdAt", {
      header: "Date de création",
      cell: ({ row }) => (
        <span className="text-sm text-gray-600 dark:text-gray-300">
          {new Date(row.getValue("createdAt")).toLocaleDateString("fr-FR")}
        </span>
      ),
      size: 120,
      minSize: 100,
      maxSize: 150,
      enableResizing: true,
    }),
    columnHelper.display({
      id: "actions",
      header: () => <div className="text-center w-full">Actions</div>,
      meta: { forceVisible: true },
      enableResizing: false,
      cell: ({ row }) => {
        const type = row.original;
        return <TypeActionsCell type={type} onEdit={handleEdit} onDelete={handleDelete} />;
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
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: (updater) => {
      const newVisibility = typeof updater === "function" ? updater(columnVisibility) : updater;
      setColumnVisibility(newVisibility);
      try {
        localStorage.setItem("admin-types-cotisation-column-visibility", JSON.stringify(newVisibility));
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let result;
      if (editingType) {
        result = await updateTypeCotisationMensuelle({
          id: editingType.id,
          ...formData,
        });
      } else {
        result = await createTypeCotisationMensuelle(formData);
      }

      if (result.success) {
        toast.success(editingType ? "Type mis à jour" : "Type créé");
        setShowForm(false);
        setEditingType(null);
        setFormData({
          nom: "",
          description: "",
          montant: 0,
          actif: true,
          categorie: "Divers",
        });
        loadData();
      } else {
        toast.error(result.error || "Erreur lors de la sauvegarde");
      }
    } catch (error) {
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce type de cotisation ?")) return;

    try {
      const result = await deleteTypeCotisationMensuelle(id);
      if (result.success) {
        toast.success("Type supprimé");
        loadData();
      } else {
        toast.error(result.error || "Erreur lors de la suppression");
      }
    } catch (error) {
      toast.error("Erreur lors de la suppression");
    }
  };

  const handleEdit = (type: TypeCotisationMensuelle) => {
    setEditingType(type);
    setFormData({
      nom: type.nom,
      description: type.description || "",
      montant: type.montant,
      actif: type.actif,
    });
    setShowForm(true);
  };

  if (loading && typesCotisation.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center space-x-2">
          <Clock className="h-5 w-5 animate-spin text-blue-600" />
          <span className="text-gray-600">Chargement des types de cotisation...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
        {/* En-tête */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 dark:from-blue-400 dark:to-blue-600 bg-clip-text text-transparent">
              Types de Cotisation Mensuelle
            </h1>
            <p className="text-gray-700 dark:text-gray-300 mt-1 sm:mt-2 text-sm sm:text-base lg:text-lg">
              Gérer les types de cotisation mensuelle et leurs paramètres
            </p>
          </div>
        </div>

        {/* Statistiques */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4">
            <Card className="shadow-md border-blue-200 dark:border-blue-800 hover:shadow-lg transition-shadow">
              <CardContent className="p-4 sm:p-6 bg-gradient-to-br from-blue-50/80 to-white dark:from-blue-900/20 dark:to-gray-800">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wide">
                      Total Types
                    </p>
                    <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-blue-900 dark:text-blue-100 mt-1 sm:mt-2">
                      {stats.totalTypesCotisation}
                    </p>
                  </div>
                  <Settings className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600 dark:text-blue-400" />
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-md border-green-200 dark:border-green-800 hover:shadow-lg transition-shadow">
              <CardContent className="p-4 sm:p-6 bg-gradient-to-br from-green-50/80 to-white dark:from-green-900/20 dark:to-gray-800">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm font-semibold text-green-700 dark:text-green-300 uppercase tracking-wide">
                      Types Actifs
                    </p>
                    <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-green-900 dark:text-green-100 mt-1 sm:mt-2">
                      {stats.typesActifs}
                    </p>
                  </div>
                  <CheckCircle2 className="h-6 w-6 sm:h-8 sm:w-8 text-green-600 dark:text-green-400" />
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-md border-purple-200 dark:border-purple-800 hover:shadow-lg transition-shadow">
              <CardContent className="p-4 sm:p-6 bg-gradient-to-br from-purple-50/80 to-white dark:from-purple-900/20 dark:to-gray-800">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm font-semibold text-purple-700 dark:text-purple-300 uppercase tracking-wide">
                      Cotisations Mois
                    </p>
                    <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-purple-900 dark:text-purple-100 mt-1 sm:mt-2">
                      {stats.totalCotisationsMois}
                    </p>
                  </div>
                  <Calendar className="h-6 w-6 sm:h-8 sm:w-8 text-purple-600 dark:text-purple-400" />
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-md border-orange-200 dark:border-orange-800 hover:shadow-lg transition-shadow">
              <CardContent className="p-4 sm:p-6 bg-gradient-to-br from-orange-50/80 to-white dark:from-orange-900/20 dark:to-gray-800">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm font-semibold text-orange-700 dark:text-orange-300 uppercase tracking-wide">
                      Total Dettes
                    </p>
                    <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-orange-900 dark:text-orange-100 mt-1 sm:mt-2">
                      {stats.totalDettes.toFixed(2).replace('.', ',')} €
                    </p>
                  </div>
                  <Euro className="h-6 w-6 sm:h-8 sm:w-8 text-orange-600 dark:text-orange-400" />
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-md border-red-200 dark:border-red-800 hover:shadow-lg transition-shadow">
              <CardContent className="p-4 sm:p-6 bg-gradient-to-br from-red-50/80 to-white dark:from-red-900/20 dark:to-gray-800">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm font-semibold text-red-700 dark:text-red-300 uppercase tracking-wide">
                      En Retard
                    </p>
                    <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-red-900 dark:text-red-100 mt-1 sm:mt-2">
                      {stats.adherentsEnRetard}
                    </p>
                  </div>
                  <AlertTriangle className="h-6 w-6 sm:h-8 sm:w-8 text-red-600 dark:text-red-400" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Card principale avec liste */}
        <Card className="shadow-lg border-blue-200 dark:border-blue-800">
          <CardHeader className="bg-gradient-to-r from-blue-500/90 to-blue-600/90 dark:from-blue-600/90 dark:to-blue-700/90 text-white rounded-t-lg pb-3 sm:pb-4 pt-3 sm:pt-4 px-4 sm:px-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0">
              <div>
                <CardTitle className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2 sm:gap-3">
                  <Settings className="h-5 w-5 sm:h-6 sm:w-6" />
                  Liste des Types de Cotisation
                </CardTitle>
                <CardDescription className="text-blue-100 dark:text-blue-200 mt-1 sm:mt-2 text-sm sm:text-base">
                  Gérer les types de cotisation mensuelle et leurs paramètres
                </CardDescription>
              </div>
              <div className="flex items-center space-x-2 w-full sm:w-auto">
                <ColumnVisibilityToggle 
                  table={table} 
                  storageKey="admin-types-cotisation-column-visibility"
                />
                <Button
                  onClick={() => {
                    setEditingType(null);
                    setFormData({
                      nom: "",
                      description: "",
                      montant: 0,
                      actif: true,
                      categorie: "Divers",
                    });
                    setShowForm(true);
                  }}
                  className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Nouveau Type
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4 sm:pt-6 pb-4 px-4 sm:px-6">

            {/* Filtres et recherche */}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-4 sm:mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Rechercher par nom, description, montant..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-28"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Filtrer par statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="actif">Actifs</SelectItem>
                  <SelectItem value="inactif">Inactifs</SelectItem>
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
                  {filteredData.length} type(s) trouvé(s)
                </div>
                <DataTable table={table} emptyMessage="Aucun type de cotisation trouvé" compact={true} />
                
                {/* Pagination - Masquée sur mobile */}
                <div className="hidden md:flex bg-white dark:bg-gray-800 mt-5 items-center justify-between py-5 font-semibold rounded-xl shadow-xl border border-gray-200 dark:border-gray-700">
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

        {/* Modal de création/édition */}
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogContent className="sm:max-w-3xl max-h-[95vh] overflow-y-auto p-0 gap-0">
            {/* Header avec gradient */}
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 text-white p-6 rounded-t-lg">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center">
                    {editingType ? (
                      <Edit className="h-6 w-6 text-white" />
                    ) : (
                      <Plus className="h-6 w-6 text-white" />
                    )}
                  </div>
                  <div>
                    <DialogTitle className="text-2xl font-bold text-white mb-1">
                      {editingType ? "Modifier le Type" : "Nouveau Type de Cotisation"}
                    </DialogTitle>
                    <DialogDescription className="text-blue-100 text-sm">
                      {editingType ? "Modifier les paramètres du type" : "Créer un nouveau type de cotisation mensuelle"}
                    </DialogDescription>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowForm(false);
                    setEditingType(null);
                    setFormData({
                      nom: "",
                      description: "",
                      montant: 0,
                      actif: true,
                    });
                  }}
                  className="h-8 w-8 p-0 text-white hover:bg-white/20 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Contenu principal */}
            <div className="p-6 space-y-4 bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
              <form onSubmit={handleSubmit} className="space-y-4">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                  <Info className="h-5 w-5 text-blue-600" />
                  Informations du type
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Nom */}
                  <div className="space-y-1 md:col-span-2">
                    <label className="text-[9px] sm:text-[10px] font-semibold text-slate-700 uppercase tracking-wide flex items-center gap-1 sm:gap-2 bg-slate-100 px-2 py-1 rounded-t-md">
                      <FileText className="h-3 w-3" />
                      Nom *
                    </label>
                    <Input
                      id="nom"
                      value={formData.nom}
                      onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                      placeholder="ex: Forfait Mensuel"
                      required
                      className="rounded-md rounded-tl-none border-blue-200 dark:border-blue-800 border-t-0 focus:border-blue-400 focus:ring-blue-400"
                    />
                  </div>

                  {/* Montant */}
                  <div className="space-y-1">
                    <label className="text-[9px] sm:text-[10px] font-semibold text-slate-700 uppercase tracking-wide flex items-center gap-1 sm:gap-2 bg-slate-100 px-2 py-1 rounded-t-md">
                      <Euro className="h-3 w-3" />
                      Montant * (€)
                    </label>
                    <div className="relative">
                      <Input
                        id="montant"
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.montant}
                        onChange={(e) => setFormData({ ...formData, montant: parseFloat(e.target.value) || 0 })}
                        placeholder="0.00"
                        required
                        className="rounded-md rounded-tl-none border-blue-200 dark:border-blue-800 border-t-0 focus:border-blue-400 focus:ring-blue-400 pr-10"
                      />
                      <Euro className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    </div>
                    {editingType && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        La modification du montant n'affectera que les futures cotisations. Les cotisations déjà créées conservent leur montant initial.
                      </p>
                    )}
                  </div>

                  {/* Catégorie */}
                  <div className="space-y-1">
                    <label className="text-[9px] sm:text-[10px] font-semibold text-slate-700 uppercase tracking-wide flex items-center gap-1 sm:gap-2 bg-slate-100 px-2 py-1 rounded-t-md">
                      <Settings className="h-3 w-3" />
                      Catégorie
                    </label>
                    <Select
                      value={formData.categorie}
                      onValueChange={(v: CategorieTypeCotisation) => setFormData({ ...formData, categorie: v })}
                    >
                      <SelectTrigger className="rounded-md rounded-tl-none border-blue-200 dark:border-blue-800 border-t-0">
                        <SelectValue placeholder="Choisir une catégorie" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ForfaitMensuel">Forfait mensuel</SelectItem>
                        <SelectItem value="Assistance">Assistance</SelectItem>
                        <SelectItem value="Divers">Divers / Extra</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Forfait mensuel = obligatoire par mois. Assistance = bénéficiaire (naissance, décès…). Divers = formation, matériel, etc.
                    </p>
                  </div>

                  {/* Statut */}
                  <div className="space-y-1">
                    <label className="text-[9px] sm:text-[10px] font-semibold text-slate-700 uppercase tracking-wide flex items-center gap-1 sm:gap-2 bg-slate-100 px-2 py-1 rounded-t-md">
                      <CheckCircle2 className="h-3 w-3" />
                      Statut
                    </label>
                    <div className="p-2 sm:p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-md rounded-tl-none border border-blue-200 dark:border-blue-800 border-t-0 shadow-sm">
                      <div className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          id="actif"
                          checked={formData.actif}
                          onChange={(e) => setFormData({ ...formData, actif: e.target.checked })}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                        <Label htmlFor="actif" className="cursor-pointer text-sm font-medium text-slate-900 dark:text-slate-100">
                          Type actif
                        </Label>
                        <Badge
                          className={
                            formData.actif
                              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs ml-auto"
                              : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 text-xs ml-auto"
                          }
                        >
                          {formData.actif ? "Actif" : "Inactif"}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  <div className="space-y-1 md:col-span-2">
                    <label className="text-[9px] sm:text-[10px] font-semibold text-slate-700 uppercase tracking-wide flex items-center gap-1 sm:gap-2 bg-slate-100 px-2 py-1 rounded-t-md">
                      <FileText className="h-3 w-3" />
                      Description
                    </label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Description du type de cotisation (optionnel)"
                      rows={3}
                      className="rounded-md rounded-tl-none border-blue-200 dark:border-blue-800 border-t-0 focus:border-blue-400 focus:ring-blue-400 resize-none"
                    />
                  </div>
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-gray-700">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowForm(false);
                      setEditingType(null);
                      setFormData({
                        nom: "",
                        description: "",
                        montant: 0,
                        actif: true,
                      });
                    }}
                    className="bg-white hover:bg-slate-50 border-slate-300 text-slate-700 hover:text-slate-900 shadow-sm"
                  >
                    Annuler
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={loading}
                    className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg"
                  >
                    {loading ? (
                      <>
                        <Clock className="h-4 w-4 mr-2 animate-spin" />
                        Enregistrement...
                      </>
                    ) : editingType ? (
                      <>
                        <Edit className="h-4 w-4 mr-2" />
                        Modifier
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4 mr-2" />
                        Créer
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </div>
          </DialogContent>
        </Dialog>

        {/* Informations importantes */}
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20 shadow-md">
          <CardContent className="p-4 sm:p-6">
            <Alert className="border-0 bg-transparent">
              <AlertDescription className="space-y-2">
                <div className="flex items-start space-x-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                  <div>
                    <h3 className="font-medium text-amber-800 dark:text-amber-200">
                      Informations Importantes
                    </h3>
                    <ul className="mt-2 text-sm text-amber-700 dark:text-amber-300 space-y-1">
                      <li>• Tous les types de cotisations sont obligatoires dans l'association mais ne sont pas applicables tous les mois</li>
                      <li>• Si un adhérent ne paie pas sa cotisation du mois, le montant devient une dette qu'il doit à l'association</li>
                      <li>• Un type inactif ne peut pas être utilisé pour créer de nouvelles cotisations</li>
                      <li>• La suppression d'un type est impossible s'il est utilisé dans des cotisations</li>
                    </ul>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
