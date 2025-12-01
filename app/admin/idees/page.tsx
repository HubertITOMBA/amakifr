"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Lightbulb, 
  Search, 
  CheckCircle,
  XCircle,
  Ban,
  MessageSquare,
  Trash2,
  Eye,
  Calendar,
  User,
  ThumbsUp,
  AlertCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight
} from "lucide-react";
import { StatutIdee } from "@prisma/client";
import { 
  getAllIdeesForAdmin,
  validerIdee,
  rejeterIdee,
  bloquerIdee,
  supprimerCommentaire
} from "@/actions/idees";
import { toast } from "sonner";
import Link from "next/link";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  createColumnHelper,
  getCoreRowModel,
  useReactTable,
  getSortedRowModel,
  SortingState,
  getFilteredRowModel,
  ColumnFiltersState,
  VisibilityState,
  getPaginationRowModel,
} from "@tanstack/react-table";
import { DataTable } from "@/components/admin/DataTable";
import { ColumnVisibilityToggle } from "@/components/admin/ColumnVisibilityToggle";

interface IdeeWithRelations {
  id: string;
  titre: string;
  description: string;
  statut: StatutIdee;
  nombreCommentaires: number;
  nombreApprobations: number;
  dateCreation: Date;
  dateValidation: Date | null;
  dateRejet: Date | null;
  dateBlocage: Date | null;
  raisonRejet: string | null;
  estLue: boolean;
  Adherent: {
    id: string;
    firstname: string;
    lastname: string;
    User: {
      id: string;
      name: string | null;
      email: string | null;
      image: string | null;
    };
  };
  Commentaires: Array<{
    id: string;
    contenu: string;
    createdAt: Date;
    supprime: boolean;
    raisonSuppression: string | null;
    Adherent: {
      id: string;
      firstname: string;
      lastname: string;
      User: {
        id: string;
        name: string | null;
        email: string | null;
        image: string | null;
      };
    };
  }>;
  Approbations: Array<{
    id: string;
    adherentId: string;
  }>;
}

type IdeeData = {
  id: string;
  titre: string;
  auteur: string;
  dateCreation: Date;
  statut: StatutIdee;
  nombreCommentaires: number;
  nombreApprobations: number;
  description: string;
  raisonRejet: string | null;
  estLue: boolean;
  original: IdeeWithRelations;
};

const columnHelper = createColumnHelper<IdeeData>();

const getStatutBadge = (statut: StatutIdee) => {
  switch (statut) {
    case StatutIdee.Validee:
      return (
        <Badge className="bg-green-500 hover:bg-green-600">
          <CheckCircle className="h-3 w-3 mr-1" />
          Validée
        </Badge>
      );
    case StatutIdee.EnAttente:
      return (
        <Badge className="bg-yellow-500 hover:bg-yellow-600">
          <Clock className="h-3 w-3 mr-1" />
          En attente
        </Badge>
      );
    case StatutIdee.Rejetee:
      return (
        <Badge className="bg-red-500 hover:bg-red-600">
          <XCircle className="h-3 w-3 mr-1" />
          Rejetée
        </Badge>
      );
    case StatutIdee.Bloquee:
      return (
        <Badge className="bg-red-600 hover:bg-red-700">
          <Ban className="h-3 w-3 mr-1" />
          Bloquée
        </Badge>
      );
    default:
      return null;
  }
};

export default function AdminIdeesPage() {
  const [idees, setIdees] = useState<IdeeWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedIdee, setSelectedIdee] = useState<IdeeWithRelations | null>(null);
  const [showValiderDialog, setShowValiderDialog] = useState(false);
  const [showRejeterDialog, setShowRejeterDialog] = useState(false);
  const [showBloquerDialog, setShowBloquerDialog] = useState(false);
  const [showSupprimerCommentaireDialog, setShowSupprimerCommentaireDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [selectedCommentaire, setSelectedCommentaire] = useState<any>(null);
  const [raisonRejet, setRaisonRejet] = useState("");
  const [raisonSuppression, setRaisonSuppression] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // Visibilité des colonnes
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("admin-idees-column-visibility");
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

  const loadIdees = useCallback(async () => {
    try {
      setLoading(true);
      const result = await getAllIdeesForAdmin();
      if (result.success && result.data) {
        setIdees(result.data as IdeeWithRelations[]);
      } else {
        toast.error(result.error || "Erreur lors du chargement des idées");
      }
    } catch (error) {
      console.error("Erreur lors du chargement des idées:", error);
      toast.error("Erreur lors du chargement des idées");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadIdees();
  }, [loadIdees]);

  // Transformer les données pour la table
  const tableData = useMemo(() => {
    return idees.map((idee) => ({
      id: idee.id,
      titre: idee.titre,
      auteur: `${idee.Adherent.firstname} ${idee.Adherent.lastname}`,
      dateCreation: idee.dateCreation,
      statut: idee.statut,
      nombreCommentaires: idee.nombreCommentaires,
      nombreApprobations: idee.nombreApprobations,
      description: idee.description,
      raisonRejet: idee.raisonRejet,
      estLue: idee.estLue,
      original: idee,
    }));
  }, [idees]);

  // Filtrer les données
  const filteredData = useMemo(() => {
    return tableData.filter((idee) => {
      // Filtre global (recherche)
      if (globalFilter.trim()) {
        const q = globalFilter.trim().toLowerCase();
        const searchText = [
          idee.titre,
          idee.auteur,
          idee.description,
        ].join(" ").toLowerCase();
        if (!searchText.includes(q)) return false;
      }

      // Filtre par statut
      if (statusFilter !== "all" && idee.statut !== statusFilter) {
        return false;
      }

      return true;
    });
  }, [tableData, globalFilter, statusFilter]);

  const handleValider = async () => {
    if (!selectedIdee) return;

    try {
      setActionLoading(true);
      const formData = new FormData();
      formData.append("id", selectedIdee.id);

      const result = await validerIdee(formData);
      if (result.success) {
        toast.success(result.message || "Idée validée avec succès");
        setShowValiderDialog(false);
        setSelectedIdee(null);
        await loadIdees();
      } else {
        toast.error(result.error || "Erreur lors de la validation");
      }
    } catch (error) {
      console.error("Erreur lors de la validation:", error);
      toast.error("Erreur lors de la validation");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejeter = async () => {
    if (!selectedIdee || !raisonRejet.trim()) {
      toast.error("Veuillez saisir une raison de rejet");
      return;
    }

    try {
      setActionLoading(true);
      const formData = new FormData();
      formData.append("id", selectedIdee.id);
      formData.append("raisonRejet", raisonRejet);

      const result = await rejeterIdee(formData);
      if (result.success) {
        toast.success(result.message || "Idée rejetée avec succès");
        setShowRejeterDialog(false);
        setSelectedIdee(null);
        setRaisonRejet("");
        await loadIdees();
      } else {
        toast.error(result.error || "Erreur lors du rejet");
      }
    } catch (error) {
      console.error("Erreur lors du rejet:", error);
      toast.error("Erreur lors du rejet");
    } finally {
      setActionLoading(false);
    }
  };

  const handleBloquer = async () => {
    if (!selectedIdee || !raisonRejet.trim()) {
      toast.error("Veuillez saisir une raison de blocage");
      return;
    }

    try {
      setActionLoading(true);
      const formData = new FormData();
      formData.append("id", selectedIdee.id);
      formData.append("raisonRejet", raisonRejet);

      const result = await bloquerIdee(formData);
      if (result.success) {
        toast.success(result.message || "Idée bloquée avec succès");
        setShowBloquerDialog(false);
        setSelectedIdee(null);
        setRaisonRejet("");
        await loadIdees();
      } else {
        toast.error(result.error || "Erreur lors du blocage");
      }
    } catch (error) {
      console.error("Erreur lors du blocage:", error);
      toast.error("Erreur lors du blocage");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSupprimerCommentaire = async () => {
    if (!selectedCommentaire || !raisonSuppression.trim()) {
      toast.error("Veuillez saisir une raison de suppression");
      return;
    }

    try {
      setActionLoading(true);
      const formData = new FormData();
      formData.append("id", selectedCommentaire.id);
      formData.append("raisonSuppression", raisonSuppression);

      const result = await supprimerCommentaire(formData);
      if (result.success) {
        toast.success(result.message || "Commentaire supprimé avec succès");
        setShowSupprimerCommentaireDialog(false);
        setSelectedCommentaire(null);
        setRaisonSuppression("");
        await loadIdees();
      } else {
        toast.error(result.error || "Erreur lors de la suppression");
      }
    } catch (error) {
      console.error("Erreur lors de la suppression:", error);
      toast.error("Erreur lors de la suppression");
    } finally {
      setActionLoading(false);
    }
  };

  const columns = useMemo(() => [
    columnHelper.accessor("titre", {
      header: "Titre",
      cell: ({ row }) => (
        <div className="max-w-xs">
          <p className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">
            {row.getValue("titre")}
          </p>
        </div>
      ),
      size: 250,
      minSize: 200,
      maxSize: 400,
      enableResizing: true,
    }),
    columnHelper.accessor("auteur", {
      header: "Auteur",
      cell: ({ row }) => (
        <span className="text-sm text-gray-900 dark:text-gray-100">
          {row.getValue("auteur")}
        </span>
      ),
      size: 180,
      minSize: 150,
      maxSize: 250,
      enableResizing: true,
    }),
    columnHelper.accessor("dateCreation", {
      header: "Date de création",
      cell: ({ row }) => (
        <span className="text-sm text-gray-900 dark:text-gray-100">
          {format(new Date(row.getValue("dateCreation")), "d MMM yyyy", { locale: fr })}
        </span>
      ),
      size: 150,
      minSize: 120,
      maxSize: 200,
      enableResizing: true,
    }),
    columnHelper.accessor("statut", {
      header: "Statut",
      cell: ({ row }) => getStatutBadge(row.getValue("statut")),
      size: 140,
      minSize: 120,
      maxSize: 180,
      enableResizing: true,
    }),
    columnHelper.accessor("nombreCommentaires", {
      header: "Commentaires",
      cell: ({ row }) => (
        <div className="flex items-center gap-1 text-sm text-gray-900 dark:text-gray-100">
          <MessageSquare className="h-4 w-4" />
          <span>{row.getValue("nombreCommentaires")}</span>
        </div>
      ),
      size: 130,
      minSize: 100,
      maxSize: 150,
      enableResizing: true,
    }),
    columnHelper.accessor("nombreApprobations", {
      header: "Approbations",
      cell: ({ row }) => (
        <div className="flex items-center gap-1 text-sm text-gray-900 dark:text-gray-100">
          <ThumbsUp className="h-4 w-4" />
          <span>{row.getValue("nombreApprobations")}</span>
        </div>
      ),
      size: 130,
      minSize: 100,
      maxSize: 150,
      enableResizing: true,
    }),
    columnHelper.display({
      id: "actions",
      header: "Actions",
      meta: { forceVisible: true },
      enableResizing: false,
      cell: ({ row }) => {
        const idee = row.original.original;
        return (
          <div className="flex items-center gap-1 sm:gap-2">
            {idee.statut === StatutIdee.EnAttente && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSelectedIdee(idee);
                    setShowValiderDialog(true);
                  }}
                  className="h-7 w-7 sm:h-8 sm:w-8 p-0 border-green-300 hover:bg-green-50"
                  title="Valider"
                >
                  <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSelectedIdee(idee);
                    setRaisonRejet("");
                    setShowRejeterDialog(true);
                  }}
                  className="h-7 w-7 sm:h-8 sm:w-8 p-0 border-red-300 hover:bg-red-50"
                  title="Rejeter"
                >
                  <XCircle className="h-3 w-3 sm:h-4 sm:w-4" />
                </Button>
              </>
            )}
            {idee.statut !== StatutIdee.Bloquee && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setSelectedIdee(idee);
                  setRaisonRejet("");
                  setShowBloquerDialog(true);
                }}
                className="h-7 w-7 sm:h-8 sm:w-8 p-0 border-red-300 hover:bg-red-50"
                title="Bloquer"
              >
                <Ban className="h-3 w-3 sm:h-4 sm:w-4" />
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setSelectedIdee(idee);
                setShowDetailsDialog(true);
              }}
              className="h-7 w-7 sm:h-8 sm:w-8 p-0 border-blue-300 hover:bg-blue-50"
              title="Voir les détails"
            >
              <Eye className="h-3 w-3 sm:h-4 sm:w-4" />
            </Button>
          </div>
        );
      },
      size: 200,
      minSize: 180,
      maxSize: 250,
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
        localStorage.setItem("admin-idees-column-visibility", JSON.stringify(newVisibility));
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
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement des idées...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Lightbulb className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600" />
            Gestion des Idées
          </h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 mt-1 sm:mt-2">
            Gérez toutes les idées soumises par les adhérents
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <ColumnVisibilityToggle 
            table={table} 
            storageKey="admin-idees-column-visibility"
          />
        </div>
      </div>

      {/* Filtres */}
      <Card className="!py-0 border-2 border-slate-200 dark:border-slate-800/50 bg-white dark:bg-gray-900">
        <CardContent className="pt-4 sm:pt-6 pb-4 px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Rechercher une idée..."
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
                <SelectItem value={StatutIdee.EnAttente}>En attente</SelectItem>
                <SelectItem value={StatutIdee.Validee}>Validées</SelectItem>
                <SelectItem value={StatutIdee.Rejetee}>Rejetées</SelectItem>
                <SelectItem value={StatutIdee.Bloquee}>Bloquées</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="!py-0 border-2 border-amber-200 dark:border-amber-800/50 bg-white dark:bg-gray-900">
        <CardHeader className="pb-3 sm:pb-4 pt-3 sm:pt-4 px-4 sm:px-6 bg-gradient-to-r from-amber-100 to-amber-50 dark:from-amber-900/30 dark:to-amber-800/20 rounded-t-lg">
          <CardTitle className="flex items-center gap-2 text-lg sm:text-xl text-gray-700 dark:text-gray-200 font-bold">
            <Lightbulb className="h-5 w-5 text-amber-500 dark:text-amber-400" />
            Liste des idées ({filteredData.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 sm:pt-6 pb-4 px-4 sm:px-6">
          {filteredData.length === 0 ? (
            <div className="py-12 text-center">
              <Lightbulb className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-300 text-lg">
                {searchTerm || statusFilter !== "all" 
                  ? "Aucune idée ne correspond aux filtres" 
                  : "Aucune idée pour le moment"}
              </p>
            </div>
          ) : (
            <>
              <div className="mb-4 text-sm text-gray-600 dark:text-gray-300">
                {table.getFilteredRowModel().rows.length} idée(s) trouvée(s)
              </div>
              <DataTable table={table} emptyMessage="Aucune idée trouvée" compact={true} />
              
              {/* Pagination */}
              <div className="bg-white dark:bg-gray-800 mt-4 sm:mt-5 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-0 py-4 sm:py-5 font-semibold rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 px-4 sm:px-6">
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

      {/* Dialog Valider */}
      <Dialog open={showValiderDialog} onOpenChange={setShowValiderDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Valider l'idée</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir valider cette idée ? Elle sera visible par tous les adhérents.
            </DialogDescription>
          </DialogHeader>
          {selectedIdee && (
            <div className="space-y-4">
              <div>
                <p className="font-semibold">{selectedIdee.titre}</p>
                <p className="text-sm text-gray-600">
                  Par {selectedIdee.Adherent.firstname} {selectedIdee.Adherent.lastname}
                </p>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowValiderDialog(false)}>
                  Annuler
                </Button>
                <Button
                  onClick={handleValider}
                  disabled={actionLoading}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {actionLoading ? "Validation..." : "Valider"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog Rejeter */}
      <Dialog open={showRejeterDialog} onOpenChange={setShowRejeterDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeter l'idée</DialogTitle>
            <DialogDescription>
              Indiquez la raison du rejet. L'adhérent sera notifié par email.
            </DialogDescription>
          </DialogHeader>
          {selectedIdee && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="raison-rejet">Raison du rejet *</Label>
                <Textarea
                  id="raison-rejet"
                  value={raisonRejet}
                  onChange={(e) => setRaisonRejet(e.target.value)}
                  placeholder="Ex: Viole l'éthique de l'association, contient des propos diffamatoires..."
                  rows={4}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => {
                  setShowRejeterDialog(false);
                  setRaisonRejet("");
                }}>
                  Annuler
                </Button>
                <Button
                  onClick={handleRejeter}
                  disabled={actionLoading || !raisonRejet.trim()}
                  className="bg-red-600 hover:bg-red-700"
                >
                  {actionLoading ? "Rejet..." : "Rejeter"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog Bloquer */}
      <Dialog open={showBloquerDialog} onOpenChange={setShowBloquerDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bloquer l'idée</DialogTitle>
            <DialogDescription>
              Indiquez la raison du blocage. L'adhérent sera notifié par email.
            </DialogDescription>
          </DialogHeader>
          {selectedIdee && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="raison-blocage">Raison du blocage *</Label>
                <Textarea
                  id="raison-blocage"
                  value={raisonRejet}
                  onChange={(e) => setRaisonRejet(e.target.value)}
                  placeholder="Ex: Viole l'éthique de l'association, contient des propos diffamatoires..."
                  rows={4}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => {
                  setShowBloquerDialog(false);
                  setRaisonRejet("");
                }}>
                  Annuler
                </Button>
                <Button
                  onClick={handleBloquer}
                  disabled={actionLoading || !raisonRejet.trim()}
                  className="bg-red-600 hover:bg-red-700"
                >
                  {actionLoading ? "Blocage..." : "Bloquer"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog Détails */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Détails de l'idée</DialogTitle>
            <DialogDescription>
              Informations complètes et commentaires
            </DialogDescription>
          </DialogHeader>
          {selectedIdee && (
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-semibold">Titre</Label>
                <p className="text-lg font-medium">{selectedIdee.titre}</p>
              </div>
              <div>
                <Label className="text-sm font-semibold">Auteur</Label>
                <p className="text-sm">
                  {selectedIdee.Adherent.firstname} {selectedIdee.Adherent.lastname}
                </p>
              </div>
              <div>
                <Label className="text-sm font-semibold">Description</Label>
                <p className="text-sm whitespace-pre-wrap bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                  {selectedIdee.description}
                </p>
              </div>
              <div className="flex gap-4">
                <div>
                  <Label className="text-sm font-semibold">Statut</Label>
                  <div className="mt-1">{getStatutBadge(selectedIdee.statut)}</div>
                </div>
                <div>
                  <Label className="text-sm font-semibold">Date de création</Label>
                  <p className="text-sm">
                    {format(new Date(selectedIdee.dateCreation), "d MMMM yyyy à HH:mm", { locale: fr })}
                  </p>
                </div>
              </div>
              {selectedIdee.raisonRejet && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                  <Label className="text-sm font-semibold text-red-700 dark:text-red-300">Raison du rejet/blocage</Label>
                  <p className="text-sm text-red-700 dark:text-red-300 mt-1">{selectedIdee.raisonRejet}</p>
                </div>
              )}

              {/* Commentaires */}
              <div>
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Commentaires ({selectedIdee.Commentaires.length})
                </Label>
                {selectedIdee.Commentaires.length > 0 ? (
                  <div className="space-y-2 mt-2 max-h-64 overflow-y-auto">
                    {selectedIdee.Commentaires.map((commentaire) => (
                      <div
                        key={commentaire.id}
                        className={`bg-gray-50 dark:bg-gray-800 rounded-lg p-3 ${
                          commentaire.supprime ? "opacity-50" : ""
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold text-sm">
                                {commentaire.Adherent.firstname} {commentaire.Adherent.lastname}
                              </span>
                              <span className="text-xs text-gray-500">
                                {format(new Date(commentaire.createdAt), "d MMM yyyy à HH:mm", { locale: fr })}
                              </span>
                              {commentaire.supprime && (
                                <Badge variant="destructive" className="text-xs">
                                  Supprimé
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-gray-700 dark:text-gray-300">
                              {commentaire.contenu}
                            </p>
                            {commentaire.raisonSuppression && (
                              <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                                Raison: {commentaire.raisonSuppression}
                              </p>
                            )}
                          </div>
                          {!commentaire.supprime && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedCommentaire(commentaire);
                                setShowSupprimerCommentaireDialog(true);
                                setShowDetailsDialog(false);
                              }}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 mt-2">Aucun commentaire</p>
                )}
              </div>

              <div className="flex gap-2 justify-end pt-4 border-t">
                <Button variant="outline" onClick={() => setShowDetailsDialog(false)}>
                  Fermer
                </Button>
                <Link href="/idees">
                  <Button className="bg-blue-600 hover:bg-blue-700">
                    Voir sur le site
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog Supprimer Commentaire */}
      <Dialog open={showSupprimerCommentaireDialog} onOpenChange={setShowSupprimerCommentaireDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer le commentaire</DialogTitle>
            <DialogDescription>
              Indiquez la raison de la suppression. L'adhérent sera notifié par email.
            </DialogDescription>
          </DialogHeader>
          {selectedCommentaire && (
            <div className="space-y-4">
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {selectedCommentaire.contenu}
                </p>
              </div>
              <div>
                <Label htmlFor="raison-suppression">Raison de la suppression *</Label>
                <Textarea
                  id="raison-suppression"
                  value={raisonSuppression}
                  onChange={(e) => setRaisonSuppression(e.target.value)}
                  placeholder="Ex: Viole l'éthique de l'association, contient des propos diffamatoires..."
                  rows={4}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => {
                  setShowSupprimerCommentaireDialog(false);
                  setRaisonSuppression("");
                }}>
                  Annuler
                </Button>
                <Button
                  onClick={handleSupprimerCommentaire}
                  disabled={actionLoading || !raisonSuppression.trim()}
                  className="bg-red-600 hover:bg-red-700"
                >
                  {actionLoading ? "Suppression..." : "Supprimer"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
