"use client";

import { toast } from "react-toastify";
import { 
  CheckCircle2, 
  AlertCircle, 
  Info, 
  AlertTriangle,
  X
} from "lucide-react";
import React from "react";

// Types pour les options de toast
interface ToastOptions {
  duration?: number;
  position?: "top-right" | "top-left" | "bottom-right" | "bottom-left" | "top-center" | "bottom-center";
}

// Composant pour les toasts avec icônes
const ToastContent = ({ 
  message, 
  icon: Icon 
}: { 
  message: string; 
  icon: React.ComponentType<{ className?: string }> 
}) => (
  <div className="flex items-center gap-3">
    <Icon className="toast-icon" />
    <span className="flex-1">{message}</span>
  </div>
);

// Fonctions utilitaires pour les toasts
export const toastUtils = {
  // Toast de succès
  success: (message: string, options?: ToastOptions) => {
    return toast.success(
      <ToastContent message={message} icon={CheckCircle2} />,
      {
        autoClose: options?.duration || 5000,
        position: options?.position || "top-right",
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      }
    );
  },

  // Toast d'erreur
  error: (message: string, options?: ToastOptions) => {
    return toast.error(
      <ToastContent message={message} icon={AlertCircle} />,
      {
        autoClose: options?.duration || 7000,
        position: options?.position || "top-right",
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      }
    );
  },

  // Toast d'information
  info: (message: string, options?: ToastOptions) => {
    return toast.info(
      <ToastContent message={message} icon={Info} />,
      {
        autoClose: options?.duration || 5000,
        position: options?.position || "top-right",
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      }
    );
  },

  // Toast d'avertissement
  warning: (message: string, options?: ToastOptions) => {
    return toast.warning(
      <ToastContent message={message} icon={AlertTriangle} />,
      {
        autoClose: options?.duration || 6000,
        position: options?.position || "top-right",
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      }
    );
  },

  // Toast de chargement (ne se ferme pas automatiquement)
  loading: (message: string, options?: ToastOptions) => {
    return toast.info(
      <ToastContent message={message} icon={Info} />,
      {
        autoClose: false,
        position: options?.position || "top-right",
        hideProgressBar: true,
        closeOnClick: false,
        pauseOnHover: false,
        draggable: false,
      }
    );
  },

  // Fermer tous les toasts
  dismiss: () => {
    toast.dismiss();
  },

  // Fermer un toast spécifique
  dismissToast: (toastId: string | number) => {
    toast.dismiss(toastId);
  }
};

// Export des fonctions individuelles pour faciliter l'utilisation
export const { success, error, info, warning, loading, dismiss, dismissToast } = toastUtils;

// Export par défaut
export default toastUtils;
