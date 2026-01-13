"use client";

import { useState, useEffect, useCallback } from "react";
import { DynamicNavbar } from "@/components/home/DynamicNavbar";
import { Footer } from "@/components/home/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  FileText, 
  Upload, 
  Search, 
  Filter, 
  Download, 
  Trash2, 
  Eye, 
  File,
  Image,
  Video,
  Table,
  FileSpreadsheet,
  X,
  Plus
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { getDocuments, deleteDocument, updateDocument } from "@/actions/documents";
import { DocumentUpload } from "@/components/documents/DocumentUpload";
import { toast } from "sonner";
import { TypeDocument } from "@prisma/client";

const getDocumentIcon = (type: TypeDocument) => {
  switch (type) {
    case TypeDocument.PDF:
      return FileText;
    case TypeDocument.Image:
      return Image;
    case TypeDocument.Video:
      return Video;
    case TypeDocument.Excel:
      return Table;
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

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);

  const loadDocuments = useCallback(async () => {
    try {
      setLoading(true);
      const options: any = {};

      if (filterType !== "all") {
        options.type = filterType as TypeDocument;
      }

      const result = await getDocuments(options);
      if (result.success && result.documents) {
        setDocuments(result.documents);
        // Extraire les catégories uniques
        const uniqueCategories = Array.from(
          new Set(
            result.documents
              .map((d: any) => d.categorie)
              .filter((c: string | null) => c !== null)
          )
        ) as string[];
        setCategories(uniqueCategories);
      } else {
        toast.error(result.error || "Erreur lors du chargement");
      }
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors du chargement des documents");
    } finally {
      setLoading(false);
    }
  }, [filterType]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const handleDelete = async (documentId: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce document ?")) {
      return;
    }

    const result = await deleteDocument(documentId);
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

  const filteredDocuments = documents.filter((document) => {
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch =
        document.nomOriginal.toLowerCase().includes(searchLower) ||
        (document.description &&
          document.description.toLowerCase().includes(searchLower)) ||
        (document.categorie &&
          document.categorie.toLowerCase().includes(searchLower));
      if (!matchesSearch) return false;
    }

    if (filterCategory !== "all" && document.categorie !== filterCategory) {
      return false;
    }

    return true;
  });

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-slate-900 dark:to-slate-800">
      <DynamicNavbar />
      
      <main className="flex-1 py-6 sm:py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          {/* En-tête */}
          <div className="mb-6 sm:mb-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2 sm:gap-3">
                  <FileText className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600 dark:text-blue-400" />
                  Mes Documents
                </h1>
                <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1 sm:mt-2">
                  Gérez tous vos documents en un seul endroit
                </p>
              </div>
              <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
                <DialogTrigger asChild>
                  <Button className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white text-sm h-9 sm:h-10">
                    <Plus className="h-4 w-4 mr-2" />
                    Nouveau document
                  </Button>
                </DialogTrigger>
                <DialogContent className="w-[95vw] sm:w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="text-base sm:text-lg">Uploader un document</DialogTitle>
                    <DialogDescription className="text-xs sm:text-sm">
                      Téléversez un nouveau document (max 50MB)
                    </DialogDescription>
                  </DialogHeader>
                  <DocumentUpload
                    onUploadSuccess={handleUploadSuccess}
                    showCategory={true}
                    showDescription={true}
                    showPublicToggle={true}
                  />
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Filtres */}
          <Card className="mb-6 shadow-md border-gray-200 dark:border-gray-700">
            <CardHeader className="pb-3 pt-4 px-4 sm:px-6">
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <Filter className="h-4 w-4 sm:h-5 sm:w-5" />
                Filtres
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 px-4 sm:px-6 pb-4 sm:pb-6">
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Rechercher un document..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-11 text-sm h-9 sm:h-10"
                  />
                </div>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-full sm:w-48 text-sm h-9 sm:h-10">
                    <SelectValue placeholder="Tous les types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les types</SelectItem>
                    <SelectItem value="PDF">PDF</SelectItem>
                    <SelectItem value="Image">Image</SelectItem>
                    <SelectItem value="Video">Vidéo</SelectItem>
                    <SelectItem value="Excel">Excel</SelectItem>
                    <SelectItem value="Word">Word</SelectItem>
                    <SelectItem value="Autre">Autre</SelectItem>
                  </SelectContent>
                </Select>
                {categories.length > 0 && (
                  <Select value={filterCategory} onValueChange={setFilterCategory}>
                    <SelectTrigger className="w-full sm:w-48 text-sm h-9 sm:h-10">
                      <SelectValue placeholder="Toutes les catégories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Toutes les catégories</SelectItem>
                      {categories.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
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
                    className="w-full sm:w-auto text-sm h-9 sm:h-10"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Réinitialiser
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Liste des documents */}
          <Card className="shadow-md border-gray-200 dark:border-gray-700">
            <CardHeader className="pb-3 pt-4 px-4 sm:px-6">
              <CardTitle className="text-base sm:text-lg">
                Documents ({filteredDocuments.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 px-0 sm:px-0 pb-0">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : filteredDocuments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4">
                  <FileText className="h-16 w-16 text-gray-400 mb-4" />
                  <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 text-center mb-4">
                    {searchTerm || filterType !== "all" || filterCategory !== "all"
                      ? "Aucun document ne correspond à vos critères"
                      : "Aucun document uploadé"}
                  </p>
                  {!searchTerm && filterType === "all" && filterCategory === "all" && (
                    <Button
                      onClick={() => setShowUploadDialog(true)}
                      className="bg-blue-600 hover:bg-blue-700 text-white text-sm h-9 sm:h-10"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Uploader votre premier document
                    </Button>
                  )}
                </div>
              ) : (
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredDocuments.map((document) => {
                    const IconComponent = getDocumentIcon(document.type);
                    return (
                      <div
                        key={document.id}
                        className="p-4 sm:p-6 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                      >
                        <div className="flex items-start gap-3 sm:gap-4">
                          <div className={`p-2 sm:p-3 rounded-lg flex-shrink-0 ${getDocumentColor(document.type)}`}>
                            <IconComponent className="h-5 w-5 sm:h-6 sm:w-6" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2 sm:gap-4 mb-2">
                              <div className="flex-1 min-w-0">
                                <h3 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white truncate">
                                  {document.nomOriginal}
                                </h3>
                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                  <Badge
                                    variant="outline"
                                    className={`text-xs ${getDocumentColor(document.type)}`}
                                  >
                                    {document.type}
                                  </Badge>
                                  {document.categorie && (
                                    <Badge variant="outline" className="text-xs">
                                      {document.categorie}
                                    </Badge>
                                  )}
                                  {document.estPublic && (
                                    <Badge variant="default" className="bg-green-600 text-white text-xs">
                                      Public
                                    </Badge>
                                  )}
                                </div>
                                {document.description && (
                                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-2 line-clamp-2">
                                    {document.description}
                                  </p>
                                )}
                                <div className="flex items-center gap-3 sm:gap-4 mt-2 text-xs text-gray-500 dark:text-gray-500">
                                  <span>{formatFileSize(document.taille)}</span>
                                  <span>•</span>
                                  <span>
                                    {formatDistanceToNow(new Date(document.createdAt), {
                                      addSuffix: true,
                                      locale: fr,
                                    })}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                                <a
                                  href={document.chemin}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="h-8 w-8 sm:h-9 sm:w-9 flex items-center justify-center rounded-md border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                  title="Voir"
                                >
                                  <Eye className="h-4 w-4" />
                                </a>
                                <a
                                  href={document.chemin}
                                  download
                                  className="h-8 w-8 sm:h-9 sm:w-9 flex items-center justify-center rounded-md border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                  title="Télécharger"
                                >
                                  <Download className="h-4 w-4" />
                                </a>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDelete(document.id)}
                                  className="h-8 w-8 sm:h-9 sm:w-9 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                                  title="Supprimer"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  );
}

