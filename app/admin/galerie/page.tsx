"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  Camera, 
  Video,
  Search, 
  Plus, 
  Edit, 
  Trash2, 
  CheckCircle,
  XCircle,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Loader2,
  Image as ImageIcon,
  MoreHorizontal
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { 
  getAllMediaGalerie,
  uploadMediaGalerie,
  updateMediaGalerie,
  deleteMediaGalerie,
  getMediaGalerieById
} from "@/actions/galerie";
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
import Image from "next/image";

const columnHelper = createColumnHelper<any>();

const categories = [
  { value: "Événements Officiels", label: "Événements Officiels" },
  { value: "Événements Sociaux", label: "Événements Sociaux" },
  { value: "Actions Caritatives", label: "Actions Caritatives" },
  { value: "Formations et Conférences", label: "Formations et Conférences" },
];

const couleurs = [
  { value: "blue", label: "Bleu" },
  { value: "green", label: "Vert" },
  { value: "purple", label: "Violet" },
  { value: "orange", label: "Orange" },
];

const getTypeBadge = (type: string) => {
  if (type === "video") {
    return (
      <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border-red-300 dark:border-red-700">
        <Video className="h-3 w-3 mr-1" />
        Vidéo
      </Badge>
    );
  }
  return (
    <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border-blue-300 dark:border-blue-700">
      <Camera className="h-3 w-3 mr-1" />
      Photo
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

export default function AdminGaleriePage() {
  const [medias, setMedias] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [categorieFilter, setCategorieFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("admin-galerie-column-visibility");
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
            date: false,
            lieu: false,
            description: false,
            ordre: false,
            actif: false,
            createdAt: false,
            // Garder visible : titre, actions (si présente)
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
      const saved = localStorage.getItem("admin-galerie-column-visibility");
      
      if (isMobile && (!saved || Object.keys(JSON.parse(saved || "{}")).length === 0)) {
        setColumnVisibility({
          type: false,
          categorie: false,
          date: false,
          lieu: false,
          description: false,
          ordre: false,
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
  const [selectedMedia, setSelectedMedia] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  // Form data
  const [formData, setFormData] = useState({
    titre: "",
    description: "",
    type: "image" as "image" | "video",
    categorie: "Événements Officiels",
    couleur: "blue",
    date: new Date().toISOString().split("T")[0],
    lieu: "",
    ordre: 0,
    actif: true,
  });

  // Debounce pour la recherche
  useEffect(() => {
    const timer = setTimeout(() => {
      setGlobalFilter(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const loadMedias = useCallback(async () => {
    try {
      setLoading(true);
      const result = await getAllMediaGalerie(false);
      if (result.success && result.data) {
        setMedias(result.data);
      } else {
        toast.error(result.error || "Erreur lors du chargement");
        setMedias([]);
      }
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors du chargement des médias");
      setMedias([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMedias();
  }, [loadMedias]);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validation du type de fichier
    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");

    if (!isImage && !isVideo) {
      toast.error("Le fichier doit être une image ou une vidéo");
      return;
    }

    // Mettre à jour le type dans le formulaire
    setFormData({ ...formData, type: isImage ? "image" : "video" });

    // Créer un aperçu local
    if (isImage) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setPreview(null);
    }
  };

  /**
   * Divise un fichier en chunks et les envoie séquentiellement
   */
  const uploadFileInChunks = async (file: File, metadata: any): Promise<{ success: boolean; error?: string; media?: any }> => {
    const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB par chunk (sous la limite de 10MB de Next.js)
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    const uploadId = `${Date.now()}_${Math.random().toString(36).substring(7)}`;

    try {
      // Envoyer chaque chunk séquentiellement
      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        const start = chunkIndex * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);
        const isLastChunk = chunkIndex === totalChunks - 1;

        const chunkFormData = new FormData();
        chunkFormData.append("chunk", chunk);
        chunkFormData.append("chunkIndex", chunkIndex.toString());
        chunkFormData.append("totalChunks", totalChunks.toString());
        chunkFormData.append("uploadId", uploadId);
        chunkFormData.append("fileName", file.name);
        chunkFormData.append("mimeType", file.type);
        chunkFormData.append("totalSize", file.size.toString());
        chunkFormData.append("isLastChunk", isLastChunk.toString());

        // Ajouter les métadonnées seulement avec le dernier chunk
        if (isLastChunk) {
          chunkFormData.append("titre", metadata.titre);
          chunkFormData.append("description", metadata.description || "");
          chunkFormData.append("type", metadata.type);
          chunkFormData.append("categorie", metadata.categorie);
          chunkFormData.append("couleur", metadata.couleur);
          chunkFormData.append("date", metadata.date);
          chunkFormData.append("lieu", metadata.lieu || "");
          chunkFormData.append("ordre", metadata.ordre.toString());
          chunkFormData.append("actif", metadata.actif.toString());
        }

        const response = await fetch("/api/galerie/upload-chunk", {
          method: "POST",
          body: chunkFormData,
        });

        if (!response.ok) {
          const errorText = await response.text();
          let errorData;
          try {
            errorData = JSON.parse(errorText);
          } catch {
            errorData = { error: errorText || `Erreur ${response.status}` };
          }
          console.error(`Erreur lors de l'upload du chunk ${chunkIndex + 1}/${totalChunks}:`, errorData);
          return { success: false, error: errorData.error || `Erreur ${response.status}` };
        }

        const result = await response.json();

        // Mettre à jour la progression
        const progress = Math.round(((chunkIndex + 1) / totalChunks) * 100);
        setUploadProgress(progress);

        // Log pour débogage
        if (process.env.NODE_ENV === 'development') {
          console.log(`Chunk ${chunkIndex + 1}/${totalChunks} uploadé:`, {
            success: result.success,
            hasMedia: !!result.media,
            isLastChunk,
            message: result.message,
          });
        }

        // Si c'est le dernier chunk et que l'upload est terminé
        if (isLastChunk && result.success) {
          if (result.media) {
            return { success: true, media: result.media };
          } else {
            // Si les métadonnées ne sont pas encore traitées, attendre un peu et réessayer
            // Cela peut arriver si le serveur n'a pas encore assemblé le fichier
            console.warn("Dernier chunk envoyé mais média non retourné, attente...");
            // Pour les fichiers en un seul chunk, le serveur devrait traiter immédiatement
            // Si ce n'est pas le cas, il y a un problème
            if (totalChunks === 1) {
              return { success: false, error: "Erreur: le fichier n'a pas été traité correctement par le serveur" };
            }
          }
        }

        // Si ce n'est pas le dernier chunk, continuer avec le suivant
        if (!isLastChunk && result.success) {
          continue;
        }

        // Si on arrive ici, il y a un problème
        if (!result.success) {
          return { success: false, error: result.error || "Erreur lors de l'upload du chunk" };
        }
      }

      return { success: false, error: "Erreur lors de l'assemblage des chunks" };
    } catch (error) {
      console.error("Erreur lors de l'upload par chunks:", error);
      return { success: false, error: error instanceof Error ? error.message : "Erreur inconnue" };
    }
  };

  const handleCreate = async () => {
    if (!formData.titre.trim()) {
      toast.error("Le titre est requis");
      return;
    }

    const fileInput = fileInputRef.current;
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
      toast.error("Veuillez sélectionner un fichier");
      return;
    }

    const file = fileInput.files[0];
    setUploading(true);
    setUploadProgress(0);

    try {
      const metadata = {
        titre: formData.titre,
        description: formData.description || "",
        type: formData.type,
        categorie: formData.categorie,
        couleur: formData.couleur,
        date: formData.date,
        lieu: formData.lieu || "",
        ordre: formData.ordre,
        actif: formData.actif,
      };

      // Utiliser l'upload par chunks pour tous les fichiers
      // Cela permet de contourner la limite de 10MB de Next.js côté client
      const result = await uploadFileInChunks(file, metadata);

      if (result.success) {
        toast.success("Média ajouté avec succès");
        setShowCreateDialog(false);
        resetForm();
        loadMedias();
      } else {
        toast.error(result.error || "Erreur lors de l'ajout");
      }
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de l'ajout du média");
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleEdit = async () => {
    if (!selectedMedia || !formData.titre.trim()) {
      toast.error("Le titre est requis");
      return;
    }

    try {
      const formDataToSend = new FormData();
      formDataToSend.append("id", selectedMedia.id);
      formDataToSend.append("titre", formData.titre);
      formDataToSend.append("description", formData.description || "");
      formDataToSend.append("categorie", formData.categorie);
      formDataToSend.append("couleur", formData.couleur);
      formDataToSend.append("date", formData.date);
      formDataToSend.append("lieu", formData.lieu || "");
      formDataToSend.append("ordre", formData.ordre.toString());
      formDataToSend.append("actif", formData.actif.toString());

      const result = await updateMediaGalerie(formDataToSend);

      if (result.success) {
        toast.success(result.message || "Média mis à jour avec succès");
        setShowEditDialog(false);
        resetForm();
        loadMedias();
      } else {
        toast.error(result.error || "Erreur lors de la mise à jour");
      }
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de la mise à jour");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce média ?")) {
      return;
    }

    try {
      const result = await deleteMediaGalerie(id);
      if (result.success) {
        toast.success(result.message || "Média supprimé avec succès");
        loadMedias();
      } else {
        toast.error(result.error || "Erreur lors de la suppression");
      }
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de la suppression");
    }
  };

  const openEditDialog = async (media: any) => {
    setSelectedMedia(media);
    setFormData({
      titre: media.titre || "",
      description: media.description || "",
      type: media.type || "image",
      categorie: media.categorie || "Événements Officiels",
      couleur: media.couleur || "blue",
      date: media.date ? new Date(media.date).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
      lieu: media.lieu || "",
      ordre: media.ordre || 0,
      actif: media.actif ?? true,
    });
    setPreview(media.chemin || null);
    setShowEditDialog(true);
  };

  const resetForm = () => {
    setFormData({
      titre: "",
      description: "",
      type: "image",
      categorie: "Événements Officiels",
      couleur: "blue",
      date: new Date().toISOString().split("T")[0],
      lieu: "",
      ordre: 0,
      actif: true,
    });
    setPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Filtrer les données
  const filteredData = useMemo(() => {
    return medias.filter((media) => {
      // Filtre global (recherche)
      if (globalFilter.trim()) {
        const q = globalFilter.trim().toLowerCase();
        const searchText = [
          media.titre || "",
          media.description || "",
          media.categorie || "",
          media.lieu || "",
        ].join(" ").toLowerCase();
        if (!searchText.includes(q)) return false;
      }

      // Filtre par type
      if (typeFilter !== "all" && media.type !== typeFilter) {
        return false;
      }

      // Filtre par catégorie
      if (categorieFilter !== "all" && media.categorie !== categorieFilter) {
        return false;
      }

      // Filtre par statut
      if (statusFilter !== "all") {
        if (statusFilter === "actif" && !media.actif) return false;
        if (statusFilter === "inactif" && media.actif) return false;
      }

      return true;
    });
  }, [medias, globalFilter, typeFilter, categorieFilter, statusFilter]);

  const columns = useMemo(() => [
    columnHelper.accessor("chemin", {
      header: "Aperçu",
      cell: ({ row }) => {
        const media = row.original;
        if (media.type === "image") {
          return (
            <div className="relative h-16 w-16 rounded overflow-hidden">
              <Image
                src={media.chemin}
                alt={media.titre || "Aperçu"}
                fill
                className="object-cover"
                sizes="64px"
              />
            </div>
          );
        }
        return (
          <div className="h-16 w-16 rounded bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
            <Video className="h-6 w-6 text-gray-500" />
          </div>
        );
      },
      size: 100,
      minSize: 80,
      maxSize: 120,
      enableResizing: true,
    }),
    columnHelper.accessor("titre", {
      header: "Titre",
      cell: ({ row }) => (
        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
          {row.getValue("titre")}
        </span>
      ),
      size: 200,
      minSize: 150,
      maxSize: 300,
      enableResizing: true,
    }),
    columnHelper.accessor("type", {
      header: "Type",
      cell: ({ row }) => {
        const type = row.getValue("type") as string;
        return getTypeBadge(type);
      },
      size: 120,
      minSize: 100,
      maxSize: 150,
      enableResizing: true,
    }),
    columnHelper.accessor("categorie", {
      header: "Catégorie",
      cell: ({ row }) => (
        <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
          {row.getValue("categorie")}
        </span>
      ),
      size: 180,
      minSize: 150,
      maxSize: 250,
      enableResizing: true,
    }),
    columnHelper.accessor("date", {
      header: "Date",
      cell: ({ row }) => {
        const date = row.getValue("date") as Date;
        return (
          <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
            {format(new Date(date), "dd/MM/yyyy", { locale: fr })}
          </span>
        );
      },
      size: 120,
      minSize: 100,
      maxSize: 150,
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
    columnHelper.display({
      id: "actions",
      header: () => <div className="text-center w-full">Actions</div>,
      meta: { forceVisible: true },
      enableResizing: false,
      cell: ({ row }) => {
        const media = row.original;
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
                  onClick={() => openEditDialog(media)}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <Edit className="h-4 w-4" />
                  <span>Éditer</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => handleDelete(media.id)}
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
        localStorage.setItem("admin-galerie-column-visibility", JSON.stringify(newVisibility));
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
                <Camera className="h-5 w-5" />
                Gestion de la Galerie ({filteredData.length})
              </CardTitle>
              <div className="flex items-center gap-2">
                <ColumnVisibilityToggle 
                  table={table} 
                  storageKey="admin-galerie-column-visibility"
                />
                <Button
                  onClick={() => {
                    resetForm();
                    setShowCreateDialog(true);
                  }}
                  className="bg-white text-blue-600 hover:bg-blue-50 border-white"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Ajouter un média
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
                  placeholder="Rechercher un média..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Filtrer par type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les types</SelectItem>
                  <SelectItem value="image">Photos</SelectItem>
                  <SelectItem value="video">Vidéos</SelectItem>
                </SelectContent>
              </Select>
              <Select value={categorieFilter} onValueChange={setCategorieFilter}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Filtrer par catégorie" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les catégories</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
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
                  {filteredData.length} média(s) trouvé(s)
                </div>
                <DataTable table={table} emptyMessage="Aucun média trouvé" compact={true} />
                
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
            <DialogTitle>Ajouter un média à la galerie</DialogTitle>
            <DialogDescription>
              Téléchargez une photo ou une vidéo pour la galerie
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="file">Fichier *</Label>
              <Input
                id="file"
                type="file"
                ref={fileInputRef}
                accept={formData.type === "image" ? "image/*" : "video/*"}
                onChange={handleFileSelect}
                className="cursor-pointer"
              />
              {uploading && uploadProgress > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
                    <span>Progression de l'upload</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}
              {preview && formData.type === "image" && (
                <div className="relative h-48 w-full rounded overflow-hidden border">
                  <Image
                    src={preview}
                    alt="Aperçu"
                    fill
                    className="object-contain"
                  />
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="titre">Titre *</Label>
              <Input
                id="titre"
                value={formData.titre}
                onChange={(e) => setFormData({ ...formData, titre: e.target.value })}
                placeholder="Ex: Assemblée Générale 2023"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Description du média"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="categorie">Catégorie *</Label>
                <Select value={formData.categorie} onValueChange={(value) => setFormData({ ...formData, categorie: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
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
                    {couleurs.map((color) => (
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
                <Label htmlFor="date">Date *</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lieu">Lieu</Label>
                <Input
                  id="lieu"
                  value={formData.lieu}
                  onChange={(e) => setFormData({ ...formData, lieu: e.target.value })}
                  placeholder="Ex: Paris, France"
                />
              </div>
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
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="actif"
                checked={formData.actif}
                onChange={(e) => setFormData({ ...formData, actif: e.target.checked })}
                className="rounded"
              />
              <Label htmlFor="actif">Média actif (visible publiquement)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowCreateDialog(false);
              resetForm();
            }}>
              Annuler
            </Button>
            <Button onClick={handleCreate} disabled={uploading}>
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Upload en cours... {uploadProgress > 0 && `${uploadProgress}%`}
                </>
              ) : (
                "Ajouter"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Éditer */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Éditer le média</DialogTitle>
            <DialogDescription>
              Modifiez les informations du média
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {preview && selectedMedia?.type === "image" && (
              <div className="relative h-48 w-full rounded overflow-hidden border">
                <Image
                  src={preview}
                  alt="Aperçu"
                  fill
                  className="object-contain"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="edit-titre">Titre *</Label>
              <Input
                id="edit-titre"
                value={formData.titre}
                onChange={(e) => setFormData({ ...formData, titre: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-categorie">Catégorie *</Label>
                <Select value={formData.categorie} onValueChange={(value) => setFormData({ ...formData, categorie: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
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
                    {couleurs.map((color) => (
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
                <Label htmlFor="edit-date">Date *</Label>
                <Input
                  id="edit-date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-lieu">Lieu</Label>
                <Input
                  id="edit-lieu"
                  value={formData.lieu}
                  onChange={(e) => setFormData({ ...formData, lieu: e.target.value })}
                />
              </div>
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
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="edit-actif"
                checked={formData.actif}
                onChange={(e) => setFormData({ ...formData, actif: e.target.checked })}
                className="rounded"
              />
              <Label htmlFor="edit-actif">Média actif (visible publiquement)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowEditDialog(false);
              resetForm();
            }}>
              Annuler
            </Button>
            <Button onClick={handleEdit}>
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

