"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Calendar, Euro, Users, AlertTriangle, CheckCircle2, Clock, Eye, Edit, Settings, Search, Filter, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, List, Plus, MoreHorizontal } from "lucide-react";
import { toast } from "react-toastify";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar as CalendarUI } from "@/components/ui/calendar";
import { fr } from "date-fns/locale";
import { Textarea } from "@/components/ui/textarea";
import { createCotisationsMensuelles, getCotisationsMensuellesStats, getCotisationsMensuellesByPeriode } from "@/actions/cotisations-mensuelles";
import { getAllTypesCotisationMensuelle } from "@/actions/cotisations-mensuelles";
import { useRouter } from "next/navigation";
import { ViewDialog } from "@/app/admin/types-cotisation/ViewDialog";
import { CreateTypeCotisationDialog } from "./CreateTypeCotisationDialog";
import { EditTypeCotisationDialog } from "./EditTypeCotisationDialog";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

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
  categorie?: "ForfaitMensuel" | "Assistance" | "Divers";
  _count?: {
    CotisationsMensuelles: number;
  } | null;
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
  adherentBeneficiaireId?: string | null;
  TypeCotisation: {
    id: string;
    nom: string;
    description?: string | null;
    montant: number;
    obligatoire: boolean;
    aBeneficiaire?: boolean;
  };
  Adherent: {
    id: string;
    firstname: string;
    lastname: string;
    User: {
      email: string;
    };
  };
  AdherentBeneficiaire?: {
    id: string;
    firstname: string;
    lastname: string;
  } | null;
  CreatedBy: {
    name?: string | null;
    email: string;
  };
  _count: {
    Paiements: number;
  };
}

export default function AdminCotisationCreation() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [loadingCotisations, setLoadingCotisations] = useState(false);
  const [stats, setStats] = useState<CotisationStats | null>(null);
  const [typesCotisation, setTypesCotisation] = useState<TypeCotisationMensuelle[]>([]);
  const [cotisationsMois, setCotisationsMois] = useState<CotisationMensuelle[]>([]);
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
  const [formData, setFormData] = useState({
    mois: new Date().getMonth() + 1,
    annee: new Date().getFullYear(),
    typeCotisationIds: [] as string[],
  });
  const [showExistingCotisationsDialog, setShowExistingCotisationsDialog] = useState(false);
  const [showAffecterDialog, setShowAffecterDialog] = useState(false);
  const [affecterDate, setAffecterDate] = useState<Date>(() => new Date());
  const [createTypeDialogOpen, setCreateTypeDialogOpen] = useState(false);

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
        const data = typesResult.data as TypeCotisationMensuelle[];
        setTypesCotisation(data);
        // Sélectionner automatiquement les types obligatoires
        const typesObligatoires = data
          .filter((type) => type.obligatoire && type.actif)
          .map((type) => type.id);
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

  const runAffecterForPeriod = async (annee: number, mois: number) => {
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
      const result = await createCotisationsMensuelles({
        periode: `${annee}-${String(mois).padStart(2, "0")}`,
        annee,
        mois,
        typeCotisationIds: formData.typeCotisationIds,
      });
      if (result.success) {
        toast.success(result.message);
        setShowAffecterDialog(false);
        setFormData({
          mois: new Date().getMonth() + 1,
          annee: new Date().getFullYear(),
          typeCotisationIds: typesCotisation
            .filter(type => type.obligatoire && type.actif)
            .map(type => type.id),
        });
        loadData();
        loadCotisationsMois();
      } else {
        if (result.error?.includes("existent déjà") || result.error?.includes("exist déjà")) {
          setFormData(prev => ({ ...prev, annee, mois }));
          setShowAffecterDialog(false);
          setShowExistingCotisationsDialog(true);
        } else {
          toast.error(result.error);
        }
      }
    } catch {
      toast.error("Erreur lors de la création des cotisations");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (hasExistingNonValidated) {
      setShowExistingCotisationsDialog(true);
      return;
    }
    await runAffecterForPeriod(formData.annee, formData.mois);
  };

  const handleOpenAffecterDialog = () => {
    const forfaitSelected = formData.typeCotisationIds.some(id => {
      const type = typesCotisation.find(t => t.id === id);
      return type && type.nom.toLowerCase().includes('forfait');
    });
    if (!forfaitSelected) {
      toast.error("Veuillez sélectionner au moins le type 'Forfait Mensuel'.");
      return;
    }
    setAffecterDate(new Date());
    setShowAffecterDialog(true);
  };

  const handleConfirmAffecterFromDialog = () => {
    const annee = affecterDate.getFullYear();
    const mois = affecterDate.getMonth() + 1;
    runAffecterForPeriod(annee, mois);
  };

  // Cotisations existantes pour le mois sélectionné et non encore toutes validées
  const hasExistingNonValidated = useMemo(() => {
    if (cotisationsMois.length === 0) return false;
    return cotisationsMois.some((c: CotisationMensuelle) => c.statut !== "Paye");
  }, [cotisationsMois]);

  // Note: Le total réel sera calculé côté serveur (forfait + assistances du mois par adhérent)

  return (
    <div className="space-y-4">
      {/* En-tête */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Les types de cotisations
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
            Générer les obligations de cotisation pour tous les adhérents actifs
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Calendar className="h-5 w-5 text-blue-600" />
          <span className="text-xs text-gray-500">
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
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-1">
          <Card className="overflow-hidden pt-0 gap-0 py-0">
            <CardContent className="p-1.5 flex items-center justify-between gap-1 py-2">
              <div className="min-w-0">
                <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400 leading-tight">Types Actifs</p>
                <p className="text-sm font-bold text-gray-900 dark:text-white leading-tight">{stats.typesActifs}</p>
              </div>
              <Users className="h-4 w-4 shrink-0 text-blue-600" />
            </CardContent>
          </Card>
          <Card className="overflow-hidden pt-0 gap-0 py-0">
            <CardContent className="p-1.5 flex items-center justify-between gap-1 py-2">
              <div className="min-w-0">
                <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400 leading-tight">En Retard</p>
                <p className="text-sm font-bold text-red-600 leading-tight">{stats.adherentsEnRetard}</p>
              </div>
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
            </CardContent>
          </Card>
          <Card className="overflow-hidden pt-0 gap-0 py-0">
            <CardContent className="p-1.5 flex items-center justify-between gap-1 py-2">
              <div className="min-w-0">
                <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400 leading-tight">Total Dettes</p>
                <p className="text-sm font-bold text-orange-600 leading-tight">{stats.totalDettes.toFixed(2).replace('.', ',')} €</p>
              </div>
              <Euro className="h-4 w-4 shrink-0 text-orange-600" />
            </CardContent>
          </Card>
          <Card className="overflow-hidden pt-0 gap-0 py-0">
            <CardContent className="p-1.5 flex items-center justify-between gap-1 py-2">
              <div className="min-w-0">
                <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400 leading-tight">Cot. Mois</p>
                <p className="text-sm font-bold text-green-600 leading-tight">{stats.totalCotisationsMois}</p>
              </div>
              <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Liste des types de cotisation (sans Card englobante pour éviter le double Card) */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-3">
          <div className="space-y-2">
            <Label className="sr-only">Types de Cotisation à Inclure</Label>
            <TypesCotisationTable 
              types={typesCotisation}
              selectedIds={formData.typeCotisationIds}
              onSelectionChange={(ids) => setFormData(prev => ({ ...prev, typeCotisationIds: ids }))}
              sorting={sorting}
              onSortingChange={setSorting}
              onEditSuccess={loadData}
              headerActions={
                <>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setCreateTypeDialogOpen(true)}
                    className="bg-white/20 hover:bg-white/30 text-white border-white/30"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Créer un type
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={loading}
                    onClick={handleOpenAffecterDialog}
                    className="bg-white/20 hover:bg-white/30 text-white border-white/30"
                  >
                    {loading ? (
                      <>
                        <Clock className="h-4 w-4 mr-2 animate-spin" />
                        Affectation...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Affecter les cotisations
                      </>
                    )}
                  </Button>
                </>
              }
            />
          </div>
        </div>

        {/* Alerte si cotisations existantes non validées pour ce mois */}
        {hasExistingNonValidated && (
          <Alert className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <AlertDescription>
              Des cotisations existent déjà pour {moisOptions.find(m => m.value === formData.mois)?.label} {formData.annee} et ne sont pas toutes validées.
              Consultez et modifiez les cotisations depuis la page &quot;Cotisations du mois&quot;.
            </AlertDescription>
          </Alert>
        )}
      </form>

      {/* Dialog : choix du mois à affecter (calendrier) */}
      <Dialog open={showAffecterDialog} onOpenChange={setShowAffecterDialog}>
        <DialogContent className="max-w-sm sm:max-w-md border-2 border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/30">
          <DialogHeader className="pb-2">
            <DialogTitle className="text-blue-800 dark:text-blue-200">Choisir le mois à affecter</DialogTitle>
            <DialogDescription className="text-blue-700 dark:text-blue-300">
              Sélectionnez une date dans le calendrier pour choisir le mois et l&apos;année. Les cotisations mensuelles seront créées pour tous les adhérents actifs sur cette période.
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
            <Button type="button" variant="outline" onClick={() => setShowAffecterDialog(false)}>
              Annuler
            </Button>
            <Button
              type="button"
              disabled={loading}
              onClick={handleConfirmAffecterFromDialog}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {loading ? (
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

      {/* Dialog : cotisations déjà existantes pour ce mois */}
      <Dialog open={showExistingCotisationsDialog} onOpenChange={setShowExistingCotisationsDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              Cotisations déjà existantes
            </DialogTitle>
            <DialogDescription>
              Des cotisations existent déjà pour {moisOptions.find(m => m.value === formData.mois)?.label} {formData.annee} et ne sont pas toutes validées.
              Vous pouvez les consulter et les modifier depuis la page &quot;Cotisations du mois&quot;.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setShowExistingCotisationsDialog(false)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CreateTypeCotisationDialog
        open={createTypeDialogOpen}
        onOpenChange={setCreateTypeDialogOpen}
        onSuccess={loadData}
      />
    </div>
  );
}

// Visibilité par défaut : nom, categorie, montant, actif, actions (pas de colonne sélection ici)
const DEFAULT_TYPES_TABLE_VISIBILITY: VisibilityState = {
  nom: true,
  categorie: true,
  montant: true,
  actif: true,
  actions: true,
  description: false,
  obligatoire: false,
  ordre: false,
};

// Ids de colonnes valides pour TypesCotisationTable (accessor = id pour chaque colonne)
const TYPES_TABLE_COLUMN_IDS = new Set(["nom", "categorie", "montant", "actif", "description", "obligatoire", "ordre", "actions"]);

// Composant Table pour les types de cotisation (même style que /admin/types-cotisation, actions en menu)
function TypesCotisationTable({
  types,
  selectedIds,
  onSelectionChange,
  sorting,
  onSortingChange,
  onEditSuccess,
  headerActions,
}: {
  types: TypeCotisationMensuelle[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  sorting: SortingState;
  onSortingChange: (sorting: SortingState) => void;
  onEditSuccess?: () => void;
  headerActions?: React.ReactNode;
}) {
  const router = useRouter();
  const [viewOpenTypeId, setViewOpenTypeId] = useState<string | null>(null);
  const [editOpenTypeId, setEditOpenTypeId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("admin-cotisations-types-table-column-visibility");
        if (saved) {
          const parsed = JSON.parse(saved) as Record<string, boolean>;
          const filtered: VisibilityState = {};
          for (const id of TYPES_TABLE_COLUMN_IDS) {
            if (id in parsed) filtered[id] = parsed[id];
          }
          return { ...DEFAULT_TYPES_TABLE_VISIBILITY, ...filtered };
        }
      } catch (e) {
        console.error("Erreur chargement visibilité colonnes:", e);
      }
    }
    return DEFAULT_TYPES_TABLE_VISIBILITY;
  });

  const data = useMemo(() => [...types], [types]);

  const filteredData = useMemo(() => {
    return data.filter((item) => {
      if (searchTerm.trim()) {
        const q = searchTerm.trim().toLowerCase();
        const searchText = [
          item.nom || "",
          item.description || "",
          (item.categorie || "").toLowerCase(),
          item.montant.toString(),
        ].join(" ").toLowerCase();
        if (!searchText.includes(q)) return false;
      }
      if (statusFilter !== "all") {
        if (statusFilter === "actif" && !item.actif) return false;
        if (statusFilter === "inactif" && item.actif) return false;
      }
      return true;
    });
  }, [data, searchTerm, statusFilter]);

  const typeForView = useMemo(() => {
    if (!viewOpenTypeId) return null;
    const type = types.find(t => t.id === viewOpenTypeId);
    if (!type) return null;
    return {
      ...type,
      createdBy: type.CreatedBy?.email || "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      CreatedBy: type.CreatedBy || { id: "", email: "" },
      _count: type._count || { CotisationsMensuelles: 0 },
    };
  }, [viewOpenTypeId, types]);

  const typeForEdit = useMemo(() => {
    if (!editOpenTypeId) return null;
    const type = types.find(t => t.id === editOpenTypeId);
    if (!type) return null;
    return {
      id: type.id,
      nom: type.nom,
      description: type.description ?? "",
      montant: type.montant,
      obligatoire: type.obligatoire,
      actif: type.actif,
      ordre: type.ordre,
      categorie: type.categorie ?? "Divers",
      aBeneficiaire: false,
    };
  }, [editOpenTypeId, types]);

  const columns = useMemo(() => [
    columnHelper.accessor("nom", {
      header: "Nom",
      cell: ({ row }) => (
        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
          {row.getValue("nom")}
        </span>
      ),
      size: 150,
      minSize: 120,
      maxSize: 200,
      enableResizing: true,
    }),
    columnHelper.accessor("categorie", {
      header: "Catégorie",
      cell: ({ row }) => {
        const cat = (row.getValue("categorie") as "ForfaitMensuel" | "Assistance" | "Divers") || "Divers";
        const labels: Record<string, string> = {
          ForfaitMensuel: "Forfait mensuel",
          Assistance: "Assistance",
          Divers: "Divers",
        };
        const colors: Record<string, string> = {
          ForfaitMensuel: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
          Assistance: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
          Divers: "bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-200",
        };
        return (
          <Badge className={colors[cat] || colors.Divers}>
            {labels[cat] || cat}
          </Badge>
        );
      },
      size: 130,
      minSize: 100,
      maxSize: 180,
      enableResizing: true,
    }),
    columnHelper.accessor("montant", {
      header: "Montant",
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Euro className="h-4 w-4 text-gray-500" />
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {(row.getValue("montant") as number).toFixed(2).replace(".", ",")} €
          </span>
        </div>
      ),
      size: 120,
      minSize: 100,
      maxSize: 150,
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
      size: 90,
      minSize: 80,
      maxSize: 120,
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
    columnHelper.accessor("obligatoire", {
      header: "Obligatoire",
      cell: ({ row }) => (
        <Badge
          className={
            row.getValue("obligatoire")
              ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 text-xs"
              : "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200 text-xs"
          }
        >
          {row.getValue("obligatoire") ? "Oui" : "Non"}
        </Badge>
      ),
      size: 100,
      minSize: 80,
      maxSize: 120,
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
        const typeForViewRow = {
          ...type,
          createdBy: type.CreatedBy?.email || "",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          CreatedBy: type.CreatedBy || { id: "", email: "" },
          _count: type._count || { CotisationsMensuelles: 0 },
        };
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 hover:bg-slate-100 dark:hover:bg-slate-800"
                title="Actions"
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
                onClick={() => setViewOpenTypeId(type.id)}
              >
                <Eye className="h-4 w-4" />
                Voir
              </DropdownMenuItem>
              <DropdownMenuItem
                className="flex items-center gap-2 cursor-pointer"
                onClick={() => setEditOpenTypeId(type.id)}
              >
                <Edit className="h-4 w-4" />
                Éditer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
      size: 80,
      minSize: 70,
      maxSize: 100,
    }),
  ], [types, router]);

  const table = useReactTable({
    data: filteredData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: (updaterOrValue) => {
      const next = typeof updaterOrValue === "function" ? updaterOrValue(sorting) : updaterOrValue;
      onSortingChange(next);
    },
    onColumnVisibilityChange: (updater) => {
      const next = typeof updater === "function" ? updater(columnVisibility) : updater;
      const sanitized: VisibilityState = {};
      for (const id of TYPES_TABLE_COLUMN_IDS) {
        if (id in next) sanitized[id] = next[id];
      }
      setColumnVisibility(sanitized);
      try {
        localStorage.setItem("admin-cotisations-types-table-column-visibility", JSON.stringify(sanitized));
      } catch (e) {
        console.error("Erreur sauvegarde visibilité colonnes:", e);
      }
    },
    initialState: {
      pagination: { pageSize: 10 },
    },
    state: { sorting, columnVisibility },
    defaultColumn: {
      minSize: 50,
      maxSize: 800,
    },
  });

  return (
    <>
    <Card className="shadow-lg border-blue-200 dark:border-blue-800 pt-0 gap-0">
      <CardHeader className="bg-gradient-to-r from-blue-500/90 to-blue-600/90 dark:from-blue-600/90 dark:to-blue-700/90 text-white rounded-t-lg pb-1.5 sm:pb-2 pt-0 px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-2">
          <div>
            <CardTitle className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2 sm:gap-3">
              <Settings className="h-5 w-5 sm:h-6 sm:w-6" />
              Types de cotisation
            </CardTitle>
            <CardDescription className="text-blue-100 dark:text-blue-200 mt-0.5 sm:mt-1 text-sm sm:text-base">
              Types de cotisations et assistances
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end sm:justify-end">
            {headerActions}
            <ColumnVisibilityToggle
              table={table}
              storageKey="admin-cotisations-types-table-column-visibility"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-1.5 sm:pt-2 pb-4 px-4 sm:px-6">
        {/* Filtres et recherche (même style que types-cotisation) */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-4 sm:mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Rechercher par nom, description, catégorie, montant..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
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

        <div className="mb-4 text-sm text-gray-600 dark:text-gray-300">
          {filteredData.length} type(s) trouvé(s)
        </div>
        <div className="border rounded-lg overflow-hidden bg-white dark:bg-gray-900 border-slate-200 dark:border-slate-700">
          <DataTable table={table} emptyMessage="Aucun type de cotisation disponible" compact={true} />
        </div>

        {/* Pagination compacte */}
        <div className="hidden md:flex bg-white dark:bg-gray-800 mt-3 items-center justify-between gap-3 py-2.5 px-4 font-semibold rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex-1 text-xs text-muted-foreground dark:text-gray-400 min-w-0">
            {table.getFilteredRowModel().rows.length} ligne(s) au total
          </div>
          <div className="flex items-center gap-3 lg:gap-4 shrink-0">
            <div className="flex items-center gap-1.5">
              <p className="text-xs font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">Lignes</p>
              <Select
                value={`${table.getState().pagination.pageSize}`}
                onValueChange={(value) => table.setPageSize(Number(value))}
              >
                <SelectTrigger className="h-7 w-[60px]">
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
            <div className="text-xs font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
              Page {table.getState().pagination.pageIndex + 1} sur {table.getPageCount() || 1}
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="hidden h-7 w-7 lg:flex"
                onClick={() => table.setPageIndex(0)}
                disabled={!table.getCanPreviousPage()}
              >
                <span className="sr-only">Aller à la première page</span>
                <ChevronsLeft className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                <span className="sr-only">Page précédente</span>
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                <span className="sr-only">Page suivante</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="hidden h-7 w-7 lg:flex"
                onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                disabled={!table.getCanNextPage()}
              >
                <span className="sr-only">Aller à la dernière page</span>
                <ChevronsRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
      {typeForView && (
        <ViewDialog
          type={typeForView as any}
          open={!!viewOpenTypeId}
          onOpenChange={(open) => !open && setViewOpenTypeId(null)}
          triggerButton={<span className="hidden" />}
        />
      )}
      {typeForEdit && (
        <EditTypeCotisationDialog
          type={typeForEdit}
          open={!!editOpenTypeId}
          onOpenChange={(open) => !open && setEditOpenTypeId(null)}
          onSuccess={() => {
            setEditOpenTypeId(null);
            onEditSuccess?.();
          }}
        />
      )}
    </>
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
        const aNom = a.TypeCotisation?.nom || "";
        const bNom = b.TypeCotisation?.nom || "";
        const aIsForfait = aNom.toLowerCase().includes('forfait');
        const bIsForfait = bNom.toLowerCase().includes('forfait');
        
        if (aIsForfait && !bIsForfait) return -1;
        if (!aIsForfait && bIsForfait) return 1;
        return aNom.localeCompare(bNom);
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
              <Card key={moisKey} className={`border-gray-200 dark:border-gray-700 pt-0 gap-0 ${
                isEditableMonth ? 'ring-2 ring-blue-300 dark:ring-blue-700' : ''
              }`}>
                <CardHeader className={`pb-1.5 pt-2 ${
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
                <CardContent className="pt-1.5 px-4 pb-4">
                  <div className="space-y-2">
                    {cotisationsMois.map((cotisation, index) => {
                      const nomType = cotisation.TypeCotisation?.nom || "Type inconnu";
                      const isForfait = nomType.toLowerCase().includes('forfait');
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
                                  {nomType}
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
