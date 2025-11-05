"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera, Upload, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { uploadFile } from "@/actions/user";

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
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      formData.append('folder', 'users');

      const result = await uploadFile(formData);

      if (result.success && result.url) {
        onImageChange(result.url);
        toast.success("Photo mise à jour avec succès !");
      } else {
        throw new Error(result.message || 'Erreur lors de l\'upload');
      }
    } catch (error) {
      console.error('Erreur upload:', error);
      toast.error("Erreur lors de l'upload de l'image");
      setPreview(null);
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveImage = () => {
    setPreview(null);
    onImageChange("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
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
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="absolute bottom-2 right-2 bg-white text-gray-800 rounded-full p-2 hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 className={`${iconSizes[size]} animate-spin`} />
            ) : (
              <Camera className={iconSizes[size]} />
            )}
          </button>
          
          {displayImage && (
            <button
              onClick={handleRemoveImage}
              disabled={uploading}
              className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors disabled:opacity-50"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
        disabled={uploading}
        title={`Format: JPG, PNG, GIF, WEBP • Taille max: ${maxSize}MB`}
      />
    </div>
  );
}
