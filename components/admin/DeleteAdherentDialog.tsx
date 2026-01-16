"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { adminDeleteAdherent } from "@/actions/user/admin-delete-adherent";

interface DeleteAdherentDialogProps {
  userId: string;
  userName: string;
  userEmail?: string | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
}

/**
 * Dialogue de confirmation pour la suppression définitive d'un adhérent
 * 
 * Fonctionnalités :
 * - Double confirmation (checkbox + raison obligatoire)
 * - Raison prédéfinie ou personnalisée
 * - Option d'envoi d'email à l'adhérent
 * - Avertissements clairs sur l'irréversibilité
 * 
 * @param userId - L'ID de l'utilisateur à supprimer
 * @param userName - Le nom de l'utilisateur
 * @param userEmail - L'email de l'utilisateur (pour l'envoi de notification)
 * @param open - État contrôlé pour l'ouverture du dialogue (optionnel)
 * @param onOpenChange - Callback pour gérer les changements d'état (optionnel)
 * @param trigger - Élément personnalisé pour déclencher le dialogue (optionnel)
 */
export function DeleteAdherentDialog({ 
  userId, 
  userName, 
  userEmail,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  trigger
}: DeleteAdherentDialogProps) {
  const router = useRouter();
  const [internalOpen, setInternalOpen] = useState(false);
  
  // Utiliser l'état contrôlé si fourni, sinon utiliser l'état interne
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = controlledOnOpenChange || setInternalOpen;
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [notifyUser, setNotifyUser] = useState(true);
  const [reasonType, setReasonType] = useState<string>("custom");
  const [customReason, setCustomReason] = useState("");

  // Réinitialiser l'état quand le dialogue se ferme
  useEffect(() => {
    if (!open) {
      setConfirmed(false);
      setCustomReason("");
      setReasonType("custom");
      setNotifyUser(true);
      setIsDeleting(false);
    }
  }, [open]);

  const predefinedReasons = [
    { value: "rgpd", label: "Demande RGPD - Droit à l'oubli" },
    { value: "duplicate", label: "Compte en double / Erreur de création" },
    { value: "inactive", label: "Compte inactif - Demande de l'adhérent" },
    { value: "force_majeure", label: "Force majeure / Circonstances exceptionnelles" },
    { value: "rules_violation", label: "Non-respect du règlement intérieur" },
    { value: "custom", label: "Autre raison (à préciser)" },
  ];

  const getReason = () => {
    if (reasonType === "custom") {
      return customReason.trim();
    }
    const selected = predefinedReasons.find(r => r.value === reasonType);
    return selected ? selected.label : "";
  };

  const isReasonValid = () => {
    const reason = getReason();
    return reason.length >= 10; // Minimum 10 caractères
  };

  const handleDelete = async () => {
    if (!confirmed) {
      toast.error("Vous devez confirmer la suppression en cochant la case");
      return;
    }

    if (!isReasonValid()) {
      toast.error("Veuillez fournir une raison d'au moins 10 caractères");
      return;
    }

    setIsDeleting(true);

    try {
      const reason = getReason();
      const result = await adminDeleteAdherent(userId, reason, notifyUser);

      if (result.success) {
        toast.success(result.message);
        setOpen(false);
        // Réinitialiser l'état interne
        setConfirmed(false);
        setCustomReason("");
        setReasonType("custom");
        setNotifyUser(true);
        router.refresh();
      } else {
        toast.error(result.error || "Erreur lors de la suppression");
      }
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Une erreur s'est produite lors de la suppression");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      {trigger ? (
        <AlertDialogTrigger asChild>
          {trigger}
        </AlertDialogTrigger>
      ) : (
        <AlertDialogTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 hover:bg-red-50 dark:hover:bg-red-900/20"
            title="Supprimer définitivement"
          >
            <Trash2 className="h-4 w-4 text-red-600 dark:text-red-400" />
          </Button>
        </AlertDialogTrigger>
      )}
      <AlertDialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            Suppression définitive de l'adhérent
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4 mt-4">
              {/* Avertissement principal */}
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <div className="space-y-2">
                    <p className="font-semibold text-red-900 dark:text-red-100">
                      ⚠️ Action irréversible et définitive
                    </p>
                    <p className="text-sm text-red-800 dark:text-red-200">
                      Vous êtes sur le point de supprimer <strong>{userName}</strong> et toutes ses données.
                    </p>
                  </div>
                </div>
              </div>

              {/* Liste des données supprimées */}
              <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4">
                <p className="font-semibold text-sm mb-3 text-slate-900 dark:text-slate-100">
                  🗑️ Données qui seront supprimées définitivement :
                </p>
                <ul className="text-sm text-slate-700 dark:text-slate-300 space-y-1.5 ml-4">
                  <li>• Compte utilisateur et identifiants de connexion</li>
                  <li>• Informations personnelles de l'adhérent</li>
                  <li>• Adresses et numéros de téléphone</li>
                  <li>• Historique complet des cotisations et paiements</li>
                  <li>• Votes, candidatures et positions électorales</li>
                  <li>• Messages, conversations et notifications</li>
                  <li>• Documents, réservations et inscriptions</li>
                  <li>• Idées, commentaires et approbations</li>
                  <li>• Assistances reçues et dettes</li>
                  <li>• Tout autre historique lié au compte</li>
                </ul>
              </div>

              {/* Raison de la suppression */}
              <div className="space-y-3">
                <Label className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  📋 Raison de la suppression *
                </Label>
                <Select value={reasonType} onValueChange={setReasonType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionnez une raison" />
                  </SelectTrigger>
                  <SelectContent>
                    {predefinedReasons.map((reason) => (
                      <SelectItem key={reason.value} value={reason.value}>
                        {reason.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {reasonType === "custom" && (
                  <div className="space-y-2">
                    <Textarea
                      placeholder="Décrivez la raison de la suppression (minimum 10 caractères)..."
                      value={customReason}
                      onChange={(e) => setCustomReason(e.target.value)}
                      className="min-h-[80px] resize-none"
                      maxLength={500}
                    />
                    <p className="text-xs text-slate-500">
                      {customReason.length}/500 caractères
                      {customReason.length < 10 && customReason.length > 0 && 
                        <span className="text-red-600 ml-2">
                          (minimum 10 caractères requis)
                        </span>
                      }
                    </p>
                  </div>
                )}
              </div>

              {/* Option de notification */}
              {userEmail && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="notify-user"
                      checked={notifyUser}
                      onCheckedChange={(checked) => setNotifyUser(checked as boolean)}
                      className="mt-0.5"
                    />
                    <div className="flex-1">
                      <Label
                        htmlFor="notify-user"
                        className="text-sm font-medium cursor-pointer text-blue-900 dark:text-blue-100"
                      >
                        📧 Notifier l'adhérent par email
                      </Label>
                      <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                        Un email sera envoyé à <strong>{userEmail}</strong> pour l'informer
                        de la suppression de son compte et de ses données.
                      </p>
                      <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                        💡 Décochez cette option uniquement pour les comptes mal créés ou
                        les cas où la notification n'est pas pertinente.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Confirmation finale */}
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="confirm-delete"
                    checked={confirmed}
                    onCheckedChange={(checked) => setConfirmed(checked as boolean)}
                    className="mt-0.5"
                  />
                  <Label
                    htmlFor="confirm-delete"
                    className="text-sm font-medium cursor-pointer text-yellow-900 dark:text-yellow-100"
                  >
                    ✅ Je comprends que cette action est <strong>irréversible</strong> et
                    supprimera <strong>définitivement</strong> toutes les données de{" "}
                    <strong>{userName}</strong>
                  </Label>
                </div>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>
            Annuler
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={!confirmed || !isReasonValid() || isDeleting}
            className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
          >
            {isDeleting ? (
              <>
                <span className="animate-spin mr-2">⏳</span>
                Suppression en cours...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                Supprimer définitivement
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
