"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Lock, Eye, EyeOff } from "lucide-react";
import { changePassword } from "@/actions/user";
import { toast } from "react-toastify";

interface ChangePasswordDialogProps {
  trigger?: React.ReactNode;
}

/**
 * Composant modal pour changer le mot de passe de l'utilisateur connecté
 * 
 * @param trigger - Élément déclencheur optionnel pour ouvrir le modal
 */
export function ChangePasswordDialog({ trigger }: ChangePasswordDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState<{
    currentPassword?: string;
    newPassword?: string;
    confirmPassword?: string;
  }>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setLoading(true);

    try {
      // Validation côté client
      if (!formData.currentPassword) {
        setErrors({ currentPassword: "Le mot de passe actuel est requis" });
        setLoading(false);
        return;
      }

      if (!formData.newPassword || formData.newPassword.length < 6) {
        setErrors({ newPassword: "Le nouveau mot de passe doit contenir au moins 6 caractères" });
        setLoading(false);
        return;
      }

      if (formData.newPassword !== formData.confirmPassword) {
        setErrors({ confirmPassword: "Les mots de passe ne correspondent pas" });
        setLoading(false);
        return;
      }

      // Créer un FormData pour la Server Action
      const formDataToSend = new FormData();
      formDataToSend.append("currentPassword", formData.currentPassword);
      formDataToSend.append("newPassword", formData.newPassword);
      formDataToSend.append("confirmPassword", formData.confirmPassword);

      const result = await changePassword(formDataToSend);

      if (result.success) {
        toast.success(result.message || "Mot de passe modifié avec succès");
        setFormData({
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        });
        setOpen(false);
      } else {
        toast.error(result.error || "Erreur lors du changement de mot de passe");
        // Afficher l'erreur dans le champ approprié si possible
        if (result.error?.includes("actuel")) {
          setErrors({ currentPassword: result.error });
        } else if (result.error?.includes("nouveau")) {
          setErrors({ newPassword: result.error });
        } else if (result.error?.includes("correspond")) {
          setErrors({ confirmPassword: result.error });
        }
      }
    } catch (error) {
      console.error("Erreur lors du changement de mot de passe:", error);
      toast.error("Une erreur est survenue lors du changement de mot de passe");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!loading) {
      setOpen(newOpen);
      if (!newOpen) {
        // Réinitialiser le formulaire quand le modal se ferme
        setFormData({
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        });
        setErrors({});
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Lock className="h-4 w-4 mr-2" />
            Changer le mot de passe
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Changer le mot de passe
          </DialogTitle>
          <DialogDescription>
            Saisissez votre mot de passe actuel et votre nouveau mot de passe pour le modifier.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Mot de passe actuel */}
          <div className="space-y-2">
            <Label htmlFor="currentPassword" className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1 sm:gap-2 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-t-md">
              Mot de passe actuel *
            </Label>
            <div className="relative">
              <Input
                id="currentPassword"
                type={showCurrentPassword ? "text" : "password"}
                value={formData.currentPassword}
                onChange={(e) => {
                  setFormData({ ...formData, currentPassword: e.target.value });
                  if (errors.currentPassword) {
                    setErrors({ ...errors, currentPassword: undefined });
                  }
                }}
                className={`bg-blue-50 dark:bg-slate-800 rounded-md rounded-tl-none border border-blue-200 dark:border-slate-600 text-xs font-medium text-slate-900 dark:text-slate-100 shadow-sm pr-10 ${
                  errors.currentPassword ? "border-red-500" : ""
                }`}
                placeholder="Saisissez votre mot de passe actuel"
                disabled={loading}
                required
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                tabIndex={-1}
              >
                {showCurrentPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            {errors.currentPassword && (
              <p className="text-xs text-red-600 dark:text-red-400">{errors.currentPassword}</p>
            )}
          </div>

          {/* Nouveau mot de passe */}
          <div className="space-y-2">
            <Label htmlFor="newPassword" className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1 sm:gap-2 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-t-md">
              Nouveau mot de passe *
            </Label>
            <div className="relative">
              <Input
                id="newPassword"
                type={showNewPassword ? "text" : "password"}
                value={formData.newPassword}
                onChange={(e) => {
                  setFormData({ ...formData, newPassword: e.target.value });
                  if (errors.newPassword) {
                    setErrors({ ...errors, newPassword: undefined });
                  }
                }}
                className={`bg-blue-50 dark:bg-slate-800 rounded-md rounded-tl-none border border-blue-200 dark:border-slate-600 text-xs font-medium text-slate-900 dark:text-slate-100 shadow-sm pr-10 ${
                  errors.newPassword ? "border-red-500" : ""
                }`}
                placeholder="Saisissez votre nouveau mot de passe (min. 6 caractères)"
                disabled={loading}
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                tabIndex={-1}
              >
                {showNewPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            {errors.newPassword && (
              <p className="text-xs text-red-600 dark:text-red-400">{errors.newPassword}</p>
            )}
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Le mot de passe doit contenir au moins 6 caractères.
            </p>
          </div>

          {/* Confirmation du mot de passe */}
          <div className="space-y-2">
            <Label htmlFor="confirmPassword" className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1 sm:gap-2 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-t-md">
              Confirmer le nouveau mot de passe *
            </Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                value={formData.confirmPassword}
                onChange={(e) => {
                  setFormData({ ...formData, confirmPassword: e.target.value });
                  if (errors.confirmPassword) {
                    setErrors({ ...errors, confirmPassword: undefined });
                  }
                }}
                className={`bg-blue-50 dark:bg-slate-800 rounded-md rounded-tl-none border border-blue-200 dark:border-slate-600 text-xs font-medium text-slate-900 dark:text-slate-100 shadow-sm pr-10 ${
                  errors.confirmPassword ? "border-red-500" : ""
                }`}
                placeholder="Confirmez votre nouveau mot de passe"
                disabled={loading}
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                tabIndex={-1}
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="text-xs text-red-600 dark:text-red-400">{errors.confirmPassword}</p>
            )}
          </div>

          {/* Boutons d'action */}
          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={loading}
              className="bg-slate-50 hover:bg-slate-100 border-slate-300 text-slate-700 hover:text-slate-900 text-xs sm:text-sm shadow-sm"
            >
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm shadow-sm"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4 mr-2" />
                  Enregistrer
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

