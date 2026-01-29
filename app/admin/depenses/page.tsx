"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
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
import { ColumnVisibilityToggle } from "@/components/admin/ColumnVisibilityToggle";
import { DataTable } from "@/components/admin/DataTable";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Receipt, 
  Euro, 
  Plus, 
  Eye, 
  Edit, 
  Trash2,
  Search,
  Filter,
  Download,
  Calendar,
  Settings,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  FileText,
  X,
  CheckCircle,
  XCircle,
  Clock,
  Image,
  File,
  MoreHorizontal
} from "lucide-react";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getAllDepenses, deleteDepense, getDepenseStats, validateDepense, rejectDepense, suspendDepense, getDepenseById } from "@/actions/depenses";
import { getAllTypesDepense } from "@/actions/depenses/types";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface Depense {
  id: string;
  libelle: string;
  montant: number;
  dateDepense: string | Date;
  typeDepenseId?: string | null;
  categorie?: string | null;
  description?: string | null;
  justificatif?: string | null;
  statut: string;
  CreatedBy: {
    id: string;
    email: string;
    name?: string | null;
  };
  ValidatedBy?: {
    id: string;
    email: string;
    name?: string | null;
  } | null;
  TypeDepense?: {
    id: string;
    titre: string;
    description?: string | null;
  } | null;
  Justificatifs?: {
    id: string;
    nomFichier: string;
    chemin: string;
    typeMime: string;
    taille: number;
  }[];
}

interface TypeDepense {
  id: string;
  titre: string;
  description?: string | null;
  actif: boolean;
}

const columnHelper = createColumnHelper<Depense>();

const getStatusColor = (statut: string) => {
  switch (statut) {
    case "Valide":
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
    case "Rejete":
      return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
    case "EnAttente":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
  }
};

export default function AdminDepensesPage() {
  const [depenses, setDepenses] = useState<Depense[]>([]);
  const [typesDepense, setTypesDepense] = useState<TypeDepense[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statutFilter, setStatutFilter] = useState<string>("all");
  const [dateDebut, setDateDebut] = useState<string>("");
  const [dateFin, setDateFin] = useState<string>("");
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [selectedDepense, setSelectedDepense] = useState<Depense | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Visibilité des colonnes - charger depuis localStorage
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("admin-depenses-column-visibility");
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
            categorie: false,
            typeDepenseId: false,
            dateDepense: false,
            statut: false,
            description: false,
            createdAt: false,
            CreatedBy: false,
            ValidatedBy: false,
            // Garder visible : libelle, montant, actions (si présente)
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
      const saved = localStorage.getItem("admin-depenses-column-visibility");
      
      if (isMobile && (!saved || Object.keys(JSON.parse(saved || "{}")).length === 0)) {
        setColumnVisibility({
          categorie: false,
          typeDepenseId: false,
          dateDepense: false,
          statut: false,
          description: false,
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

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [depensesResult, typesResult, statsResult] = await Promise.all([
        getAllDepenses(),
        getAllTypesDepense(),
        getDepenseStats()
      ]);

      if (depensesResult.success && depensesResult.data) {
        setDepenses(depensesResult.data);
      }

      if (typesResult.success && typesResult.data) {
        setTypesDepense(typesResult.data.filter((t: TypeDepense) => t.actif));
      }

      if (statsResult.success && statsResult.data) {
        setStats(statsResult.data);
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
  }, [loadData]);

  // Filtrer les données
  const filteredData = useMemo(() => {
    return depenses.filter(item => {
      // Filtre global (recherche)
      if (globalFilter.trim()) {
        const q = globalFilter.trim().toLowerCase();
        const searchText = [
          item.libelle || "",
          item.description || "",
          item.categorie || "",
          item.TypeDepense?.titre || "",
          item.statut || "",
        ].join(" ").toLowerCase();
        if (!searchText.includes(q)) return false;
      }

      // Filtre par type
      if (typeFilter !== "all") {
        if (typeFilter === "none" && item.typeDepenseId) return false;
        if (typeFilter !== "none" && item.typeDepenseId !== typeFilter) return false;
      }

      // Filtre par statut
      if (statutFilter !== "all" && item.statut !== statutFilter) {
        return false;
      }

      // Filtre par date
      if (dateDebut || dateFin) {
        const itemDate = new Date(item.dateDepense);
        if (dateDebut && itemDate < new Date(dateDebut)) return false;
        if (dateFin) {
          const finDate = new Date(dateFin);
          finDate.setHours(23, 59, 59, 999);
          if (itemDate > finDate) return false;
        }
      }

      return true;
    });
  }, [depenses, globalFilter, typeFilter, statutFilter, dateDebut, dateFin]);

  const handleDelete = async (id: string) => {
    toast("Supprimer cette dépense ?", {
      description: "Cette action est irréversible",
      action: {
        label: "Supprimer",
        onClick: async () => {
          const res = await deleteDepense(id);
          if (res.success) {
            toast.success("Dépense supprimée");
            loadData();
          } else {
            toast.error(res.error || "Erreur lors de la suppression");
          }
        },
      },
      cancel: {
        label: "Annuler",
        onClick: () => {},
      },
    });
  };

  const handleValidate = async (id: string) => {
    toast("Valider cette dépense ?", {
      description: "La dépense sera marquée comme validée",
      action: {
        label: "Valider",
        onClick: async () => {
          const res = await validateDepense(id);
          if (res.success) {
            toast.success("Dépense validée");
            loadData();
          } else {
            toast.error(res.error || "Erreur lors de la validation");
          }
        },
      },
      cancel: {
        label: "Annuler",
        onClick: () => {},
      },
    });
  };

  const handleReject = async (id: string) => {
    toast("Rejeter cette dépense ?", {
      description: "La dépense sera marquée comme rejetée",
      action: {
        label: "Rejeter",
        onClick: async () => {
          const res = await rejectDepense(id);
          if (res.success) {
            toast.success("Dépense rejetée");
            loadData();
          } else {
            toast.error(res.error || "Erreur lors du rejet");
          }
        },
      },
      cancel: {
        label: "Annuler",
        onClick: () => {},
      },
    });
  };

  const handleSuspend = async (id: string) => {
    toast("Remettre cette dépense en attente ?", {
      description: "La dépense sera remise en attente de validation",
      action: {
        label: "Remettre en attente",
        onClick: async () => {
          const res = await suspendDepense(id);
          if (res.success) {
            toast.success("Dépense remise en attente");
            loadData();
          } else {
            toast.error(res.error || "Erreur lors de la remise en attente");
          }
        },
      },
      cancel: {
        label: "Annuler",
        onClick: () => {},
      },
    });
  };

  const handleViewDetails = async (depense: Depense) => {
    setShowDetailsDialog(true);
    setLoadingDetails(true);
    try {
      // Charger les détails complets de la dépense avec les justificatifs
      const result = await getDepenseById(depense.id);
      if (result.success && result.data) {
        setSelectedDepense(result.data);
      } else {
        // En cas d'erreur, utiliser les données de base
        setSelectedDepense(depense);
        toast.error(result.error || "Erreur lors du chargement des détails");
      }
    } catch (error) {
      console.error("Erreur lors du chargement des détails:", error);
      setSelectedDepense(depense);
      toast.error("Erreur lors du chargement des détails");
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleExportPDF = async () => {
    try {
      toast.loading("Génération du PDF en cours...");
      const { default: jsPDF } = await import('jspdf');
      const { addPDFHeader, addPDFFooter } = await import('@/lib/pdf-helpers-client');
      const doc = new jsPDF();

      await addPDFHeader(doc, 'Rapport des Dépenses');
      
      let yPos = 70;
      
      // Date de génération
      doc.setFontSize(12);
      doc.setTextColor(100, 100, 100);
      doc.setFont('helvetica', 'normal');
      doc.text(`Date de génération: ${new Date().toLocaleDateString('fr-FR')}`, 20, yPos);
      yPos += 10;

      // Statistiques
      if (stats) {
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'bold');
        doc.text(`Total dépenses: ${stats.totalDepenses}`, 20, yPos);
        yPos += 6;
        doc.text(`Dépenses du mois: ${stats.depensesMois}`, 20, yPos);
        yPos += 6;
        doc.text(`Total montant global: ${stats.totalMontantGlobal.toFixed(2)} €`, 20, yPos);
        yPos += 10;
      }

      // En-têtes du tableau
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('Date', 20, yPos);
      doc.text('Libellé', 50, yPos);
      doc.text('Type', 110, yPos);
      doc.text('Montant', 150, yPos);
      doc.text('Statut', 175, yPos);
      yPos += 6;

      // Ligne de séparation
      doc.setDrawColor(200, 200, 200);
      doc.line(20, yPos, 190, yPos);
      yPos += 4;

      // Données
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      filteredData.forEach((depense) => {
        if (yPos > 270) {
          doc.addPage();
          yPos = 20;
        }

        const date = new Date(depense.dateDepense);
        doc.text(format(date, 'dd/MM/yyyy', { locale: fr }), 20, yPos);
        doc.text((depense.libelle || "").substring(0, 30), 50, yPos);
        doc.text((depense.TypeDepense?.titre || depense.categorie || "—").substring(0, 20), 110, yPos);
        doc.text(`${depense.montant.toFixed(2)} €`, 150, yPos);
        doc.text(depense.statut, 175, yPos);
        yPos += 6;
      });

      await addPDFFooter(doc);
      doc.save(`depenses_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
      toast.dismiss();
      toast.success("PDF généré avec succès");
    } catch (error) {
      console.error("Erreur lors de l'export PDF:", error);
      toast.dismiss();
      toast.error("Erreur lors de la génération du PDF");
    }
  };

  const columns = useMemo(() => [
    columnHelper.accessor("dateDepense", {
      header: "Date",
      cell: ({ row }) => {
        const date = new Date(row.getValue("dateDepense"));
        return (
          <span className="text-sm text-gray-900 dark:text-gray-100">
            {format(date, 'dd MMM yyyy', { locale: fr })}
          </span>
        );
      },
      size: 120,
      minSize: 100,
      maxSize: 150,
      enableResizing: true,
    }),
    columnHelper.accessor("libelle", {
      header: "Libellé",
      cell: ({ row }) => {
        const libelle = row.getValue("libelle") as string;
        const type = row.original.TypeDepense;
        const categorie = row.original.categorie;
        const statut = row.original.statut;
        return (
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
              {libelle}
            </span>
            {/* Afficher le type et statut en petit sur mobile */}
            <div className="text-xs text-gray-500 dark:text-gray-400 md:hidden ml-0 font-normal flex items-center gap-2">
              {(type?.titre || categorie) && (
                <span>{type?.titre || categorie}</span>
              )}
              {statut && (
                <span className="text-xs">• {statut}</span>
              )}
            </div>
          </div>
        );
      },
      size: 200,
      minSize: 120,
      maxSize: 300,
      enableResizing: true,
    }),
    columnHelper.accessor("TypeDepense", {
      header: "Type",
      cell: ({ row }) => {
        const type = row.original.TypeDepense;
        const categorie = row.original.categorie;
        return (
          <Badge variant="outline" className="text-xs">
            {type?.titre || categorie || "—"}
          </Badge>
        );
      },
      size: 150,
      minSize: 120,
      maxSize: 200,
      enableResizing: true,
    }),
    columnHelper.accessor("montant", {
      header: "Montant",
      cell: ({ row }) => {
        const montant = Number(row.getValue("montant"));
        const dateDepense = row.original.dateDepense;
        return (
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
              {montant.toFixed(2).replace('.', ',')} €
            </span>
            {/* Afficher la date en petit sur mobile */}
            {dateDepense && (
              <span className="text-xs text-gray-500 dark:text-gray-400 md:hidden font-normal">
                {format(new Date(dateDepense), "d MMM yyyy", { locale: fr })}
              </span>
            )}
          </div>
        );
      },
      size: 120,
      minSize: 90,
      maxSize: 150,
      enableResizing: true,
    }),
    columnHelper.accessor("statut", {
      header: "Statut",
      cell: ({ row }) => (
        <Badge className={`${getStatusColor(row.getValue("statut"))} text-xs`}>
          {row.getValue("statut")}
        </Badge>
      ),
      size: 120,
      minSize: 100,
      maxSize: 150,
      enableResizing: true,
    }),
    columnHelper.accessor("CreatedBy", {
      header: "Demandeur",
      cell: ({ row }) => {
        const createdBy = row.original.CreatedBy;
        return (
          <div className="text-xs sm:text-sm text-gray-900 dark:text-gray-100">
            {createdBy?.name || createdBy?.email || "—"}
          </div>
        );
      },
      size: 180,
      minSize: 140,
      maxSize: 250,
      enableResizing: true,
    }),
    columnHelper.accessor("ValidatedBy", {
      header: "Validateur",
      cell: ({ row }) => {
        const validatedBy = row.original.ValidatedBy;
        const statut = row.original.statut;
        if (statut === "Valide" && validatedBy) {
          return (
            <div className="text-xs sm:text-sm text-gray-900 dark:text-gray-100">
              {validatedBy.name || validatedBy.email}
            </div>
          );
        }
        return (
          <div className="text-xs sm:text-sm text-gray-400 dark:text-gray-500">
            —
          </div>
        );
      },
      size: 180,
      minSize: 140,
      maxSize: 250,
      enableResizing: true,
    }),
    columnHelper.display({
      id: "actions",
      header: () => <div className="text-center w-full">Actions</div>,
      meta: { forceVisible: true },
      enableResizing: false,
      cell: ({ row }) => {
        const depense = row.original;
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
                  onClick={() => handleViewDetails(depense)}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <Eye className="h-4 w-4" />
                  <span>Voir les détails</span>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link 
                    href={`/admin/depenses/${depense.id}/edition`}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <Edit className="h-4 w-4" />
                    <span>{depense.statut === "Valide" || depense.statut === "Rejete" ? "Consulter (lecture seule)" : "Éditer"}</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {depense.statut !== "Valide" && (
                  <DropdownMenuItem 
                    onClick={() => handleValidate(depense.id)}
                    className="flex items-center gap-2 cursor-pointer text-green-600 dark:text-green-400 focus:text-green-600 dark:focus:text-green-400"
                  >
                    <CheckCircle className="h-4 w-4" />
                    <span>Valider</span>
                  </DropdownMenuItem>
                )}
                {depense.statut !== "Rejete" && (
                  <DropdownMenuItem 
                    onClick={() => handleReject(depense.id)}
                    className="flex items-center gap-2 cursor-pointer text-orange-600 dark:text-orange-400 focus:text-orange-600 dark:focus:text-orange-400"
                  >
                    <XCircle className="h-4 w-4" />
                    <span>Rejeter</span>
                  </DropdownMenuItem>
                )}
                {depense.statut !== "EnAttente" && (
                  <DropdownMenuItem 
                    onClick={() => handleSuspend(depense.id)}
                    className="flex items-center gap-2 cursor-pointer text-yellow-600 dark:text-yellow-400 focus:text-yellow-600 dark:focus:text-yellow-400"
                  >
                    <Clock className="h-4 w-4" />
                    <span>Remettre en attente</span>
                  </DropdownMenuItem>
                )}
                {(depense.statut !== "Valide" && depense.statut !== "Rejete") && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={() => handleDelete(depense.id)}
                      className="flex items-center gap-2 cursor-pointer text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span>Supprimer</span>
                    </DropdownMenuItem>
                  </>
                )}
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
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: (updater) => {
      const newVisibility = typeof updater === "function" ? updater(columnVisibility) : updater;
      setColumnVisibility(newVisibility);
      try {
        localStorage.setItem("admin-depenses-column-visibility", JSON.stringify(newVisibility));
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
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
        {/* En-tête */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-orange-600 to-orange-800 dark:from-orange-400 dark:to-orange-600 bg-clip-text text-transparent">
              Gestion des Dépenses
            </h1>
            <p className="text-gray-700 dark:text-gray-300 mt-1 sm:mt-2 text-sm sm:text-base lg:text-lg">
              Suivi et gestion de toutes les dépenses
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4 w-full sm:w-auto">
            <Button
              onClick={() => window.location.href = '/admin/depenses/types'}
              variant="outline"
              className="w-full sm:w-auto border-purple-300 hover:bg-purple-50 dark:border-purple-700 dark:hover:bg-purple-900/20 text-purple-700 dark:text-purple-300 shadow-sm"
            >
              <Settings className="h-4 w-4 mr-2" />
              Types
            </Button>
            <Link href="/admin/depenses/gestion" className="w-full sm:w-auto">
              <Button className="w-full sm:w-auto bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white shadow-lg">
                <Plus className="h-4 w-4 mr-2" />
                Nouvelle dépense
              </Button>
            </Link>
          </div>
        </div>

        {/* Statistiques */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 sm:gap-4">
            <Card className="!py-0 border-orange-200 dark:border-orange-800 shadow-lg hover:shadow-xl transition-shadow">
              <CardContent className="p-4 sm:p-6 bg-gradient-to-br from-orange-50/80 to-white dark:from-orange-900/20 dark:to-gray-800">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm font-semibold text-orange-700 dark:text-orange-300 uppercase tracking-wide">
                      Total
                    </p>
                    <p className="text-2xl sm:text-3xl font-bold text-orange-900 dark:text-orange-100 mt-1 sm:mt-2">
                      {stats.totalDepenses}
                    </p>
                  </div>
                  <Receipt className="h-6 w-6 sm:h-7 sm:w-7 text-orange-600 dark:text-orange-400" />
                </div>
              </CardContent>
            </Card>

            <Card className="!py-0 border-blue-200 dark:border-blue-800 shadow-lg hover:shadow-xl transition-shadow">
              <CardContent className="p-4 sm:p-6 bg-gradient-to-br from-blue-50/80 to-white dark:from-blue-900/20 dark:to-gray-800">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wide">
                      Ce Mois
                    </p>
                    <p className="text-2xl sm:text-3xl font-bold text-blue-900 dark:text-blue-100 mt-1 sm:mt-2">
                      {stats.depensesMois}
                    </p>
                  </div>
                  <Calendar className="h-6 w-6 sm:h-7 sm:w-7 text-blue-600 dark:text-blue-400" />
                </div>
              </CardContent>
            </Card>

            <Card className="!py-0 border-yellow-200 dark:border-yellow-800 shadow-lg hover:shadow-xl transition-shadow">
              <CardContent className="p-4 sm:p-6 bg-gradient-to-br from-yellow-50/80 to-white dark:from-yellow-900/20 dark:to-gray-800">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm font-semibold text-yellow-700 dark:text-yellow-300 uppercase tracking-wide">
                      En Attente
                    </p>
                    <p className="text-2xl sm:text-3xl font-bold text-yellow-900 dark:text-yellow-100 mt-1 sm:mt-2">
                      {stats.depensesEnAttente}
                    </p>
                  </div>
                  <FileText className="h-6 w-6 sm:h-7 sm:w-7 text-yellow-600 dark:text-yellow-400" />
                </div>
              </CardContent>
            </Card>

            <Card className="!py-0 border-green-200 dark:border-green-800 shadow-lg hover:shadow-xl transition-shadow">
              <CardContent className="p-4 sm:p-6 bg-gradient-to-br from-green-50/80 to-white dark:from-green-900/20 dark:to-gray-800">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm font-semibold text-green-700 dark:text-green-300 uppercase tracking-wide">
                      Total Montant
                    </p>
                    <p className="text-2xl sm:text-3xl font-bold text-green-900 dark:text-green-100 mt-1 sm:mt-2">
                      {stats.totalMontantGlobal.toFixed(2).replace('.', ',')} €
                    </p>
                  </div>
                  <Euro className="h-6 w-6 sm:h-7 sm:w-7 text-green-600 dark:text-green-400" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filtres et recherche */}
        <Card className="!py-0 shadow-xl border-orange-200 dark:border-orange-800">
          <CardHeader className="bg-gradient-to-r from-orange-500/90 to-orange-600/90 dark:from-orange-600/90 dark:to-orange-700/90 text-white rounded-t-lg pb-3 sm:pb-4 pt-3 sm:pt-4 px-4 sm:px-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0">
              <div>
                <CardTitle className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2 sm:gap-3">
                  <Receipt className="h-5 w-5 sm:h-6 sm:w-6" />
                  Liste des Dépenses
                </CardTitle>
                <CardDescription className="text-orange-100 dark:text-orange-200 mt-1 sm:mt-2 text-sm sm:text-base">
                  {filteredData.length} dépense(s) trouvée(s) • Total: {filteredData.reduce((sum, d) => sum + Number(d.montant), 0).toFixed(2).replace('.', ',')} €
                </CardDescription>
              </div>
              <div className="flex items-center space-x-2 w-full sm:w-auto">
                <ColumnVisibilityToggle 
                  table={table} 
                  storageKey="admin-depenses-column-visibility"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportPDF}
                  className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <Download className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Export PDF</span>
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            {/* Filtres */}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Rechercher (libellé, description, type, statut)..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-28"
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Type de dépense" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les types</SelectItem>
                  <SelectItem value="none">Sans type</SelectItem>
                  {typesDepense.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.titre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statutFilter} onValueChange={setStatutFilter}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="EnAttente">En Attente</SelectItem>
                  <SelectItem value="Valide">Validé</SelectItem>
                  <SelectItem value="Rejete">Rejeté</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Filtres par date */}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-6">
              <div className="flex-1">
                <label className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                  Date de début
                </label>
                <Input
                  type="date"
                  value={dateDebut}
                  onChange={(e) => setDateDebut(e.target.value)}
                  className="w-full"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                  Date de fin
                </label>
                <Input
                  type="date"
                  value={dateFin}
                  onChange={(e) => setDateFin(e.target.value)}
                  className="w-full"
                />
              </div>
              {(dateDebut || dateFin) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setDateDebut("");
                    setDateFin("");
                  }}
                  className="mt-6 sm:mt-0"
                >
                  <X className="h-4 w-4 mr-2" />
                  Réinitialiser
                </Button>
              )}
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
              </div>
            ) : (
              <>
                <DataTable table={table} emptyMessage="Aucune dépense trouvée" compact={true} />
                
                {/* Pagination - Masquée sur mobile */}
                <div className="hidden md:flex bg-white dark:bg-gray-800 mt-5 flex-col sm:flex-row items-center justify-between py-5 font-semibold rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 gap-4 sm:gap-0">
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
      </div>

      {/* Dialog de détails */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Détails de la Dépense</DialogTitle>
          </DialogHeader>
          {loadingDetails ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : selectedDepense ? (
            <div className="space-y-6">
              {/* Informations de la dépense */}
              <Card className="!py-0 border-blue-200 dark:border-blue-800 shadow-sm">
                <CardContent className="p-4 sm:p-6 bg-gradient-to-br from-blue-50/80 to-white dark:from-blue-900/20 dark:to-gray-800">
                  <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                    <Receipt className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    Informations de la dépense
                  </h3>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="libelle">Libellé *</Label>
                        <div className="p-2.5 bg-white dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-900 dark:text-gray-100">
                          {selectedDepense.libelle || "—"}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="montant">Montant *</Label>
                        <div className="p-2.5 bg-white dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700 text-sm font-bold text-gray-900 dark:text-gray-100">
                          {selectedDepense.montant.toFixed(2).replace('.', ',')} €
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="dateDepense">Date *</Label>
                        <div className="p-2.5 bg-white dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-900 dark:text-gray-100">
                          {format(new Date(selectedDepense.dateDepense), 'dd MMMM yyyy', { locale: fr })}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="typeDepenseId">Type de dépense</Label>
                        <div className="p-2.5 bg-white dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700">
                          {selectedDepense.TypeDepense ? (
                            <Badge variant="outline" className="text-xs">
                              {selectedDepense.TypeDepense.titre}
                            </Badge>
                          ) : (
                            <span className="text-sm text-gray-500 dark:text-gray-400">—</span>
                          )}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="categorie">Catégorie (ancien système)</Label>
                        <div className="p-2.5 bg-white dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-900 dark:text-gray-100">
                          {selectedDepense.categorie || "—"}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="statut">Statut</Label>
                        <div className="p-2.5 bg-white dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700">
                          <Badge 
                            className={
                              selectedDepense.statut === "Valide" 
                                ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-green-300 dark:border-green-700"
                                : selectedDepense.statut === "Rejete"
                                ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border-red-300 dark:border-red-700"
                                : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 border-yellow-300 dark:border-yellow-700"
                            }
                          >
                            {selectedDepense.statut}
                          </Badge>
                        </div>
                      </div>
                      {selectedDepense.CreatedBy && (
                        <div className="space-y-2">
                          <Label htmlFor="createdBy">Demandeur</Label>
                          <div className="p-2.5 bg-white dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-900 dark:text-gray-100">
                            {selectedDepense.CreatedBy.name || selectedDepense.CreatedBy.email}
                          </div>
                        </div>
                      )}
                      {selectedDepense.ValidatedBy && selectedDepense.statut === "Valide" && (
                        <div className="space-y-2">
                          <Label htmlFor="validatedBy">Validateur</Label>
                          <div className="p-2.5 bg-white dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-900 dark:text-gray-100">
                            {selectedDepense.ValidatedBy.name || selectedDepense.ValidatedBy.email}
                          </div>
                        </div>
                      )}
                      <div className="md:col-span-2 space-y-2">
                        <Label htmlFor="description">Description</Label>
                        <div className="p-2.5 bg-white dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap min-h-[80px]">
                          {selectedDepense.description || "—"}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Section Justificatifs */}
              <Card className="!py-0 border-orange-200 dark:border-orange-800 shadow-sm">
                <CardContent className="p-4 sm:p-6 bg-gradient-to-br from-orange-50/80 to-white dark:from-orange-900/20 dark:to-gray-800">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                      <FileText className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                      Justificatifs
                      {selectedDepense.Justificatifs && selectedDepense.Justificatifs.length > 0 && (
                        <Badge variant="outline" className="ml-2 border-orange-300 dark:border-orange-700 text-orange-700 dark:text-orange-300">
                          {selectedDepense.Justificatifs.length}
                        </Badge>
                      )}
                    </h3>
                  </div>

                  <div className="space-y-4">
                    {selectedDepense.Justificatifs && selectedDepense.Justificatifs.length > 0 ? (
                      <div className="space-y-2">
                        {selectedDepense.Justificatifs.map((just: any) => {
                          const getFileIcon = (typeMime: string) => {
                            if (typeMime.startsWith("image/")) {
                              return <Image className="h-5 w-5 text-blue-500" />;
                            } else if (typeMime === "application/pdf") {
                              return <FileText className="h-5 w-5 text-red-500" />;
                            }
                            return <File className="h-5 w-5 text-gray-500" />;
                          };
                          const formatFileSize = (bytes: number) => {
                            if (bytes < 1024) return bytes + " B";
                            if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + " KB";
                            return (bytes / (1024 * 1024)).toFixed(2) + " MB";
                          };
                          return (
                            <Card key={just.id} className="!py-0 border-gray-200 dark:border-gray-700">
                              <CardContent className="p-3 sm:p-4">
                                <div className="flex items-center justify-between gap-3">
                                  <div className="flex items-center gap-3 flex-1 min-w-0">
                                    {getFileIcon(just.typeMime)}
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                                        {just.nomFichier}
                                      </p>
                                      <div className="flex items-center gap-2 mt-1">
                                        <Badge variant="outline" className="text-xs">
                                          {formatFileSize(just.taille)}
                                        </Badge>
                                        {just.createdAt && (
                                          <span className="text-xs text-gray-500 dark:text-gray-400">
                                            {format(new Date(just.createdAt), 'dd MMM yyyy à HH:mm', { locale: fr })}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => window.open(just.chemin, '_blank')}
                                      className="h-8 w-8 p-0 border-blue-300 hover:bg-blue-50 dark:border-blue-700 dark:hover:bg-blue-900/20"
                                      title="Voir le justificatif"
                                    >
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                    <a href={just.chemin} download={just.nomFichier}>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-8 w-8 p-0 border-green-300 hover:bg-green-50 dark:border-green-700 dark:hover:bg-green-900/20"
                                        title="Télécharger le justificatif"
                                      >
                                        <Download className="h-4 w-4" />
                                      </Button>
                                    </a>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    ) : selectedDepense.justificatif ? (
                      <Card className="!py-0 border-gray-200 dark:border-gray-700">
                        <CardContent className="p-3 sm:p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <FileText className="h-5 w-5 text-blue-500" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                                  Justificatif (ancien système)
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => window.open(selectedDepense.justificatif, '_blank')}
                                className="h-8 w-8 p-0 border-blue-300 hover:bg-blue-50 dark:border-blue-700 dark:hover:bg-blue-900/20"
                                title="Voir le justificatif"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <a href={selectedDepense.justificatif} download>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 w-8 p-0 border-green-300 hover:bg-green-50 dark:border-green-700 dark:hover:bg-green-900/20"
                                  title="Télécharger le justificatif"
                                >
                                  <Download className="h-4 w-4" />
                                </Button>
                              </a>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ) : (
                      <Card className="!py-0 border-dashed">
                        <CardContent className="p-6 text-center">
                          <FileText className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            Aucun justificatif associé à cette dépense
                          </p>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              Aucune donnée disponible
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
