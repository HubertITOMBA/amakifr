"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
  FileText, 
  Search, 
  Plus, 
  Edit, 
  Trash2, 
  Eye,
  Printer,
  Calendar,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Loader2
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { 
  getAllRapportsReunion,
  createRapportReunion,
  updateRapportReunion,
  deleteRapportReunion,
  getRapportReunionById
} from "@/actions/rapports-reunion";
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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

const columnHelper = createColumnHelper<any>();

export default function AdminRapportsReunionPage() {
  const [rapports, setRapports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("admin-rapports-reunion-column-visibility");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Object.keys(parsed).length > 0) {
            return parsed;
          }
        }
        const isMobile = window.innerWidth < 768;
        if (isMobile) {
          return {
            dateReunion: false,
            createdAt: false,
            CreatedBy: false,
            updatedAt: false,
          };
        }
      } catch (error) {
        console.error("Erreur lors du chargement des préférences:", error);
      }
    }
    return {};
  });

  // Dialogs
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedRapport, setSelectedRapport] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form data
  const [formData, setFormData] = useState({
    titre: "",
    dateReunion: "",
    contenu: "",
  });

  // Debounce pour la recherche
  useEffect(() => {
    const timer = setTimeout(() => {
      setGlobalFilter(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const loadRapports = useCallback(async () => {
    try {
      setLoading(true);
      const result = await getAllRapportsReunion();
      if (result.success && result.rapports) {
        setRapports(result.rapports);
      } else {
        toast.error(result.error || "Erreur lors du chargement");
        setRapports([]);
      }
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors du chargement des rapports");
      setRapports([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRapports();
  }, [loadRapports]);

  const handleCreate = async () => {
    if (!formData.titre.trim() || !formData.dateReunion || !formData.contenu.trim()) {
      toast.error("Veuillez remplir tous les champs");
      return;
    }

    setIsSubmitting(true);
    try {
      const formDataToSend = new FormData();
      formDataToSend.append("titre", formData.titre);
      formDataToSend.append("dateReunion", formData.dateReunion);
      formDataToSend.append("contenu", formData.contenu);

      const result = await createRapportReunion(formDataToSend);
      if (result.success) {
        toast.success(result.message);
        setShowCreateDialog(false);
        setFormData({ titre: "", dateReunion: "", contenu: "" });
        loadRapports();
      } else {
        toast.error(result.error || "Erreur lors de la création");
      }
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de la création du rapport");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!selectedRapport || !formData.titre.trim() || !formData.dateReunion || !formData.contenu.trim()) {
      toast.error("Veuillez remplir tous les champs");
      return;
    }

    setIsSubmitting(true);
    try {
      const formDataToSend = new FormData();
      formDataToSend.append("id", selectedRapport.id);
      formDataToSend.append("titre", formData.titre);
      formDataToSend.append("dateReunion", formData.dateReunion);
      formDataToSend.append("contenu", formData.contenu);

      const result = await updateRapportReunion(formDataToSend);
      if (result.success) {
        toast.success(result.message);
        setShowEditDialog(false);
        setSelectedRapport(null);
        setFormData({ titre: "", dateReunion: "", contenu: "" });
        loadRapports();
      } else {
        toast.error(result.error || "Erreur lors de la modification");
      }
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de la modification du rapport");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedRapport) return;

    try {
      const result = await deleteRapportReunion(selectedRapport.id);
      if (result.success) {
        toast.success(result.message);
        setShowDeleteDialog(false);
        setSelectedRapport(null);
        loadRapports();
      } else {
        toast.error(result.error || "Erreur lors de la suppression");
      }
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de la suppression du rapport");
    }
  };

  const handleView = async (rapport: any) => {
    try {
      const result = await getRapportReunionById(rapport.id);
      if (result.success && result.rapport) {
        setSelectedRapport(result.rapport);
        setShowViewDialog(true);
      } else {
        toast.error(result.error || "Erreur lors du chargement");
      }
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors du chargement du rapport");
    }
  };

  const handlePrint = (rapport: any) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error("Impossible d'ouvrir la fenêtre d'impression");
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${rapport.titre}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              max-width: 800px;
              margin: 0 auto;
              padding: 20px;
            }
            h1 {
              color: #1e40af;
              border-bottom: 2px solid #1e40af;
              padding-bottom: 10px;
            }
            .meta {
              color: #666;
              margin-bottom: 20px;
            }
            .contenu {
              line-height: 1.6;
              white-space: pre-wrap;
            }
            @media print {
              body {
                padding: 0;
              }
            }
          </style>
        </head>
        <body>
          <h1>${rapport.titre}</h1>
          <div class="meta">
            <p><strong>Date de la réunion :</strong> ${format(new Date(rapport.dateReunion), "dd MMMM yyyy", { locale: fr })}</p>
            <p><strong>Créé le :</strong> ${format(new Date(rapport.createdAt), "dd MMMM yyyy à HH:mm", { locale: fr })}</p>
            ${rapport.CreatedBy ? `<p><strong>Créé par :</strong> ${rapport.CreatedBy.name || rapport.CreatedBy.email}</p>` : ''}
          </div>
          <div class="contenu">${rapport.contenu}</div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  const openEditDialog = (rapport: any) => {
    setSelectedRapport(rapport);
    setFormData({
      titre: rapport.titre,
      dateReunion: format(new Date(rapport.dateReunion), "yyyy-MM-dd"),
      contenu: rapport.contenu,
    });
    setShowEditDialog(true);
  };

  const openDeleteDialog = (rapport: any) => {
    setSelectedRapport(rapport);
    setShowDeleteDialog(true);
  };

  // Filtrer les données
  const filteredData = useMemo(() => {
    return rapports.filter(item => {
      if (globalFilter.trim()) {
        const q = globalFilter.trim().toLowerCase();
        const searchText = [
          item.titre || "",
          item.contenu || "",
        ].join(" ").toLowerCase();
        if (!searchText.includes(q)) return false;
      }
      return true;
    });
  }, [rapports, globalFilter]);

  const columns = useMemo(() => [
    columnHelper.accessor("titre", {
      header: "Titre",
      cell: ({ row }) => (
        <span className="text-sm text-gray-900 dark:text-gray-100 font-medium">
          {row.getValue("titre")}
        </span>
      ),
      size: 300,
      minSize: 200,
      maxSize: 400,
      enableResizing: true,
    }),
    columnHelper.accessor("dateReunion", {
      header: "Date de réunion",
      cell: ({ row }) => (
        <span className="text-sm text-gray-900 dark:text-gray-100">
          {format(new Date(row.getValue("dateReunion")), "dd MMM yyyy", { locale: fr })}
        </span>
      ),
      size: 150,
      minSize: 120,
      maxSize: 200,
      enableResizing: true,
    }),
    columnHelper.accessor("CreatedBy", {
      header: "Créé par",
      cell: ({ row }) => {
        const createdBy = row.getValue("CreatedBy") as any;
        return (
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {createdBy?.name || createdBy?.email || "N/A"}
          </span>
        );
      },
      size: 150,
      minSize: 120,
      maxSize: 200,
      enableResizing: true,
    }),
    columnHelper.accessor("createdAt", {
      header: "Créé le",
      cell: ({ row }) => (
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {format(new Date(row.getValue("createdAt")), "dd MMM yyyy", { locale: fr })}
        </span>
      ),
      size: 120,
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
        const rapport = row.original;
        return (
          <div className="flex items-center space-x-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleView(rapport)}>
                  <Eye className="h-4 w-4 mr-2" />
                  Voir
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handlePrint(rapport)}>
                  <Printer className="h-4 w-4 mr-2" />
                  Imprimer
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => openEditDialog(rapport)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Modifier
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => openDeleteDialog(rapport)}
                  className="text-red-600 dark:text-red-400"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Supprimer
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
      size: 100,
      minSize: 80,
      maxSize: 120,
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
        localStorage.setItem("admin-rapports-reunion-column-visibility", JSON.stringify(newVisibility));
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50">
      <Card className="mx-auto max-w-7xl shadow-lg border-blue-200 !py-0">
        <CardHeader className="!py-0 bg-gradient-to-r from-blue-500 to-blue-600 text-white">
          <div className="flex items-center justify-between py-4 sm:py-6">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Rapports de Réunion ({filteredData.length})
            </CardTitle>
            <div className="flex items-center gap-2">
              <ColumnVisibilityToggle 
                table={table} 
                storageKey="admin-rapports-reunion-column-visibility"
              />
              <Button
                onClick={() => {
                  setFormData({ titre: "", dateReunion: "", contenu: "" });
                  setShowCreateDialog(true);
                }}
                className="bg-white text-blue-600 hover:bg-blue-50"
              >
                <Plus className="h-4 w-4 mr-2" />
                Nouveau rapport
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filtres et recherche */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Rechercher un rapport..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : (
            <>
              <div className="mb-4 text-sm text-gray-600 dark:text-gray-300">
                {filteredData.length} rapport(s) trouvé(s)
              </div>
              <DataTable table={table} emptyMessage="Aucun rapport trouvé" compact={true} />
              
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
            </>
          )}
        </CardContent>
      </Card>

      {/* Dialog de création */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Créer un nouveau rapport de réunion</DialogTitle>
            <DialogDescription>
              Remplissez les informations du rapport de réunion mensuelle
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="titre">Titre *</Label>
              <Input
                id="titre"
                value={formData.titre}
                onChange={(e) => setFormData({ ...formData, titre: e.target.value })}
                placeholder="Ex: Réunion mensuelle - Janvier 2024"
              />
            </div>
            <div>
              <Label htmlFor="dateReunion">Date de la réunion *</Label>
              <Input
                id="dateReunion"
                type="date"
                value={formData.dateReunion}
                onChange={(e) => setFormData({ ...formData, dateReunion: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="contenu">Contenu du rapport *</Label>
              <Textarea
                id="contenu"
                value={formData.contenu}
                onChange={(e) => setFormData({ ...formData, contenu: e.target.value })}
                placeholder="Rédigez le compte rendu de la réunion..."
                rows={15}
                className="font-mono text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Annuler
            </Button>
            <Button onClick={handleCreate} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Création...
                </>
              ) : (
                "Créer"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de modification */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modifier le rapport de réunion</DialogTitle>
            <DialogDescription>
              Modifiez les informations du rapport de réunion
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-titre">Titre *</Label>
              <Input
                id="edit-titre"
                value={formData.titre}
                onChange={(e) => setFormData({ ...formData, titre: e.target.value })}
                placeholder="Ex: Réunion mensuelle - Janvier 2024"
              />
            </div>
            <div>
              <Label htmlFor="edit-dateReunion">Date de la réunion *</Label>
              <Input
                id="edit-dateReunion"
                type="date"
                value={formData.dateReunion}
                onChange={(e) => setFormData({ ...formData, dateReunion: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-contenu">Contenu du rapport *</Label>
              <Textarea
                id="edit-contenu"
                value={formData.contenu}
                onChange={(e) => setFormData({ ...formData, contenu: e.target.value })}
                placeholder="Rédigez le compte rendu de la réunion..."
                rows={15}
                className="font-mono text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Annuler
            </Button>
            <Button onClick={handleEdit} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Modification...
                </>
              ) : (
                "Enregistrer"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de visualisation */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedRapport?.titre}</DialogTitle>
          </DialogHeader>
          <div className="space-y-1 mt-2 text-sm text-muted-foreground">
            <p><strong>Date de la réunion :</strong> {selectedRapport && format(new Date(selectedRapport.dateReunion), "dd MMMM yyyy", { locale: fr })}</p>
            <p><strong>Créé le :</strong> {selectedRapport && format(new Date(selectedRapport.createdAt), "dd MMMM yyyy à HH:mm", { locale: fr })}</p>
            {selectedRapport?.CreatedBy && (
              <p><strong>Créé par :</strong> {selectedRapport.CreatedBy.name || selectedRapport.CreatedBy.email}</p>
            )}
            {selectedRapport?.UpdatedBy && (
              <p><strong>Modifié par :</strong> {selectedRapport.UpdatedBy.name || selectedRapport.UpdatedBy.email}</p>
            )}
          </div>
          <div className="mt-4">
            <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg whitespace-pre-wrap text-sm">
              {selectedRapport?.contenu}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowViewDialog(false)}>
              Fermer
            </Button>
            {selectedRapport && (
              <Button onClick={() => handlePrint(selectedRapport)}>
                <Printer className="h-4 w-4 mr-2" />
                Imprimer
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmation de suppression */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer le rapport "{selectedRapport?.titre}" ? Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
