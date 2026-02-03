"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams } from "next/navigation";
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
  ChevronsRight,
  ArrowLeft,
  Eye,
  Pencil,
  Trash2,
  MoreHorizontal,
  CalendarPlus,
  Banknote,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { 
  getAllAssistances, 
  createAssistance,
  updateAssistance,
  deleteAssistance,
  getTypesCotisationAssistance,
  affecterAssistanceToCotisationDuMois,
  getVersementAssistanceBreakdown,
  verserAssistanceToAdherent,
  envoyerEmailVersementAssistance,
} from "@/actions/paiements";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  const searchParams = useSearchParams();
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
            type: false,
            dateEvenement: false,
            montantPaye: false,
            montantRestant: false,
            description: false,
            createdAt: false,
            // Garder visible : Adherent, montant, actions (si présente)
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
      const saved = localStorage.getItem("admin-assistances-column-visibility");
      
      if (isMobile && (!saved || Object.keys(JSON.parse(saved || "{}")).length === 0)) {
        setColumnVisibility({
          type: false,
          dateEvenement: false,
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
  const [selectedAdherent, setSelectedAdherent] = useState<{
    id: string;
    firstname: string;
    lastname: string;
    email: string;
  } | null>(null);
  const [typesCotisationAssistance, setTypesCotisationAssistance] = useState<Array<{ id: string; nom: string; montant: number }>>([]);
  const [formData, setFormData] = useState({
    adherentId: "",
    typeCotisationId: "",
    dateEvenement: new Date().toISOString().split('T')[0],
    montant: "50",
    description: "",
  });

  const [viewAssistance, setViewAssistance] = useState<any | null>(null);
  const [editAssistance, setEditAssistance] = useState<any | null>(null);
  const [editFormData, setEditFormData] = useState({
    adherentId: "",
    type: "Naissance" as "Naissance" | "MariageEnfant" | "DecesFamille" | "AnniversaireSalle" | "Autre",
    dateEvenement: "",
    montant: 50,
    description: "",
  });
  const [affecterAssistanceRow, setAffecterAssistanceRow] = useState<any | null>(null);
  const [affecterMois, setAffecterMois] = useState(new Date().getMonth() + 1);
  const [affecterAnnee, setAffecterAnnee] = useState(new Date().getFullYear());
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [loadingDelete, setLoadingDelete] = useState(false);
  const [loadingAffecter, setLoadingAffecter] = useState(false);
  const [editAdherentSearchOpen, setEditAdherentSearchOpen] = useState(false);
  const [editSelectedAdherent, setEditSelectedAdherent] = useState<{ id: string; firstname: string; lastname: string; email?: string } | null>(null);
  const [versementAssistance, setVersementAssistance] = useState<any | null>(null);
  const [versementBreakdown, setVersementBreakdown] = useState<{
    montantFixe: number;
    totalDettes: number;
    totalCotisationsNonPayees: number;
    aDeduire: number;
    montantAVerser: number;
    adherentName: string;
    typeAssistance: string;
  } | null>(null);
  const [loadingVersement, setLoadingVersement] = useState(false);
  const [submittingVersement, setSubmittingVersement] = useState(false);
  const [sendingEmailVersement, setSendingEmailVersement] = useState(false);

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

  const loadTypesCotisationAssistance = useCallback(async () => {
    const res = await getTypesCotisationAssistance();
    if (res.success && res.data) setTypesCotisationAssistance(res.data);
  }, []);

  useEffect(() => {
    if (createDialogOpen) loadTypesCotisationAssistance();
  }, [createDialogOpen, loadTypesCotisationAssistance]);

  // Ouvrir le dialog "Nouvelle assistance" si on arrive depuis cotisations-du-mois (?open=create)
  useEffect(() => {
    if (searchParams.get("open") === "create") {
      setCreateDialogOpen(true);
    }
  }, [searchParams]);

  // Charger le détail du versement quand on ouvre le dialog "Verser à l'adhérent"
  useEffect(() => {
    if (!versementAssistance?.id) {
      setVersementBreakdown(null);
      return;
    }
    let cancelled = false;
    setLoadingVersement(true);
    setVersementBreakdown(null);
    getVersementAssistanceBreakdown(versementAssistance.id).then((res) => {
      if (cancelled) return;
      setLoadingVersement(false);
      if (res.success && res.data) setVersementBreakdown(res.data);
      else toast.error(res.error || "Erreur lors du calcul du versement");
    });
    return () => {
      cancelled = true;
    };
  }, [versementAssistance?.id]);

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

  const nomToTypeEvenementFamilial = (nom: string): "Naissance" | "MariageEnfant" | "DecesFamille" | "AnniversaireSalle" | "Autre" => {
    const n = (nom || "").toLowerCase();
    if (n.includes("naissance")) return "Naissance";
    if (n.includes("mariage")) return "MariageEnfant";
    if (n.includes("décès") || n.includes("deces")) return "DecesFamille";
    if (n.includes("anniversaire")) return "AnniversaireSalle";
    return "Autre";
  };

  const handleCreate = async () => {
    if (!formData.adherentId || !formData.dateEvenement) {
      toast.error("Veuillez remplir tous les champs obligatoires");
      return;
    }
    if (!formData.typeCotisationId) {
      toast.error("Veuillez sélectionner un type d'assistance");
      return;
    }

    const typeAssistance = typesCotisationAssistance.find((t) => t.id === formData.typeCotisationId);
    const type = typeAssistance ? nomToTypeEvenementFamilial(typeAssistance.nom) : "Autre";

    try {
      const result = await createAssistance({
        adherentId: formData.adherentId,
        type,
        typeCotisationId: formData.typeCotisationId,
        dateEvenement: formData.dateEvenement,
        montant: parseFloat(formData.montant) || 50,
        description: formData.description || undefined,
      });

      if (result.success) {
        toast.success(result.message);
        setCreateDialogOpen(false);
        setFormData({
          adherentId: "",
          typeCotisationId: "",
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

  const handleUpdate = async () => {
    if (!editAssistance?.id || !editFormData.adherentId || !editFormData.dateEvenement) {
      toast.error("Veuillez remplir tous les champs obligatoires");
      return;
    }
    setLoadingEdit(true);
    try {
      const result = await updateAssistance({
        id: editAssistance.id,
        adherentId: editFormData.adherentId,
        type: editFormData.type,
        dateEvenement: editFormData.dateEvenement,
        montant: editFormData.montant,
        description: editFormData.description || undefined,
      });
      if (result.success) {
        toast.success(result.message);
        setEditAssistance(null);
        loadData();
      } else {
        toast.error(result.error || "Erreur lors de la mise à jour");
      }
    } catch (error) {
      toast.error("Erreur lors de la mise à jour");
    } finally {
      setLoadingEdit(false);
    }
  };

  const handleDelete = async (row: any) => {
    if (!confirm("Supprimer cette assistance ?")) return;
    setLoadingDelete(true);
    try {
      const result = await deleteAssistance(row.id);
      if (result.success) {
        toast.success(result.message);
        loadData();
      } else {
        toast.error(result.error || "Erreur lors de la suppression");
      }
    } catch (error) {
      toast.error("Erreur lors de la suppression");
    } finally {
      setLoadingDelete(false);
    }
  };

  const handleAffecter = async () => {
    if (!affecterAssistanceRow?.id) return;
    setLoadingAffecter(true);
    try {
      const result = await affecterAssistanceToCotisationDuMois({
        assistanceId: affecterAssistanceRow.id,
        annee: affecterAnnee,
        mois: affecterMois,
      });
      if (result.success) {
        toast.success(result.message);
        setAffecterAssistanceRow(null);
        setAffecterMois(new Date().getMonth() + 1);
        setAffecterAnnee(new Date().getFullYear());
        loadData();
      } else {
        toast.error(result.error || "Erreur lors de l'affectation");
      }
    } catch (error) {
      toast.error("Erreur lors de l'affectation");
    } finally {
      setLoadingAffecter(false);
    }
  };

  const moisOptions = [
    { value: 1, label: "Janvier" }, { value: 2, label: "Février" }, { value: 3, label: "Mars" },
    { value: 4, label: "Avril" }, { value: 5, label: "Mai" }, { value: 6, label: "Juin" },
    { value: 7, label: "Juillet" }, { value: 8, label: "Août" }, { value: 9, label: "Septembre" },
    { value: 10, label: "Octobre" }, { value: 11, label: "Novembre" }, { value: 12, label: "Décembre" },
  ];
  const now = new Date();
  const currentMois = now.getMonth() + 1;
  const currentAnnee = now.getFullYear();

  const columns = useMemo(() => [
    columnHelper.accessor("Adherent", {
      header: "Adhérent",
      cell: ({ row }) => {
        const adherent = row.original.Adherent;
        const type = row.original.type;
        return (
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-gray-400 dark:text-gray-500 shrink-0" />
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                {adherent?.firstname} {adherent?.lastname}
              </span>
            </div>
            {/* Afficher le type en petit sur mobile */}
            {type && (
              <span className="text-xs text-gray-500 dark:text-gray-400 md:hidden ml-6 font-normal">
                {getTypeAssistanceLabel(type)}
              </span>
            )}
          </div>
        );
      },
      size: 200,
      minSize: 120,
      maxSize: 300,
      enableResizing: true,
    }),
    columnHelper.accessor("type", {
      header: "Type",
      cell: ({ row }) => {
        const type = row.getValue("type") as string;
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
      size: 100,
      minSize: 90,
      maxSize: 150,
      enableResizing: true,
    }),
    columnHelper.accessor("montantPaye", {
      header: "Payé",
      cell: ({ row }) => (
        <span className="text-sm text-green-600 dark:text-green-400 font-medium">
          {(row.getValue("montantPaye") as number).toFixed(2)} €
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
        const restant = row.getValue("montantRestant") as number;
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
        const label = statut === "Paye" ? "Payé" : statut === "Affecte" ? "Affecté" : statut === "Annule" ? "Annulé" : "En attente";
        const className =
          statut === "Paye"
            ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
            : statut === "Affecte"
              ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
              : statut === "Annule"
                ? "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
                : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
        return <Badge className={className}>{label}</Badge>;
      },
      size: 120,
      minSize: 100,
      maxSize: 150,
      enableResizing: true,
    }),
    columnHelper.display({
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const item = row.original;
        const isEnAttente = item.statut === "EnAttente";
        const canDelete = item.statut !== "Affecte" && item.statut !== "Paye";
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setViewAssistance(item)}>
                <Eye className="h-4 w-4 mr-2" />
                Voir
              </DropdownMenuItem>
              {isEnAttente && (
                <DropdownMenuItem onClick={() => {
                  setEditAssistance(item);
                  setEditSelectedAdherent(item.Adherent ? { id: item.adherentId, firstname: item.Adherent.firstname, lastname: item.Adherent.lastname, email: item.Adherent.User?.email } : null);
                  setEditFormData({
                    adherentId: item.adherentId,
                    type: item.type,
                    dateEvenement: item.dateEvenement ? new Date(item.dateEvenement).toISOString().split("T")[0] : "",
                    montant: Number(item.montant),
                    description: item.description || "",
                  });
                }}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Modifier
                </DropdownMenuItem>
              )}
              {canDelete && (
                <DropdownMenuItem
                  className="text-red-600 dark:text-red-400"
                  onClick={() => handleDelete(item)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Supprimer
                </DropdownMenuItem>
              )}
              {isEnAttente && (
                <DropdownMenuItem onClick={() => {
                  setAffecterAssistanceRow(item);
                  setAffecterMois(currentMois);
                  setAffecterAnnee(currentAnnee);
                }}>
                  <CalendarPlus className="h-4 w-4 mr-2" />
                  Affecter à la cotisation du mois
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => setVersementAssistance(item)}>
                <Banknote className="h-4 w-4 mr-2" />
                Verser à l&apos;adhérent
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
      size: 80,
      enableResizing: false,
    }),
  ], [currentMois, currentAnnee]);

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
    enableColumnResizing: true,
    columnResizeMode: "onChange",
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
    <div className="min-h-screen min-h-[100dvh] bg-gradient-to-br from-purple-50 via-white to-purple-50 py-6 sm:py-8">
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="mb-4">
          <Link href="/admin/finances">
            <Button variant="ghost" size="sm" className="text-gray-600 dark:text-gray-300">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour
            </Button>
          </Link>
        </div>
        <Card className="mx-auto max-w-screen-2xl w-full shadow-lg border-2 border-violet-200 dark:border-violet-800/50 bg-white dark:bg-gray-900 !py-0 min-h-[80vh]">
          <CardHeader className="bg-gradient-to-r from-purple-500/90 via-pink-400/80 to-purple-500/90 dark:from-purple-700/50 dark:via-pink-600/40 dark:to-purple-700/50 text-white pb-3 sm:pb-4 pt-3 sm:pt-4 px-4 sm:px-6 gap-0 shadow-md">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl font-bold text-white">
                <HandHeart className="h-5 w-5 text-white" />
                Assistances ({filteredData.length})
              </CardTitle>
              <div className="flex items-center gap-2 w-full sm:w-auto">
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
                <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden">
                  <DialogHeader className="bg-gradient-to-r from-purple-500/90 via-pink-400/80 to-purple-500/90 dark:from-purple-700/50 dark:via-pink-600/40 dark:to-purple-700/50 text-white px-6 py-4 shadow-md">
                    <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
                      <Plus className="h-5 w-5" />
                      Créer une assistance
                    </DialogTitle>
                    <DialogDescription className="text-purple-100 dark:text-purple-200">
                      Enregistrez une assistance pour un événement familial (type et montant depuis les types de cotisation Assistance).
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 px-6 py-5">
                    <div className="rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-900/20 p-3">
                      <Label className="text-xs font-medium uppercase tracking-wider text-purple-700 dark:text-purple-400">Adhérent *</Label>
                      <div className="flex items-center gap-2 mt-1.5">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setAdherentSearchOpen(true)}
                          className="flex-1 justify-start bg-white dark:bg-gray-900"
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
                              setFormData((prev) => ({ ...prev, adherentId: "" }));
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
                          setFormData((prev) => ({ ...prev, adherentId: adherent.id }));
                        }}
                      />
                    </div>
                    <div className="rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-900/20 p-3">
                      <Label className="text-xs font-medium uppercase tracking-wider text-purple-700 dark:text-purple-400">Type d&apos;assistance *</Label>
                      <Select
                        value={formData.typeCotisationId}
                        onValueChange={(value) => {
                          const typeAssistance = typesCotisationAssistance.find((t) => t.id === value);
                          setFormData((prev) => ({
                            ...prev,
                            typeCotisationId: value,
                            montant: typeAssistance ? String(typeAssistance.montant) : prev.montant,
                          }));
                        }}
                      >
                        <SelectTrigger className="mt-1.5 bg-white dark:bg-gray-900">
                          <SelectValue placeholder="Sélectionner un type d'assistance" />
                        </SelectTrigger>
                        <SelectContent>
                          {typesCotisationAssistance.map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.nom} ({Number(t.montant).toFixed(2)} €)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-1">
                        Types issus de types_cotisation_mensuelle (catégorie Assistance). L&apos;id sélectionné est enregistré dans assistances.typeCotisationId.
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-900/20 p-3">
                        <Label className="text-xs font-medium uppercase tracking-wider text-purple-700 dark:text-purple-400">Date de l&apos;événement *</Label>
                        <Input
                          id="dateEvenement"
                          type="date"
                          value={formData.dateEvenement}
                          onChange={(e) => setFormData((prev) => ({ ...prev, dateEvenement: e.target.value }))}
                          className="mt-1.5 bg-white dark:bg-gray-900"
                        />
                      </div>
                      <div className="rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-900/20 p-3">
                        <Label className="text-xs font-medium uppercase tracking-wider text-purple-700 dark:text-purple-400">Montant (€) *</Label>
                        <Input
                          id="montant"
                          type="number"
                          step="0.01"
                          min="0"
                          value={formData.montant}
                          onChange={(e) => setFormData((prev) => ({ ...prev, montant: e.target.value }))}
                          placeholder="50.00"
                          className="mt-1.5 max-w-[140px] bg-white dark:bg-gray-900"
                        />
                      </div>
                    </div>
                    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30 p-3">
                      <Label className="text-xs font-medium uppercase tracking-wider text-gray-600 dark:text-gray-400">Description</Label>
                      <Textarea
                        id="description"
                        value={formData.description}
                        onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                        placeholder="Description optionnelle (jusqu'à 500 caractères)"
                        maxLength={500}
                        rows={6}
                        className="mt-1.5 min-h-[140px] resize-y bg-white dark:bg-gray-900"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        {formData.description.length} / 500 caractères
                      </p>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
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
                className="pl-28"
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
                <SelectItem value="Affecte">Affecté</SelectItem>
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
              <DataTable table={table} emptyMessage="Aucune assistance trouvée" compact={true} resizable={true} headerColor="purple" />
              
              {/* Pagination - Masquée sur mobile */}
              <div className="hidden md:flex bg-white dark:bg-gray-800 mt-4 sm:mt-5 flex-col sm:flex-row items-center justify-between gap-3 sm:gap-0 py-4 sm:py-5 font-semibold rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 px-4 sm:px-6">
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

      {/* Dialog Voir l'assistance */}
      <Dialog open={!!viewAssistance} onOpenChange={(open) => !open && setViewAssistance(null)}>
        <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden">
          <DialogHeader className="bg-gradient-to-r from-purple-500/90 via-violet-400/80 to-purple-500/90 dark:from-purple-700/50 dark:via-violet-600/40 dark:to-purple-700/50 text-white px-6 py-4 shadow-md">
            <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Détail de l'assistance
            </DialogTitle>
            <DialogDescription className="text-purple-100 dark:text-purple-200 text-sm">
              Informations en lecture seule
            </DialogDescription>
          </DialogHeader>
          {viewAssistance && (
            <div className="p-4 sm:p-6 space-y-4">
              <div className="rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800/50 p-3">
                <Label className="text-purple-700 dark:text-purple-300 text-xs font-medium uppercase tracking-wider">Adhérent</Label>
                <p className="font-medium text-gray-900 dark:text-gray-100 mt-1">{viewAssistance.Adherent?.firstname} {viewAssistance.Adherent?.lastname}</p>
                {viewAssistance.Adherent?.User?.email && <p className="text-sm text-muted-foreground mt-0.5">{viewAssistance.Adherent.User.email}</p>}
              </div>
              <div className="rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800/50 p-3">
                <Label className="text-purple-700 dark:text-purple-300 text-xs font-medium uppercase tracking-wider">Type</Label>
                <div className="flex items-center gap-2 mt-1">
                  {getTypeAssistanceIcon(viewAssistance.type)}
                  <span className="text-gray-900 dark:text-gray-100">{getTypeAssistanceLabel(viewAssistance.type)}</span>
                </div>
              </div>
              <div className="rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800/50 p-3">
                <Label className="text-purple-700 dark:text-purple-300 text-xs font-medium uppercase tracking-wider">Date de l'événement</Label>
                <p className="text-gray-900 dark:text-gray-100 mt-1">{viewAssistance.dateEvenement ? format(new Date(viewAssistance.dateEvenement), "d MMMM yyyy", { locale: fr }) : "—"}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800/50 p-3">
                  <Label className="text-purple-700 dark:text-purple-300 text-xs font-medium uppercase tracking-wider">Montant</Label>
                  <p className="font-semibold text-gray-900 dark:text-gray-100 mt-1">{Number(viewAssistance.montant).toFixed(2)} €</p>
                </div>
                <div className="rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800/50 p-3">
                  <Label className="text-purple-700 dark:text-purple-300 text-xs font-medium uppercase tracking-wider">Statut</Label>
                  <Badge className={`mt-1 ${
                    viewAssistance.statut === "Paye" ? "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200"
                    : viewAssistance.statut === "Affecte" ? "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200"
                    : viewAssistance.statut === "Annule" ? "bg-gray-100 text-gray-800 dark:bg-gray-900/50 dark:text-gray-200"
                    : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-200"
                  }`}>
                    {viewAssistance.statut === "Paye" ? "Payé" : viewAssistance.statut === "Affecte" ? "Affecté" : viewAssistance.statut === "Annule" ? "Annulé" : "En attente"}
                  </Badge>
                </div>
              </div>
              {viewAssistance.montantPaye != null && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/50 p-3">
                    <Label className="text-green-700 dark:text-green-300 text-xs font-medium uppercase tracking-wider">Payé</Label>
                    <p className="text-green-600 dark:text-green-400 font-medium mt-1">{Number(viewAssistance.montantPaye).toFixed(2)} €</p>
                  </div>
                  <div className={`rounded-lg p-3 border ${Number(viewAssistance.montantRestant) > 0 ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/50" : "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800/50"}`}>
                    <Label className={`text-xs font-medium uppercase tracking-wider ${Number(viewAssistance.montantRestant) > 0 ? "text-red-700 dark:text-red-300" : "text-green-700 dark:text-green-300"}`}>Restant</Label>
                    <p className={`font-medium mt-1 ${Number(viewAssistance.montantRestant) > 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}>{Number(viewAssistance.montantRestant).toFixed(2)} €</p>
                  </div>
                </div>
              )}
              {viewAssistance.description && (
                <div className="rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800/50 p-3">
                  <Label className="text-purple-700 dark:text-purple-300 text-xs font-medium uppercase tracking-wider">Description</Label>
                  <div className="mt-1 min-h-[120px] max-h-[280px] overflow-y-auto rounded border border-purple-100 dark:border-purple-800/50 bg-white dark:bg-gray-900/50 p-3">
                    <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">{viewAssistance.description}</p>
                  </div>
                </div>
              )}
              <div className="flex justify-end pt-2">
                <Button variant="outline" onClick={() => setViewAssistance(null)}>Fermer</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog Modifier l'assistance (En attente uniquement) */}
      <Dialog open={!!editAssistance} onOpenChange={(open) => { if (!open) { setEditAssistance(null); setEditSelectedAdherent(null); } }}>
        <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden">
          <DialogHeader className="bg-gradient-to-r from-amber-500/90 via-orange-400/80 to-amber-500/90 dark:from-amber-700/50 dark:via-orange-600/40 dark:to-amber-700/50 text-white px-6 py-4 shadow-md">
            <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
              <Pencil className="h-5 w-5" />
              Modifier l'assistance
            </DialogTitle>
            <DialogDescription className="text-amber-100 dark:text-amber-200 text-sm">
              Modifiez les champs puis enregistrez. Réservé aux assistances en attente.
            </DialogDescription>
          </DialogHeader>
          {editAssistance && (
            <div className="p-4 sm:p-6 space-y-4">
              <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 p-3">
                <Label className="text-amber-800 dark:text-amber-200 font-medium">Adhérent *</Label>
                <div className="flex items-center gap-2 mt-2">
                  <Button type="button" variant="outline" onClick={() => setEditAdherentSearchOpen(true)} className="flex-1 justify-start border-amber-300 dark:border-amber-700">
                    <User className="h-4 w-4 mr-2" />
                    {editSelectedAdherent ? `${editSelectedAdherent.firstname} ${editSelectedAdherent.lastname}` : "Rechercher un adhérent"}
                  </Button>
                  {editSelectedAdherent && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => { setEditSelectedAdherent(null); setEditFormData((p) => ({ ...p, adherentId: "" })); }}>
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <AdherentSearchDialog
                  open={editAdherentSearchOpen}
                  onOpenChange={setEditAdherentSearchOpen}
                  onSelect={(adherent) => {
                    setEditSelectedAdherent({ id: adherent.id, firstname: adherent.firstname, lastname: adherent.lastname, email: adherent.email });
                    setEditFormData((p) => ({ ...p, adherentId: adherent.id }));
                  }}
                />
              </div>
              <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 p-3">
                <Label className="text-amber-800 dark:text-amber-200 font-medium">Type d'événement *</Label>
                <Select value={editFormData.type} onValueChange={(value: any) => setEditFormData((p) => ({ ...p, type: value }))}>
                  <SelectTrigger className="mt-2 border-amber-300 dark:border-amber-700"><SelectValue /></SelectTrigger>
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
                <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 p-3">
                  <Label className="text-amber-800 dark:text-amber-200 font-medium">Date de l'événement *</Label>
                  <Input type="date" value={editFormData.dateEvenement} onChange={(e) => setEditFormData((p) => ({ ...p, dateEvenement: e.target.value }))} className="mt-2 border-amber-300 dark:border-amber-700" />
                </div>
                <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 p-3">
                  <Label className="text-amber-800 dark:text-amber-200 font-medium">Montant (€) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editFormData.montant}
                    onChange={(e) => setEditFormData((p) => ({ ...p, montant: parseFloat(e.target.value) || 0 }))}
                    className="mt-2 border-amber-300 dark:border-amber-700"
                    disabled={editAssistance.statut === "Affecte" || editAssistance.statut === "Paye"}
                    title={editAssistance.statut === "Affecte" || editAssistance.statut === "Paye" ? "Le montant n'est pas modifiable lorsque l'assistance est affectée ou payée" : undefined}
                  />
                </div>
              </div>
              <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 p-3">
                <Label className="text-amber-800 dark:text-amber-200 font-medium">Description</Label>
                <Textarea value={editFormData.description} onChange={(e) => setEditFormData((p) => ({ ...p, description: e.target.value }))} placeholder="Optionnel" rows={6} className="mt-2 min-h-[140px] resize-y border-amber-300 dark:border-amber-700" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => { setEditAssistance(null); setEditSelectedAdherent(null); }}>Annuler</Button>
                <Button onClick={handleUpdate} disabled={loadingEdit}>{loadingEdit ? "Enregistrement…" : "Enregistrer"}</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog Affecter à la cotisation du mois */}
      <Dialog open={!!affecterAssistanceRow} onOpenChange={(open) => { if (!open) setAffecterAssistanceRow(null); }}>
        <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden">
          <DialogHeader className="bg-gradient-to-r from-teal-500/90 via-cyan-400/80 to-teal-500/90 dark:from-teal-700/50 dark:via-cyan-600/40 dark:to-teal-700/50 text-white px-6 py-4 shadow-md">
            <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
              <CalendarPlus className="h-5 w-5" />
              Affecter à la cotisation du mois
            </DialogTitle>
            <DialogDescription className="text-teal-100 dark:text-teal-200 text-sm">
              Choisissez le mois de la cotisation (égal ou supérieur au mois en cours). L'assistance sera liée à cette période.
            </DialogDescription>
          </DialogHeader>
          {affecterAssistanceRow && (
            <div className="p-4 sm:p-6 space-y-4">
              <div className="rounded-lg bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800/50 p-3">
                <Label className="text-teal-700 dark:text-teal-300 text-xs font-medium uppercase tracking-wider">Assistance</Label>
                <p className="font-medium text-gray-900 dark:text-gray-100 mt-1">
                  {affecterAssistanceRow.Adherent?.firstname} {affecterAssistanceRow.Adherent?.lastname} — {getTypeAssistanceLabel(affecterAssistanceRow.type)} ({Number(affecterAssistanceRow.montant).toFixed(2)} €)
                </p>
              </div>
              <div className="rounded-lg bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800/50 p-3">
                <Label className="text-teal-700 dark:text-teal-300 font-medium">Période de la cotisation</Label>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div>
                    <Label className="text-teal-600 dark:text-teal-400 text-xs">Année</Label>
                    <Select value={String(affecterAnnee)} onValueChange={(v) => setAffecterAnnee(Number(v))}>
                      <SelectTrigger className="mt-1 border-teal-300 dark:border-teal-700"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 5 }, (_, i) => currentAnnee + i).map((y) => (
                          <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-teal-600 dark:text-teal-400 text-xs">Mois</Label>
                    <Select value={String(affecterMois)} onValueChange={(v) => setAffecterMois(Number(v))}>
                      <SelectTrigger className="mt-1 border-teal-300 dark:border-teal-700"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {moisOptions
                          .filter((m) => affecterAnnee > currentAnnee || (affecterAnnee === currentAnnee && m.value >= currentMois))
                          .map((m) => (
                            <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setAffecterAssistanceRow(null)}>Annuler</Button>
                <Button onClick={handleAffecter} disabled={loadingAffecter}>{loadingAffecter ? "Affectation…" : "Affecter"}</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog Verser à l'adhérent */}
      <Dialog open={!!versementAssistance} onOpenChange={(open) => { if (!open) { setVersementAssistance(null); setVersementBreakdown(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Banknote className="h-5 w-5 text-green-600" />
              Verser à l&apos;adhérent
            </DialogTitle>
            <DialogDescription>
              Montant fixe de l&apos;assistance, moins les dettes initiales et cotisations non payées de l&apos;adhérent. Le reste est versé à l&apos;adhérent et enregistré comme dépense (comptabilisé).
            </DialogDescription>
          </DialogHeader>
          {versementAssistance && (
            <div className="space-y-4">
              {loadingVersement ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
                </div>
              ) : versementBreakdown ? (
                <>
                  <div className="rounded-lg border bg-muted/30 p-4 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Montant fixe assistance</span>
                      <span className="font-medium">{versementBreakdown.montantFixe.toFixed(2)} €</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Dettes initiales à déduire</span>
                      <span className="font-medium">− {versementBreakdown.totalDettes.toFixed(2)} €</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Cotisations non payées à déduire</span>
                      <span className="font-medium">− {versementBreakdown.totalCotisationsNonPayees.toFixed(2)} €</span>
                    </div>
                    <div className="border-t pt-2 mt-2 flex justify-between font-semibold text-base">
                      <span>Montant à verser à l&apos;adhérent</span>
                      <span className="text-green-600 dark:text-green-400">{versementBreakdown.montantAVerser.toFixed(2)} €</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {versementBreakdown.adherentName} — {versementBreakdown.typeAssistance}
                  </p>
                  {versementBreakdown.montantAVerser <= 0 ? (
                    <p className="text-sm text-amber-600 dark:text-amber-400">
                      Rien à verser : le montant fixe est entièrement absorbé par les dettes et cotisations.
                    </p>
                  ) : null}
                  {versementBreakdown && (
                    <div className="flex flex-wrap justify-end gap-2 pt-2">
                      <Button variant="outline" onClick={() => { setVersementAssistance(null); setVersementBreakdown(null); }}>Annuler</Button>
                      <Button
                        variant="outline"
                        onClick={async () => {
                          if (!versementAssistance?.id) return;
                          setSendingEmailVersement(true);
                          try {
                            const result = await envoyerEmailVersementAssistance(versementAssistance.id);
                            if (result.success) {
                              toast.success(result.message);
                            } else {
                              toast.error(result.error || "Erreur");
                            }
                          } finally {
                            setSendingEmailVersement(false);
                          }
                        }}
                        disabled={sendingEmailVersement}
                      >
                        {sendingEmailVersement ? <Loader2 className="h-4 w-4 animate-spin" /> : "Envoyer l'email au bénéficiaire"}
                      </Button>
                      {versementBreakdown.montantAVerser > 0 && (
                        <Button
                          onClick={async () => {
                            if (!versementAssistance?.id) return;
                            setSubmittingVersement(true);
                            try {
                              const result = await verserAssistanceToAdherent(versementAssistance.id);
                              if (result.success) {
                                toast.success(result.message);
                                setVersementAssistance(null);
                                setVersementBreakdown(null);
                                loadData();
                              } else {
                                toast.error(result.error || "Erreur");
                              }
                            } finally {
                              setSubmittingVersement(false);
                            }
                          }}
                          disabled={submittingVersement}
                        >
                          {submittingVersement ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enregistrer le versement (dépense)"}
                        </Button>
                      )}
                    </div>
                  )}
                </>
              ) : null}
            </div>
          )}
        </DialogContent>
      </Dialog>

      </div>
    </div>
  );
}

