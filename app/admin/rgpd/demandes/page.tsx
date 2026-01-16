"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import {
  Shield,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  FileDown,
  Trash2,
  Eye,
  AlertTriangle,
  Download,
} from "lucide-react";
import { getAllDataDeletionRequests, verifyDataDeletionRequest, approveDataDeletionRequest, rejectDataDeletionRequest, exportUserData, completeDataDeletionRequest } from "@/actions/rgpd";
import { ensureRGPDMenu } from "@/actions/menus/ensure-rgpd-menu";
import { DataTable } from "@/components/admin/DataTable";
import { ColumnVisibilityToggle } from "@/components/admin/ColumnVisibilityToggle";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
// Type pour le statut (sera disponible après régénération Prisma)
type StatutDemandeSuppression = "EnAttente" | "EnVerification" | "Approuvee" | "Rejetee" | "Completee" | "Annulee";

type DataDeletionRequestData = {
  id: string;
  userId: string;
  userEmail: string;
  userName: string | null;
  message: string | null;
  statut: StatutDemandeSuppression;
  verifiedAt: Date | null;
  verifiedBy: string | null;
  verifiedByName: string | null;
  approvedAt: Date | null;
  approvedBy: string | null;
  approvedByName: string | null;
  rejectedAt: Date | null;
  rejectedBy: string | null;
  rejectedByName: string | null;
  rejectionReason: string | null;
  completedAt: Date | null;
  completedBy: string | null;
  completedByName: string | null;
  dataExported: boolean;
  exportPath: string | null;
  createdAt: Date;
  updatedAt: Date;
  User: {
    id: string;
    name: string | null;
    email: string | null;
    role: string;
    adherent: {
      firstname: string | null;
      lastname: string | null;
    } | null;
  };
};

const columnHelper = createColumnHelper<DataDeletionRequestData>();

export default function AdminRGPDDemandesPage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const [requests, setRequests] = useState<DataDeletionRequestData[]>([]);
  const [loading, setLoading] = useState(true);
  const [sorting, setSorting] = useState<SortingState>([{ id: "createdAt", desc: true }]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedRequest, setSelectedRequest] = useState<DataDeletionRequestData | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("admin-rgpd-demandes-column-visibility");
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
    if (sessionStatus === "loading") return;

    if (!session?.user || session.user.role !== "Admin") {
      router.push("/");
      return;
    }

    try {
      setLoading(true);
      const result = await getAllDataDeletionRequests();

      if (result.success && result.data) {
        setRequests(result.data);
      } else {
        toast.error(result.error || "Erreur lors du chargement des demandes");
      }
    } catch (error) {
      console.error("Erreur lors du chargement des données:", error);
      toast.error("Erreur lors du chargement des demandes");
    } finally {
      setLoading(false);
    }
  }, [session, sessionStatus, router]);

  useEffect(() => {
    loadData();
    // S'assurer que le menu RGPD existe dans la sidebar
    ensureRGPDMenu().catch((error) => {
      console.error("Erreur lors de la vérification du menu RGPD:", error);
    });
  }, [loadData]);

  const filteredData = useMemo(() => {
    return requests.filter((item) => {
      if (globalFilter.trim()) {
        const q = globalFilter.trim().toLowerCase();
        const searchText = [
          item.userEmail || "",
          item.userName || "",
          item.User?.name || "",
          item.User?.adherent?.firstname || "",
          item.User?.adherent?.lastname || "",
          item.message || "",
        ]
          .join(" ")
          .toLowerCase();
        if (!searchText.includes(q)) return false;
      }

      if (statusFilter !== "all" && item.statut !== statusFilter) {
        return false;
      }

      return true;
    });
  }, [requests, globalFilter, statusFilter]);

  const getStatusBadge = (statut: StatutDemandeSuppression) => {
    const statusConfig: Record<StatutDemandeSuppression, { label: string; className: string; icon: any }> = {
      EnAttente: {
        label: "En attente",
        className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400",
        icon: Clock,
      },
      EnVerification: {
        label: "En vérification",
        className: "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400",
        icon: Eye,
      },
      Approuvee: {
        label: "Approuvée",
        className: "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400",
        icon: CheckCircle2,
      },
      Rejetee: {
        label: "Rejetée",
        className: "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400",
        icon: XCircle,
      },
      Completee: {
        label: "Complétée",
        className: "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400",
        icon: CheckCircle2,
      },
      Annulee: {
        label: "Annulée",
        className: "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400",
        icon: XCircle,
      },
    };

    const config = statusConfig[statut];
    const Icon = config.icon;

    return (
      <Badge className={`${config.className} flex items-center gap-1`}>
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const handleVerify = async (requestId: string) => {
    setActionLoading(requestId);
    try {
      const result = await verifyDataDeletionRequest(requestId);
      if (result.success) {
        toast.success(result.message);
        await loadData();
      } else {
        toast.error(result.error || "Erreur lors de la vérification");
      }
    } catch (error) {
      toast.error("Erreur lors de la vérification");
    } finally {
      setActionLoading(null);
    }
  };

  const handleApprove = async (requestId: string) => {
    setActionLoading(requestId);
    try {
      const result = await approveDataDeletionRequest(requestId);
      if (result.success) {
        toast.success(result.message);
        await loadData();
      } else {
        toast.error(result.error || "Erreur lors de l'approbation");
      }
    } catch (error) {
      toast.error("Erreur lors de l'approbation");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    if (!selectedRequest || !rejectReason || rejectReason.length < 10) {
      toast.error("Veuillez fournir une raison d'au moins 10 caractères");
      return;
    }

    setActionLoading(selectedRequest.id);
    try {
      const formData = new FormData();
      formData.append("requestId", selectedRequest.id);
      formData.append("reason", rejectReason);

      const result = await rejectDataDeletionRequest(formData);
      if (result.success) {
        toast.success(result.message);
        setRejectDialogOpen(false);
        setRejectReason("");
        setSelectedRequest(null);
        await loadData();
      } else {
        toast.error(result.error || "Erreur lors du rejet");
      }
    } catch (error) {
      toast.error("Erreur lors du rejet");
    } finally {
      setActionLoading(null);
    }
  };

  const handleExport = async (userId: string, requestId: string) => {
    setActionLoading(`export-${requestId}`);
    try {
      const result = await exportUserData(userId);
      if (result.success) {
        toast.success("Données exportées avec succès");
        await loadData();
      } else {
        toast.error(result.error || "Erreur lors de l'export");
      }
    } catch (error) {
      toast.error("Erreur lors de l'export");
    } finally {
      setActionLoading(null);
    }
  };

  const handleComplete = async (requestId: string, userId: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer définitivement toutes les données de cet utilisateur ? Cette action est irréversible.")) {
      return;
    }

    setActionLoading(`complete-${requestId}`);
    try {
      const result = await completeDataDeletionRequest(requestId);
      if (result.success) {
        toast.success(result.message);
        await loadData();
      } else {
        toast.error(result.error || "Erreur lors de la suppression");
      }
    } catch (error) {
      toast.error("Erreur lors de la suppression");
    } finally {
      setActionLoading(null);
    }
  };

  const columns = useMemo(
    () => [
      columnHelper.accessor("createdAt", {
        header: () => <div className="text-center w-full">Date demande</div>,
        cell: ({ row }) => {
          const date = new Date(row.getValue("createdAt"));
          return (
            <div className="text-center">
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {format(date, "dd/MM/yyyy", { locale: fr })}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {format(date, "HH:mm", { locale: fr })}
              </div>
            </div>
          );
        },
        size: 120,
        minSize: 100,
        maxSize: 150,
        enableResizing: true,
      }),
      columnHelper.accessor("userEmail", {
        header: () => <div className="text-center w-full">Utilisateur</div>,
        cell: ({ row }) => {
          const item = row.original;
          const fullName = item.userName || (item.User?.adherent 
            ? `${item.User.adherent.firstname || ""} ${item.User.adherent.lastname || ""}`.trim()
            : item.User?.name || "N/A");
          return (
            <div className="text-center">
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {fullName}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {item.userEmail}
              </div>
            </div>
          );
        },
        size: 200,
        minSize: 150,
        maxSize: 300,
        enableResizing: true,
      }),
      columnHelper.accessor("statut", {
        header: () => <div className="text-center w-full">Statut</div>,
        cell: ({ row }) => {
          return <div className="text-center">{getStatusBadge(row.getValue("statut"))}</div>;
        },
        size: 150,
        minSize: 120,
        maxSize: 200,
        enableResizing: true,
      }),
      columnHelper.accessor("message", {
        header: () => <div className="text-center w-full">Message</div>,
        cell: ({ row }) => {
          const message = row.getValue("message") as string | null;
          return (
            <div className="text-center max-w-xs mx-auto">
              <div className="text-sm text-gray-900 dark:text-gray-100 line-clamp-2" title={message || ""}>
                {message || "Aucun message"}
              </div>
            </div>
          );
        },
        size: 200,
        minSize: 150,
        maxSize: 300,
        enableResizing: true,
      }),
      columnHelper.accessor("dataExported", {
        header: () => <div className="text-center w-full">Export</div>,
        cell: ({ row }) => {
          const exported = row.getValue("dataExported") as boolean;
          return (
            <div className="text-center">
              {exported ? (
                <Badge className="bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Oui
                </Badge>
              ) : (
                <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400">
                  Non
                </Badge>
              )}
            </div>
          );
        },
        size: 100,
        minSize: 80,
        maxSize: 120,
        enableResizing: true,
      }),
      columnHelper.display({
        id: "actions",
        header: () => <div className="text-center w-full">Actions</div>,
        meta: { forceVisible: true },
        enableResizing: false,
        cell: ({ row }) => {
          const request = row.original;
          const isLoading = actionLoading === request.id || actionLoading?.startsWith(`export-${request.id}`) || actionLoading?.startsWith(`complete-${request.id}`);

          return (
            <div className="flex items-center justify-center gap-1">
              {request.statut === "EnAttente" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleVerify(request.id)}
                  disabled={isLoading}
                  className="h-7 w-7 sm:h-8 sm:w-8 p-0 border-blue-300 hover:bg-blue-50"
                  title="Vérifier l'identité"
                >
                  {isLoading ? (
                    <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
                  ) : (
                    <Eye className="h-3 w-3 sm:h-4 sm:w-4" />
                  )}
                </Button>
              )}
              {(request.statut === "EnVerification" || request.statut === "EnAttente") && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleApprove(request.id)}
                    disabled={isLoading}
                    className="h-7 w-7 sm:h-8 sm:w-8 p-0 border-green-300 hover:bg-green-50"
                    title="Approuver"
                  >
                    {isLoading ? (
                      <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-3 w-3 sm:h-4 sm:w-4" />
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelectedRequest(request);
                      setRejectDialogOpen(true);
                    }}
                    disabled={isLoading}
                    className="h-7 w-7 sm:h-8 sm:w-8 p-0 border-red-300 hover:bg-red-50"
                    title="Rejeter"
                  >
                    <XCircle className="h-3 w-3 sm:h-4 sm:w-4" />
                  </Button>
                </>
              )}
              {request.statut === "Approuvee" && !request.dataExported && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleExport(request.userId, request.id)}
                  disabled={isLoading}
                  className="h-7 w-7 sm:h-8 sm:w-8 p-0 border-purple-300 hover:bg-purple-50"
                  title="Exporter les données"
                >
                  {isLoading ? (
                    <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
                  ) : (
                    <Download className="h-3 w-3 sm:h-4 sm:w-4" />
                  )}
                </Button>
              )}
              {request.statut === "Approuvee" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleComplete(request.id, request.userId)}
                  disabled={isLoading}
                  className="h-7 w-7 sm:h-8 sm:w-8 p-0 border-red-300 hover:bg-red-50"
                  title="Supprimer les données"
                >
                  {isLoading ? (
                    <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                  )}
                </Button>
              )}
            </div>
          );
        },
        size: 200,
        minSize: 180,
        maxSize: 250,
      }),
    ],
    [actionLoading, handleVerify, handleApprove, handleExport, handleComplete]
  );

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
        localStorage.setItem("admin-rgpd-demandes-column-visibility", JSON.stringify(newVisibility));
      } catch (error) {
        console.error("Erreur lors de la sauvegarde des préférences:", error);
      }
    },
    initialState: {
      pagination: {
        pageSize: 20,
      },
    },
    state: { sorting, columnFilters, globalFilter, columnVisibility },
    defaultColumn: {
      minSize: 50,
      maxSize: 800,
    },
  });

  if (sessionStatus === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const stats = useMemo(() => {
    return {
      total: requests.length,
      enAttente: requests.filter((r) => r.statut === "EnAttente").length,
      enVerification: requests.filter((r) => r.statut === "EnVerification").length,
      approuvees: requests.filter((r) => r.statut === "Approuvee").length,
      completees: requests.filter((r) => r.statut === "Completee").length,
    };
  }, [requests]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <Card className="mx-auto max-w-7xl shadow-lg border-blue-200 dark:border-gray-700 !pt-0">
          <CardHeader className="bg-gradient-to-r from-blue-500/90 via-blue-400/80 to-blue-500/90 dark:from-blue-700/50 dark:via-blue-600/40 dark:to-blue-700/50 text-white !pt-0 rounded-t-lg flex items-center">
            <div className="pt-4 sm:pt-6 pb-4 sm:pb-6 flex items-center">
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Demandes de suppression de données (RGPD) ({stats.total})
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            {/* Statistiques */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
              <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.total}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Total</div>
                </CardContent>
              </Card>
              <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{stats.enAttente}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">En attente</div>
                </CardContent>
              </Card>
              <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.enVerification}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">En vérification</div>
                </CardContent>
              </Card>
              <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.approuvees}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Approuvées</div>
                </CardContent>
              </Card>
              <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-gray-600 dark:text-gray-400">{stats.completees}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Complétées</div>
                </CardContent>
              </Card>
            </div>

            {/* Filtres et recherche */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Rechercher par email, nom..."
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
                  <SelectItem value="EnAttente">En attente</SelectItem>
                  <SelectItem value="EnVerification">En vérification</SelectItem>
                  <SelectItem value="Approuvee">Approuvées</SelectItem>
                  <SelectItem value="Rejetee">Rejetées</SelectItem>
                  <SelectItem value="Completee">Complétées</SelectItem>
                  <SelectItem value="Annulee">Annulées</SelectItem>
                </SelectContent>
              </Select>
              <ColumnVisibilityToggle
                table={table}
                storageKey="admin-rgpd-demandes-column-visibility"
              />
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              </div>
            ) : (
              <>
                <div className="mb-4 text-sm text-gray-600 dark:text-gray-300">
                  {filteredData.length} demande(s) trouvée(s)
                </div>
                <DataTable table={table} emptyMessage="Aucune demande trouvée" headerColor="blue" />

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

        {/* Dialog de rejet */}
        <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Rejeter la demande de suppression</DialogTitle>
              <DialogDescription>
                Veuillez fournir une raison pour le rejet de cette demande (minimum 10 caractères).
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="rejectReason">Raison du rejet *</Label>
                <Textarea
                  id="rejectReason"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Ex: Identité non vérifiée, demande frauduleuse, etc."
                  rows={4}
                  className="mt-1.5"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {rejectReason.length}/10 caractères minimum
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setRejectDialogOpen(false);
                  setRejectReason("");
                  setSelectedRequest(null);
                }}
              >
                Annuler
              </Button>
              <Button
                onClick={handleReject}
                disabled={!rejectReason || rejectReason.length < 10 || actionLoading !== null}
                className="bg-red-600 hover:bg-red-700"
              >
                {actionLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Rejet en cours...
                  </>
                ) : (
                  "Rejeter la demande"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
