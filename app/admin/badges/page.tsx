"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Award, 
  Search, 
  Plus, 
  Edit, 
  Trash2, 
  UserPlus,
  CheckCircle,
  XCircle,
  Filter,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  MoreHorizontal,
  X,
  User
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { 
  getAllBadges,
  createBadge,
  updateBadge,
  deleteBadge,
  attribuerBadge,
  retirerBadge,
  getBadgeById
} from "@/actions/badges";
import { getAllUsersForAdmin } from "@/actions/user";
import { toast } from "sonner";
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
import * as LucideIcons from "lucide-react";

const columnHelper = createColumnHelper<any>();

// Liste des icônes disponibles (les plus courantes)
const availableIcons = [
  "Award", "UserPlus", "CheckCircle", "Calendar", "Euro", "Lightbulb",
  "Clock", "TrendingUp", "Star", "Heart", "Trophy", "Medal", "Shield",
  "Zap", "Target", "Gift", "Crown", "Gem", "Sparkles"
];

const availableColors = [
  { value: "blue", label: "Bleu" },
  { value: "green", label: "Vert" },
  { value: "purple", label: "Violet" },
  { value: "orange", label: "Orange" },
  { value: "yellow", label: "Jaune" },
  { value: "red", label: "Rouge" },
  { value: "indigo", label: "Indigo" },
  { value: "pink", label: "Rose" },
  { value: "slate", label: "Gris" },
  { value: "gold", label: "Or" },
];

const getBadgeTypeBadge = (type: string) => {
  if (type === "Automatique") {
    return (
      <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border-blue-300 dark:border-blue-700">
        <CheckCircle className="h-3 w-3 mr-1" />
        Automatique
      </Badge>
    );
  }
  return (
    <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 border-purple-300 dark:border-purple-700">
      Manuel
    </Badge>
  );
};

const getStatusBadge = (actif: boolean) => {
  if (actif) {
    return (
      <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-green-300 dark:border-green-700">
        <CheckCircle className="h-3 w-3 mr-1" />
        Actif
      </Badge>
    );
  }
  return (
    <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200 border-gray-300 dark:border-gray-700">
      <XCircle className="h-3 w-3 mr-1" />
      Inactif
      </Badge>
  );
};

export default function AdminBadgesPage() {
  const [badges, setBadges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("admin-badges-column-visibility");
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
            type: false,
            couleur: false,
            icone: false,
            actif: false,
            createdAt: false,
            // Garder visible : nom, actions (si présente)
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
      const saved = localStorage.getItem("admin-badges-column-visibility");
      
      if (isMobile && (!saved || Object.keys(JSON.parse(saved || "{}")).length === 0)) {
        setColumnVisibility({
          description: false,
          type: false,
          couleur: false,
          icone: false,
          actif: false,
          createdAt: false,
        });
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Dialogs
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showAttribuerDialog, setShowAttribuerDialog] = useState(false);
  const [selectedBadge, setSelectedBadge] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]); // Changé en tableau pour sélection multiple
  const [raisonAttribution, setRaisonAttribution] = useState("");
  const [userSearch, setUserSearch] = useState(""); // Recherche d'adhérents

  // Form data
  const [formData, setFormData] = useState({
    nom: "",
    description: "",
    icone: "Award",
    couleur: "blue",
    type: "Manuel" as "Automatique" | "Manuel",
    condition: "",
    actif: true,
    ordre: 0,
  });

  // Debounce pour la recherche
  useEffect(() => {
    const timer = setTimeout(() => {
      setGlobalFilter(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const loadBadges = useCallback(async () => {
    try {
      setLoading(true);
      const result = await getAllBadges();
      if (result.success && result.data) {
        setBadges(result.data);
      } else {
        toast.error(result.error || "Erreur lors du chargement");
        setBadges([]);
      }
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors du chargement des badges");
      setBadges([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadUsers = useCallback(async () => {
    try {
      const result = await getAllUsersForAdmin();
      if (result.success && result.users) {
        setUsers(result.users);
      }
    } catch (error) {
      console.error("Erreur lors du chargement des utilisateurs:", error);
    }
  }, []);

  useEffect(() => {
    loadBadges();
    loadUsers();
  }, [loadBadges, loadUsers]);

  const handleCreate = async () => {
    if (!formData.nom.trim() || !formData.description.trim()) {
      toast.error("Le nom et la description sont requis");
      return;
    }

    try {
      const result = await createBadge(formData);
      if (result.success) {
        toast.success(result.message || "Badge créé avec succès");
        setShowCreateDialog(false);
        setFormData({
          nom: "",
          description: "",
          icone: "Award",
          couleur: "blue",
          type: "Manuel",
          condition: "",
          actif: true,
          ordre: 0,
        });
        loadBadges();
      } else {
        toast.error(result.error || "Erreur lors de la création");
      }
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de la création du badge");
    }
  };

  const handleEdit = async () => {
    if (!selectedBadge || !formData.nom.trim() || !formData.description.trim()) {
      toast.error("Le nom et la description sont requis");
      return;
    }

    try {
      const result = await updateBadge({
        id: selectedBadge.id,
        ...formData,
      });
      if (result.success) {
        toast.success(result.message || "Badge mis à jour avec succès");
        setShowEditDialog(false);
        setSelectedBadge(null);
        loadBadges();
      } else {
        toast.error(result.error || "Erreur lors de la mise à jour");
      }
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de la mise à jour du badge");
    }
  };

  const handleDelete = async (badgeId: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce badge ? Cette action est irréversible.")) {
      return;
    }

    try {
      const result = await deleteBadge(badgeId);
      if (result.success) {
        toast.success(result.message || "Badge supprimé avec succès");
        loadBadges();
      } else {
        toast.error(result.error || "Erreur lors de la suppression");
      }
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de la suppression du badge");
    }
  };

  const handleToggleUser = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSelectAllFiltered = () => {
    // Filtrer les utilisateurs selon la recherche actuelle
    const filteredUsers = users.filter((user) => {
      if (!userSearch.trim()) return true;
      const searchLower = userSearch.toLowerCase();
      const displayName = user.adherent
        ? `${user.adherent.firstname} ${user.adherent.lastname}`.toLowerCase()
        : (user.name || user.email || "").toLowerCase();
      return (
        displayName.includes(searchLower) ||
        user.email?.toLowerCase().includes(searchLower)
      );
    });

    const filteredUserIds = filteredUsers.map(u => u.id);
    
    // Si tous les utilisateurs filtrés sont déjà sélectionnés, les désélectionner tous
    const allFilteredSelected = filteredUserIds.every(id => selectedUserIds.includes(id));
    
    if (allFilteredSelected) {
      // Désélectionner tous les utilisateurs filtrés
      setSelectedUserIds(prev => prev.filter(id => !filteredUserIds.includes(id)));
      toast.info(`${filteredUserIds.length} adhérent${filteredUserIds.length > 1 ? "s" : ""} désélectionné${filteredUserIds.length > 1 ? "s" : ""}`);
    } else {
      // Sélectionner tous les utilisateurs filtrés
      setSelectedUserIds(prev => {
        const newSelection = [...prev];
        filteredUserIds.forEach(id => {
          if (!newSelection.includes(id)) {
            newSelection.push(id);
          }
        });
        return newSelection;
      });
      toast.success(`${filteredUserIds.length} adhérent${filteredUserIds.length > 1 ? "s" : ""} sélectionné${filteredUserIds.length > 1 ? "s" : ""}`);
    }
  };

  const handleAttribuer = async () => {
    if (!selectedBadge || selectedUserIds.length === 0) {
      toast.error("Veuillez sélectionner au moins un adhérent");
      return;
    }

    try {
      let successCount = 0;
      let errorCount = 0;

      // Attribuer le badge à tous les utilisateurs sélectionnés
      for (const userId of selectedUserIds) {
        const result = await attribuerBadge({
          badgeId: selectedBadge.id,
          userId: userId,
          raison: raisonAttribution || undefined,
        });
        if (result.success) {
          successCount++;
        } else {
          errorCount++;
        }
      }

      if (successCount > 0) {
        toast.success(`Badge attribué à ${successCount} adhérent${successCount > 1 ? "s" : ""}`);
      }
      if (errorCount > 0) {
        toast.error(`Échec pour ${errorCount} adhérent${errorCount > 1 ? "s" : ""}`);
      }

      setShowAttribuerDialog(false);
      setSelectedUserIds([]);
      setRaisonAttribution("");
      setUserSearch("");
      loadBadges();
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de l'attribution du badge");
    }
  };

  const openEditDialog = async (badge: any) => {
    setSelectedBadge(badge);
    setFormData({
      nom: badge.nom,
      description: badge.description,
      icone: badge.icone,
      couleur: badge.couleur,
      type: badge.type,
      condition: badge.condition || "",
      actif: badge.actif,
      ordre: badge.ordre,
    });
    setShowEditDialog(true);
  };

  const openAttribuerDialog = (badge: any) => {
    setSelectedBadge(badge);
    setSelectedUserIds([]);
    setRaisonAttribution("");
    setUserSearch("");
    setShowAttribuerDialog(true);
  };

  // Filtrer les données
  const filteredData = useMemo(() => {
    return badges.filter((badge) => {
      // Filtre global (recherche)
      if (globalFilter.trim()) {
        const q = globalFilter.trim().toLowerCase();
        const searchText = [
          badge.nom || "",
          badge.description || "",
        ].join(" ").toLowerCase();
        if (!searchText.includes(q)) return false;
      }

      // Filtre par type
      if (typeFilter !== "all" && badge.type !== typeFilter) {
        return false;
      }

      // Filtre par statut
      if (statusFilter !== "all") {
        const isActif = statusFilter === "actif";
        if (badge.actif !== isActif) return false;
      }

      return true;
    });
  }, [badges, globalFilter, typeFilter, statusFilter]);

  const columns = useMemo(() => [
    columnHelper.accessor("nom", {
      header: "Nom",
      cell: ({ row }) => {
        const badge = row.original;
        const IconComponent = (LucideIcons as any)[badge.icone] || Award;
        const colorClasses: Record<string, { bg: string; text: string }> = {
          blue: { bg: "bg-blue-100 dark:bg-blue-900", text: "text-blue-600 dark:text-blue-400" },
          green: { bg: "bg-green-100 dark:bg-green-900", text: "text-green-600 dark:text-green-400" },
          purple: { bg: "bg-purple-100 dark:bg-purple-900", text: "text-purple-600 dark:text-purple-400" },
          orange: { bg: "bg-orange-100 dark:bg-orange-900", text: "text-orange-600 dark:text-orange-400" },
          yellow: { bg: "bg-yellow-100 dark:bg-yellow-900", text: "text-yellow-600 dark:text-yellow-400" },
          red: { bg: "bg-red-100 dark:bg-red-900", text: "text-red-600 dark:text-red-400" },
          indigo: { bg: "bg-indigo-100 dark:bg-indigo-900", text: "text-indigo-600 dark:text-indigo-400" },
          pink: { bg: "bg-pink-100 dark:bg-pink-900", text: "text-pink-600 dark:text-pink-400" },
          slate: { bg: "bg-slate-100 dark:bg-slate-900", text: "text-slate-600 dark:text-slate-400" },
          gold: { bg: "bg-yellow-200 dark:bg-yellow-800", text: "text-yellow-700 dark:text-yellow-300" },
        };
        const colors = colorClasses[badge.couleur] || colorClasses.blue;
        return (
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className={`p-1.5 sm:p-2 rounded-lg flex-shrink-0 ${colors.bg}`}>
              <IconComponent className={`h-4 w-4 sm:h-5 sm:w-5 ${colors.text}`} />
            </div>
            <span className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white truncate">
              {badge.nom}
            </span>
          </div>
        );
      },
      size: 250,
      minSize: 200,
      maxSize: 400,
      enableResizing: true,
    }),
    columnHelper.accessor("description", {
      header: "Description",
      cell: ({ row }) => {
        const description = row.getValue("description") as string;
        return (
          <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
            {description}
          </span>
        );
      },
      size: 300,
      minSize: 200,
      maxSize: 500,
      enableResizing: true,
    }),
    columnHelper.accessor("type", {
      header: "Type",
      cell: ({ row }) => {
        const type = row.getValue("type") as string;
        return getBadgeTypeBadge(type);
      },
      size: 150,
      minSize: 120,
      maxSize: 200,
      enableResizing: true,
    }),
    columnHelper.accessor("actif", {
      header: "Statut",
      cell: ({ row }) => {
        const actif = row.getValue("actif") as boolean;
        return getStatusBadge(actif);
      },
      size: 120,
      minSize: 100,
      maxSize: 150,
      enableResizing: true,
    }),
    columnHelper.accessor("ordre", {
      header: "Ordre",
      cell: ({ row }) => {
        const ordre = row.getValue("ordre") as number;
        return (
          <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
            {ordre}
          </span>
        );
      },
      size: 80,
      minSize: 60,
      maxSize: 100,
      enableResizing: true,
    }),
    columnHelper.display({
      id: "actions",
      header: () => <div className="text-center w-full">Actions</div>,
      meta: { forceVisible: true },
      enableResizing: false,
      cell: ({ row }) => {
        const badge = row.original;
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
                  onClick={() => openEditDialog(badge)}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <Edit className="h-4 w-4" />
                  <span>Éditer</span>
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => openAttribuerDialog(badge)}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <UserPlus className="h-4 w-4" />
                  <span>Attribuer</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => handleDelete(badge.id)}
                  className="flex items-center gap-2 cursor-pointer text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>Supprimer</span>
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
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: (updater) => {
      const newVisibility = typeof updater === "function" ? updater(columnVisibility) : updater;
      setColumnVisibility(newVisibility);
      try {
        localStorage.setItem("admin-badges-column-visibility", JSON.stringify(newVisibility));
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
        <Card className="!py-0 shadow-lg border-blue-200 dark:border-blue-800">
          <CardHeader className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5" />
                Gestion des Badges ({filteredData.length})
              </CardTitle>
              <div className="flex items-center gap-2">
                <ColumnVisibilityToggle 
                  table={table} 
                  storageKey="admin-badges-column-visibility"
                />
                <Button
                  onClick={() => {
                    setFormData({
                      nom: "",
                      description: "",
                      icone: "Award",
                      couleur: "blue",
                      type: "Manuel",
                      condition: "",
                      actif: true,
                      ordre: 0,
                    });
                    setShowCreateDialog(true);
                  }}
                  className="bg-white text-blue-600 hover:bg-blue-50 border-white"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Nouveau badge
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4 sm:pt-6 pb-4 px-4 sm:px-6">
            {/* Filtres et recherche */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Rechercher un badge..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-11"
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Filtrer par type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les types</SelectItem>
                  <SelectItem value="Automatique">Automatique</SelectItem>
                  <SelectItem value="Manuel">Manuel</SelectItem>
                </SelectContent>
              </Select>
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
                  {filteredData.length} badge(s) trouvé(s)
                </div>
                <DataTable table={table} emptyMessage="Aucun badge trouvé" />
                
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
      </div>

      {/* Dialog Créer */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Créer un nouveau badge</DialogTitle>
            <DialogDescription>
              Remplissez les informations pour créer un nouveau badge
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nom">Nom *</Label>
              <Input
                id="nom"
                value={formData.nom}
                onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                placeholder="Ex: Premier Pas"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Description du badge"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="icone">Icône *</Label>
                <Select value={formData.icone} onValueChange={(value) => setFormData({ ...formData, icone: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableIcons.map((icon) => (
                      <SelectItem key={icon} value={icon}>
                        {icon}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="couleur">Couleur *</Label>
                <Select value={formData.couleur} onValueChange={(value) => setFormData({ ...formData, couleur: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableColors.map((color) => (
                      <SelectItem key={color.value} value={color.value}>
                        {color.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="type">Type *</Label>
                <Select value={formData.type} onValueChange={(value: any) => setFormData({ ...formData, type: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Manuel">Manuel</SelectItem>
                    <SelectItem value="Automatique">Automatique</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ordre">Ordre d'affichage</Label>
                <Input
                  id="ordre"
                  type="number"
                  min="0"
                  value={formData.ordre}
                  onChange={(e) => setFormData({ ...formData, ordre: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>
            {formData.type === "Automatique" && (
              <div className="space-y-2">
                <Label htmlFor="condition">Condition (JSON)</Label>
                <Textarea
                  id="condition"
                  value={formData.condition}
                  onChange={(e) => setFormData({ ...formData, condition: e.target.value })}
                  placeholder='{"type": "premiere_cotisation"}'
                  rows={2}
                />
              </div>
            )}
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="actif"
                checked={formData.actif}
                onChange={(e) => setFormData({ ...formData, actif: e.target.checked })}
                className="rounded"
              />
              <Label htmlFor="actif">Badge actif</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Annuler
            </Button>
            <Button onClick={handleCreate}>
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Éditer */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Éditer le badge</DialogTitle>
            <DialogDescription>
              Modifiez les informations du badge
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-nom">Nom *</Label>
              <Input
                id="edit-nom"
                value={formData.nom}
                onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description *</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-icone">Icône *</Label>
                <Select value={formData.icone} onValueChange={(value) => setFormData({ ...formData, icone: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableIcons.map((icon) => (
                      <SelectItem key={icon} value={icon}>
                        {icon}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-couleur">Couleur *</Label>
                <Select value={formData.couleur} onValueChange={(value) => setFormData({ ...formData, couleur: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableColors.map((color) => (
                      <SelectItem key={color.value} value={color.value}>
                        {color.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-type">Type *</Label>
                <Select value={formData.type} onValueChange={(value: any) => setFormData({ ...formData, type: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Manuel">Manuel</SelectItem>
                    <SelectItem value="Automatique">Automatique</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-ordre">Ordre d'affichage</Label>
                <Input
                  id="edit-ordre"
                  type="number"
                  min="0"
                  value={formData.ordre}
                  onChange={(e) => setFormData({ ...formData, ordre: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>
            {formData.type === "Automatique" && (
              <div className="space-y-2">
                <Label htmlFor="edit-condition">Condition (JSON)</Label>
                <Textarea
                  id="edit-condition"
                  value={formData.condition}
                  onChange={(e) => setFormData({ ...formData, condition: e.target.value })}
                  rows={2}
                />
              </div>
            )}
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="edit-actif"
                checked={formData.actif}
                onChange={(e) => setFormData({ ...formData, actif: e.target.checked })}
                className="rounded"
              />
              <Label htmlFor="edit-actif">Badge actif</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Annuler
            </Button>
            <Button onClick={handleEdit}>
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Attribuer */}
      <Dialog open={showAttribuerDialog} onOpenChange={setShowAttribuerDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg">
                <UserPlus className="h-5 w-5 text-white" />
              </div>
              Attribuer le badge "{selectedBadge?.nom}"
            </DialogTitle>
            <DialogDescription>
              Sélectionnez un ou plusieurs adhérents pour attribuer ce badge
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-auto space-y-4">
            {/* Champ de recherche des adhérents */}
            <div className="space-y-2">
              <Label>Rechercher des adhérents</Label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400 dark:text-gray-500" />
                <Input
                  placeholder="Rechercher par nom, email..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="pl-11 pr-10"
                />
                {userSearch && (
                  <button
                    onClick={() => setUserSearch("")}
                    className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    title="Effacer la recherche"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Indicateur et actions de sélection */}
            <div className="flex items-center justify-between">
              {userSearch && (
                <p className="text-xs text-muted-foreground">
                  {(() => {
                    const filteredCount = users.filter((user) => {
                      const searchLower = userSearch.toLowerCase();
                      const displayName = user.adherent
                        ? `${user.adherent.firstname} ${user.adherent.lastname}`.toLowerCase()
                        : (user.name || user.email || "").toLowerCase();
                      return (
                        displayName.includes(searchLower) ||
                        user.email?.toLowerCase().includes(searchLower)
                      );
                    }).length;
                    return `${filteredCount} adhérent${filteredCount > 1 ? "s" : ""} trouvé${filteredCount > 1 ? "s" : ""}`;
                  })()}
                </p>
              )}
              
              {users.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleSelectAllFiltered}
                  className="text-xs h-7 px-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20"
                >
                  {(() => {
                    const filteredUsers = users.filter((user) => {
                      if (!userSearch.trim()) return true;
                      const searchLower = userSearch.toLowerCase();
                      const displayName = user.adherent
                        ? `${user.adherent.firstname} ${user.adherent.lastname}`.toLowerCase()
                        : (user.name || user.email || "").toLowerCase();
                      return (
                        displayName.includes(searchLower) ||
                        user.email?.toLowerCase().includes(searchLower)
                      );
                    });
                    const allSelected = filteredUsers.every(u => selectedUserIds.includes(u.id));
                    return allSelected ? "Tout désélectionner" : "Tout sélectionner";
                  })()}
                </Button>
              )}
            </div>

            {/* Liste des adhérents */}
            <div className="space-y-2">
              <Label>
                Adhérents ({selectedUserIds.length} sélectionné{selectedUserIds.length > 1 ? "s" : ""})
              </Label>
              <ScrollArea className="h-[300px] border rounded-md p-4 bg-gray-50/50 dark:bg-gray-900/50">
                <div className="space-y-2">
                  {users.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Aucun adhérent disponible
                    </p>
                  ) : (() => {
                    // Filtrer les utilisateurs selon la recherche
                    const filteredUsers = users.filter((user) => {
                      if (!userSearch.trim()) return true;
                      const searchLower = userSearch.toLowerCase();
                      const displayName = user.adherent
                        ? `${user.adherent.firstname} ${user.adherent.lastname}`.toLowerCase()
                        : (user.name || user.email || "").toLowerCase();
                      return (
                        displayName.includes(searchLower) ||
                        user.email?.toLowerCase().includes(searchLower)
                      );
                    });

                    if (filteredUsers.length === 0) {
                      return (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          Aucun adhérent trouvé pour "{userSearch}"
                        </p>
                      );
                    }

                    return filteredUsers.map((user) => {
                      const displayName = user.adherent
                        ? `${user.adherent.firstname} ${user.adherent.lastname}`
                        : user.name || user.email || "Utilisateur sans nom";
                      
                      return (
                        <div
                          key={user.id}
                          className="flex items-center space-x-3 p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                          onClick={() => handleToggleUser(user.id)}
                        >
                          <Checkbox
                            checked={selectedUserIds.includes(user.id)}
                            onCheckedChange={() => handleToggleUser(user.id)}
                          />
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={user.image || undefined} />
                            <AvatarFallback>
                              {displayName.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{displayName}</p>
                            {user.email && (
                              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                            )}
                          </div>
                          <Badge variant="secondary" className="text-xs flex-shrink-0">
                            {user.role}
                          </Badge>
                        </div>
                      );
                    });
                  })()}
                </div>
              </ScrollArea>
            </div>

            {/* Compteur de sélection */}
            {selectedUserIds.length > 0 && (
              <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <p className="text-sm font-medium text-green-800 dark:text-green-300 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  {selectedUserIds.length} adhérent{selectedUserIds.length > 1 ? "s" : ""} sélectionné{selectedUserIds.length > 1 ? "s" : ""}
                </p>
              </div>
            )}

            {/* Raison de l'attribution */}
            <div className="space-y-2">
              <Label htmlFor="raison">Raison de l'attribution (optionnel)</Label>
              <Textarea
                id="raison"
                value={raisonAttribution}
                onChange={(e) => setRaisonAttribution(e.target.value)}
                placeholder="Ex: Excellence académique 2025, Bonne conduite, Participation exceptionnelle..."
                rows={3}
                className="resize-none"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button 
              variant="outline" 
              onClick={() => {
                setShowAttribuerDialog(false);
                setSelectedUserIds([]);
                setUserSearch("");
                setRaisonAttribution("");
              }}
            >
              Annuler
            </Button>
            <Button 
              onClick={handleAttribuer}
              disabled={selectedUserIds.length === 0}
              className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Attribuer à {selectedUserIds.length} adhérent{selectedUserIds.length > 1 ? "s" : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

