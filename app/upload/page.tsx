"use client";

import { DynamicNavbar } from "@/components/home/DynamicNavbar";
import { Footer } from "@/components/home/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Upload, 
  File, 
  FileText, 
  Image, 
  Video, 
  Table,
  CheckCircle,
  X,
  Download,
  Trash2,
  Eye,
  AlertCircle
} from "lucide-react";
import { useState, useRef } from "react";
import { uploadFile } from "@/actions/user";

interface UploadedFile {
  id: string;
  name: string;
  originalName: string;
  size: number;
  type: string;
  url: string;
  uploadDate: Date;
}

const fileTypeIcons = {
  "application/pdf": FileText,
  "application/vnd.ms-excel": Table,
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": Table,
  "video/mp4": Video,
  "video/quicktime": Video,
  "image/jpeg": Image,
  "image/jpg": Image,
  "image/png": Image,
  "image/gif": Image,
  "image/webp": Image,
};

const fileTypeColors = {
  "application/pdf": "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  "application/vnd.ms-excel": "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  "video/mp4": "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  "video/quicktime": "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  "image/jpeg": "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  "image/jpg": "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  "image/png": "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  "image/gif": "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  "image/webp": "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
};

export default function UploadPage() {
  const [uploading, setUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileTypeIcon = (type: string) => {
    const IconComponent = fileTypeIcons[type as keyof typeof fileTypeIcons] || File;
    return IconComponent;
  };

  const getFileTypeColor = (type: string) => {
    return fileTypeColors[type as keyof typeof fileTypeColors] || "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
  };

  const handleFileUpload = async (file: File) => {
    setUploading(true);
    setError(null);
    setSuccess(null);

    console.log("Début de l'upload du fichier:", {
      name: file.name,
      size: file.size,
      type: file.type
    });

    // Validation côté client
    const allowedTypes = [
      "application/pdf",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "video/mp4",
      "video/quicktime",
      "video/x-msvideo",
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/webp",
      "image/bmp",
      "image/tiff"
    ];

    const allowedExtensions = ['.pdf', '.xls', '.xlsx', '.mp4', '.mov', '.avi', '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff'];
    const fileName = file.name.toLowerCase();
    const hasValidExtension = allowedExtensions.some(ext => fileName.endsWith(ext));

    if (!allowedTypes.includes(file.type) && !hasValidExtension) {
      setError(`Type de fichier non autorisé: ${file.type}. Types supportés: PDF, Excel, MP4, Images`);
      setUploading(false);
      return;
    }

    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      setError("Fichier trop volumineux (max 50MB)");
      setUploading(false);
      return;
    }

    try {
      // Upload du fichier avec Server Action
      const formData = new FormData();
      formData.append("file", file);

      console.log("Envoi de la requête vers uploadFile Server Action...");
      const result = await uploadFile(formData);

      console.log("Résultat de l'upload:", result);

      if (result.success && result.url) {
        const newFile: UploadedFile = {
          id: Date.now().toString(),
          name: result.originalName || file.name,
          originalName: result.originalName || file.name,
          size: result.size || file.size,
          type: result.type || file.type,
          url: result.url,
          uploadDate: new Date(),
        };

        setUploadedFiles(prev => [newFile, ...prev]);
        setSuccess(`Fichier "${result.originalName || file.name}" uploadé avec succès !`);
        
        // Effacer le message de succès après 5 secondes
        setTimeout(() => setSuccess(null), 5000);
      } else {
        setError(result.message || "Erreur lors de l'upload");
      }
    } catch (error) {
      console.error("Erreur détaillée upload:", error);
      setError(`Erreur lors de l'upload du fichier: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    } finally {
      setUploading(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0]);
    }
  };

  const removeFile = (id: string) => {
    setUploadedFiles(prev => prev.filter(file => file.id !== id));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
      <DynamicNavbar />
      
      {/* Hero Section */}
      <section className="relative py-20 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white">
        <div className="absolute inset-0 bg-black/20" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex justify-center mb-8">
            <div className="bg-white/20 backdrop-blur-sm rounded-full p-6 shadow-2xl">
              <Upload className="h-16 w-16 text-white" />
            </div>
          </div>
          <h1 className="text-4xl md:text-6xl font-bold mb-6 text-white drop-shadow-lg">
            Upload de Fichiers
          </h1>
          <p className="text-xl md:text-2xl mb-8 text-purple-100">
            Téléchargez vos documents, images, vidéos et fichiers
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Badge variant="secondary" className="bg-white/20 text-white border-white/30 text-lg px-6 py-3">
              <FileText className="h-5 w-5 mr-2" />
              PDF, Excel
            </Badge>
            <Badge variant="secondary" className="bg-white/20 text-white border-white/30 text-lg px-6 py-3">
              <Video className="h-5 w-5 mr-2" />
              Vidéos MP4
            </Badge>
            <Badge variant="secondary" className="bg-white/20 text-white border-white/30 text-lg px-6 py-3">
              <Image className="h-5 w-5 mr-2" />
              Images
            </Badge>
          </div>
        </div>
      </section>

      {/* Upload Section */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Upload Zone */}
            <Card className="p-8">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Upload className="h-6 w-6" />
                  <span>Zone d'Upload</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                    dragActive
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                      : "border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500"
                  }`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                >
                  <Upload className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <p className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    Glissez-déposez votre fichier ici
                  </p>
                  <p className="text-gray-500 dark:text-gray-400 mb-4">
                    ou cliquez pour sélectionner un fichier
                  </p>
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="mb-4"
                  >
                    {uploading ? "Upload en cours..." : "Sélectionner un fichier"}
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileInput}
                    className="hidden"
                    accept=".pdf,.xls,.xlsx,.mp4,.mov,.jpg,.jpeg,.png,.gif,.webp"
                  />
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Types supportés: PDF, Excel, MP4, Images (max 50MB)
                  </p>
                </div>

                {/* Messages d'erreur et succès */}
                {error && (
                  <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center space-x-2">
                    <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                    <span className="text-red-600 dark:text-red-400">{error}</span>
                  </div>
                )}

                {success && (
                  <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-center space-x-2">
                    <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                    <span className="text-green-600 dark:text-green-400">{success}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Fichiers uploadés */}
            <Card className="p-8">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <File className="h-6 w-6" />
                <span>Fichiers uploadés ({uploadedFiles.length})</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {uploadedFiles.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <File className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Aucun fichier uploadé</p>
                  </div>
                ) : (
                  <div className="space-y-4 max-h-96 overflow-y-auto">
                    {uploadedFiles.map((file) => {
                      const IconComponent = getFileTypeIcon(file.type);
                      const colorClass = getFileTypeColor(file.type);

                      return (
                        <div
                          key={file.id}
                          className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                        >
                          <div className="flex items-center space-x-3">
                            <div className={`p-2 rounded-lg ${colorClass}`}>
                              <IconComponent className="h-5 w-5" />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white">
                                {file.originalName}
                              </p>
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                {formatFileSize(file.size)} • {file.uploadDate.toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(file.url, '_blank')}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const link = document.createElement('a');
                                link.href = file.url;
                                link.download = file.originalName;
                                link.click();
                              }}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => removeFile(file.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
