"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Activity, Search, Filter, Download, RefreshCw, Calendar, User, FileText, Trash2, Edit, Eye, CheckCircle2, XCircle, AlertCircle, ChevronsLeft, ChevronsRight, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "react-toastify";
import { getUserActivities, getActivityStats } from "@/actions/admin/activities";
import { ensureActivitiesMenu } from "@/actions/menus/ensure-activities-menu";
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
import { useActivityLogger } from "@/hooks/use-activity-logger";

// Types pour les activités
type ActivityType = "Connexion" | "Deconnexion" | "Creation" | "Modification" | "Suppression" | "Consultation" | "Export" | "Import" | "Authentification" | "ChangementMotDePasse" | "Autre";

interface UserActivity {
  id: string;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  type: ActivityType;
  action: string;
  entityType: string | null;
  entityId: string | null;
  details: any;
  ipAddress: string | null;
  userAgent: string | null;
  url: string | null;
  success: boolean;
  errorMessage: string | null;
  createdAt: Date;
  User: {
    id: string;
    name: string | null;
    email: string | null;
    role: string;
    image: string | null;
  } | null;
}

const columnHelper = createColumnHelper<UserActivity>();

// Fonction pour obtenir l'icône selon le type
const getTypeIcon = (type: ActivityType) => {
  switch (type) {
    case "Creation":
      return <FileText className="h-4 w-4 text-green-600" />;
    case "Modification":
      return <Edit className="h-4 w-4 text-blue-600" />;
    case "Suppression":
      return <Trash2 className="h-4 w-4 text-red-600" />;
    case "Consultation":
      return <Eye className="h-4 w-4 text-purple-600" />;
    case "Export":
      return <Download className="h-4 w-4 text-indigo-600" />;
    case "Connexion":
      return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
    case "Deconnexion":
      return <XCircle className="h-4 w-4 text-gray-600" />;
    default:
      return <Activity className="h-4 w-4 text-gray-600" />;
  }
};

// Fonction pour obtenir la couleur du badge selon le type
const getTypeBadgeColor = (type: ActivityType) => {
  switch (type) {
    case "Creation":
      return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800";
    case "Modification":
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800";
    case "Suppression":
      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800";
    case "Consultation":
      return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border-purple-200 dark:border-purple-800";
    case "Export":
      return "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800";
    case "Connexion":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800";
    case "Deconnexion":
      return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-700";
    default:
      return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-700";
  }
};

export default function AdminActivitiesPage() {
  const [data, setData] = useState<UserActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    last24h: 0,
    last7d: 0,
    last30d: 0,
    errors: 0,
  });
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [successFilter, setSuccessFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [pagination, setPagination] = useState({
    total: 0,
    totalPages: 0,
  });
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("admin-activities-column-visibility");
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
      const [activitiesResult, statsResult] = await Promise.all([
        getUserActivities(
          page,
          pageSize,
          typeFilter !== "all" ? (typeFilter as ActivityType) : undefined,
          undefined,
          undefined,
          searchTerm || undefined
        ),
        getActivityStats(),
      ]);

      if (activitiesResult.success && activitiesResult.activities) {
        setData(activitiesResult.activities);
        if (activitiesResult.pagination) {
          setPagination({
            total: activitiesResult.pagination.total,
            totalPages: activitiesResult.pagination.totalPages,
          });
        }
      } else {
        toast.error(activitiesResult.error || "Erreur lors du chargement des activités");
      }

      if (statsResult.success && statsResult.stats) {
        setStats({
          total: statsResult.stats.total || 0,
          last24h: statsResult.stats.last24h || 0,
          last7d: statsResult.stats.last7d || 0,
          last30d: statsResult.stats.last30d || 0,
          errors: statsResult.stats.errors || 0,
        });
      }
    } catch (error) {
      console.error("Erreur lors du chargement:", error);
      toast.error("Erreur lors du chargement des données");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, typeFilter, searchTerm]);

  useEffect(() => {
    loadData();
    // S'assurer que le menu existe dans la sidebar
    ensureActivitiesMenu().catch((error) => {
      console.error("Erreur lors de la vérification du menu:", error);
    });
  }, [loadData]);

  // Logger la consultation de la page
  useActivityLogger("Activités des utilisateurs", "UserActivity");

  // Filtrer les données
  const filteredData = useMemo(() => {
    return data.filter((item) => {
      // Filtre global (recherche)
      if (globalFilter.trim()) {
        const q = globalFilter.trim().toLowerCase();
        const searchText = [
          item.action || "",
          item.userName || "",
          item.userEmail || "",
          item.entityType || "",
        ].join(" ").toLowerCase();
        if (!searchText.includes(q)) return false;
      }

      // Filtre par succès
      if (successFilter !== "all") {
        const isSuccess = successFilter === "success";
        if (item.success !== isSuccess) return false;
      }

      return true;
    });
  }, [data, globalFilter, successFilter]);

  const columns = useMemo(() => [
    columnHelper.accessor("createdAt", {
      header: "Date",
      cell: ({ row }) => (
        <span className="text-sm text-gray-900 dark:text-gray-100">
          {format(new Date(row.getValue("createdAt")), "dd/MM/yyyy HH:mm", { locale: fr })}
        </span>
      ),
      size: 150,
      minSize: 120,
      maxSize: 180,
      enableResizing: true,
    }),
    columnHelper.accessor("type", {
      header: "Type",
      cell: ({ row }) => {
        const type = row.getValue("type") as ActivityType;
        return (
          <Badge className={`${getTypeBadgeColor(type)} text-xs border`}>
            <div className="flex items-center gap-1">
              {getTypeIcon(type)}
              <span>{type}</span>
            </div>
          </Badge>
        );
      },
      size: 140,
      minSize: 100,
      maxSize: 180,
      enableResizing: true,
    }),
    columnHelper.accessor("action", {
      header: "Action",
      cell: ({ row }) => (
        <span className="text-sm text-gray-900 dark:text-gray-100 font-medium">
          {row.getValue("action")}
        </span>
      ),
      size: 250,
      minSize: 200,
      maxSize: 400,
      enableResizing: true,
    }),
    columnHelper.accessor("User", {
      header: "Utilisateur",
      cell: ({ row }) => {
        const user = row.getValue("User");
        const userName = user?.name || row.original.userName || "Inconnu";
        const userEmail = user?.email || row.original.userEmail || "";
        return (
          <div className="flex flex-col">
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{userName}</span>
            {userEmail && (
              <span className="text-xs text-gray-500 dark:text-gray-400">{userEmail}</span>
            )}
          </div>
        );
      },
      size: 200,
      minSize: 150,
      maxSize: 300,
      enableResizing: true,
    }),
    columnHelper.accessor("entityType", {
      header: "Entité",
      cell: ({ row }) => {
        const entityType = row.getValue("entityType");
        const entityId = row.original.entityId;
        return (
          <div className="flex flex-col">
            {entityType && (
              <span className="text-sm text-gray-900 dark:text-gray-100">{entityType}</span>
            )}
            {entityId && (
              <span className="text-xs text-gray-500 dark:text-gray-400">ID: {entityId.substring(0, 8)}...</span>
            )}
          </div>
        );
      },
      size: 150,
      minSize: 100,
      maxSize: 200,
      enableResizing: true,
    }),
    columnHelper.accessor("success", {
      header: "Statut",
      cell: ({ row }) => {
        const success = row.getValue("success");
        return (
          <Badge
            className={
              success
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800"
            }
          >
            {success ? (
              <div className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                <span>Succès</span>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <XCircle className="h-3 w-3" />
                <span>Erreur</span>
              </div>
            )}
          </Badge>
        );
      },
      size: 100,
      minSize: 80,
      maxSize: 120,
      enableResizing: true,
    }),
    columnHelper.accessor("ipAddress", {
      header: "IP",
      cell: ({ row }) => (
        <span className="text-xs text-gray-600 dark:text-gray-400 font-mono">
          {row.getValue("ipAddress") || "N/A"}
        </span>
      ),
      size: 120,
      minSize: 100,
      maxSize: 150,
      enableResizing: true,
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
        localStorage.setItem("admin-activities-column-visibility", JSON.stringify(newVisibility));
      } catch (error) {
        console.error("Erreur lors de la sauvegarde des préférences:", error);
      }
    },
    initialState: {
      pagination: {
        pageSize: pageSize,
      },
    },
    state: { sorting, columnFilters, globalFilter, columnVisibility },
    defaultColumn: {
      minSize: 50,
      maxSize: 800,
    },
    manualPagination: true,
    pageCount: pagination.totalPages,
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-slate-900 dark:to-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card className="mx-auto max-w-7xl shadow-lg border-blue-200 dark:border-gray-700 !pt-0">
          <CardHeader className="bg-gradient-to-r from-blue-500/90 via-blue-400/80 to-blue-500/90 dark:from-blue-700/50 dark:via-blue-600/40 dark:to-blue-700/50 text-white !pt-0 rounded-t-lg">
            <div className="flex items-center justify-between pt-4 sm:pt-6 pb-4 sm:pb-6">
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Activités des utilisateurs ({stats.total})
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={loadData}
                disabled={loading}
                className="bg-white/10 hover:bg-white/20 border-white/30 text-white hover:text-white"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                Actualiser
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            {/* Statistiques */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
              <Card className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20">
                <CardContent className="p-3">
                  <div className="text-xs text-blue-600 dark:text-blue-400 font-semibold">Total</div>
                  <div className="text-lg font-bold text-blue-900 dark:text-blue-100">{stats.total}</div>
                </CardContent>
              </Card>
              <Card className="border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20">
                <CardContent className="p-3">
                  <div className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">24h</div>
                  <div className="text-lg font-bold text-emerald-900 dark:text-emerald-100">{stats.last24h}</div>
                </CardContent>
              </Card>
              <Card className="border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/20">
                <CardContent className="p-3">
                  <div className="text-xs text-purple-600 dark:text-purple-400 font-semibold">7 jours</div>
                  <div className="text-lg font-bold text-purple-900 dark:text-purple-100">{stats.last7d}</div>
                </CardContent>
              </Card>
              <Card className="border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/20">
                <CardContent className="p-3">
                  <div className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold">30 jours</div>
                  <div className="text-lg font-bold text-indigo-900 dark:text-indigo-100">{stats.last30d}</div>
                </CardContent>
              </Card>
              <Card className="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
                <CardContent className="p-3">
                  <div className="text-xs text-red-600 dark:text-red-400 font-semibold">Erreurs</div>
                  <div className="text-lg font-bold text-red-900 dark:text-red-100">{stats.errors}</div>
                </CardContent>
              </Card>
            </div>

            {/* Filtres et recherche */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Rechercher par action, utilisateur, email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Type d'activité" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les types</SelectItem>
                  <SelectItem value="Connexion">Connexion</SelectItem>
                  <SelectItem value="Creation">Création</SelectItem>
                  <SelectItem value="Modification">Modification</SelectItem>
                  <SelectItem value="Suppression">Suppression</SelectItem>
                  <SelectItem value="Consultation">Consultation</SelectItem>
                  <SelectItem value="Export">Export</SelectItem>
                </SelectContent>
              </Select>
              <Select value={successFilter} onValueChange={setSuccessFilter}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="success">Succès uniquement</SelectItem>
                  <SelectItem value="error">Erreurs uniquement</SelectItem>
                </SelectContent>
              </Select>
              <ColumnVisibilityToggle
                table={table}
                storageKey="admin-activities-column-visibility"
              />
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              </div>
            ) : (
              <>
                <div className="mb-4 text-sm text-gray-600 dark:text-gray-300">
                  {filteredData.length} activité(s) trouvée(s)
                </div>
                <DataTable table={table} emptyMessage="Aucune activité trouvée" />
                
                {/* Pagination - Masquée sur mobile */}
                <div className="hidden md:flex bg-white dark:bg-gray-800 mt-5 flex-col sm:flex-row items-center justify-between py-5 font-semibold rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 gap-4">
                  <div className="ml-5 flex-1 text-sm text-muted-foreground dark:text-gray-400">
                    {pagination.total} activité(s) au total
                  </div>

                  <div className="flex items-center space-x-6 lg:space-x-8">
                    <div className="flex items-center space-x-2">
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Lignes par page</p>
                      <Select
                        value={`${pageSize}`}
                        onValueChange={(value) => {
                          setPageSize(Number(value));
                          setPage(1);
                        }}
                      >
                        <SelectTrigger className="h-8 w-[70px]">
                          <SelectValue placeholder={pageSize} />
                        </SelectTrigger>
                        <SelectContent side="top">
                          {[10, 20, 50, 100].map((size) => (
                            <SelectItem key={size} value={`${size}`}>
                              {size}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex w-[100px] items-center justify-center text-sm font-medium text-gray-700 dark:text-gray-300">
                      Page {page} sur {pagination.totalPages || 1}
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        className="hidden h-8 w-8 p-0 lg:flex"
                        onClick={() => setPage(1)}
                        disabled={page === 1}
                      >
                        <span className="sr-only">Aller à la première page</span>
                        <ChevronsLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        className="h-8 w-8 p-0"
                        onClick={() => setPage(Math.max(1, page - 1))}
                        disabled={page === 1}
                      >
                        <span className="sr-only">Page précédente</span>
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        className="h-8 w-8 p-0"
                        onClick={() => setPage(Math.min(pagination.totalPages || 1, page + 1))}
                        disabled={page >= (pagination.totalPages || 1)}
                      >
                        <span className="sr-only">Page suivante</span>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        className="hidden h-8 w-8 p-0 lg:flex"
                        onClick={() => setPage(pagination.totalPages || 1)}
                        disabled={page >= (pagination.totalPages || 1)}
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
    </div>
  );
}
