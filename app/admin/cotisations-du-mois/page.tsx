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
import { Textarea } from "@/components/ui/textarea";
import { 
  Calendar, 
  Euro, 
  Plus, 
  Edit, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  AlertTriangle,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  X,
  Info,
  FileText,
  User
} from "lucide-react";
import { AdherentSearchDialog } from "@/components/admin/AdherentSearchDialog";
import { toast } from "react-toastify";
import { 
  getAllCotisationsDuMois,
  createCotisationDuMois,
  updateCotisationDuMois,
  deleteCotisationDuMois,
} from "@/actions/cotisations-du-mois";
import { getAllTypesCotisationMensuelle } from "@/actions/cotisations-mensuelles";
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

interface CotisationDuMois {
  id: string;
  periode: string;
  annee: number;
  mois: number;
  typeCotisationId: string;
  montantBase: number;
  dateEcheance: Date | string;
  description?: string | null;
  statut: string;
  createdBy: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  TypeCotisation: {
    id: string;
    nom: string;
    description?: string | null;
    montant: number;
    obligatoire: boolean;
    aBeneficiaire: boolean;
  };
  CreatedBy: {
    name?: string | null;
    email: string;
  };
  _count: {
    CotisationsMensuelles: number;
  };
}

interface TypeCotisationMensuelle {
  id: string;
  nom: string;
  description?: string;
  montant: number;
  obligatoire: boolean;
  actif: boolean;
  aBeneficiaire: boolean;
}

const columnHelper = createColumnHelper<CotisationDuMois>();

const moisOptions = [
  { value: 1, label: "Janvier" },
  { value: 2, label: "Février" },
  { value: 3, label: "Mars" },
  { value: 4, label: "Avril" },
  { value: 5, label: "Mai" },
  { value: 6, label: "Juin" },
  { value: 7, label: "Juillet" },
  { value: 8, label: "Août" },
  { value: 9, label: "Septembre" },
  { value: 10, label: "Octobre" },
  { value: 11, label: "Novembre" },
  { value: 12, label: "Décembre" },
];

export default function AdminCotisationsDuMois() {
  const [cotisations, setCotisations] = useState<CotisationDuMois[]>([]);
  const [typesCotisation, setTypesCotisation] = useState<TypeCotisationMensuelle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingCotisation, setEditingCotisation] = useState<CotisationDuMois | null>(null);
  const [formData, setFormData] = useState({
    annee: new Date().getFullYear(),
    mois: new Date().getMonth() + 1,
    typeCotisationId: "",
    montantBase: 0,
    dateEcheance: "",
    description: "",
    adherentBeneficiaireId: "",
  });
  const [adherentSearchOpen, setAdherentSearchOpen] = useState(false);
  const [selectedAdherent, setSelectedAdherent] = useState<{
    id: string;
    firstname: string;
    lastname: string;
    email: string;
  } | null>(null);

  // États pour TanStack Table
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [anneeFilter, setAnneeFilter] = useState<string>("all");
  const [moisFilter, setMoisFilter] = useState<string>("all");
  const [statutFilter, setStatutFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("admin-cotisations-du-mois-column-visibility");
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
            periode: false,
            TypeCotisation: false,
            montantAttendu: false,
            montantPaye: false,
            montantRestant: false,
            description: false,
            statut: false,
            createdAt: false,
            // Garder visible : (première colonne principale), actions (si présente)
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
      const saved = localStorage.getItem("admin-cotisations-du-mois-column-visibility");
      
      if (isMobile && (!saved || Object.keys(JSON.parse(saved || "{}")).length === 0)) {
        setColumnVisibility({
          periode: false,
          TypeCotisation: false,
          montantAttendu: false,
          montantPaye: false,
          montantRestant: false,
          description: false,
          statut: false,
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
      const [cotisationsResult, typesResult] = await Promise.all([
        getAllCotisationsDuMois(),
        getAllTypesCotisationMensuelle()
      ]);

      if (cotisationsResult.success && cotisationsResult.data) {
        setCotisations(cotisationsResult.data);
      } else {
        console.error("Erreur getAllCotisationsDuMois:", cotisationsResult.error);
        toast.error(cotisationsResult.error || "Erreur lors du chargement des cotisations du mois");
      }

      if (typesResult.success && typesResult.data) {
        setTypesCotisation(typesResult.data.filter((t: TypeCotisationMensuelle) => t.actif));
      } else {
        console.error("Erreur getAllTypesCotisationMensuelle:", typesResult.error);
      }
    } catch (error) {
      console.error("Erreur dans loadData:", error);
      toast.error("Erreur lors du chargement des données");
    } finally {
      setLoading(false);
    }
  }, []);

  // Obtenir les années uniques
  const anneeOptions = useMemo(() => {
    const anneeSet = new Set<number>();
    cotisations.forEach(c => {
      anneeSet.add(c.annee);
    });
    return Array.from(anneeSet).sort((a, b) => b - a);
  }, [cotisations]);

  // Filtrer les données
  const filteredData = useMemo(() => {
    return cotisations.filter(item => {
      // Filtre global (recherche)
      if (globalFilter.trim()) {
        const q = globalFilter.trim().toLowerCase();
        const searchText = [
          item.periode || "",
          item.TypeCotisation?.nom || "",
          item.TypeCotisation?.description || "",
          item.description || "",
          item.statut || "",
          item.CreatedBy?.email || "",
        ].join(" ").toLowerCase();
        if (!searchText.includes(q)) return false;
      }
      
      // Filtre par année
      if (anneeFilter !== "all" && item.annee !== parseInt(anneeFilter)) {
        return false;
      }
      
      // Filtre par mois
      if (moisFilter !== "all" && item.mois !== parseInt(moisFilter)) {
        return false;
      }
      
      // Filtre par statut
      if (statutFilter !== "all" && item.statut !== statutFilter) {
        return false;
      }
      
      // Filtre par type
      if (typeFilter !== "all" && item.typeCotisationId !== typeFilter) {
        return false;
      }
      
      return true;
    });
  }, [cotisations, globalFilter, anneeFilter, moisFilter, statutFilter, typeFilter]);

  const columns = useMemo(() => [
    columnHelper.accessor("periode", {
      header: "Période",
      cell: ({ row }) => {
        const mois = moisOptions.find(m => m.value === row.original.mois)?.label || `Mois ${row.original.mois}`;
        return (
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {mois} {row.original.annee}
          </span>
        );
      },
      size: 150,
      minSize: 120,
      maxSize: 200,
      enableResizing: true,
    }),
    columnHelper.accessor("TypeCotisation.nom", {
      header: "Type de cotisation",
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {row.original.TypeCotisation?.nom || "Type inconnu"}
          </span>
          {row.original.TypeCotisation?.obligatoire && (
            <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 text-xs w-fit mt-1">
              Obligatoire
            </Badge>
          )}
        </div>
      ),
      size: 200,
      minSize: 150,
      maxSize: 300,
      enableResizing: true,
    }),
    columnHelper.accessor("montantBase", {
      header: "Montant de base",
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Euro className="h-4 w-4 text-gray-500" />
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {row.original.montantBase.toFixed(2).replace(".", ",")} €
          </span>
        </div>
      ),
      size: 150,
      minSize: 120,
      maxSize: 180,
      enableResizing: true,
    }),
    columnHelper.accessor("dateEcheance", {
      header: "Date d'échéance",
      cell: ({ row }) => (
        <span className="text-sm text-gray-900 dark:text-gray-100">
          {new Date(row.original.dateEcheance).toLocaleDateString('fr-FR')}
        </span>
      ),
      size: 150,
      minSize: 120,
      maxSize: 180,
      enableResizing: true,
    }),
    columnHelper.accessor("statut", {
      header: "Statut",
      cell: ({ row }) => {
        const statut = row.original.statut;
        const badges = {
          Planifie: <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 text-xs"><Clock className="h-3 w-3 mr-1" />Planifié</Badge>,
          Cree: <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs"><CheckCircle2 className="h-3 w-3 mr-1" />Créé</Badge>,
          Annule: <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 text-xs"><AlertTriangle className="h-3 w-3 mr-1" />Annulé</Badge>,
        };
        return badges[statut as keyof typeof badges] || <Badge>{statut}</Badge>;
      },
      size: 120,
      minSize: 100,
      maxSize: 150,
      enableResizing: true,
    }),
    columnHelper.accessor("_count.CotisationsMensuelles", {
      header: "Cotisations créées",
      cell: ({ row }) => (
        <span className="text-sm text-gray-900 dark:text-gray-100">
          {row.original._count.CotisationsMensuelles}
        </span>
      ),
      size: 150,
      minSize: 120,
      maxSize: 180,
      enableResizing: true,
    }),
    columnHelper.display({
      id: "actions",
      header: "Actions",
      meta: { forceVisible: true },
      enableResizing: false,
      cell: ({ row }) => {
        const item = row.original;
        return (
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0 border-blue-300 hover:bg-blue-50"
              onClick={() => {
                setEditingCotisation(item);
                setFormData({
                  annee: item.annee,
                  mois: item.mois,
                  typeCotisationId: item.typeCotisationId,
                  montantBase: item.montantBase,
                  dateEcheance: new Date(item.dateEcheance).toISOString().split('T')[0],
                  description: item.description || "",
                  adherentBeneficiaireId: (item as any).adherentBeneficiaireId || "",
                });
                // TODO: Charger l'adhérent bénéficiaire si présent
                setShowForm(true);
              }}
              title="Modifier"
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0 border-red-300 hover:bg-red-50"
              onClick={() => handleDelete(item.id)}
              disabled={item._count.CotisationsMensuelles > 0}
              title={
                item._count.CotisationsMensuelles > 0
                  ? "Impossible de supprimer : des cotisations mensuelles ont été créées"
                  : "Supprimer"
              }
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        );
      },
      size: 120,
      minSize: 100,
      maxSize: 150,
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
        localStorage.setItem("admin-cotisations-du-mois-column-visibility", JSON.stringify(newVisibility));
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
      // Vérifier si le type nécessite un adhérent bénéficiaire
      const selectedType = typesCotisation.find(t => t.id === formData.typeCotisationId);
      const aBeneficiaire = selectedType?.aBeneficiaire || false;
      
      if (aBeneficiaire && !formData.adherentBeneficiaireId) {
        toast.error("Veuillez sélectionner l'adhérent bénéficiaire pour ce type de cotisation");
        return;
      }

      const formDataObj = new FormData();
      formDataObj.append("annee", formData.annee.toString());
      formDataObj.append("mois", formData.mois.toString());
      formDataObj.append("typeCotisationId", formData.typeCotisationId);
      formDataObj.append("montantBase", formData.montantBase.toString());
      formDataObj.append("dateEcheance", formData.dateEcheance);
      if (formData.description) {
        formDataObj.append("description", formData.description);
      }
      if (formData.adherentBeneficiaireId) {
        formDataObj.append("adherentBeneficiaireId", formData.adherentBeneficiaireId);
      }

      let result;
      if (editingCotisation) {
        formDataObj.append("id", editingCotisation.id);
        result = await updateCotisationDuMois(formDataObj);
      } else {
        result = await createCotisationDuMois(formDataObj);
      }

      if (result.success) {
        toast.success(editingCotisation ? "Cotisation du mois mise à jour" : "Cotisation du mois créée");
        setShowForm(false);
        setEditingCotisation(null);
        setFormData({
          annee: new Date().getFullYear(),
          mois: new Date().getMonth() + 1,
          typeCotisationId: "",
          montantBase: 0,
          dateEcheance: "",
          description: "",
          adherentBeneficiaireId: "",
        });
        setSelectedAdherent(null);
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
    if (!confirm("Êtes-vous sûr de vouloir supprimer cette cotisation du mois ?")) {
      return;
    }

    try {
      const result = await deleteCotisationDuMois(id);
      if (result.success) {
        toast.success("Cotisation du mois supprimée");
        loadData();
      } else {
        toast.error(result.error || "Erreur lors de la suppression");
      }
    } catch (error) {
      toast.error("Erreur lors de la suppression");
    }
  };

  if (loading && cotisations.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-slate-900 dark:to-slate-800 p-2 sm:p-4">
      <Card className="mx-auto max-w-7xl shadow-lg border-blue-200 !pt-0">
        <CardHeader className="!py-0 !pt-0 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-t-lg">
          <div className="flex items-center justify-between py-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calendar className="h-4 w-4" />
              Gestion des Cotisations du Mois ({cotisations.length})
            </CardTitle>
            <Button
              onClick={() => {
                setEditingCotisation(null);
                setFormData({
                  annee: new Date().getFullYear(),
                  mois: new Date().getMonth() + 1,
                  typeCotisationId: "",
                  montantBase: 0,
                  dateEcheance: "",
                  description: "",
                  adherentBeneficiaireId: "",
                });
                setSelectedAdherent(null);
                setShowForm(true);
              }}
              className="bg-white/10 hover:bg-white/20 border-white/30 text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              Nouvelle cotisation
            </Button>
          </div>
          <CardDescription className="text-blue-100 text-xs pb-3">
            Créez et gérez les cotisations par mois et année. Recherchez et triez par année ou mois.
          </CardDescription>
        </CardHeader>
        <CardContent className="!py-0 p-4">
          {/* Filtres et recherche */}
          <div className="flex flex-col sm:flex-row gap-2 mb-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Rechercher par période, type, description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-11"
              />
            </div>
            <ColumnVisibilityToggle 
              table={table} 
              storageKey="admin-cotisations-du-mois-column-visibility"
            />
            <Select value={anneeFilter} onValueChange={setAnneeFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Toutes les années" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les années</SelectItem>
                {anneeOptions.map(annee => (
                  <SelectItem key={annee} value={annee.toString()}>
                    {annee}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={moisFilter} onValueChange={setMoisFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Tous les mois" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les mois</SelectItem>
                {moisOptions.map(mois => (
                  <SelectItem key={mois.value} value={mois.value.toString()}>
                    {mois.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statutFilter} onValueChange={setStatutFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Tous les statuts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="Planifie">Planifié</SelectItem>
                <SelectItem value="Cree">Créé</SelectItem>
                <SelectItem value="Annule">Annulé</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Tous les types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les types</SelectItem>
                {typesCotisation.map(type => (
                  <SelectItem key={type.id} value={type.id}>
                    {type.nom}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="mb-2 text-xs text-gray-600 dark:text-gray-300">
            {filteredData.length} cotisation(s) trouvée(s) sur {cotisations.length}
          </div>

          <DataTable table={table} emptyMessage="Aucune cotisation du mois trouvée" />
          
          {/* Pagination */}
          <div className="bg-white dark:bg-gray-800 mt-3 flex items-center justify-between !py-0 font-semibold rounded-xl shadow-xl border border-gray-200 dark:border-gray-700">
            <div className="ml-3 flex-1 text-xs text-muted-foreground dark:text-gray-400">
              {table.getFilteredRowModel().rows.length} ligne(s) au total
            </div>

            <div className="flex items-center space-x-6 lg:space-x-8">
              <div className="flex items-center space-x-2">
                <p className="text-xs font-medium text-gray-700 dark:text-gray-300">Lignes par page</p>
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

              <div className="flex items-center justify-center text-xs font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
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
        </CardContent>
      </Card>

      {/* Dialog de création/édition */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="!py-0 !pt-0 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="!py-0 !pt-0 pb-3">
            <div className="pt-4">
              <DialogTitle className="text-lg">
                {editingCotisation ? "Modifier la cotisation du mois" : "Nouvelle cotisation du mois"}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {editingCotisation 
                  ? "Modifiez les informations de la cotisation du mois"
                  : "Créez une nouvelle cotisation pour un mois et une année donnés"}
              </DialogDescription>
            </div>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="annee" className="text-xs">Année *</Label>
                <Input
                  id="annee"
                  type="number"
                  min="2020"
                  max="2100"
                  value={formData.annee}
                  onChange={(e) => setFormData({ ...formData, annee: parseInt(e.target.value) })}
                  required
                  disabled={!!editingCotisation}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="mois" className="text-xs">Mois *</Label>
                <Select
                  value={formData.mois.toString()}
                  onValueChange={(value) => setFormData({ ...formData, mois: parseInt(value) })}
                  disabled={!!editingCotisation}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {moisOptions.map(mois => (
                      <SelectItem key={mois.value} value={mois.value.toString()}>
                        {mois.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="typeCotisationId" className="text-xs">Type de cotisation *</Label>
              <Select
                value={formData.typeCotisationId}
                onValueChange={(value) => setFormData({ ...formData, typeCotisationId: value })}
                disabled={!!editingCotisation}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionnez un type de cotisation" />
                </SelectTrigger>
                <SelectContent>
                  {typesCotisation.map(type => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.nom} {type.obligatoire && "(Obligatoire)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="montantBase" className="text-xs">Montant de base (€) *</Label>
                <Input
                  id="montantBase"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.montantBase}
                  onChange={(e) => setFormData({ ...formData, montantBase: parseFloat(e.target.value) || 0 })}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="dateEcheance" className="text-xs">Date d'échéance *</Label>
                <Input
                  id="dateEcheance"
                  type="date"
                  value={formData.dateEcheance}
                  onChange={(e) => setFormData({ ...formData, dateEcheance: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="description" className="text-xs">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                placeholder="Description optionnelle..."
              />
            </div>

            {/* Champ pour l'adhérent bénéficiaire (pour les types avec bénéficiaire) */}
            {formData.typeCotisationId && (() => {
              const selectedType = typesCotisation.find(t => t.id === formData.typeCotisationId);
              // Utiliser le champ aBeneficiaire du type de cotisation
              const aBeneficiaire = selectedType?.aBeneficiaire || false;
              
              if (aBeneficiaire) {
                return (
                  <div className="space-y-1">
                    <Label className="text-xs">Adhérent bénéficiaire *</Label>
                    <div className="flex gap-2">
                      <Input
                        readOnly
                        value={selectedAdherent ? `${selectedAdherent.firstname} ${selectedAdherent.lastname}` : ""}
                        placeholder="Sélectionnez l'adhérent bénéficiaire..."
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setAdherentSearchOpen(true)}
                      >
                        <User className="h-4 w-4 mr-2" />
                        Rechercher
                      </Button>
                      {selectedAdherent && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedAdherent(null);
                            setFormData({ ...formData, adherentBeneficiaireId: "" });
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      L'adhérent bénéficiaire ne paiera pas cette cotisation d'assistance
                    </p>
                  </div>
                );
              }
              return null;
            })()}

            <DialogFooter className="!py-0 pt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowForm(false);
                  setEditingCotisation(null);
                }}
              >
                Annuler
              </Button>
              <Button type="submit" size="sm" disabled={loading}>
                {loading ? "Enregistrement..." : editingCotisation ? "Modifier" : "Créer"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog de recherche d'adhérent */}
      <AdherentSearchDialog
        open={adherentSearchOpen}
        onOpenChange={setAdherentSearchOpen}
        onSelect={(adherent) => {
          setSelectedAdherent(adherent);
          setFormData({ ...formData, adherentBeneficiaireId: adherent.id });
        }}
        title="Sélectionner l'adhérent bénéficiaire"
        description="Recherchez l'adhérent qui bénéficiera de cette assistance (il ne paiera pas cette cotisation)"
      />
    </div>
  );
}

