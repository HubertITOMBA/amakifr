"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  Filter, 
  Download, 
  Trash2, 
  Eye, 
  File,
  Image,
  Video,
  Table as TableIcon,
  X,
  User,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  MoreHorizontal,
  Edit,
  Plus
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { fr } from "date-fns/locale";
import { getAllDocuments, adminDeleteDocument } from "@/actions/documents";
import { toast } from "sonner";
import { TypeDocument } from "@prisma/client";
import { useSession } from "next-auth/react";
import { DocumentUpload } from "@/components/documents/DocumentUpload";
import { EditDocumentDialog } from "@/components/documents/EditDocumentDialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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

const columnHelper = createColumnHelper<any>();

const getDocumentIcon = (type: TypeDocument) => {
  switch (type) {
    case TypeDocument.PDF:
      return FileText;
    case TypeDocument.Image:
      return Image;
    case TypeDocument.Video:
      return Video;
    case TypeDocument.Excel:
      return TableIcon;
    case TypeDocument.Word:
      return FileText;
    default:
      return File;
  }
};

const getDocumentColor = (type: TypeDocument) => {
  switch (type) {
    case TypeDocument.PDF:
      return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
    case TypeDocument.Image:
      return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
    case TypeDocument.Video:
      return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
    case TypeDocument.Excel:
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
    case TypeDocument.Word:
      return "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
  }
};

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

export default function AdminDocumentsPage() {
  const { data: session } = useSession();
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [editingDocument, setEditingDocument] = useState<any | null>(null);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("admin-documents-column-visibility");
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
            categorie: false,
            taille: false,
            User: false,
            createdAt: false,
            // Garder visible : description (qui inclut nom du fichier), actions
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
      const saved = localStorage.getItem("admin-documents-column-visibility");
      
      if (isMobile && (!saved || Object.keys(JSON.parse(saved || "{}")).length === 0)) {
        setColumnVisibility({
          type: false,
          categorie: false,
          taille: false,
          User: false,
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

  const loadDocuments = useCallback(async () => {
    try {
      setLoading(true);
      const options: any = {};

      if (filterType !== "all") {
        options.type = filterType as TypeDocument;
      }

      if (searchTerm.trim()) {
        options.searchTerm = searchTerm.trim();
      }

      const result = await getAllDocuments(options);
      if (result.success && result.documents) {
        setDocuments(result.documents);
      } else {
        toast.error(result.error || "Erreur lors du chargement");
        setDocuments([]);
      }
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors du chargement des documents");
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, [filterType, searchTerm]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const handleDelete = async (documentId: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce document ?")) {
      return;
    }

    const result = await adminDeleteDocument(documentId);
    if (result.success) {
      setDocuments((prev) => prev.filter((d) => d.id !== documentId));
      toast.success("Document supprimé avec succès");
    } else {
      toast.error(result.error || "Erreur");
    }
  };

  const handleUploadSuccess = (document: any) => {
    setDocuments((prev) => [document, ...prev]);
    setShowUploadDialog(false);
    loadDocuments();
  };

  const handleUpdateSuccess = () => {
    loadDocuments();
    setEditingDocument(null);
  };

  const isDocumentOwner = (document: any) => {
    return session?.user?.id === document.userId;
  };

  // Extraire les catégories uniques
  const categories = useMemo(() => {
    return Array.from(
      new Set(
        documents
          .map((d) => d.categorie)
          .filter((c: string | null) => c !== null)
      )
    ) as string[];
  }, [documents]);

  // Filtrer les données
  const filteredData = useMemo(() => {
    return documents.filter((document) => {
      // Filtre global (recherche)
      if (globalFilter.trim()) {
        const q = globalFilter.trim().toLowerCase();
        const searchText = [
          document.nomOriginal || "",
          document.description || "",
          document.categorie || "",
          document.User?.name || "",
          document.User?.email || "",
          document.Adherent?.firstname || "",
          document.Adherent?.lastname || "",
        ].join(" ").toLowerCase();
        if (!searchText.includes(q)) return false;
      }

      // Filtre par catégorie
      if (filterCategory !== "all" && document.categorie !== filterCategory) {
        return false;
      }

      return true;
    });
  }, [documents, globalFilter, filterCategory]);

  const columns = useMemo(() => [
    columnHelper.accessor("description", {
      header: "Description / Nom du fichier",
      cell: ({ row }) => {
        const document = row.original;
        const IconComponent = getDocumentIcon(document.type);
        return (
          <div className="min-w-0">
            {document.description ? (
              <div className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white mb-1 line-clamp-2">
                {document.description}
              </div>
            ) : null}
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
              <div className={`p-1 sm:p-1.5 rounded flex-shrink-0 ${getDocumentColor(document.type)}`}>
                <IconComponent className="h-3 w-3 sm:h-4 sm:w-4" />
              </div>
              <span className="text-xs text-gray-600 dark:text-gray-400 truncate">
                {document.nomOriginal}
              </span>
            </div>
          </div>
        );
      },
      size: 300,
      minSize: 250,
      maxSize: 500,
      enableResizing: true,
    }),
    columnHelper.accessor("User", {
      header: "Adhérent",
      cell: ({ row }) => {
        const user = row.original.User;
        const adherent = row.original.Adherent;
        return (
          <div className="flex items-center gap-1.5 min-w-0">
            <User className="h-3 w-3 sm:h-4 sm:w-4 text-gray-500 dark:text-gray-400 flex-shrink-0" />
            <div className="min-w-0">
              {adherent ? (
                <div className="text-xs sm:text-sm text-gray-900 dark:text-white truncate">
                  {adherent.firstname} {adherent.lastname}
                </div>
              ) : (
                <div className="text-xs sm:text-sm text-gray-900 dark:text-white truncate">
                  {user?.name || "N/A"}
                </div>
              )}
            </div>
          </div>
        );
      },
      size: 180,
      minSize: 140,
      maxSize: 250,
      enableResizing: true,
    }),
    columnHelper.accessor("type", {
      header: "Type",
      cell: ({ row }) => {
        const type = row.getValue("type") as TypeDocument;
        return (
          <Badge
            variant="outline"
            className={`text-xs ${getDocumentColor(type)}`}
          >
            {type}
          </Badge>
        );
      },
      size: 120,
      minSize: 100,
      maxSize: 150,
      enableResizing: true,
    }),
    columnHelper.accessor("categorie", {
      header: "Catégorie",
      cell: ({ row }) => {
        const categorie = row.getValue("categorie") as string | null;
        return (
          <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
            {categorie || "-"}
          </span>
        );
      },
      size: 150,
      minSize: 120,
      maxSize: 200,
      enableResizing: true,
    }),
    columnHelper.accessor("taille", {
      header: "Taille",
      cell: ({ row }) => {
        const taille = row.getValue("taille") as number;
        return (
          <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
            {formatFileSize(taille)}
          </span>
        );
      },
      size: 100,
      minSize: 80,
      maxSize: 120,
      enableResizing: true,
    }),
    columnHelper.accessor("createdAt", {
      header: "Date",
      cell: ({ row }) => {
        const date = row.getValue("createdAt") as Date;
        return (
          <div className="text-xs text-gray-600 dark:text-gray-400">
            <div>{format(new Date(date), "dd/MM/yyyy", { locale: fr })}</div>
            <div className="text-[10px] text-gray-500 dark:text-gray-500">
              {formatDistanceToNow(new Date(date), { addSuffix: true, locale: fr })}
            </div>
          </div>
        );
      },
      size: 130,
      minSize: 110,
      maxSize: 160,
      enableResizing: true,
    }),
    columnHelper.display({
      id: "actions",
      header: () => <div className="text-center w-full">Actions</div>,
      meta: { forceVisible: true },
      enableResizing: false,
      cell: ({ row }) => {
        const document = row.original;
        const canEdit = isDocumentOwner(document);
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
                <DropdownMenuItem asChild>
                  <a
                    href={document.chemin}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <Eye className="h-4 w-4" />
                    <span>Voir / Télécharger</span>
                  </a>
                </DropdownMenuItem>
                {canEdit && (
                  <>
                    <DropdownMenuItem 
                      onClick={() => setEditingDocument(document)}
                      className="cursor-pointer"
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      <span>Modifier</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem 
                  onClick={() => handleDelete(document.id)}
                  className="focus:bg-red-50 dark:focus:bg-red-900/20 text-red-600 dark:text-red-400 cursor-pointer"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
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
        localStorage.setItem("admin-documents-column-visibility", JSON.stringify(newVisibility));
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-slate-900 dark:to-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <Card className="!py-0 shadow-lg border-blue-200 dark:border-blue-800">
          <CardHeader className="bg-gradient-to-r from-blue-500 to-blue-600 text-white py-4 sm:py-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                <FileText className="h-5 w-5 sm:h-6 sm:w-6" />
                Documents des adhérents ({documents.length})
              </CardTitle>
              <div className="flex items-center gap-2">
                <ColumnVisibilityToggle 
                  table={table} 
                  storageKey="admin-documents-column-visibility"
                />
                <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
                  <DialogTrigger asChild>
                    <Button className="bg-white hover:bg-gray-100 text-blue-600 text-sm h-9 sm:h-10">
                      <Plus className="h-4 w-4 mr-2" />
                      Nouveau document
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="w-[95vw] sm:w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle className="text-base sm:text-lg">Téléverser un document</DialogTitle>
                      <DialogDescription className="text-xs sm:text-sm">
                        Téléversez un nouveau document (max 50MB)
                      </DialogDescription>
                    </DialogHeader>
                    <DocumentUpload
                      onUploadSuccess={handleUploadSuccess}
                      onClose={() => setShowUploadDialog(false)}
                      showCategory={true}
                      showDescription={true}
                      showPublicToggle={true}
                    />
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            {/* Filtres et recherche */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Rechercher par nom, description, utilisateur..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-11 text-sm h-9 sm:h-10"
                />
              </div>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-full sm:w-48 text-sm h-9 sm:h-10">
                  <SelectValue placeholder="Type de document" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les types</SelectItem>
                  <SelectItem value={TypeDocument.PDF}>PDF</SelectItem>
                  <SelectItem value={TypeDocument.Image}>Image</SelectItem>
                  <SelectItem value={TypeDocument.Video}>Vidéo</SelectItem>
                  <SelectItem value={TypeDocument.Excel}>Excel</SelectItem>
                  <SelectItem value={TypeDocument.Word}>Word</SelectItem>
                  <SelectItem value={TypeDocument.Autre}>Autre</SelectItem>
                </SelectContent>
              </Select>
              {categories.length > 0 && (
                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger className="w-full sm:w-48 text-sm h-9 sm:h-10">
                    <SelectValue placeholder="Catégorie" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes les catégories</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {(filterType !== "all" || filterCategory !== "all" || searchTerm) && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setFilterType("all");
                    setFilterCategory("all");
                    setSearchTerm("");
                  }}
                  className="text-sm h-9 sm:h-10"
                >
                  <X className="h-4 w-4 mr-2" />
                  Effacer
                </Button>
              )}
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <>
                <div className="mb-4 text-sm text-gray-600 dark:text-gray-300">
                  {filteredData.length} document(s) trouvé(s)
                </div>
                <div className="[&_td]:py-1 [&_th]:py-2">
                  <DataTable table={table} emptyMessage="Aucun document trouvé" />
                </div>
                
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

      {/* Dialog d'édition */}
      {editingDocument && (
        <EditDocumentDialog
          document={editingDocument}
          open={!!editingDocument}
          onOpenChange={(open) => !open && setEditingDocument(null)}
          onUpdateSuccess={handleUpdateSuccess}
          isAdmin={true}
        />
      )}
    </div>
  );
}

