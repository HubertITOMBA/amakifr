"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Calendar, Euro, Users, AlertTriangle, CheckCircle2, Clock, Eye, Edit, Settings, Search, Filter, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, List } from "lucide-react";
import { toast } from "react-toastify";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { createCotisationsMensuelles, getCotisationsMensuellesStats, getCotisationsMensuellesByPeriode, updateCotisationMensuelle, getAllCotisationsMensuelles } from "@/actions/cotisations-mensuelles";
import { getAllTypesCotisationMensuelle } from "@/actions/cotisations-mensuelles";
import { useRouter } from "next/navigation";
import { ViewDialog } from "@/app/admin/types-cotisation/ViewDialog";
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

interface CotisationStats {
  totalTypesCotisation: number;
  typesActifs: number;
  totalCotisationsMois: number;
  totalDettes: number;
  adherentsEnRetard: number;
}

interface TypeCotisationMensuelle {
  id: string;
  nom: string;
  description?: string;
  montant: number;
  obligatoire: boolean;
  actif: boolean;
  ordre: number;
  _count?: {
    CotisationsMensuelles: number;
  };
  CreatedBy?: {
    email: string;
  };
}

const columnHelper = createColumnHelper<TypeCotisationMensuelle & { selected?: boolean }>();

interface CotisationMensuelle {
  id: string;
  periode: string;
  annee: number;
  mois: number;
  montantAttendu: number;
  montantPaye: number;
  montantRestant: number;
  statut: string;
  dateEcheance: Date | string;
  description?: string | null;
  TypeCotisation: {
    id: string;
    nom: string;
    description?: string | null;
    montant: number;
    obligatoire: boolean;
  };
  Adherent: {
    id: string;
    firstname: string;
    lastname: string;
    User: {
      email: string;
    };
  };
  CreatedBy: {
    name?: string | null;
    email: string;
  };
  _count: {
    Paiements: number;
  };
}

const cotisationColumnHelper = createColumnHelper<CotisationMensuelle>();

interface CotisationsListTableProps {
  cotisations: CotisationMensuelle[];
  typesCotisation: TypeCotisationMensuelle[];
  loading: boolean;
  onEdit: (cotisation: CotisationMensuelle) => void;
}

function CotisationsListTable({ cotisations, typesCotisation, loading, onEdit }: CotisationsListTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [moisFilter, setMoisFilter] = useState<string>("all");
  const [anneeFilter, setAnneeFilter] = useState<string>("all");
  const [statutFilter, setStatutFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("admin-cotisations-column-visibility");
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

  // Obtenir les mois et années uniques
  const moisOptions = useMemo(() => {
    const moisSet = new Set<string>();
    cotisations.forEach(c => {
      const [annee, mois] = c.periode.split('-');
      moisSet.add(`${annee}-${mois}`);
    });
    return Array.from(moisSet).sort().reverse();
  }, [cotisations]);

  const anneeOptions = useMemo(() => {
    const anneeSet = new Set<number>();
    cotisations.forEach(c => {
      anneeSet.add(c.annee);
    });
    return Array.from(anneeSet).sort((a, b) => b - a);
  }, [cotisations]);

  // Fonction pour vérifier si une cotisation peut être modifiée
  const canEdit = (cotisation: CotisationMensuelle): boolean => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
    const nextYear = currentMonth === 12 ? currentYear + 1 : currentYear;
    
    return (
      (cotisation.annee === currentYear && cotisation.mois === currentMonth) ||
      (cotisation.annee === nextYear && cotisation.mois === nextMonth)
    );
  };

  // Filtrer les données
  const filteredData = useMemo(() => {
    return cotisations.filter(item => {
      // Filtre global (recherche)
      if (globalFilter.trim()) {
        const q = globalFilter.trim().toLowerCase();
        const searchText = [
          item.TypeCotisation.nom || "",
          item.Adherent.firstname || "",
          item.Adherent.lastname || "",
          item.Adherent.User.email || "",
          item.statut || "",
          item.description || "",
        ].join(" ").toLowerCase();
        if (!searchText.includes(q)) return false;
      }
      
      // Filtre par mois/année
      if (moisFilter !== "all") {
        const [annee, mois] = moisFilter.split('-');
        if (item.annee !== parseInt(annee) || item.mois !== parseInt(mois)) {
          return false;
        }
      }
      
      // Filtre par année
      if (anneeFilter !== "all" && item.annee !== parseInt(anneeFilter)) {
        return false;
      }
      
      // Filtre par statut
      if (statutFilter !== "all" && item.statut !== statutFilter) {
        return false;
      }
      
      // Filtre par type
      if (typeFilter !== "all" && item.TypeCotisation.id !== typeFilter) {
        return false;
      }
      
      return true;
    });
  }, [cotisations, globalFilter, moisFilter, anneeFilter, statutFilter, typeFilter]);

  const columns = useMemo(() => [
    cotisationColumnHelper.accessor("periode", {
      header: "Période",
      cell: ({ row }) => {
        const mois = new Date(2000, row.original.mois - 1, 1).toLocaleDateString('fr-FR', { month: 'long' });
        return (
          <span className="text-sm text-gray-900 dark:text-gray-100 font-medium capitalize">
            {mois} {row.original.annee}
          </span>
        );
      },
      size: 150,
      minSize: 120,
      maxSize: 200,
      enableResizing: true,
    }),
    cotisationColumnHelper.accessor("TypeCotisation.nom", {
      header: "Type",
      cell: ({ row }) => (
        <span className="text-sm text-gray-900 dark:text-gray-100">
          {row.original.TypeCotisation.nom}
        </span>
      ),
      size: 200,
      minSize: 150,
      maxSize: 300,
      enableResizing: true,
    }),
    cotisationColumnHelper.accessor("Adherent", {
      header: "Adhérent",
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {row.original.Adherent.firstname} {row.original.Adherent.lastname}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {row.original.Adherent.User.email}
          </span>
        </div>
      ),
      size: 250,
      minSize: 200,
      maxSize: 350,
      enableResizing: true,
    }),
    cotisationColumnHelper.accessor("montantAttendu", {
      header: "Montant",
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Euro className="h-3 w-3 text-gray-500" />
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {row.original.montantAttendu.toFixed(2).replace(".", ",")} €
          </span>
        </div>
      ),
      size: 120,
      minSize: 100,
      maxSize: 150,
      enableResizing: true,
    }),
    cotisationColumnHelper.accessor("statut", {
      header: "Statut",
      cell: ({ row }) => {
        const statut = row.original.statut;
        const badges = {
          Paye: <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs"><CheckCircle2 className="h-3 w-3 mr-1" />Payé</Badge>,
          EnAttente: <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 text-xs"><Clock className="h-3 w-3 mr-1" />En attente</Badge>,
          EnRetard: <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 text-xs"><AlertTriangle className="h-3 w-3 mr-1" />En retard</Badge>,
          PartiellementPaye: <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 text-xs">Partiellement payé</Badge>,
        };
        return badges[statut as keyof typeof badges] || <Badge>{statut}</Badge>;
      },
      size: 150,
      minSize: 120,
      maxSize: 180,
      enableResizing: true,
    }),
    cotisationColumnHelper.accessor("dateEcheance", {
      header: "Échéance",
      cell: ({ row }) => (
        <span className="text-sm text-gray-900 dark:text-gray-100">
          {new Date(row.original.dateEcheance).toLocaleDateString('fr-FR')}
        </span>
      ),
      size: 120,
      minSize: 100,
      maxSize: 150,
      enableResizing: true,
    }),
    cotisationColumnHelper.display({
      id: "actions",
      header: "Actions",
      meta: { forceVisible: true },
      enableResizing: false,
      cell: ({ row }) => {
        const item = row.original;
        const editable = canEdit(item);
        return (
          <div className="flex items-center space-x-2">
            <Button
              variant={editable ? "default" : "outline"}
              size="sm"
              className={`h-8 w-8 p-0 ${
                editable
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'border-gray-300 dark:border-gray-600 opacity-50 cursor-not-allowed'
              }`}
              onClick={() => editable && onEdit(item)}
              disabled={!editable}
              title={editable ? "Modifier" : "Modification uniquement pour le mois en cours ou le mois suivant"}
            >
              <Edit className="h-4 w-4" />
            </Button>
          </div>
        );
      },
      size: 100,
      minSize: 80,
      maxSize: 120,
    }),
  ], [onEdit]);

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
        localStorage.setItem("admin-cotisations-column-visibility", JSON.stringify(newVisibility));
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filtres et recherche */}
      <div className="flex flex-col sm:flex-row gap-4 items-end">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Rechercher par type, adhérent, email, statut..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <ColumnVisibilityToggle 
          table={table} 
          storageKey="admin-cotisations-column-visibility"
        />
        <Select value={moisFilter} onValueChange={setMoisFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Tous les mois" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les mois</SelectItem>
            {moisOptions.map(mois => {
              const [annee, moisNum] = mois.split('-');
              const moisNom = new Date(2000, parseInt(moisNum) - 1, 1).toLocaleDateString('fr-FR', { month: 'long' });
              return (
                <SelectItem key={mois} value={mois}>
                  {moisNom.charAt(0).toUpperCase() + moisNom.slice(1)} {annee}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
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
        <Select value={statutFilter} onValueChange={setStatutFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Tous les statuts" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="EnAttente">En attente</SelectItem>
            <SelectItem value="PartiellementPaye">Partiellement payé</SelectItem>
            <SelectItem value="Paye">Payé</SelectItem>
            <SelectItem value="EnRetard">En retard</SelectItem>
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

      <div className="mb-4 text-sm text-gray-600 dark:text-gray-300">
        {filteredData.length} cotisation(s) trouvée(s) sur {cotisations.length}
      </div>

      <DataTable table={table} emptyMessage="Aucune cotisation trouvée" compact={true} />
      
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
    </div>
  );
}

export default function AdminCotisationCreation() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [loadingCotisations, setLoadingCotisations] = useState(false);
  const [loadingAllCotisations, setLoadingAllCotisations] = useState(false);
  const [stats, setStats] = useState<CotisationStats | null>(null);
  const [typesCotisation, setTypesCotisation] = useState<TypeCotisationMensuelle[]>([]);
  const [cotisationsMois, setCotisationsMois] = useState<CotisationMensuelle[]>([]);
  const [allCotisations, setAllCotisations] = useState<CotisationMensuelle[]>([]);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [sortingList, setSortingList] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [moisFilter, setMoisFilter] = useState<string>("all");
  const [anneeFilter, setAnneeFilter] = useState<string>("all");
  const [statutFilter, setStatutFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("admin-cotisations-column-visibility");
        if (saved) return JSON.parse(saved);
      } catch (error) {
        console.error("Erreur lors du chargement des préférences:", error);
      }
    }
    return {};
  });
  const [editingCotisation, setEditingCotisation] = useState<CotisationMensuelle | null>(null);
  const [editFormData, setEditFormData] = useState({
    montantAttendu: 0,
    dateEcheance: "",
    description: "",
    statut: "EnAttente" as "EnAttente" | "PartiellementPaye" | "Paye" | "EnRetard",
  });
  const [formData, setFormData] = useState({
    mois: new Date().getMonth() + 1,
    annee: new Date().getFullYear(),
    typeCotisationIds: [] as string[],
  });

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

  useEffect(() => {
    loadData();
    loadAllCotisations();
  }, []);

  // Charger les cotisations du mois sélectionné
  useEffect(() => {
    loadCotisationsMois();
  }, [formData.mois, formData.annee]);

  // Debounce pour la recherche
  useEffect(() => {
    const timer = setTimeout(() => {
      setGlobalFilter(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const loadData = async () => {
    try {
      const [statsResult, typesResult] = await Promise.all([
        getCotisationsMensuellesStats(),
        getAllTypesCotisationMensuelle()
      ]);

      if (statsResult.success && statsResult.data) {
        setStats(statsResult.data);
      }

      if (typesResult.success && typesResult.data) {
        setTypesCotisation(typesResult.data);
        // Sélectionner automatiquement les types obligatoires
        const typesObligatoires = typesResult.data
          .filter((type: TypeCotisationMensuelle) => type.obligatoire && type.actif)
          .map((type: TypeCotisationMensuelle) => type.id);
        setFormData(prev => ({ ...prev, typeCotisationIds: typesObligatoires }));
      }
    } catch (error) {
      console.error("Erreur lors du chargement des données:", error);
    }
  };

  const loadCotisationsMois = async () => {
    try {
      setLoadingCotisations(true);
      const periode = `${formData.annee}-${formData.mois.toString().padStart(2, '0')}`;
      const result = await getCotisationsMensuellesByPeriode(periode);
      if (result.success && result.data) {
        setCotisationsMois(result.data);
      }
    } catch (error) {
      console.error("Erreur lors du chargement des cotisations du mois:", error);
    } finally {
      setLoadingCotisations(false);
    }
  };

  const loadAllCotisations = async () => {
    try {
      setLoadingAllCotisations(true);
      const result = await getAllCotisationsMensuelles();
      if (result.success && result.data) {
        setAllCotisations(result.data);
      } else {
        toast.error(result.error || "Erreur lors du chargement des cotisations");
      }
    } catch (error) {
      console.error("Erreur lors du chargement de toutes les cotisations:", error);
      toast.error("Erreur lors du chargement des cotisations");
    } finally {
      setLoadingAllCotisations(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Vérifier qu'au moins le forfait est sélectionné
    const forfaitSelected = formData.typeCotisationIds.some(id => {
      const type = typesCotisation.find(t => t.id === id);
      return type && type.nom.toLowerCase().includes('forfait');
    });
    
    if (!forfaitSelected) {
      toast.error("Veuillez sélectionner au moins le type 'Forfait Mensuel'. Les assistances du mois seront automatiquement ajoutées.");
      return;
    }
    
    setLoading(true);

    try {
      // La logique utilise automatiquement le forfait et ajoute les assistances du mois
      const result = await createCotisationsMensuelles({
        periode: `${formData.annee}-${formData.mois.toString().padStart(2, '0')}`,
        annee: formData.annee,
        mois: formData.mois,
        typeCotisationIds: formData.typeCotisationIds, // Utilisé pour trouver le forfait
      });

      if (result.success) {
        toast.success(result.message);
        setFormData({
          mois: new Date().getMonth() + 1,
          annee: new Date().getFullYear(),
          typeCotisationIds: typesCotisation
            .filter(type => type.obligatoire && type.actif)
            .map(type => type.id),
        });
        loadData(); // Recharger les données
        loadCotisationsMois(); // Recharger les cotisations du mois
      } else {
        toast.error(result.error);
      }
    } catch (error) {
      toast.error("Erreur lors de la création des cotisations");
    } finally {
      setLoading(false);
    }
  };

  // Trouver le forfait pour afficher le montant de base
  const typeForfait = typesCotisation.find(t => 
    t.id && formData.typeCotisationIds.includes(t.id) && 
    t.nom.toLowerCase().includes('forfait')
  );
  const montantForfait = typeForfait ? typeForfait.montant : 0;
  
  // Note: Le total réel sera calculé côté serveur (forfait + assistances du mois par adhérent)

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Création des Cotisations Mensuelles
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mt-2">
            Générer les obligations de cotisation pour tous les adhérents actifs
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Calendar className="h-6 w-6 text-blue-600" />
          <span className="text-sm text-gray-500">
            {new Date().toLocaleDateString('fr-FR', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </span>
        </div>
      </div>

      {/* Statistiques */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                    Types Actifs
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {stats.typesActifs}
                  </p>
                </div>
                <Users className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                    En Retard
                  </p>
                  <p className="text-2xl font-bold text-red-600">
                    {stats.adherentsEnRetard}
                  </p>
                </div>
                <AlertTriangle className="h-8 w-8 text-red-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                    Total Dettes
                  </p>
                  <p className="text-2xl font-bold text-orange-600">
                    {stats.totalDettes.toFixed(2).replace('.', ',')} €
                  </p>
                </div>
                <Euro className="h-8 w-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                    Cotisations Mois
                  </p>
                  <p className="text-2xl font-bold text-green-600">
                    {stats.totalCotisationsMois}
                  </p>
                </div>
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Formulaire de création */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Calendar className="h-5 w-5 text-blue-600" />
            <span>Nouvelles Cotisations Mensuelles</span>
          </CardTitle>
          <CardDescription>
            Créer les cotisations mensuelles pour tous les adhérents actifs. 
            Chaque cotisation inclut automatiquement le forfait mensuel (15€ ou montant variable) 
            + les assistances du mois s'il y en a.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Période */}
              <div className="space-y-2">
                <Label htmlFor="mois">Mois</Label>
                <Select
                  value={formData.mois.toString()}
                  onValueChange={(value) => setFormData({ ...formData, mois: parseInt(value) })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un mois" />
                  </SelectTrigger>
                  <SelectContent>
                    {moisOptions.map((mois) => (
                      <SelectItem key={mois.value} value={mois.value.toString()}>
                        {mois.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="annee">Année</Label>
                <Input
                  id="annee"
                  type="number"
                  min="2020"
                  max="2030"
                  value={formData.annee}
                  onChange={(e) => setFormData({ ...formData, annee: parseInt(e.target.value) })}
                />
              </div>

              {/* Types de Cotisation */}
              <div className="space-y-2 md:col-span-2">
                <div className="flex items-center justify-between">
                  <Label>Types de Cotisation à Inclure</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const actifsIds = typesCotisation.filter(t => t.actif).map(t => t.id);
                      if (formData.typeCotisationIds.length === actifsIds.length) {
                        setFormData(prev => ({ ...prev, typeCotisationIds: [] }));
                      } else {
                        setFormData(prev => ({ ...prev, typeCotisationIds: actifsIds }));
                      }
                    }}
                    className="text-xs"
                  >
                    {formData.typeCotisationIds.length === typesCotisation.filter(t => t.actif).length 
                      ? "Tout désélectionner" 
                      : "Tout sélectionner"}
                  </Button>
                </div>
                <TypesCotisationTable 
                  types={typesCotisation}
                  selectedIds={formData.typeCotisationIds}
                  onSelectionChange={(ids) => setFormData(prev => ({ ...prev, typeCotisationIds: ids }))}
                  sorting={sorting}
                  onSortingChange={setSorting}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  {formData.typeCotisationIds.length} type(s) sélectionné(s) sur {typesCotisation.filter(t => t.actif).length} actif(s)
                </p>
              </div>
            </div>

            {/* Résumé */}
            <Alert>
              <AlertDescription className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Forfait mensuel :</span>
                  <span className="font-bold text-lg">
                    {montantForfait.toFixed(2).replace('.', ',')} €
                  </span>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  + assistances du mois (ajoutées automatiquement si présentes)
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-300 mt-3">
                  <div className="mb-2">
                    <strong>Note :</strong> Chaque cotisation mensuelle inclut automatiquement le forfait + les assistances du mois pour chaque adhérent.
                  </div>
                  {formData.typeCotisationIds.length > 0 ? (
                    formData.typeCotisationIds.map(typeId => {
                      const type = typesCotisation.find(t => t.id === typeId);
                      return type ? (
                        <div key={typeId} className="flex justify-between">
                          <span>• {type.nom} :</span>
                          <span>{type.montant.toFixed(2).replace('.', ',')} €</span>
                        </div>
                      ) : null;
                    })
                  ) : (
                    <div className="text-red-600">Aucun type sélectionné</div>
                  )}
                  <div className="mt-2 pt-2 border-t">
                    <strong>Période :</strong> {moisOptions.find(m => m.value === formData.mois)?.label} {formData.annee}
                  </div>
                </div>
              </AlertDescription>
            </Alert>

            {/* Bouton de soumission */}
            <div className="flex justify-end space-x-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setFormData({
                  mois: new Date().getMonth() + 1,
                  annee: new Date().getFullYear(),
                  typeCotisationIds: typesCotisation
                    .filter(type => type.obligatoire && type.actif)
                    .map(type => type.id),
                })}
              >
                Réinitialiser
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {loading ? (
                  <>
                    <Clock className="h-4 w-4 mr-2 animate-spin" />
                    Création en cours...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Créer les Cotisations
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Types de cotisation sélectionnés pour le mois */}
      {formData.typeCotisationIds.length > 0 && (
        <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-900/10">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Settings className="h-5 w-5 text-blue-600" />
              <span>
                Types de cotisation sélectionnés pour {moisOptions.find(m => m.value === formData.mois)?.label} {formData.annee}
              </span>
              <Badge className="ml-2">{formData.typeCotisationIds.length}</Badge>
            </CardTitle>
            <CardDescription>
              Liste des types de cotisation qui seront utilisés pour créer les cotisations mensuelles
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TypesSelectionnesTable 
              types={typesCotisation.filter(t => formData.typeCotisationIds.includes(t.id))}
            />
          </CardContent>
        </Card>
      )}

      {/* Cotisations créées pour le mois */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Calendar className="h-5 w-5 text-blue-600" />
            <span>
              Cotisations créées pour {moisOptions.find(m => m.value === formData.mois)?.label} {formData.annee}
            </span>
            {cotisationsMois.length > 0 && (
              <Badge className="ml-2">{cotisationsMois.length}</Badge>
            )}
          </CardTitle>
          <CardDescription>
            Liste des cotisations mensuelles créées pour la période sélectionnée.
          </CardDescription>
          <Alert className="mt-4 border-blue-200 bg-blue-50 dark:bg-blue-900/20">
            <Edit className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800 dark:text-blue-200">
              <strong>Modification des cotisations :</strong> Vous pouvez modifier uniquement les cotisations du 
              <strong className="mx-1">mois en cours ({new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })})</strong>
              ou du <strong className="mx-1">mois suivant</strong>. 
              Les cotisations modifiables sont marquées avec un badge vert "Modifiable" et un bouton d'édition actif.
            </AlertDescription>
          </Alert>
        </CardHeader>
        <CardContent>
          {loadingCotisations ? (
            <div className="flex items-center justify-center py-8">
              <Clock className="h-5 w-5 animate-spin text-blue-600 mr-2" />
              <span className="text-gray-600">Chargement...</span>
            </div>
          ) : cotisationsMois.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p>Aucune cotisation créée pour cette période</p>
            </div>
          ) : (
            <CotisationsMoisTable 
              cotisations={cotisationsMois}
              onEdit={(cotisation) => {
                setEditingCotisation(cotisation);
                setEditFormData({
                  montantAttendu: cotisation.montantAttendu,
                  dateEcheance: new Date(cotisation.dateEcheance).toISOString().split('T')[0],
                  description: cotisation.description || "",
                  statut: cotisation.statut as "EnAttente" | "PartiellementPaye" | "Paye" | "EnRetard",
                });
              }}
            />
          )}
        </CardContent>
      </Card>

      {/* Dialog d'édition */}
      <Dialog open={!!editingCotisation} onOpenChange={(open) => !open && setEditingCotisation(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5" />
              Modifier la cotisation
            </DialogTitle>
            <DialogDescription>
              {editingCotisation && (
                <>
                  Modifier la cotisation de {editingCotisation.Adherent.firstname} {editingCotisation.Adherent.lastname} 
                  pour le type "{editingCotisation.TypeCotisation.nom}"
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {editingCotisation && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setLoading(true);
                try {
                  const result = await updateCotisationMensuelle({
                    id: editingCotisation.id,
                    montantAttendu: editFormData.montantAttendu,
                    dateEcheance: editFormData.dateEcheance,
                    description: editFormData.description || undefined,
                    statut: editFormData.statut,
                  });

                  if (result.success) {
                    toast.success(result.message || "Cotisation mise à jour avec succès");
                    setEditingCotisation(null);
                    loadCotisationsMois();
                    loadData();
                  } else {
                    toast.error(result.error || "Erreur lors de la mise à jour");
                  }
                } catch (error) {
                  toast.error("Erreur lors de la mise à jour de la cotisation");
                } finally {
                  setLoading(false);
                }
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="montantAttendu">Montant attendu *</Label>
                <div className="relative">
                  <Euro className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="montantAttendu"
                    type="number"
                    step="0.01"
                    min="0"
                    value={editFormData.montantAttendu}
                    onChange={(e) => setEditFormData({ ...editFormData, montantAttendu: parseFloat(e.target.value) || 0 })}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="dateEcheance">Date d'échéance *</Label>
                <Input
                  id="dateEcheance"
                  type="date"
                  value={editFormData.dateEcheance}
                  onChange={(e) => setEditFormData({ ...editFormData, dateEcheance: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="statut">Statut *</Label>
                <Select
                  value={editFormData.statut}
                  onValueChange={(value) => setEditFormData({ ...editFormData, statut: value as typeof editFormData.statut })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EnAttente">En attente</SelectItem>
                    <SelectItem value="PartiellementPaye">Partiellement payé</SelectItem>
                    <SelectItem value="Paye">Payé</SelectItem>
                    <SelectItem value="EnRetard">En retard</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={editFormData.description}
                  onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                  rows={3}
                  placeholder="Description optionnelle..."
                />
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="text-sm text-blue-800 dark:text-blue-200">
                  <strong>Informations actuelles :</strong>
                  <div className="mt-2 space-y-1">
                    <div>Montant payé : {editingCotisation.montantPaye.toFixed(2).replace(".", ",")} €</div>
                    <div>Montant restant : {editingCotisation.montantRestant.toFixed(2).replace(".", ",")} €</div>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingCotisation(null)}
                  disabled={loading}
                >
                  Annuler
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {loading ? (
                    <>
                      <Clock className="h-4 w-4 mr-2 animate-spin" />
                      Mise à jour...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Enregistrer
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Informations importantes */}
      <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20">
        <CardContent className="p-6">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
            <div>
              <h3 className="font-medium text-amber-800 dark:text-amber-200">
                Informations Importantes
              </h3>
              <ul className="mt-2 text-sm text-amber-700 dark:text-amber-300 space-y-1">
                <li>• Les cotisations seront créées pour tous les adhérents actifs</li>
                <li>• La date d'échéance sera fixée au 15 du mois sélectionné</li>
                <li>• Les adhérents recevront une notification de leur obligation</li>
                <li>• Un système de relance automatique sera activé pour les retards</li>
                <li>• <strong>Les cotisations du mois en cours ou du mois suivant peuvent être modifiées</strong> après création (montant, date d'échéance, statut, description)</li>
                <li>• Utilisez le bouton d'édition (icône crayon) sur les cotisations modifiables pour les modifier</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Liste complète des cotisations avec TanStack Table */}
      <Card className="shadow-lg border-blue-200">
        <CardHeader className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <List className="h-5 w-5" />
              Liste des Cotisations ({allCotisations.length})
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={loadAllCotisations}
                disabled={loadingAllCotisations}
                className="bg-white/10 hover:bg-white/20 border-white/30 text-white"
              >
                {loadingAllCotisations ? (
                  <Clock className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Calendar className="h-4 w-4 mr-2" />
                )}
                Actualiser
              </Button>
            </div>
          </div>
          <CardDescription className="text-blue-100">
            Liste complète de toutes les cotisations mensuelles avec recherche et filtres avancés
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CotisationsListTable 
            cotisations={allCotisations}
            typesCotisation={typesCotisation}
            loading={loadingAllCotisations}
            onEdit={(cotisation) => {
              setEditingCotisation(cotisation);
              setEditFormData({
                montantAttendu: cotisation.montantAttendu,
                dateEcheance: new Date(cotisation.dateEcheance).toISOString().split('T')[0],
                description: cotisation.description || "",
                statut: cotisation.statut as "EnAttente" | "PartiellementPaye" | "Paye" | "EnRetard",
              });
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}

// Composant Table pour les types de cotisation
function TypesCotisationTable({
  types,
  selectedIds,
  onSelectionChange,
  sorting,
  onSortingChange,
}: {
  types: TypeCotisationMensuelle[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  sorting: SortingState;
  onSortingChange: (sorting: SortingState) => void;
}) {
  const router = useRouter();
  const data = useMemo(() => types.map(type => ({
    ...type,
    selected: selectedIds.includes(type.id),
  })), [types, selectedIds]);

  const columns = useMemo(() => [
    columnHelper.display({
      id: "select",
      header: () => (
        <input
          type="checkbox"
          checked={types.length > 0 && selectedIds.length === types.filter(t => t.actif).length}
          onChange={(e) => {
            if (e.target.checked) {
              const actifsIds = types.filter(t => t.actif).map(t => t.id);
              onSelectionChange(actifsIds);
            } else {
              onSelectionChange([]);
            }
          }}
          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          checked={row.original.selected}
          onChange={(e) => {
            if (e.target.checked) {
              onSelectionChange([...selectedIds, row.original.id]);
            } else {
              onSelectionChange(selectedIds.filter(id => id !== row.original.id));
            }
          }}
          disabled={!row.original.actif}
          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        />
      ),
      size: 50,
      enableResizing: false,
    }),
    columnHelper.accessor("nom", {
      header: "Nom",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {row.getValue("nom")}
          </span>
          {!row.original.actif && (
            <Badge className="bg-gray-100 text-gray-600 text-xs">Inactif</Badge>
          )}
        </div>
      ),
      size: 150,
      minSize: 120,
      maxSize: 200,
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
    columnHelper.accessor("obligatoire", {
      header: "Type",
      cell: ({ row }) => (
        <Badge 
          className={
            row.getValue("obligatoire")
              ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 text-xs"
              : "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200 text-xs"
          }
        >
          {row.getValue("obligatoire") ? "Obligatoire" : "Optionnel"}
        </Badge>
      ),
      size: 120,
      minSize: 100,
      maxSize: 150,
      enableResizing: true,
    }),
    columnHelper.accessor("ordre", {
      header: "Ordre",
      cell: ({ row }) => (
        <span className="text-sm text-gray-600 dark:text-gray-300">
          #{row.getValue("ordre")}
        </span>
      ),
      size: 80,
      minSize: 60,
      maxSize: 100,
      enableResizing: true,
    }),
    columnHelper.display({
      id: "actions",
      header: "Actions",
      meta: { forceVisible: true },
      enableResizing: false,
      cell: ({ row }) => {
        const type = row.original;
        // Convertir le type pour correspondre à l'interface ViewDialog
        const typeForView = {
          ...type,
          createdBy: type.CreatedBy?.email || "",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          CreatedBy: type.CreatedBy || { id: "", email: "" },
          _count: type._count || { CotisationsMensuelles: 0 },
        };
        return (
          <div className="flex items-center gap-1 sm:gap-2">
            <ViewDialog type={typeForView as any} />
            <Button
              variant="outline"
              size="sm"
              className="h-7 w-7 sm:h-8 sm:w-8 p-0 border-blue-300 hover:bg-blue-50"
              onClick={() => {
                // Rediriger vers la page de gestion des types pour éditer
                router.push(`/admin/types-cotisation`);
                // Afficher un message pour indiquer qu'il faut sélectionner le type à éditer
                setTimeout(() => {
                  toast.info(`Redirection vers la page de gestion des types de cotisation. Veuillez utiliser le bouton "Éditer" pour modifier "${type.nom}".`);
                }, 500);
              }}
              title="Éditer le type de cotisation"
            >
              <Edit className="h-3 w-3 sm:h-4 sm:w-4" />
            </Button>
          </div>
        );
      },
      size: 120,
      minSize: 100,
      maxSize: 150,
    }),
  ], [selectedIds, types, onSelectionChange, router]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: onSortingChange,
    state: { sorting },
    defaultColumn: {
      minSize: 50,
      maxSize: 800,
    },
  });

  return (
    <div className="border rounded-lg overflow-hidden bg-white dark:bg-gray-900">
      <div className="max-h-96 overflow-y-auto">
        <DataTable table={table} emptyMessage="Aucun type de cotisation disponible" compact={true} />
      </div>
    </div>
  );
}

// Composant pour afficher les types de cotisation sélectionnés
function TypesSelectionnesTable({ types }: { types: TypeCotisationMensuelle[] }) {
  if (types.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Settings className="h-12 w-12 mx-auto mb-4 text-gray-400" />
        <p>Aucun type de cotisation sélectionné</p>
      </div>
    );
  }

  // Calculer le total des montants
  const totalMontant = types.reduce((sum, type) => sum + type.montant, 0);
  const typesObligatoires = types.filter(t => t.obligatoire).length;
  const typesOptionnels = types.filter(t => !t.obligatoire).length;

  return (
    <div className="space-y-4">
      {/* Statistiques rapides */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="text-xs text-gray-600 dark:text-gray-400">Total sélectionné</div>
          <div className="text-lg font-bold text-gray-900 dark:text-white">{types.length}</div>
        </div>
        <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="text-xs text-gray-600 dark:text-gray-400">Obligatoires</div>
          <div className="text-lg font-bold text-blue-600 dark:text-blue-400">{typesObligatoires}</div>
        </div>
        <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="text-xs text-gray-600 dark:text-gray-400">Optionnels</div>
          <div className="text-lg font-bold text-gray-900 dark:text-white">{typesOptionnels}</div>
        </div>
      </div>

      {/* Montant total */}
      <div className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Euro className="h-5 w-5 text-blue-600" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Montant total des types sélectionnés</span>
          </div>
          <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {totalMontant.toFixed(2).replace(".", ",")} €
          </span>
        </div>
        <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
          Note: Le montant réel par adhérent sera calculé en fonction du forfait + les assistances du mois
        </p>
      </div>

      {/* Liste des types */}
      <div className="border rounded-lg overflow-hidden bg-white dark:bg-gray-900">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                Nom
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                Description
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                Montant
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                Type
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                Ordre
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
            {types
              .sort((a, b) => {
                // Trier par ordre, puis par nom
                if (a.ordre !== b.ordre) return a.ordre - b.ordre;
                return a.nom.localeCompare(b.nom);
              })
              .map((type) => (
                <tr key={type.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {type.nom}
                      </span>
                      {!type.actif && (
                        <Badge className="bg-gray-100 text-gray-600 text-xs">Inactif</Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-600 dark:text-gray-300 max-w-xs truncate block">
                      {type.description || "-"}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <Euro className="h-4 w-4 text-gray-500" />
                      <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {type.montant.toFixed(2).replace(".", ",")} €
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Badge 
                      className={
                        type.obligatoire
                          ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 text-xs"
                          : "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200 text-xs"
                      }
                    >
                      {type.obligatoire ? "Obligatoire" : "Optionnel"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-sm text-gray-600 dark:text-gray-300">
                      #{type.ordre}
                    </span>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Composant Table pour afficher les cotisations créées du mois avec possibilité d'édition
function CotisationsMoisTable({ 
  cotisations, 
  onEdit 
}: { 
  cotisations: CotisationMensuelle[];
  onEdit: (cotisation: CotisationMensuelle) => void;
}) {
  // Vérifier si une cotisation peut être modifiée (mois en cours ou mois en cours + 1)
  const canEdit = (cotisation: CotisationMensuelle) => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
    const nextYear = currentMonth === 12 ? currentYear + 1 : currentYear;

    const isCurrentMonth = cotisation.annee === currentYear && cotisation.mois === currentMonth;
    const isNextMonth = cotisation.annee === nextYear && cotisation.mois === nextMonth;

    return isCurrentMonth || isNextMonth;
  };

  // Grouper les cotisations par mois, puis par type (forfait en premier)
  const groupedCotisations = useMemo(() => {
    const grouped: Record<string, CotisationMensuelle[]> = {};
    
    cotisations.forEach((cotisation) => {
      const moisKey = `${cotisation.annee}-${cotisation.mois.toString().padStart(2, '0')}`;
      
      if (!grouped[moisKey]) {
        grouped[moisKey] = [];
      }
      grouped[moisKey].push(cotisation);
    });

    // Trier chaque groupe : forfait en premier, puis les autres par nom
    Object.keys(grouped).forEach((moisKey) => {
      grouped[moisKey].sort((a, b) => {
        const aIsForfait = a.TypeCotisation.nom.toLowerCase().includes('forfait');
        const bIsForfait = b.TypeCotisation.nom.toLowerCase().includes('forfait');
        
        if (aIsForfait && !bIsForfait) return -1;
        if (!aIsForfait && bIsForfait) return 1;
        return a.TypeCotisation.nom.localeCompare(b.TypeCotisation.nom);
      });
    });

    return grouped;
  }, [cotisations]);

  // Obtenir les noms de mois
  const getMonthName = (mois: number) => {
    const moisNames = [
      "janvier", "février", "mars", "avril", "mai", "juin",
      "juillet", "août", "septembre", "octobre", "novembre", "décembre"
    ];
    return moisNames[mois - 1] || "";
  };

  // Statistiques
  const stats = useMemo(() => {
    const total = cotisations.length;
    const totalMontant = cotisations.reduce((sum, c) => sum + c.montantAttendu, 0);
    const totalPaye = cotisations.reduce((sum, c) => sum + c.montantPaye, 0);
    const totalRestant = cotisations.reduce((sum, c) => sum + c.montantRestant, 0);
    const payees = cotisations.filter(c => c.statut === "Paye").length;
    const enAttente = cotisations.filter(c => c.statut === "EnAttente").length;
    const enRetard = cotisations.filter(c => c.statut === "EnRetard").length;

    return {
      total,
      totalMontant,
      totalPaye,
      totalRestant,
      payees,
      enAttente,
      enRetard,
    };
  }, [cotisations]);

  return (
    <div className="space-y-4">
      {/* Statistiques */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
          <div className="text-xs text-gray-600 dark:text-gray-400">Total</div>
          <div className="text-lg font-bold text-gray-900 dark:text-white">{stats.total}</div>
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
          <div className="text-xs text-gray-600 dark:text-gray-400">Payées</div>
          <div className="text-lg font-bold text-green-600 dark:text-green-400">{stats.payees}</div>
        </div>
        <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg">
          <div className="text-xs text-gray-600 dark:text-gray-400">En attente</div>
          <div className="text-lg font-bold text-yellow-600 dark:text-yellow-400">{stats.enAttente}</div>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
          <div className="text-xs text-gray-600 dark:text-gray-400">En retard</div>
          <div className="text-lg font-bold text-red-600 dark:text-red-400">{stats.enRetard}</div>
        </div>
      </div>

      {/* Totaux financiers */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
          <div className="text-xs text-gray-600 dark:text-gray-400">Montant total attendu</div>
          <div className="text-lg font-bold text-gray-900 dark:text-white">
            {stats.totalMontant.toFixed(2).replace(".", ",")} €
          </div>
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
          <div className="text-xs text-gray-600 dark:text-gray-400">Montant total payé</div>
          <div className="text-lg font-bold text-green-600 dark:text-green-400">
            {stats.totalPaye.toFixed(2).replace(".", ",")} €
          </div>
        </div>
        <div className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded-lg">
          <div className="text-xs text-gray-600 dark:text-gray-400">Montant total restant</div>
          <div className="text-lg font-bold text-orange-600 dark:text-orange-400">
            {stats.totalRestant.toFixed(2).replace(".", ",")} €
          </div>
        </div>
      </div>

      {/* Liste organisée par mois */}
      <div className="space-y-4">
        {Object.entries(groupedCotisations)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([moisKey, cotisationsMois]) => {
            const [annee, mois] = moisKey.split('-');
            const moisNum = parseInt(mois);
            const anneeNum = parseInt(annee);
            const moisNom = getMonthName(moisNum);
            
            // Calculer le total pour ce mois
            const totalMois = cotisationsMois.reduce((sum, c) => sum + c.montantAttendu, 0);
            
            // Vérifier si ce mois est modifiable (mois en cours ou mois suivant)
            const now = new Date();
            const currentYear = now.getFullYear();
            const currentMonth = now.getMonth() + 1;
            const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
            const nextYear = currentMonth === 12 ? currentYear + 1 : currentYear;
            
            const isCurrentMonth = anneeNum === currentYear && moisNum === currentMonth;
            const isNextMonth = anneeNum === nextYear && moisNum === nextMonth;
            const isEditableMonth = isCurrentMonth || isNextMonth;
            
            return (
              <Card key={moisKey} className={`border-gray-200 dark:border-gray-700 ${
                isEditableMonth ? 'ring-2 ring-blue-300 dark:ring-blue-700' : ''
              }`}>
                <CardHeader className={`pb-3 ${
                  isEditableMonth
                    ? 'bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20'
                    : 'bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20'
                }`}>
                  <CardTitle className="text-base">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Calendar className="h-5 w-5 text-blue-600" />
                        <span className="font-semibold text-gray-900 dark:text-gray-100 capitalize">
                          {moisNom} {anneeNum}
                        </span>
                        {isEditableMonth && (
                          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs border border-green-300 dark:border-green-700">
                            <Edit className="h-3 w-3 mr-1" />
                            Modifiable
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Euro className="h-4 w-4 text-gray-600" />
                        <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
                          {totalMois.toFixed(2).replace(".", ",")} €
                        </span>
                      </div>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="space-y-2">
                    {cotisationsMois.map((cotisation, index) => {
                      const isForfait = cotisation.TypeCotisation.nom.toLowerCase().includes('forfait');
                      const editable = canEdit(cotisation);
                      
                      return (
                        <div
                          key={cotisation.id}
                          className={`flex items-center justify-between p-3 rounded-md border transition-all ${
                            isForfait
                              ? editable
                                ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700 shadow-sm'
                                : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                              : editable
                                ? 'bg-gray-50 dark:bg-gray-800/50 border-gray-300 dark:border-gray-600 shadow-sm'
                                : 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700'
                          } ${index < cotisationsMois.length - 1 ? 'mb-2' : ''} ${
                            editable ? 'hover:shadow-md' : ''
                          }`}
                        >
                          <div className="flex-1 flex items-center gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className={`text-sm font-medium ${
                                  isForfait
                                    ? 'text-blue-900 dark:text-blue-100'
                                    : 'text-gray-900 dark:text-gray-100'
                                }`}>
                                  {cotisation.TypeCotisation.nom}
                                </span>
                                {!isForfait && (
                                  <Badge className="bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 text-xs">
                                    Assistance
                                  </Badge>
                                )}
                                {editable && (
                                  <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs border border-green-300 dark:border-green-700">
                                    <Edit className="h-3 w-3 mr-1" />
                                    Modifiable
                                  </Badge>
                                )}
                              </div>
                              {!editable && (
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                  Modification uniquement pour le mois en cours ou le mois suivant
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              <Euro className="h-4 w-4 text-gray-500" />
                              <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 w-24 text-right">
                                {cotisation.montantAttendu.toFixed(2).replace(".", ",")} €
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              {cotisation.statut === "Paye" && (
                                <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs">
                                  <CheckCircle2 className="h-3 w-3 mr-1" />Payé
                                </Badge>
                              )}
                              {cotisation.statut === "EnAttente" && (
                                <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 text-xs">
                                  <Clock className="h-3 w-3 mr-1" />En attente
                                </Badge>
                              )}
                              {cotisation.statut === "EnRetard" && (
                                <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 text-xs">
                                  <AlertTriangle className="h-3 w-3 mr-1" />En retard
                                </Badge>
                              )}
                              {cotisation.statut === "PartiellementPaye" && (
                                <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 text-xs">
                                  Partiellement payé
                                </Badge>
                              )}
                            </div>
                            <Button
                              variant={editable ? "default" : "outline"}
                              size="sm"
                              className={`h-8 w-8 sm:h-9 sm:w-9 p-0 ${
                                editable
                                  ? 'bg-blue-600 hover:bg-blue-700 text-white border-blue-600 shadow-sm'
                                  : 'border-gray-300 dark:border-gray-600 opacity-50 cursor-not-allowed'
                              }`}
                              onClick={() => editable && onEdit(cotisation)}
                              disabled={!editable}
                              title={
                                editable 
                                  ? "Cliquez pour modifier la cotisation" 
                                  : `Modification uniquement pour le mois en cours (${new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}) ou le mois suivant`
                              }
                            >
                              <Edit className={`h-4 w-4 ${editable ? 'text-white' : 'text-gray-400'}`} />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
      </div>
    </div>
  );
}
