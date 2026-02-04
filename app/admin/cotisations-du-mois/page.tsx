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
import { Calendar as CalendarUI } from "@/components/ui/calendar";
import { fr } from "date-fns/locale";
import { Textarea } from "@/components/ui/textarea";
import { 
  Calendar, 
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
  User,
  HandHeart,
  MoreHorizontal
} from "lucide-react";
import { AdherentSearchDialog } from "@/components/admin/AdherentSearchDialog";
import { toast } from "react-toastify";
import Link from "next/link";
import { 
  getAllCotisationsDuMois,
  createCotisationDuMois,
  updateCotisationDuMois,
  deleteCotisationDuMois,
  getAdherentsMembres,
} from "@/actions/cotisations-du-mois";
import { getAllTypesCotisationMensuelle, createCotisationsMensuelles } from "@/actions/cotisations-mensuelles";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
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
  adherentBeneficiaireId?: string | null;
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
  AdherentBeneficiaire?: {
    id: string;
    civility?: string | null;
    firstname: string;
    lastname: string;
  } | null;
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
  const [showAffecterDialog, setShowAffecterDialog] = useState(false);
  const [affecterDate, setAffecterDate] = useState<Date>(() => new Date());
  const [loadingAffecter, setLoadingAffecter] = useState(false);
  const [adherentsMembres, setAdherentsMembres] = useState<Array<{ id: string; firstname: string; lastname: string; email: string }>>([]);
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
        // Sur mobile : n'afficher que 2 colonnes (Période + Actions)
        const isMobile = window.innerWidth < 768;
        if (isMobile) {
          return {
            "TypeCotisation.nom": false,
            beneficiaire: false,
            montantBase: false,
            dateEcheance: false,
            statut: false,
            "_count.CotisationsMensuelles": false,
          };
        }
      } catch (error) {
        console.error("Erreur lors du chargement des préférences:", error);
      }
    }
    return {};
  });

  const [isMobile, setIsMobile] = useState(false);

  // Détecter mobile : 2 colonnes (Période, Actions) et pas de pagination
  useEffect(() => {
    const handleResize = () => {
      const mobile = typeof window !== "undefined" && window.innerWidth < 768;
      setIsMobile(mobile);
      const saved = localStorage.getItem("admin-cotisations-du-mois-column-visibility");
      if (mobile && (!saved || Object.keys(JSON.parse(saved || "{}")).length === 0)) {
        setColumnVisibility({
          "TypeCotisation.nom": false,
          beneficiaire: false,
          montantBase: false,
          dateEcheance: false,
          statut: false,
          "_count.CotisationsMensuelles": false,
        });
      }
    };
    handleResize();
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

  // Charger la liste des adhérents MEMBRE pour le bénéficiaire (assistance) à l'ouverture du dialog
  const loadAdherentsMembres = useCallback(async () => {
    try {
      const res = await getAdherentsMembres();
      if (res.success && res.adherents) {
        setAdherentsMembres(res.adherents);
      } else {
        setAdherentsMembres([]);
      }
    } catch (err) {
      console.error("Chargement adhérents MEMBRE:", err);
      setAdherentsMembres([]);
    }
  }, []);

  useEffect(() => {
    if (showForm) {
      loadAdherentsMembres();
    }
  }, [showForm, loadAdherentsMembres]);

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
      header: "Type",
      cell: ({ row }) => (
        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
          {row.original.TypeCotisation?.nom || "Type inconnu"}
        </span>
      ),
      size: 160,
      minSize: 120,
      maxSize: 240,
      enableResizing: true,
    }),
    columnHelper.display({
      id: "beneficiaire",
      header: "Bénéficiaire",
      cell: ({ row }) => {
        const benef = row.original.AdherentBeneficiaire;
        if (!benef) return <span className="text-xs text-gray-400">—</span>;
        const civilite = benef.civility ? String(benef.civility) : "";
        const nom = [civilite, benef.firstname, benef.lastname].filter(Boolean).join(" ");
        return (
          <span className="text-xs text-gray-900 dark:text-gray-100" title={nom}>
            {nom || "—"}
          </span>
        );
      },
      size: 180,
      minSize: 120,
      maxSize: 260,
      enableResizing: true,
    }),
    columnHelper.accessor("montantBase", {
      header: "Montant",
      cell: ({ row }) => (
        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {row.original.montantBase.toFixed(2).replace(".", ",")} €
        </span>
      ),
      size: 150,
      minSize: 120,
      maxSize: 180,
      enableResizing: true,
    }),
    columnHelper.accessor("dateEcheance", {
      header: "Échéance",
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
      header: "Nombre",
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 data-[state=open]:bg-muted"
                aria-haspopup="true"
                aria-label="Menu actions"
              >
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="flex items-center gap-2 cursor-pointer"
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
                  setShowForm(true);
                }}
              >
                <Edit className="h-4 w-4" />
                Modifier
              </DropdownMenuItem>
              <DropdownMenuItem
                className="flex items-center gap-2 cursor-pointer text-red-600 focus:text-red-600"
                onClick={() => handleDelete(item.id)}
                disabled={item._count.CotisationsMensuelles > 0}
                title={
                  item._count.CotisationsMensuelles > 0
                    ? "Impossible de supprimer : des cotisations mensuelles ont été créées"
                    : undefined
                }
              >
                <Trash2 className="h-4 w-4" />
                Supprimer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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

  // Sur mobile : afficher toutes les lignes (pas de pagination)
  useEffect(() => {
    table.setPageSize(isMobile ? 999 : 10);
  }, [isMobile, table]);

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

  const handleOpenAffecterDialog = () => {
    setAffecterDate(new Date());
    setShowAffecterDialog(true);
  };

  const handleAffecterCotisations = async () => {
    const affecterAnnee = affecterDate.getFullYear();
    const affecterMois = affecterDate.getMonth() + 1;
    const periode = `${affecterAnnee}-${String(affecterMois).padStart(2, "0")}`;
    const moisLabel = moisOptions.find((m) => m.value === affecterMois)?.label ?? affecterMois;
    // Vérifier qu'il existe au moins une ligne "cotisation du mois" pour cette période (créée via "Nouvelle cotisation")
    const cotisationsForPeriod = cotisations.filter((c) => c.periode === periode);
    const hasCotisationsDuMoisForPeriod = cotisationsForPeriod.length > 0;
    if (!hasCotisationsDuMoisForPeriod) {
      toast.warning(
        `Aucune ligne de cotisation du mois pour ${moisLabel} ${affecterAnnee}. Créez d'abord au moins une cotisation du mois (bouton "Nouvelle cotisation", ex. forfait) pour cette période, puis réessayez.`
      );
      return;
    }
    // Vérifier si la période est déjà affectée (cotisations mensuelles déjà créées)
    const alreadyAffected = cotisationsForPeriod.some((c) => (c._count?.CotisationsMensuelles ?? 0) > 0);
    if (alreadyAffected) {
      toast.info(
        `${moisLabel} ${affecterAnnee} est déjà affecté. Les cotisations mensuelles existent déjà pour cette période. Consultez Admin > Cotisations pour les modifier.`
      );
      return;
    }
    const typeCotisationIds = typesCotisation.filter((t) => t.obligatoire && t.actif).map((t) => t.id);
    if (typeCotisationIds.length === 0) {
      toast.error("Aucun type de cotisation obligatoire actif. Configurez les types sur /admin/cotisations.");
      return;
    }
    const forfaitSelected = typesCotisation.some(
      (t) => typeCotisationIds.includes(t.id) && t.nom.toLowerCase().includes("forfait")
    );
    if (!forfaitSelected) {
      toast.error("Veuillez avoir au moins le type 'Forfait Mensuel' actif et obligatoire.");
      return;
    }
    setLoadingAffecter(true);
    try {
      const result = await createCotisationsMensuelles({
        periode,
        annee: affecterAnnee,
        mois: affecterMois,
        typeCotisationIds,
      });
      if (result.success) {
        toast.success(
          result.message + " Consultez la page Admin > Cotisations pour voir les cotisations par adhérent."
        );
        setShowAffecterDialog(false);
        loadData();
      } else {
        const msg = result.error ?? "";
        if (msg.includes("Aucune cotisation du mois trouvée") || msg.includes("Veuillez d'abord créer les cotisations du mois")) {
          toast.warning(
            `Aucune ligne de cotisation du mois pour cette période. Créez d'abord au moins une "Nouvelle cotisation" (ex. forfait) pour ${moisLabel} ${affecterAnnee}.`
          );
        } else if (msg.includes("existent déjà") || msg.includes("exist déjà")) {
          toast.info(
            `${moisLabel} ${affecterAnnee} est déjà affecté. Les cotisations mensuelles existent déjà pour cette période.`
          );
        } else {
          toast.error(msg || "Erreur lors de l'affectation");
        }
      }
    } catch {
      toast.error("Erreur lors de l'affectation des cotisations");
    } finally {
      setLoadingAffecter(false);
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
      <Card className="mx-auto max-w-[96rem] w-full shadow-lg border-blue-200 !pt-0 min-h-[85vh]">
        <CardHeader className="!py-0 !pt-0 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-t-lg">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 py-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calendar className="h-4 w-4" />
              Gestion des Cotisations du Mois ({cotisations.length})
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                asChild
                variant="outline"
                className="bg-white text-blue-600 hover:bg-blue-50 border-white shadow-sm font-medium"
              >
                <Link href="/admin/finances/assistances?open=create">
                  <HandHeart className="h-4 w-4 mr-2" />
                  Nouvelle assistance
                </Link>
              </Button>
              <Button
                onClick={handleOpenAffecterDialog}
                disabled={loadingAffecter}
                className="bg-white text-blue-600 hover:bg-blue-50 border-white shadow-sm font-medium"
                title="Choisir la période puis créer les cotisations mensuelles pour tous les adhérents actifs"
              >
                {loadingAffecter ? (
                  <Clock className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                )}
                Affecter les Cotisations
              </Button>
              <Button
                onClick={() => {
                  setEditingCotisation(null);
                  const now = new Date();
                  const annee = now.getFullYear();
                  const mois = now.getMonth() + 1;
                  // Forfait mensuel ajouté par défaut : premier type forfait (obligatoire, sans bénéficiaire)
                  const typeForfait = typesCotisation.find(
                    (t) => !t.aBeneficiaire && (t.obligatoire || t.nom.toLowerCase().includes("forfait"))
                  ) ?? typesCotisation[0];
                  const dateEcheance = `${annee}-${String(mois).padStart(2, "0")}-15`;
                  setFormData({
                    annee,
                    mois,
                    typeCotisationId: typeForfait?.id ?? "",
                    montantBase: typeForfait ? Number(typeForfait.montant) : 0,
                    dateEcheance,
                    description: "",
                    adherentBeneficiaireId: "",
                  });
                  setSelectedAdherent(null);
                  setShowForm(true);
                }}
                className="bg-white text-blue-600 hover:bg-blue-50 border-white shadow-sm font-medium"
              >
                <Plus className="h-4 w-4 mr-2" />
                Nouvelle cotisation
              </Button>
            </div>
          </div>
          <CardDescription className="text-blue-100 text-xs pb-3">
            Créez et gérez les cotisations par mois et année. Recherchez et triez par année ou mois.
          </CardDescription>
        </CardHeader>
        <CardContent className="!py-0 p-3 sm:p-4">
          {/* Filtres et recherche */}
          <div className="flex flex-col sm:flex-row gap-2 mb-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Rechercher par période, type, description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-28"
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
                <SelectItem key="annee-all" value="all">Toutes les années</SelectItem>
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
                <SelectItem key="mois-all" value="all">Tous les mois</SelectItem>
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

          <div className="mb-1.5 text-xs text-gray-600 dark:text-gray-300">
            {filteredData.length} cotisation(s) trouvée(s) sur {cotisations.length}
          </div>

          <DataTable table={table} emptyMessage="Aucune cotisation du mois trouvée" compact={true} />
          
          {/* Pagination - Masquée sur mobile */}
          <div className="hidden md:flex bg-white dark:bg-gray-800 mt-3 items-center justify-between py-3 px-3 font-semibold rounded-xl shadow-xl border border-gray-200 dark:border-gray-700">
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0 border-border bg-card shadow-xl [&_[data-slot=dialog-close]]:text-white [&_[data-slot=dialog-close]]:hover:text-blue-100 [&_[data-slot=dialog-close]]:hover:bg-white/10">
          <DialogHeader className="shrink-0 bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-700 dark:to-indigo-700 text-white px-6 py-4 rounded-t-lg shadow-sm">
            <DialogTitle className="text-lg font-semibold text-white">
              {editingCotisation ? "Modifier la cotisation du mois" : "Nouvelle cotisation du mois"}
            </DialogTitle>
            <DialogDescription className="text-sm text-blue-100 dark:text-blue-200">
              {editingCotisation 
                ? "Modifiez les informations de la cotisation du mois"
                : "Créez une nouvelle cotisation pour un mois et une année donnés"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-y-auto">
            <div className="p-6 space-y-4 flex-1">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="annee" className="text-sm font-medium text-foreground">Année *</Label>
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
              <div className="space-y-1.5">
                <Label htmlFor="mois" className="text-sm font-medium text-foreground">Mois *</Label>
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

            <div className="space-y-1.5">
              <Label htmlFor="typeCotisationId" className="text-sm font-medium text-foreground">Type de cotisation *</Label>
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

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="montantBase" className="text-sm font-medium text-foreground">Montant de base (€) *</Label>
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
              <div className="space-y-1.5">
                <Label htmlFor="dateEcheance" className="text-sm font-medium text-foreground">Échéance *</Label>
                <Input
                  id="dateEcheance"
                  type="date"
                  value={formData.dateEcheance}
                  onChange={(e) => setFormData({ ...formData, dateEcheance: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description" className="text-sm font-medium text-foreground">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                placeholder="Description optionnelle..."
              />
            </div>

            {/* Champ pour l'adhérent bénéficiaire (pour les types assistance : choix depuis la liste des adhérents MEMBRE) */}
            {formData.typeCotisationId && (() => {
              const selectedType = typesCotisation.find(t => t.id === formData.typeCotisationId);
              const aBeneficiaire = selectedType?.aBeneficiaire || false;
              
              if (aBeneficiaire) {
                return (
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-foreground">Adhérent bénéficiaire *</Label>
                    <div className="flex gap-2 flex-wrap">
                      <Select
                        value={formData.adherentBeneficiaireId}
                        onValueChange={(value) => {
                          const adherent = adherentsMembres.find((a) => a.id === value);
                          setFormData({ ...formData, adherentBeneficiaireId: value });
                          setSelectedAdherent(adherent ?? null);
                        }}
                        required={aBeneficiaire}
                      >
                        <SelectTrigger className="flex-1 min-w-[200px]">
                          <SelectValue placeholder="Choisir un adhérent dans la liste..." />
                        </SelectTrigger>
                        <SelectContent>
                          {adherentsMembres.map((a) => (
                            <SelectItem key={a.id} value={a.id}>
                              {a.firstname} {a.lastname} {a.email ? `(${a.email})` : ""}
                            </SelectItem>
                          ))}
                          {adherentsMembres.length === 0 && (
                            <SelectItem value="_none" disabled>
                              Aucun adhérent MEMBRE actif
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setAdherentSearchOpen(true)}
                        title="Rechercher un adhérent"
                      >
                        <User className="h-4 w-4 mr-2" />
                        Rechercher
                      </Button>
                      {formData.adherentBeneficiaireId && (
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
                    <p className="text-xs text-muted-foreground">
                      Les cotisations ne concernent que les adhérents MEMBRE. L&apos;adhérent bénéficiaire ne paiera pas cette cotisation d&apos;assistance.
                    </p>
                  </div>
                );
              }
              return null;
            })()}
            </div>

            <DialogFooter className="shrink-0 flex flex-row justify-end gap-2 border-t border-border bg-muted/30 px-6 py-4 pb-6 sm:pb-6">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowForm(false);
                  setEditingCotisation(null);
                }}
                className="min-w-[5rem]"
              >
                Annuler
              </Button>
              <Button type="submit" size="sm" disabled={loading} className="min-w-[5rem]">
                {loading ? "Enregistrement..." : editingCotisation ? "Modifier" : "Créer"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog choix période pour affectation (même style que /admin/cotisations) */}
      <Dialog open={showAffecterDialog} onOpenChange={setShowAffecterDialog}>
        <DialogContent className="max-w-sm sm:max-w-md border-2 border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/30">
          <DialogHeader className="pb-2">
            <DialogTitle className="text-blue-800 dark:text-blue-200">Choisir le mois à affecter</DialogTitle>
            <DialogDescription className="text-blue-700 dark:text-blue-300">
              Sélectionnez une date dans le calendrier pour choisir le mois et l&apos;année. Les cotisations du mois doivent déjà exister pour cette période.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center py-2 rounded-lg bg-white/80 dark:bg-gray-900/80 p-2">
            <CalendarUI
              mode="single"
              selected={affecterDate}
              onSelect={(date) => date && setAffecterDate(date)}
              defaultMonth={affecterDate}
              locale={fr}
              className="rounded-md border border-blue-200 dark:border-blue-800"
            />
          </div>
          <p className="text-sm text-blue-800 dark:text-blue-200 text-center font-medium">
            Période sélectionnée : <strong>{moisOptions.find((m) => m.value === affecterDate.getMonth() + 1)?.label} {affecterDate.getFullYear()}</strong>
          </p>
          <DialogFooter className="gap-4 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowAffecterDialog(false)}
            >
              Annuler
            </Button>
            <Button
              type="button"
              disabled={loadingAffecter}
              onClick={handleAffecterCotisations}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {loadingAffecter ? (
                <>
                  <Clock className="h-4 w-4 mr-2 animate-spin" />
                  Affectation...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Affecter pour {moisOptions.find((m) => m.value === affecterDate.getMonth() + 1)?.label} {affecterDate.getFullYear()}
                </>
              )}
            </Button>
          </DialogFooter>
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

      {/* Informations importantes */}
      <Card className="mx-auto max-w-[96rem] w-full border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20 mt-6">
        <CardContent className="p-6">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <h3 className="font-medium text-amber-800 dark:text-amber-200">
                Informations Importantes
              </h3>
              <ul className="mt-2 text-sm text-amber-700 dark:text-amber-300 space-y-1">
                <li>• Les cotisations seront créées pour tous les adhérents actifs</li>
                <li>• La date d&apos;échéance sera fixée au 15 du mois sélectionné</li>
                <li>• Les adhérents recevront une notification de leur obligation</li>
                <li>• Un système de relance automatique sera activé pour les retards</li>
                <li>• <strong>Les cotisations du mois en cours ou du mois suivant peuvent être modifiées</strong> après création (montant, date d&apos;échéance, statut, description)</li>
                <li>• Utilisez le bouton d&apos;édition (icône crayon) sur les cotisations modifiables pour les modifier</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

