"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, X, Image as ImageIcon, Loader2, Link as LinkIcon } from "lucide-react";
import { toast } from "sonner";
import { uploadFile } from "@/actions/user";
import { uploadEvenementImage } from "@/actions/evenements";
import Image from "next/image";

interface ImageUploadProps {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  folder?: string;
  maxSize?: number; // en MB
  accept?: string;
}

export function ImageUpload({
  value,
  onChange,
  label = "Image",
  folder = "evenements",
  maxSize = 10,
  accept = "image/*"
}: ImageUploadProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [inputMode, setInputMode] = useState<"url" | "upload">(value && value.startsWith("http") ? "url" : "upload");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validation du fichier
    if (!file.type.startsWith('image/')) {
      toast.error("Veuillez sélectionner un fichier image valide");
      return;
    }

    const maxSizeBytes = maxSize * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      toast.error(`L'image ne doit pas dépasser ${maxSize}MB`);
      return;
    }

    // Créer un aperçu local
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Upload du fichier
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (folder) {
        formData.append('folder', folder);
      }
      
      // Utiliser la fonction spécifique pour les événements si le folder est "evenements"
      const result = folder === "evenements" 
        ? await uploadEvenementImage(formData)
        : await uploadFile(formData);

      if (result.success && result.url) {
        onChange(result.url);
        setPreview(null); // Réinitialiser le preview après upload réussi
        toast.success("Image uploadée avec succès !");
      } else {
        throw new Error(result.message || 'Erreur lors de l\'upload');
      }
    } catch (error) {
      console.error('Erreur upload:', error);
      toast.error("Erreur lors de l'upload de l'image");
      setPreview(null);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleUrlChange = (url: string) => {
    onChange(url);
    if (url) {
      setPreview(url);
    } else {
      setPreview(null);
    }
  };

  const handleRemoveImage = () => {
    setPreview(null);
    onChange("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const displayImage = preview || value;

  return (
    <div className="space-y-2">
      <Label>
        {label}
        <span className="text-xs font-normal text-gray-500 dark:text-gray-400 ml-2">
          (Taille max: {maxSize}MB)
        </span>
      </Label>
      
      {/* Sélecteur de mode */}
      <div className="flex gap-2 mb-3">
        <Button
          type="button"
          variant={inputMode === "url" ? "default" : "outline"}
          size="sm"
          onClick={() => setInputMode("url")}
          className="flex-1"
        >
          <LinkIcon className="h-4 w-4 mr-2" />
          URL
        </Button>
        <Button
          type="button"
          variant={inputMode === "upload" ? "default" : "outline"}
          size="sm"
          onClick={() => setInputMode("upload")}
          className="flex-1"
        >
          <Upload className="h-4 w-4 mr-2" />
          Uploader
        </Button>
      </div>

      {/* Mode URL */}
      {inputMode === "url" && (
        <div className="space-y-2">
          <Input
            type="url"
            value={value}
            onChange={(e) => handleUrlChange(e.target.value)}
            placeholder="https://exemple.com/image.jpg"
            disabled={uploading}
          />
        </div>
      )}

      {/* Mode Upload */}
      {inputMode === "upload" && (
        <div className="space-y-2">
          <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-4 hover:border-blue-400 transition-colors">
            <input
              ref={fileInputRef}
              type="file"
              accept={accept}
              onChange={handleFileSelect}
              className="hidden"
              disabled={uploading}
            />
            <div className="flex flex-col items-center justify-center space-y-2">
              {uploading ? (
                <>
                  <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
                  <p className="text-sm text-gray-600 dark:text-gray-400">Upload en cours...</p>
                </>
              ) : displayImage ? (
                <div className="relative w-full">
                  <div className="relative aspect-video w-full rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800">
                    <Image
                      src={displayImage}
                      alt="Preview"
                      fill
                      className="object-contain"
                      sizes="(max-width: 768px) 100vw, 50vw"
                      unoptimized={displayImage.startsWith('/')}
                    />
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      disabled={uploading}
                      className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1.5 hover:bg-red-600 transition-colors disabled:opacity-50"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <ImageIcon className="h-10 w-10 text-gray-400" />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="mt-2"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Sélectionner une image
                  </Button>
                  <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                    Formats acceptés: JPG, PNG, GIF, WEBP • Taille maximale: <strong>{maxSize}MB</strong>
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Aperçu si URL saisie */}
      {inputMode === "url" && value && (
        <div className="relative w-full">
          <div className="relative aspect-video w-full rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 border">
            <Image
              src={value}
              alt="Preview"
              fill
              className="object-contain"
              sizes="(max-width: 768px) 100vw, 50vw"
              unoptimized={value.startsWith('/')}
              onError={() => {
                toast.error("Impossible de charger l'image depuis cette URL");
              }}
            />
            <button
              type="button"
              onClick={handleRemoveImage}
              className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1.5 hover:bg-red-600 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

