"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera, Upload, X, Loader2, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { uploadFile } from "@/actions/user";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface PhotoUploadProps {
  currentImage?: string;
  userName?: string;
  onImageChange: (imageUrl: string) => void;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
  maxSize?: number; // en MB
}

export function PhotoUpload({ 
  currentImage, 
  userName, 
  onImageChange, 
  disabled = false,
  size = "md",
  maxSize = 5 // 5MB par défaut
}: PhotoUploadProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const sizeClasses = {
    sm: "h-16 w-16",
    md: "h-32 w-32", 
    lg: "h-40 w-40"
  };

  const iconSizes = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-5 w-5"
  };

  const handleFileSelect = async (file: File | null, inputRef: React.RefObject<HTMLInputElement>) => {
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

    // Fermer le popover
    setPopoverOpen(false);

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
      formData.append('folder', 'users');

      const result = await uploadFile(formData);

      if (result.success && result.url) {
        onImageChange(result.url);
        toast.success("Photo mise à jour avec succès !");
        setPreview(null); // Réinitialiser le preview après upload réussi
      } else {
        const errorMessage = result.message || result.error || 'Erreur lors de l\'upload';
        console.error('Erreur upload:', errorMessage, result);
        toast.error(errorMessage || "Erreur lors de l'ajout de la photo");
        setPreview(null);
      }
    } catch (error) {
      console.error('Erreur upload:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erreur lors de l\'upload de l\'image';
      toast.error(errorMessage);
      setPreview(null);
    } finally {
      setUploading(false);
      // Réinitialiser l'input pour permettre de sélectionner le même fichier
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  };

  const handleCameraInput = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    await handleFileSelect(file, cameraInputRef);
  };

  const handleGalleryInput = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    await handleFileSelect(file, galleryInputRef);
  };

  const handleRemoveImage = () => {
    setPreview(null);
    onImageChange("");
    if (cameraInputRef.current) {
      cameraInputRef.current.value = "";
    }
    if (galleryInputRef.current) {
      galleryInputRef.current.value = "";
    }
  };

  const displayImage = preview || currentImage;
  const initials = userName ? userName.charAt(0).toUpperCase() : "U";

  return (
    <div className="relative inline-block">
      <Avatar className={`${sizeClasses[size]} border-4 border-white shadow-2xl`}>
        <AvatarImage src={displayImage || ""} alt={userName || "Utilisateur"} />
        <AvatarFallback className={`${size === 'sm' ? 'text-lg' : size === 'md' ? 'text-2xl' : 'text-3xl'} bg-white text-gray-800`}>
          {initials}
        </AvatarFallback>
      </Avatar>
      
      {!disabled && (
        <>
          <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
            <PopoverTrigger asChild>
              <button
                disabled={uploading}
                className="absolute bottom-2 right-2 bg-white text-gray-800 rounded-full p-2 hover:bg-gray-100 transition-colors disabled:opacity-50 shadow-lg"
                title="Changer la photo"
                type="button"
              >
                {uploading ? (
                  <Loader2 className={`${iconSizes[size]} animate-spin`} />
                ) : (
                  <Camera className={iconSizes[size]} />
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent 
              className="w-56 p-2"
              align="end"
              side="top"
            >
              <div className="space-y-1">
                <button
                  onClick={() => {
                    cameraInputRef.current?.click();
                  }}
                  disabled={uploading}
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  type="button"
                >
                  <Camera className="h-4 w-4 text-blue-600" />
                  <span>Prendre une photo</span>
                </button>
                <button
                  onClick={() => {
                    galleryInputRef.current?.click();
                  }}
                  disabled={uploading}
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  type="button"
                >
                  <ImageIcon className="h-4 w-4 text-green-600" />
                  <span>Choisir depuis la galerie</span>
                </button>
              </div>
            </PopoverContent>
          </Popover>
          
          {displayImage && (
            <button
              onClick={handleRemoveImage}
              disabled={uploading}
              className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors disabled:opacity-50 shadow-lg"
              title="Supprimer la photo"
              type="button"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </>
      )}

      {/* Input pour la caméra */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleCameraInput}
        className="hidden"
        disabled={uploading}
        title="Prendre une photo avec la caméra"
      />

      {/* Input pour la galerie */}
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        onChange={handleGalleryInput}
        className="hidden"
        disabled={uploading}
        title="Choisir une photo depuis la galerie"
      />
    </div>
  );
}
