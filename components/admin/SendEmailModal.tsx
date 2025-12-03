"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { sendCustomEmailToAdherents } from "@/actions/user/send-email";
import { UserMultiSelectComboboxWithFilters } from "@/components/admin/UserMultiSelectComboboxWithFilters";
import { toast } from "sonner";
import { Mail, Loader2 } from "lucide-react";

interface User {
  id: string;
  name: string | null;
  email: string | null;
  status?: string | null;
  role?: string | null;
  adherent?: {
    firstname: string | null;
    lastname: string | null;
  } | null;
}

interface SendEmailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedUserIds?: string[]; // Optionnel : IDs pré-sélectionnés depuis le tableau
  selectedUsersCount?: number; // Optionnel : nombre d'utilisateurs pré-sélectionnés
  users?: User[]; // Liste des utilisateurs disponibles pour sélection dans le modal
}

export function SendEmailModal({
  open,
  onOpenChange,
  selectedUserIds = [],
  selectedUsersCount = 0,
  users = [],
}: SendEmailModalProps) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [userIds, setUserIds] = useState<string[]>(selectedUserIds);

  // Synchroniser userIds avec selectedUserIds quand le modal s'ouvre
  useEffect(() => {
    if (open && selectedUserIds.length > 0) {
      setUserIds(selectedUserIds);
    } else if (!open) {
      // Réinitialiser quand le modal se ferme
      setUserIds([]);
      setSubject("");
      setBody("");
    }
  }, [open, selectedUserIds]);

  const handleSend = async () => {
    if (!subject.trim()) {
      toast.error("L'objet de l'email est requis");
      return;
    }

    if (!body.trim()) {
      toast.error("Le corps de l'email est requis");
      return;
    }

    if (userIds.length === 0) {
      toast.error("Aucun destinataire sélectionné");
      return;
    }

    setIsSending(true);
    try {
      console.log(`[SendEmailModal] Début de l'envoi à ${userIds.length} destinataire(s)`);
      
      const result = await sendCustomEmailToAdherents({
        userIds: userIds,
        subject: subject.trim(),
        body: body.trim(),
      });

      console.log("[SendEmailModal] Résultat:", result);

      if (result.success) {
        toast.success(
          `${result.sentCount || 0} email(s) envoyé(s) avec succès${result.failedCount ? ` (${result.failedCount} échec(s))` : ""}`
        );
        // Réinitialiser le formulaire
        setSubject("");
        setBody("");
        setUserIds([]);
        onOpenChange(false);
      } else {
        const errorMessage = result.error || "Erreur lors de l'envoi des emails";
        console.error("[SendEmailModal] Erreur:", errorMessage);
        toast.error(errorMessage);
      }
    } catch (error: any) {
      console.error("[SendEmailModal] Exception:", error);
      const errorMessage = error?.message || error?.toString() || "Erreur lors de l'envoi des emails";
      toast.error(`Erreur: ${errorMessage}`);
    } finally {
      setIsSending(false);
    }
  };

  const handleCancel = () => {
    setSubject("");
    setBody("");
    setUserIds([]);
    onOpenChange(false);
  };

  // Filtrer les utilisateurs pour ne garder que ceux avec un adhérent
  const adherentsUsers = users.filter((user) => user.adherent);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-4 border-b border-gray-200 dark:border-gray-700">
          <DialogTitle className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Mail className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            Envoyer un email
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-2">
            Envoyez un email personnalisé à un ou plusieurs adhérents
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Sélection des destinataires */}
          {adherentsUsers.length > 0 && (
            <div>
              <Label htmlFor="userIds" className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300">
                Destinataire(s) <span className="text-red-500">*</span>
                <span className="text-gray-500 font-normal ml-1">(qui recevront l'email)</span>
              </Label>
              <div className="mt-1.5">
                <UserMultiSelectComboboxWithFilters
                  users={adherentsUsers}
                  value={userIds}
                  onValueChange={setUserIds}
                  placeholder="Rechercher et sélectionner des adhérents..."
                  disabled={isSending}
                  showAllOption={true}
                />
              </div>
              {userIds.length > 0 && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
                  {userIds.length === adherentsUsers.length
                    ? `Tous les adhérents sélectionnés (${userIds.length})`
                    : `${userIds.length} adhérent(s) sélectionné(s)`}
                </p>
              )}
              {selectedUserIds.length > 0 && selectedUsersCount > 0 && (
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1.5">
                  💡 {selectedUsersCount} adhérent(s) pré-sélectionné(s) depuis le tableau
                </p>
              )}
            </div>
          )}

          {/* Message si aucun utilisateur disponible */}
          {adherentsUsers.length === 0 && (
            <div className="rounded-md bg-yellow-50 dark:bg-yellow-900/20 p-3 text-sm text-yellow-800 dark:text-yellow-200">
              Aucun adhérent disponible pour l'envoi d'email.
            </div>
          )}

          <div>
            <Label htmlFor="email-subject" className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300">
              Objet <span className="text-red-500">*</span>
            </Label>
            <Input
              id="email-subject"
              placeholder="Ex: Information importante pour les adhérents"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={isSending}
              className="mt-1 text-sm h-9 sm:h-10"
              maxLength={255}
            />
          </div>

          <div>
            <Label htmlFor="email-body" className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300">
              Corps du message <span className="text-red-500">*</span>
              <span className="text-gray-500 font-normal ml-1">(contenu de l'email)</span>
            </Label>
            <Textarea
              id="email-body"
              placeholder="Rédigez votre message ici..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={8}
              disabled={isSending}
              className="mt-1 text-sm resize-none"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
              Les retours à la ligne seront préservés dans l'email. Vous pouvez utiliser du HTML pour formater le texte.
            </p>
          </div>
        </div>

        <DialogFooter className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isSending}
            className="text-sm"
          >
            Annuler
          </Button>
          <Button 
            onClick={handleSend} 
            disabled={isSending || !subject.trim() || !body.trim() || userIds.length === 0}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm"
          >
            {isSending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Envoi en cours...
              </>
            ) : (
              <>
                <Mail className="mr-2 h-4 w-4" />
                Envoyer {userIds.length > 0 && `(${userIds.length})`}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

