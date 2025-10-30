"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, X, Image as ImageIcon, Loader2, Plus, Link as LinkIcon } from "lucide-react";
import { toast } from "react-hot-toast";
import { uploadFile } from "@/actions/user";
import { uploadEvenementImage } from "@/actions/evenements";
import Image from "next/image";

interface ImagesUploadProps {
  value: string[]; // Array of URLs
  onChange: (urls: string[]) => void;
  label?: string;
  folder?: string;
  maxSize?: number; // en MB
  accept?: string;
}

export function ImagesUpload({
  value = [],
  onChange,
  label = "Images supplémentaires",
  folder = "evenements",
  maxSize = 10,
  accept = "image/*"
}: ImagesUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [inputMode, setInputMode] = useState<"url" | "upload">("upload");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    setUploading(true);
    const uploadedUrls: string[] = [];

    try {
      for (const file of files) {
        // Validation du fichier
        if (!file.type.startsWith('image/')) {
          toast.error(`${file.name} n'est pas une image valide`);
          continue;
        }

        const maxSizeBytes = maxSize * 1024 * 1024;
        if (file.size > maxSizeBytes) {
          toast.error(`${file.name} dépasse ${maxSize}MB`);
          continue;
        }

        const formData = new FormData();
        formData.append('file', file);

        // Utiliser la fonction spécifique pour les événements si le folder est "evenements"
        const result = folder === "evenements"
          ? await uploadEvenementImage(formData)
          : await uploadFile(formData);

        if (result.success && result.url) {
          uploadedUrls.push(result.url);
        } else {
          toast.error(`Erreur lors de l'upload de ${file.name}`);
        }
      }

      if (uploadedUrls.length > 0) {
        onChange([...value, ...uploadedUrls]);
        toast.success(`${uploadedUrls.length} image(s) uploadée(s) avec succès !`);
      }
    } catch (error) {
      console.error('Erreur upload:', error);
      toast.error("Erreur lors de l'upload des images");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleAddUrl = () => {
    if (!urlInput.trim()) {
      toast.error("Veuillez saisir une URL valide");
      return;
    }

    // Vérifier si l'URL est déjà dans la liste
    if (value.includes(urlInput.trim())) {
      toast.error("Cette URL est déjà dans la liste");
      return;
    }

    onChange([...value, urlInput.trim()]);
    setUrlInput("");
    toast.success("URL ajoutée avec succès");
  };

  const handleRemoveImage = (index: number) => {
    const newImages = value.filter((_, i) => i !== index);
    onChange(newImages);
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      
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
          <div className="flex gap-2">
            <Input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://exemple.com/image.jpg"
              disabled={uploading}
              onKeyPress={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddUrl();
                }
              }}
            />
            <Button
              type="button"
              onClick={handleAddUrl}
              disabled={uploading || !urlInput.trim()}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
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
              multiple
              className="hidden"
              disabled={uploading}
            />
            <div className="flex flex-col items-center justify-center space-y-2">
              {uploading ? (
                <>
                  <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
                  <p className="text-sm text-gray-600 dark:text-gray-400">Upload en cours...</p>
                </>
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
                    Sélectionner des images
                  </Button>
                  <p className="text-xs text-gray-500 text-center">
                    Formats acceptés: JPG, PNG, GIF, WEBP (max {maxSize}MB)
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Liste des images */}
      {value.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-4">
          {value.map((url, index) => (
            <div key={index} className="relative group">
              <div className="relative aspect-square w-full rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 border">
                <Image
                  src={url}
                  alt={`Image ${index + 1}`}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 50vw, 25vw"
                  onError={() => {
                    toast.error(`Impossible de charger l'image ${index + 1}`);
                  }}
                />
                <button
                  type="button"
                  onClick={() => handleRemoveImage(index)}
                  className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1.5 hover:bg-red-600 transition-colors opacity-0 group-hover:opacity-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

