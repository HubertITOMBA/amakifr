"use client";

import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";
import { QrCode, Download, Share2, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "react-toastify";

/**
 * Composant pour afficher et partager le QR Code de l'application
 * 
 * Affiche un QR Code contenant l'URL de l'application pour faciliter le partage
 * sur les réseaux sociaux et permettre un accès rapide depuis un appareil mobile.
 */
export function QRCodeShare() {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);
  
  // Récupérer l'URL de l'application depuis les variables d'environnement
  const appUrl = typeof window !== "undefined" 
    ? window.location.origin 
    : process.env.NEXT_PUBLIC_APP_URL || "https://amaki.fr";

  /**
   * Copie l'URL dans le presse-papiers
   */
  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(appUrl);
      setCopied(true);
      toast.success("URL copiée dans le presse-papiers !");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Erreur lors de la copie:", error);
      toast.error("Erreur lors de la copie de l'URL");
    }
  };

  /**
   * Partage l'URL via l'API Web Share si disponible
   */
  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "AMAKI France - Portail de l'Amicale",
          text: "Rejoignez l'Amicale des Anciens Élèves de Kipaku en France",
          url: appUrl,
        });
        toast.success("Partage réussi !");
      } catch (error) {
        // L'utilisateur a annulé le partage
        if ((error as Error).name !== "AbortError") {
          console.error("Erreur lors du partage:", error);
          toast.error("Erreur lors du partage");
        }
      }
    } else {
      // Fallback : copier l'URL
      handleCopyUrl();
    }
  };

  /**
   * Télécharge le QR Code en tant qu'image SVG
   */
  const handleDownload = () => {
    try {
      const svg = document.getElementById("qr-code-svg");
      if (!svg) return;

      const svgData = new XMLSerializer().serializeToString(svg);
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const img = new Image();

      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx?.drawImage(img, 0, 0);
        
        const pngFile = canvas.toDataURL("image/png");
        const downloadLink = document.createElement("a");
        downloadLink.download = `amaki-qrcode-${new Date().getTime()}.png`;
        downloadLink.href = pngFile;
        downloadLink.click();
        
        toast.success("QR Code téléchargé !");
      };

      img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
    } catch (error) {
      console.error("Erreur lors du téléchargement:", error);
      toast.error("Erreur lors du téléchargement du QR Code");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="flex items-center gap-2 border-white/20 hover:bg-white/10 text-white hover:text-white dark:border-white/30 dark:hover:bg-white/20 backdrop-blur-sm"
        >
          <QrCode className="h-4 w-4" />
          <span className="hidden sm:inline">QR Code</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-blue-600" />
            Partager l'application
          </DialogTitle>
          <DialogDescription>
            Scannez ce QR Code pour accéder rapidement à l'application AMAKI France
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-col items-center space-y-4 py-4">
          {/* QR Code */}
          <div className="bg-white p-6 rounded-lg shadow-lg border-2 border-blue-200 dark:border-blue-800">
            <QRCodeSVG
              id="qr-code-svg"
              value={appUrl}
              size={300}
              level="H"
              includeMargin={true}
              fgColor="#1e40af"
              bgColor="#ffffff"
            />
          </div>
          
          {/* URL */}
          <div className="w-full">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-center">
              URL de l'application :
            </p>
            <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 rounded-lg p-2 border border-gray-200 dark:border-gray-700">
              <code className="flex-1 text-xs text-gray-600 dark:text-gray-400 truncate">
                {appUrl}
              </code>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyUrl}
                className="h-8 w-8 p-0"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
          
          {/* Actions */}
          <div className="flex gap-2 w-full">
            <Button
              onClick={handleShare}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Share2 className="h-4 w-4 mr-2" />
              Partager
            </Button>
            <Button
              onClick={handleDownload}
              variant="outline"
              className="flex-1"
            >
              <Download className="h-4 w-4 mr-2" />
              Télécharger
            </Button>
          </div>
          
          {/* Instructions */}
          <div className="text-xs text-gray-500 dark:text-gray-400 text-center space-y-1 pt-2 border-t border-gray-200 dark:border-gray-700">
            <p>📱 Scannez avec votre appareil photo</p>
            <p>🔗 Partagez sur les réseaux sociaux</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

