"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createColumnHelper,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import {
  ClipboardList,
  Plus,
  Search,
  Eye,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Copy,
  Ban,
  Send,
} from "lucide-react";
import { toast } from "react-toastify";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataTable } from "@/components/admin/DataTable";
import { ColumnVisibilityToggle } from "@/components/admin/ColumnVisibilityToggle";
import { ensureSondagesMenu } from "@/actions/menus/ensure-sondages-menu";
import {
  closeSondage,
  duplicateSondage,
  getSondagesAdmin,
  publishSondage,
} from "@/actions/sondages";

type SondageRow = {
  id: string;
  sujet: string;
  dateDebut: string;
  dateFin: string;
  status: string;
  questionCount: number;
  reponseCount: number;
  createdByName: string;
  createdAt: string;
};

const columnHelper = createColumnHelper<SondageRow>();

const STATUS_LABELS: Record<string, string> = {
  Brouillon: "Brouillon",
  Ouvert: "Ouvert",
  Cloture: "Clôturé",
};

const STATUS_COLORS: Record<string, string> = {
  Brouillon: "bg-slate-100 text-slate-800",
  Ouvert: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  Cloture: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Page admin : liste des sondages
 */
export default function AdminSondagesPage() {
  const router = useRouter();
  const [data, setData] = useState<SondageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [globalFilter, setGlobalFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("admin-sondages-column-visibility");
        if (saved) return JSON.parse(saved);
        if (window.innerWidth < 768) {
          return { createdByName: false, createdAt: false, questionCount: false };
        }
      } catch {
        /* ignore */
      }
    }
    return {};
  });

  useEffect(() => {
    const t = setTimeout(() => setGlobalFilter(searchTerm), 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      await ensureSondagesMenu();
      const res = await getSondagesAdmin();
      if (res.success && res.data) {
        setData(res.data);
      } else {
        toast.error(res.error || "Erreur de chargement");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredData = useMemo(() => {
    return data.filter((row) => {
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      if (globalFilter.trim()) {
        const q = globalFilter.toLowerCase();
        const text = [row.sujet, row.createdByName, row.status].join(" ").toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }, [data, globalFilter, statusFilter]);

  const handlePublish = async (id: string) => {
    const res = await publishSondage(id);
    if (res.success) {
      toast.success(res.message || "Sondage publié");
      loadData();
    } else {
      toast.error(res.error || "Erreur");
    }
  };

  const handleClose = async (id: string) => {
    if (!confirm("Clôturer ce sondage ? Les adhérents ne pourront plus modifier leurs réponses.")) return;
    const res = await closeSondage(id);
    if (res.success) {
      toast.success(res.message || "Sondage clôturé");
      loadData();
    } else {
      toast.error(res.error || "Erreur");
    }
  };

  const handleDuplicate = async (row: SondageRow) => {
    const sujet = prompt("Sujet du nouveau sondage (unique) :", `${row.sujet} (copie)`);
    if (!sujet?.trim()) return;

    const res = await duplicateSondage({
      sourceId: row.id,
      sujet: sujet.trim(),
      dateDebut: new Date(),
      dateFin: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    });

    if (res.success && res.id) {
      toast.success(res.message || "Sondage dupliqué");
      router.push(`/admin/sondages/${res.id}`);
    } else {
      toast.error(res.error || "Erreur");
    }
  };

  const columns = useMemo(
    () => [
      columnHelper.accessor("sujet", {
        header: "Sujet",
        cell: ({ row }) => (
          <span className="font-medium text-sm text-slate-900 dark:text-slate-100">
            {row.getValue("sujet")}
          </span>
        ),
        size: 220,
        minSize: 150,
        enableResizing: true,
      }),
      columnHelper.accessor("status", {
        header: "Statut",
        cell: ({ row }) => {
          const s = row.getValue("status") as string;
          return (
            <Badge className={STATUS_COLORS[s] || ""}>{STATUS_LABELS[s] || s}</Badge>
          );
        },
        size: 100,
        minSize: 90,
        enableResizing: true,
      }),
      columnHelper.accessor("reponseCount", {
        header: "Réponses",
        cell: ({ row }) => (
          <span className="text-sm text-center block">{row.getValue("reponseCount")}</span>
        ),
        size: 90,
        minSize: 80,
        enableResizing: true,
      }),
      columnHelper.accessor("questionCount", {
        header: "Questions",
        cell: ({ row }) => (
          <span className="text-sm text-center block">{row.getValue("questionCount")}</span>
        ),
        size: 100,
        minSize: 80,
        enableResizing: true,
      }),
      columnHelper.accessor("dateFin", {
        header: "Clôture",
        cell: ({ row }) => (
          <span className="text-sm whitespace-nowrap">{formatDate(row.getValue("dateFin"))}</span>
        ),
        size: 120,
        minSize: 100,
        enableResizing: true,
      }),
      columnHelper.accessor("createdByName", {
        header: "Créé par",
        cell: ({ row }) => <span className="text-sm">{row.getValue("createdByName")}</span>,
        size: 140,
        minSize: 100,
        enableResizing: true,
      }),
      columnHelper.accessor("createdAt", {
        header: "Créé le",
        cell: ({ row }) => (
          <span className="text-sm whitespace-nowrap">{formatDate(row.getValue("createdAt"))}</span>
        ),
        size: 120,
        minSize: 100,
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
            <div className="flex items-center gap-1">
              <Link href={`/admin/sondages/${item.id}`}>
                <Button variant="outline" size="sm" className="h-7 w-7 p-0 border-blue-300 hover:bg-blue-50">
                  <Eye className="h-3.5 w-3.5" />
                </Button>
              </Link>
              {item.status === "Brouillon" && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 w-7 p-0 border-green-300 hover:bg-green-50"
                  title="Publier"
                  onClick={() => handlePublish(item.id)}
                >
                  <Send className="h-3.5 w-3.5" />
                </Button>
              )}
              {item.status === "Ouvert" && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 w-7 p-0 border-red-300 hover:bg-red-50"
                  title="Clôturer"
                  onClick={() => handleClose(item.id)}
                >
                  <Ban className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className="h-7 w-7 p-0 border-blue-300 hover:bg-blue-50"
                title="Dupliquer"
                onClick={() => handleDuplicate(item)}
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          );
        },
        size: 140,
        minSize: 120,
        maxSize: 160,
      }),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
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
      const next = typeof updater === "function" ? updater(columnVisibility) : updater;
      setColumnVisibility(next);
      try {
        localStorage.setItem("admin-sondages-column-visibility", JSON.stringify(next));
      } catch {
        /* ignore */
      }
    },
    initialState: { pagination: { pageSize: 10 } },
    state: { sorting, columnFilters, globalFilter, columnVisibility },
    defaultColumn: { minSize: 50, maxSize: 800 },
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 p-4 sm:p-6">
      <Card className="mx-auto max-w-7xl shadow-lg border-blue-200 dark:border-slate-700">
        <CardHeader className="bg-gradient-to-r from-blue-500/90 to-blue-600/90 dark:from-blue-600/90 dark:to-blue-700/90 text-white rounded-t-lg pb-3 sm:pb-4 pt-3 sm:pt-4 px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0">
            <div>
              <CardTitle className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2 sm:gap-3">
                <ClipboardList className="h-5 w-5 sm:h-6 sm:w-6" />
                Sondages ({filteredData.length})
              </CardTitle>
              <CardDescription className="text-blue-100 dark:text-blue-200 mt-1 sm:mt-2 text-sm sm:text-base">
                Créer, publier et suivre les sondages destinés aux adhérents
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <ColumnVisibilityToggle table={table} storageKey="admin-sondages-column-visibility" />
              <Link href="/admin/sondages/nouveau" className="w-full sm:w-auto">
                <Button className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg">
                  <Plus className="h-4 w-4 mr-2" />
                  Nouveau sondage
                </Button>
              </Link>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Rechercher..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="Brouillon">Brouillon</SelectItem>
                <SelectItem value="Ouvert">Ouvert</SelectItem>
                <SelectItem value="Cloture">Clôturé</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : (
            <>
              <div className="mb-4 text-sm text-muted-foreground">
                {filteredData.length} sondage(s)
              </div>
              <DataTable table={table} emptyMessage="Aucun sondage" compact headerBold headerUppercase={false} />

              <div className="bg-white dark:bg-gray-800 mt-5 flex flex-col sm:flex-row items-center justify-between py-5 px-4 font-semibold rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 gap-4">
                <div className="text-sm text-muted-foreground">
                  {table.getFilteredRowModel().rows.length} ligne(s) au total
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">Lignes par page</p>
                    <Select
                      value={`${table.getState().pagination.pageSize}`}
                      onValueChange={(v) => table.setPageSize(Number(v))}
                    >
                      <SelectTrigger className="h-8 w-[70px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent side="top">
                        {[10, 20, 30, 50].map((n) => (
                          <SelectItem key={n} value={`${n}`}>
                            {n}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <span className="text-sm">
                    Page {table.getState().pagination.pageIndex + 1} / {table.getPageCount() || 1}
                  </span>
                  <div className="flex gap-1">
                    <Button variant="outline" className="h-8 w-8 p-0 hidden lg:flex" onClick={() => table.setPageIndex(0)} disabled={!table.getCanPreviousPage()}>
                      <ChevronsLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" className="h-8 w-8 p-0" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" className="h-8 w-8 p-0" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" className="h-8 w-8 p-0 hidden lg:flex" onClick={() => table.setPageIndex(table.getPageCount() - 1)} disabled={!table.getCanNextPage()}>
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
  );
}
