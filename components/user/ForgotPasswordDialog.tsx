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
import { Loader2, HelpCircle, Mail } from "lucide-react";
import { requestPasswordReset } from "@/actions/user/request-password-reset";
import { toast } from "react-toastify";

interface ForgotPasswordDialogProps {
  trigger?: React.ReactNode;
}

/**
 * Composant modal pour demander une réinitialisation de mot de passe à l'admin
 * Pour les utilisateurs non-MEMBRE qui ont oublié leur mot de passe
 * 
 * @param trigger - Élément déclencheur optionnel pour ouvrir le modal
 */
export function ForgotPasswordDialog({ trigger }: ForgotPasswordDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const result = await requestPasswordReset();

      if (result.success) {
        toast.success(result.message || "Votre demande a été envoyée aux administrateurs");
        setOpen(false);
      } else {
        toast.error(result.error || "Erreur lors de l'envoi de votre demande");
      }
    } catch (error) {
      console.error("Erreur lors de la demande de réinitialisation:", error);
      toast.error("Une erreur est survenue lors de l'envoi de votre demande");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!loading) {
      setOpen(newOpen);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <HelpCircle className="h-4 w-4 mr-2" />
            Mot de passe oublié
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5" />
            Mot de passe oublié
          </DialogTitle>
          <DialogDescription>
            Si vous avez oublié votre mot de passe, vous pouvez envoyer une demande de réinitialisation aux administrateurs.
            Ils vous contacteront pour vous aider à réinitialiser votre mot de passe.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Mail className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm text-blue-900 dark:text-blue-100 font-medium mb-1">
                  Comment ça fonctionne ?
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  Une notification sera envoyée à tous les administrateurs avec votre demande. 
                  L'un d'entre eux vous contactera pour réinitialiser votre mot de passe.
                </p>
              </div>
            </div>
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
                  Envoi en cours...
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4 mr-2" />
                  Envoyer la demande
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
