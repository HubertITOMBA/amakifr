"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, File, X, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { uploadDocument } from "@/actions/documents";
import { toast } from "sonner";
import { TypeDocument } from "@prisma/client";

interface DocumentUploadProps {
  onUploadSuccess?: (document: any) => void;
  onClose?: () => void;
  folder?: string;
  maxSize?: number; // en MB
  accept?: string;
  showCategory?: boolean;
  showDescription?: boolean;
  showPublicToggle?: boolean;
  adherentId?: string;
}

// Types de fichiers acceptés
const ALLOWED_MIME_TYPES = [
  // Images
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/bmp",
  "image/tiff",
  // Vidéos
  "video/mp4",
  "video/quicktime",
  "video/x-msvideo",
  "video/avi",
  // PDF
  "application/pdf",
  // Word
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  // Excel
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  // CSV
  "text/csv",
  "application/csv",
  // TXT
  "text/plain",
];

// Extensions acceptées pour l'attribut accept
const ACCEPT_EXTENSIONS = [
  ".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".tiff", // Images
  ".mp4", ".mov", ".avi", // Vidéos
  ".pdf", // PDF
  ".doc", ".docx", // Word
  ".xls", ".xlsx", // Excel
  ".csv", // CSV
  ".txt", // TXT
].join(",");

const getDocumentTypeFromMimeType = (mimeType: string): TypeDocument => {
  if (mimeType === "application/pdf") return TypeDocument.PDF;
  if (mimeType.startsWith("image/")) return TypeDocument.Image;
  if (mimeType.startsWith("video/")) return TypeDocument.Video;
  if (
    mimeType === "application/vnd.ms-excel" ||
    mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mimeType === "text/csv" ||
    mimeType === "application/csv"
  )
    return TypeDocument.Excel;
  if (
    mimeType === "application/msword" ||
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  )
    return TypeDocument.Word;
  return TypeDocument.Autre;
};

const getFileTypeLabel = (mimeType: string): string => {
  if (mimeType.startsWith("image/")) return "Image";
  if (mimeType.startsWith("video/")) return "Vidéo";
  if (mimeType === "application/pdf") return "PDF";
  if (mimeType === "text/plain") return "Texte";
  if (mimeType === "text/csv" || mimeType === "application/csv") return "CSV";
  if (mimeType.includes("excel") || mimeType.includes("spreadsheet")) return "Excel";
  if (mimeType.includes("word") || mimeType.includes("wordprocessing")) return "Word";
  return "Document";
};

// Catégories prédéfinies par type de document
const DOCUMENT_CATEGORIES: Record<TypeDocument, string[]> = {
  [TypeDocument.Image]: [
    "Photos",
    "Affiches",
    "Logos",
    "Illustrations",
    "Documents scannés",
    "Autres",
  ],
  [TypeDocument.Video]: [
    "Événements",
    "Tutoriels",
    "Présentations",
    "Interviews",
    "Documentaires",
    "Autres",
  ],
  [TypeDocument.PDF]: [
    "Factures",
    "Contrats",
    "Rapports",
    "Formulaires",
    "Procès-verbaux",
    "Statuts",
    "Règlements",
    "Autres",
  ],
  [TypeDocument.Word]: [
    "Lettres",
    "Rapports",
    "Procès-verbaux",
    "Correspondances",
    "Documents administratifs",
    "Autres",
  ],
  [TypeDocument.Excel]: [
    "Tableaux",
    "Statistiques",
    "Budgets",
    "Listes",
    "Calculs",
    "Autres",
  ],
  [TypeDocument.Autre]: [
    "Documents divers",
    "Archives",
    "Autres",
  ],
};

// Catégories pour CSV et TXT (qui sont détectés comme Excel ou Autre)
const CSV_CATEGORIES = [
  "Données",
  "Exports",
  "Statistiques",
  "Listes",
  "Autres",
];

const TXT_CATEGORIES = [
  "Notes",
  "Configurations",
  "Documentation",
  "Autres",
];

/**
 * Obtient les catégories disponibles selon le type de document
 */
const getCategoriesForDocumentType = (mimeType: string): string[] => {
  const docType = getDocumentTypeFromMimeType(mimeType);
  
  if (mimeType === "text/csv" || mimeType === "application/csv") {
    return CSV_CATEGORIES;
  }
  
  if (mimeType === "text/plain") {
    return TXT_CATEGORIES;
  }
  
  return DOCUMENT_CATEGORIES[docType] || DOCUMENT_CATEGORIES[TypeDocument.Autre];
};

export function DocumentUpload({
  onUploadSuccess,
  onClose,
  folder = "documents",
  maxSize = 50,
  accept = ACCEPT_EXTENSIONS,
  showCategory = true,
  showDescription = true,
  showPublicToggle = false,
  adherentId,
}: DocumentUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [categorie, setCategorie] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [estPublic, setEstPublic] = useState(false);
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);

      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleFileSelect(e.dataTransfer.files[0]);
      }
    },
    []
  );

  const handleFileSelect = (file: File) => {
    // Validation du type de fichier
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      const fileTypeLabel = getFileTypeLabel(file.type);
      const fileExtension = file.name.split('.').pop()?.toLowerCase() || 'inconnu';
      
      toast.error(
        `Type de fichier non pris en charge`,
        {
          description: `Le fichier "${file.name}" (${fileExtension}) n'est pas autorisé. Types acceptés : Images (JPG, PNG, GIF, etc.), Vidéos (MP4, MOV, AVI), PDF, Word (DOC, DOCX), Excel (XLS, XLSX), CSV, TXT.`,
          duration: 6000,
        }
      );
      return;
    }

    // Validation de la taille
    const maxSizeBytes = maxSize * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      toast.error(
        `Fichier trop volumineux`,
        {
          description: `Le fichier "${file.name}" dépasse la taille maximale de ${maxSize}MB.`,
          duration: 5000,
        }
      );
      return;
    }

    // Déterminer les catégories disponibles selon le type de fichier
    const categories = getCategoriesForDocumentType(file.type);
    setAvailableCategories(categories);
    
    // Réinitialiser la catégorie si elle n'est plus dans la liste
    if (categorie && !categories.includes(categorie)) {
      setCategorie("");
    }

    setSelectedFile(file);
    setUploadProgress(0);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error("Veuillez sélectionner un fichier");
      return;
    }

    try {
      setUploading(true);
      setUploadProgress(0);

      // Simuler la progression (dans un vrai cas, on utiliserait XMLHttpRequest avec onprogress)
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      const formData = new FormData();
      formData.append("file", selectedFile);
      if (categorie) {
        formData.append("categorie", categorie);
      }
      if (description) {
        formData.append("description", description);
      }
      formData.append("estPublic", estPublic.toString());
      if (adherentId) {
        formData.append("adherentId", adherentId);
      }

      const result = await uploadDocument(formData);

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (result.success && result.document) {
        toast.success("Document téléversé avec succès");
        setSelectedFile(null);
        setCategorie("");
        setDescription("");
        setEstPublic(false);
        setUploadProgress(0);
        setAvailableCategories([]);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        if (onUploadSuccess) {
          onUploadSuccess(result.document);
        }
      } else {
        const errorMessage = result.error || "Erreur lors du téléversement";
        toast.error(
          "Erreur lors du téléversement",
          {
            description: errorMessage,
            duration: 6000,
          }
        );
      }
    } catch (error) {
      console.error("Erreur upload:", error);
      toast.error(
        "Erreur lors du téléversement",
        {
          description: error instanceof Error ? error.message : "Une erreur inattendue s'est produite",
          duration: 6000,
        }
      );
    } finally {
      setUploading(false);
      setTimeout(() => setUploadProgress(0), 1000);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div className="space-y-4 overflow-x-hidden">
      {/* Zone de drag & drop */}
      <Card
        className={`border-2 border-dashed transition-all duration-200 ${
          dragActive
            ? "border-blue-500 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/20 shadow-lg"
            : "border-blue-300 dark:border-blue-700 hover:border-blue-400 dark:hover:border-blue-600 bg-white dark:bg-gray-800"
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <CardContent className="p-6 sm:p-8">
          <div className="flex flex-col items-center justify-center text-center">
            <div className={`p-4 rounded-full mb-4 transition-all duration-200 ${
              dragActive 
                ? "bg-blue-200 dark:bg-blue-800/50 scale-110" 
                : "bg-blue-100 dark:bg-blue-900/30"
            }`}>
              <Upload className={`h-8 w-8 sm:h-10 sm:w-10 transition-colors ${
                dragActive 
                  ? "text-blue-700 dark:text-blue-300" 
                  : "text-blue-600 dark:text-blue-400"
              }`} />
            </div>
            <h3 className={`text-base sm:text-lg font-semibold mb-2 transition-colors ${
              dragActive 
                ? "text-blue-700 dark:text-blue-300" 
                : "text-gray-900 dark:text-white"
            }`}>
              Glissez-déposez votre fichier ici
            </h3>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-2">
              ou cliquez pour sélectionner un fichier
            </p>
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg px-3 py-2 mb-4 max-w-md">
              <p className="text-xs font-medium text-blue-800 dark:text-blue-300 mb-1">
                Types de fichiers acceptés :
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-400">
                Images (JPG, PNG, GIF, WEBP), Vidéos (MP4, MOV, AVI), PDF, Word (DOC, DOCX), Excel (XLS, XLSX), CSV, TXT
              </p>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-500">
              Taille maximale : {maxSize}MB
            </p>
            <Button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className={`bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white text-sm h-9 sm:h-10 transition-all ${
                dragActive ? "scale-105 shadow-lg" : ""
              }`}
            >
              <File className="h-4 w-4 mr-2" />
              Sélectionner un fichier
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileInput}
              accept={accept}
            />
          </div>
        </CardContent>
      </Card>

      {/* Fichier sélectionné */}
      {selectedFile && (
        <Card className="border-blue-200 dark:border-blue-800 bg-gradient-to-br from-blue-50/50 to-white dark:from-blue-900/10 dark:to-gray-800 shadow-sm">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-start gap-3 sm:gap-4 min-w-0">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex-shrink-0">
                <File className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1 min-w-0 overflow-hidden">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <h4 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white truncate">
                      {selectedFile.name}
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 break-words">
                      {formatFileSize(selectedFile.size)} • {selectedFile.type}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedFile(null);
                      setUploadProgress(0);
                      setCategorie("");
                      setAvailableCategories([]);
                      if (fileInputRef.current) {
                        fileInputRef.current.value = "";
                      }
                    }}
                    className="h-8 w-8 p-0 flex-shrink-0"
                    disabled={uploading}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                {/* Barre de progression */}
                {uploading && (
                  <div className="mt-3 space-y-2">
                    <Progress value={uploadProgress} className="h-2 bg-gray-200 dark:bg-gray-700" />
                    <p className="text-xs text-gray-600 dark:text-gray-400 text-center font-medium">
                      Téléversement en cours... {uploadProgress}%
                    </p>
                  </div>
                )}

                {/* Options supplémentaires */}
                {!uploading && (
                  <div className="mt-4 space-y-3 sm:space-y-4">
                    {showCategory && (
                      <div className="min-w-0 space-y-1.5">
                        <Label 
                          htmlFor="categorie" 
                          className="block text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100 uppercase tracking-wide bg-slate-100 dark:bg-slate-700/50 px-2.5 py-1.5 rounded-t-md border-b border-slate-200 dark:border-slate-600"
                        >
                          Catégorie {selectedFile ? <span className="text-slate-500 dark:text-slate-400 font-normal normal-case">(optionnel)</span> : ""}
                        </Label>
                        {selectedFile && availableCategories.length > 0 ? (
                          <Select 
                            value={categorie || undefined} 
                            onValueChange={(value) => setCategorie(value || "")}
                          >
                            <SelectTrigger className="mt-0 text-sm h-9 sm:h-10 w-full bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 rounded-md rounded-tl-none shadow-sm focus:border-blue-500 dark:focus:border-blue-400">
                              <SelectValue placeholder="Sélectionner une catégorie (optionnel)" />
                            </SelectTrigger>
                            <SelectContent>
                              {availableCategories.map((cat) => (
                                <SelectItem key={cat} value={cat}>
                                  {cat}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            id="categorie"
                            value={categorie}
                            onChange={(e) => setCategorie(e.target.value)}
                            placeholder="Sélectionnez d'abord un fichier"
                            className="mt-0 text-sm h-9 sm:h-10 w-full bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 rounded-md rounded-tl-none shadow-sm focus:border-blue-500 dark:focus:border-blue-400"
                            disabled={!selectedFile}
                          />
                        )}
                        {selectedFile && availableCategories.length > 0 && (
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 px-2.5">
                            Catégories suggérées selon le type de document
                          </p>
                        )}
                      </div>
                    )}
                    {showDescription && (
                      <div className="min-w-0 space-y-1.5">
                        <Label 
                          htmlFor="description" 
                          className="block text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100 uppercase tracking-wide bg-slate-100 dark:bg-slate-700/50 px-2.5 py-1.5 rounded-t-md border-b border-slate-200 dark:border-slate-600"
                        >
                          Description <span className="text-slate-500 dark:text-slate-400 font-normal normal-case">(optionnel)</span>
                        </Label>
                        <Textarea
                          id="description"
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          placeholder="Description du document..."
                          rows={3}
                          className="mt-0 text-sm w-full resize-none bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 rounded-md rounded-tl-none shadow-sm focus:border-blue-500 dark:focus:border-blue-400"
                        />
                      </div>
                    )}
                    {showPublicToggle && (
                      <div className="space-y-1.5">
                        <Label 
                          htmlFor="estPublic" 
                          className="block text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100 uppercase tracking-wide bg-slate-100 dark:bg-slate-700/50 px-2.5 py-1.5 rounded-t-md border-b border-slate-200 dark:border-slate-600"
                        >
                          Visibilité
                        </Label>
                        <div className="flex items-start gap-2.5 flex-wrap bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-600 rounded-md rounded-tl-none shadow-sm px-3 py-2.5">
                          <input
                            type="checkbox"
                            id="estPublic"
                            checked={estPublic}
                            onChange={(e) => setEstPublic(e.target.checked)}
                            className="h-4 w-4 rounded border-2 border-slate-300 dark:border-slate-600 text-blue-600 dark:text-blue-400 focus:ring-blue-500 dark:focus:ring-blue-600 flex-shrink-0 mt-0.5"
                          />
                          <Label 
                            htmlFor="estPublic" 
                            className="text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-200 cursor-pointer flex-1 leading-relaxed"
                          >
                            Rendre ce document public <span className="text-slate-500 dark:text-slate-400 font-normal">(visible par les administrateurs)</span>
                          </Label>
                        </div>
                      </div>
                    )}

                    {/* Boutons d'action */}
                    <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 justify-end">
                      {onClose && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={onClose}
                          disabled={uploading}
                          className="w-full sm:w-auto border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm h-9 sm:h-10"
                        >
                          <X className="h-4 w-4 mr-2" />
                          Annuler
                        </Button>
                      )}
                      <Button
                        onClick={handleUpload}
                        disabled={uploading}
                        className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white text-sm h-9 sm:h-10"
                      >
                        {uploading ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Téléversement en cours...
                          </>
                        ) : (
                          <>
                            <Upload className="h-4 w-4 mr-2" />
                            Téléverser le document
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

