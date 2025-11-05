"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { sendCustomEmailToAdherents } from "@/actions/user/send-email";
import { toast } from "sonner";
import { Mail, Loader2 } from "lucide-react";

interface SendEmailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedUserIds: string[];
  selectedUsersCount: number;
}

export function SendEmailModal({
  open,
  onOpenChange,
  selectedUserIds,
  selectedUsersCount,
}: SendEmailModalProps) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [isSending, setIsSending] = useState(false);

  const handleSend = async () => {
    if (!subject.trim()) {
      toast.error("L'objet de l'email est requis");
      return;
    }

    if (!body.trim()) {
      toast.error("Le corps de l'email est requis");
      return;
    }

    if (selectedUserIds.length === 0) {
      toast.error("Aucun destinataire sélectionné");
      return;
    }

    setIsSending(true);
    try {
      const result = await sendCustomEmailToAdherents({
        userIds: selectedUserIds,
        subject: subject.trim(),
        body: body.trim(),
      });

      if (result.success) {
        toast.success(
          `${result.sentCount || 0} email(s) envoyé(s) avec succès${result.failedCount ? ` (${result.failedCount} échec(s))` : ""}`
        );
        // Réinitialiser le formulaire
        setSubject("");
        setBody("");
        onOpenChange(false);
      } else {
        toast.error(result.error || "Erreur lors de l'envoi des emails");
      }
    } catch (error: any) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de l'envoi des emails");
    } finally {
      setIsSending(false);
    }
  };

  const handleCancel = () => {
    setSubject("");
    setBody("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Envoyer un email
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="rounded-md bg-blue-50 dark:bg-blue-900/20 p-3 text-sm text-blue-800 dark:text-blue-200">
            <strong>{selectedUsersCount}</strong> destinataire{selectedUsersCount > 1 ? "s" : ""} sélectionné{selectedUsersCount > 1 ? "s" : ""}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email-subject">
              Objet <span className="text-red-500">*</span>
            </Label>
            <Input
              id="email-subject"
              placeholder="Objet de l'email"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={isSending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email-body">
              Corps du message <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="email-body"
              placeholder="Corps de l'email..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={10}
              disabled={isSending}
              className="resize-none"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Les retours à la ligne seront préservés dans l'email.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isSending}
          >
            Annuler
          </Button>
          <Button onClick={handleSend} disabled={isSending || !subject.trim() || !body.trim()}>
            {isSending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Envoi en cours...
              </>
            ) : (
              <>
                <Mail className="mr-2 h-4 w-4" />
                Envoyer
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

