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
  folder?: string;
  maxSize?: number; // en MB
  accept?: string;
  showCategory?: boolean;
  showDescription?: boolean;
  showPublicToggle?: boolean;
  adherentId?: string;
}

const getDocumentTypeFromMimeType = (mimeType: string): TypeDocument => {
  if (mimeType === "application/pdf") return TypeDocument.PDF;
  if (mimeType.startsWith("image/")) return TypeDocument.Image;
  if (mimeType.startsWith("video/")) return TypeDocument.Video;
  if (
    mimeType === "application/vnd.ms-excel" ||
    mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  )
    return TypeDocument.Excel;
  if (
    mimeType === "application/msword" ||
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  )
    return TypeDocument.Word;
  return TypeDocument.Autre;
};

export function DocumentUpload({
  onUploadSuccess,
  folder = "documents",
  maxSize = 50,
  accept = "*/*",
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
    // Validation de la taille
    const maxSizeBytes = maxSize * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      toast.error(`Le fichier dépasse la taille maximale de ${maxSize}MB`);
      return;
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
        toast.success("Document uploadé avec succès");
        setSelectedFile(null);
        setCategorie("");
        setDescription("");
        setEstPublic(false);
        setUploadProgress(0);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        if (onUploadSuccess) {
          onUploadSuccess(result.document);
        }
      } else {
        toast.error(result.error || "Erreur lors de l'upload");
      }
    } catch (error) {
      console.error("Erreur upload:", error);
      toast.error("Erreur lors de l'upload du document");
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
    <div className="space-y-4">
      {/* Zone de drag & drop */}
      <Card
        className={`border-2 border-dashed transition-colors ${
          dragActive
            ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
            : "border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600"
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <CardContent className="p-6 sm:p-8">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="p-4 bg-blue-100 dark:bg-blue-900/30 rounded-full mb-4">
              <Upload className="h-8 w-8 sm:h-10 sm:w-10 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Glissez-déposez votre fichier ici
            </h3>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-4">
              ou cliquez pour sélectionner un fichier
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500 mb-4">
              Taille maximale : {maxSize}MB
            </p>
            <Button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm h-9 sm:h-10"
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
        <Card className="border-gray-200 dark:border-gray-700">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-start gap-3 sm:gap-4">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex-shrink-0">
                <File className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white truncate">
                      {selectedFile.name}
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {formatFileSize(selectedFile.size)} • {selectedFile.type}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedFile(null);
                      setUploadProgress(0);
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
                    <Progress value={uploadProgress} className="h-2" />
                    <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                      Upload en cours... {uploadProgress}%
                    </p>
                  </div>
                )}

                {/* Options supplémentaires */}
                {!uploading && (
                  <div className="mt-4 space-y-3 sm:space-y-4">
                    {showCategory && (
                      <div>
                        <Label htmlFor="categorie" className="text-xs sm:text-sm">
                          Catégorie (optionnel)
                        </Label>
                        <Input
                          id="categorie"
                          value={categorie}
                          onChange={(e) => setCategorie(e.target.value)}
                          placeholder="Ex: Factures, Contrats, etc."
                          className="mt-1 text-sm h-9 sm:h-10"
                        />
                      </div>
                    )}
                    {showDescription && (
                      <div>
                        <Label htmlFor="description" className="text-xs sm:text-sm">
                          Description (optionnel)
                        </Label>
                        <Textarea
                          id="description"
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          placeholder="Description du document..."
                          rows={3}
                          className="mt-1 text-sm"
                        />
                      </div>
                    )}
                    {showPublicToggle && (
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="estPublic"
                          checked={estPublic}
                          onChange={(e) => setEstPublic(e.target.checked)}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <Label htmlFor="estPublic" className="text-xs sm:text-sm">
                          Rendre ce document public (visible par les administrateurs)
                        </Label>
                      </div>
                    )}

                    {/* Bouton d'upload */}
                    <Button
                      onClick={handleUpload}
                      disabled={uploading}
                      className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white text-sm h-9 sm:h-10"
                    >
                      {uploading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Upload en cours...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2" />
                          Uploader le document
                        </>
                      )}
                    </Button>
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

